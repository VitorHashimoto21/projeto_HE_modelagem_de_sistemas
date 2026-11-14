import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { normalizarNome } from "@/lib/dominio/catalogo";
import { codigoEmUsoAoReativar, MENSAGENS_CATALOGO, type DadosDoItem } from "@/lib/catalogo/validacao";
import { hoje as hojeLocal, diaLocal } from "@/lib/dominio/datas";
import { competenciaBrasileira } from "@/lib/dominio/financeiro";
import { MENSAGENS_FLUXO_FINANCEIRO } from "@/lib/financeiro/servicos";
import { CORRECOES_PERMITIDAS, dentroDoPrazoDeDesfazer, MENSAGENS_DAS_CORRECOES as M, moduloDaCorrecao, type IdDaCorrecao } from "@/lib/dominio/correcoes";
import { ROTULO_MODULO } from "@/lib/dominio/permissoes";
import { MENSAGENS_DA_SUSPENSAO } from "@/lib/dominio/suspensao";
import {
  CodigoEmUso,
  CodigoEmUsoAoReativar,
  criarConsultasDoCatalogo,
  ItemNaoEncontrado,
  NcmForaDaTabela,
  NcmObrigatorio,
  NomeDuplicado,
  SubcategoriaInvalida,
  SubcategoriaNaoEncontrada,
  SubcategoriaRepetida,
} from "./catalogo";
import { comNegocio, type ClienteDoNegocio } from "./cliente-do-negocio";
import { criarConsultasDoEstoque, EstoqueInsuficiente, ItemArquivado } from "./estoque";
import { ClienteNaoEncontrado } from "./clientes";
import { FornecedorNaoEncontrado } from "./fornecedores";
import {
  ContaEncerrada,
  ContaNaoEditavel,
  ContaNaoEncontrada,
  criarConsultasFinanceiras,
  DasNaoEditavel,
  DespesaNaoEncontrada,
  JaEstornado,
  LancamentoNaoEncontrado,
  type DadosDeConta,
} from "./financeiro";
import { criarConsultasDePrecificacao } from "./precificacao";

/**
 * Correções em modo suporte (SPEC-019, 5.3 a 5.5). Cada correção roda numa **única transação**: a ação
 * do suporte, pelas mesmas funções e validações de um membro, e o evento `CORRECAO` com o antes e o
 * depois (INV-004). Se o registro falhar, a correção não acontece. O desfazer do Dono é uma operação
 * nova, na mesma transação do evento `CORRECAO_DESFEITA`, e só se o estado atual for o "depois" (INV-005).
 */

// ------------------------------------------------------------------ transação única da correção

type ClienteDaTransacao = ClienteDoNegocio;
type Loja = { negocioId: string; cliente: ClienteDaTransacao };

/**
 * Enquanto a correção roda, o cliente do negócio desse negócio é o da transação (lido por
 * `clienteDoNegocio`). Fora dela, nada muda: o contexto de suporte continua só de leitura.
 */
export const transacaoDaCorrecao = new AsyncLocalStorage<Loja>();

let savepoints = 0;

/**
 * A camada de dados abre as próprias transações (`$transaction`). Dentro da transação da correção,
 * cada uma vira um savepoint: um erro esperado (código repetido, saldo insuficiente) desfaz só aquele
 * passo, como antes, e a transação externa continua utilizável para traduzir o erro.
 */
export function achatar<T extends object>(tx: T): T {
  const bruto = tx as unknown as { $executeRawUnsafe: (sql: string) => Promise<number> };
  const proxy: T = new Proxy(tx, {
    get(alvo, prop) {
      if (prop === "$transaction") {
        return async (arg: unknown) => {
          if (typeof arg === "function") {
            const nome = `he_correcao_${++savepoints}`;
            await bruto.$executeRawUnsafe(`SAVEPOINT ${nome}`);
            try {
              const r = await (arg as (c: T) => Promise<unknown>)(proxy);
              await bruto.$executeRawUnsafe(`RELEASE SAVEPOINT ${nome}`);
              return r;
            } catch (e) {
              await bruto.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${nome}`);
              throw e;
            }
          }
          const resultados: unknown[] = [];
          for (const p of arg as Promise<unknown>[]) resultados.push(await p);
          return resultados;
        };
      }
      const valor = Reflect.get(alvo, prop);
      return typeof valor === "function" ? valor.bind(alvo) : valor;
    },
  });
  return proxy;
}

// ------------------------------------------------------------------ o antes e o depois

/** Estado do registro afetado: só os campos que a correção pode mudar, nunca dados pessoais (INV-009). */
export type Estado = Record<string, unknown> | null;

const texto = (v: unknown) => (v === null || v === undefined ? null : String(v));
const decimal = (v: unknown) => (v === null || v === undefined ? null : new Prisma.Decimal(String(v)).toFixed(2));
const quantidade = (v: unknown) => (v === null || v === undefined ? null : new Prisma.Decimal(String(v)).toFixed(3));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const doFormulario = (args: unknown[], campo: string): string | null => {
  const form = args.find((a): a is FormData => a instanceof FormData);
  const v = form?.get(campo);
  return typeof v === "string" && UUID.test(v) ? v : null;
};

/**
 * Campos só de exibição: o nome da subcategoria e o do item da movimentação ajudam o Dono a ler, mas
 * não contam na conferência (podem mudar à parte, sem mexer no registro corrigido).
 */
const SO_EXIBICAO = new Set(["subcategoria", "item", "geradas"]);

/** Os materiais contam pelo id e pela quantidade; o nome do material é só para ler. */
function comparavel(chave: string, valor: unknown): unknown {
  if (chave === "materiais" && Array.isArray(valor)) return (valor as { materialId: string; quantidade: string }[]).map((m) => ({ materialId: m.materialId, quantidade: m.quantidade }));
  return valor ?? null;
}
const igual = (chave: string, a: unknown, b: unknown) => JSON.stringify(comparavel(chave, a)) === JSON.stringify(comparavel(chave, b));

/**
 * O antes e o depois só dos campos que a correção mudou (5.3, item 4). Na criação, o registro criado
 * inteiro. null quando nada mudou (erro de validação, mesmo valor): aí nada é registrado.
 */
export function diferenca(antes: Estado, depois: Estado): { antes: Estado; depois: Estado } | null {
  if (antes === null && depois === null) return null;
  if (antes === null || depois === null) return { antes, depois };
  const mudou = (k: string) => !igual(k, antes[k], depois[k]);
  const chaves = Object.keys(depois).filter((k) => !SO_EXIBICAO.has(k) && mudou(k));
  if (chaves.length === 0) return null;
  // Os campos de exibição que mudaram junto vão para o Dono ler: o nome da subcategoria trocada, as
  // contas que a despesa fixa gerou na correção (OPEN-015).
  const com = [...chaves, ...Object.keys(depois).filter((k) => SO_EXIBICAO.has(k) && mudou(k))];
  const recorte = (e: Record<string, unknown>) => Object.fromEntries(com.filter((k) => k in e).map((k) => [k, e[k]]));
  return { antes: recorte(antes), depois: recorte(depois) };
}

/** O estado atual ainda é o "depois" gravado, nos campos que a correção mudou (INV-005). */
export function confere(atual: Estado, depois: Estado): boolean {
  if (depois === null) return atual === null;
  if (atual === null) return false;
  return Object.keys(depois).every((k) => SO_EXIBICAO.has(k) || igual(k, atual[k], depois[k]));
}

/** Erro do desfazer, com a mensagem para o Dono (5.5, item 4). */
export class DesfazerRecusado extends Error {
  constructor(public readonly mensagem: string) {
    super(mensagem);
    this.name = "DesfazerRecusado";
  }
}

type ContextoDoDesfazer = { cliente: ClienteDaTransacao; negocioId: string; donoId: string; agora: Date; hoje: string };

type Definicao = {
  /** O registro afetado, lido do formulário antes da ação (edições), ou o próprio negócio (parâmetros). */
  alvo?: (args: unknown[], negocioId: string) => string | null;
  /** Nas criações: um marcador antes da ação e o registro criado depois dele. */
  marcador?: (cliente: ClienteDaTransacao, administradorId: string) => Promise<unknown>;
  criado?: (cliente: ClienteDaTransacao, administradorId: string, marcador: unknown, resultado: unknown) => Promise<string | null>;
  estado: (cliente: ClienteDaTransacao, alvo: string) => Promise<Estado>;
  /** Nome do registro para o Dono: o nome do item, da subcategoria etc. */
  nome: (estado: Estado) => string;
  /** A compensação (5.4), com o estado atual completo, já conferido contra o "depois". */
  desfazer: (c: ContextoDoDesfazer, alvo: string, antes: Estado, depois: Estado, atual: Estado) => Promise<void>;
};

// ------------------------------------------------------------------ Catálogo

async function estadoDoItem(cliente: ClienteDaTransacao, id: string): Promise<Estado> {
  const i = await cliente.item.findFirst({
    where: { id },
    select: {
      tipo: true,
      nome: true,
      codigo: true,
      categoria: true,
      subcategoriaId: true,
      subcategoria: { select: { nome: true } },
      ncm: true,
      unidadeMedida: true,
      custoBase: true,
      comissaoPercentual: true,
      materiais: { select: { materialId: true, quantidade: true, material: { select: { nome: true } } }, orderBy: { materialId: "asc" } },
    },
  });
  if (!i) return null;
  // Os campos da edição do Catálogo (5.4). O tipo nunca muda, mas entra para montar os dados do desfazer.
  return {
    tipo: i.tipo,
    nome: i.nome,
    codigo: i.codigo,
    categoria: i.categoria,
    subcategoriaId: i.subcategoriaId,
    subcategoria: i.subcategoria?.nome ?? null,
    ncm: i.ncm,
    unidadeMedida: i.unidadeMedida,
    custoBase: decimal(i.custoBase),
    comissaoPercentual: decimal(i.comissaoPercentual),
    materiais: i.materiais.map((m) => ({ materialId: m.materialId, nome: m.material.nome, quantidade: quantidade(m.quantidade) })),
  };
}

/** Os dados do item para a edição de volta, a partir do estado gravado na correção. */
function dadosDoItem(e: Record<string, unknown>): DadosDoItem {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    tipo: e.tipo as DadosDoItem["tipo"],
    nome: String(e.nome),
    nomeChave: normalizarNome(String(e.nome)),
    codigo: texto(e.codigo),
    categoria: e.categoria as DadosDoItem["categoria"],
    subcategoriaId: texto(e.subcategoriaId),
    ncm: texto(e.ncm),
    unidadeMedida: e.unidadeMedida as DadosDoItem["unidadeMedida"],
    custoBase: Number(e.custoBase),
    comissaoPercentual: n(e.comissaoPercentual),
    // A edição do Catálogo não mexe no mínimo (SPEC-007, OPEN-001).
    estoqueMinimo: null,
    precoInicial: null,
    materiais: ((e.materiais as { materialId: string; quantidade: string }[]) ?? []).map((m) => ({ materialId: m.materialId, quantidade: Number(m.quantidade) })),
  };
}

/** Erros dos módulos, na mensagem do módulo (5.5: "a mensagem da validação do módulo"). */
function mensagemDoErro(e: unknown, registro: string, modulo: string): string | null {
  const F = MENSAGENS_FLUXO_FINANCEIRO;
  if (e instanceof JaEstornado) return F.jaEstornado;
  if (e instanceof ContaNaoEditavel) return F.contaNaoEditavel[e.motivo];
  if (e instanceof ContaEncerrada) return F.contaEncerrada;
  if (e instanceof ContaNaoEncontrada || e instanceof LancamentoNaoEncontrado || e instanceof DespesaNaoEncontrada) return `${registro} não existe mais.`;
  if (e instanceof DasNaoEditavel) return F.dasNaoEditavel;
  // O fornecedor ou o cliente da conta mudou depois da correção (a troca de tipo de volta não cabe mais).
  if (e instanceof FornecedorNaoEncontrado || e instanceof ClienteNaoEncontrado) return M.registroMudou(registro, modulo);
  if (e instanceof CodigoEmUsoAoReativar) return codigoEmUsoAoReativar(e.codigo);
  if (e instanceof CodigoEmUso) return `O código ${e.codigo} já é do item "${e.nomeDoOutro}". Ajuste direto no Catálogo.`;
  if (e instanceof NomeDuplicado) return "Já existe um item ativo com o mesmo nome. Ajuste direto no Catálogo.";
  if (e instanceof NcmForaDaTabela) return MENSAGENS_CATALOGO.ncmForaDaTabela;
  if (e instanceof NcmObrigatorio) return MENSAGENS_CATALOGO.ncmObrigatorio;
  if (e instanceof SubcategoriaInvalida || e instanceof SubcategoriaNaoEncontrada) return "A subcategoria anterior não existe mais. Ajuste direto no Catálogo.";
  if (e instanceof SubcategoriaRepetida) return `Já existe a subcategoria "${e.nome}". Ajuste direto no Catálogo.`;
  if (e instanceof ItemNaoEncontrado) return "O item não existe mais.";
  if (e instanceof ItemArquivado) return "O item foi arquivado. Reative-o no Catálogo antes de desfazer.";
  if (e instanceof EstoqueInsuficiente) return M.saldoInsuficiente(String(e.saldo).replace(".", ","));
  return null;
}

const catalogoDa = (c: ContextoDoDesfazer) => criarConsultasDoCatalogo(c.cliente, c.negocioId);
const estoqueDa = (c: ContextoDoDesfazer) => criarConsultasDoEstoque(c.cliente, c.negocioId);
const financeiroDa = (c: ContextoDoDesfazer) => criarConsultasFinanceiras(c.cliente, c.negocioId);
const precificacaoDa = (c: ContextoDoDesfazer) => criarConsultasDePrecificacao(c.cliente, c.negocioId);

async function estadoDaSubcategoria(cliente: ClienteDaTransacao, id: string): Promise<Estado> {
  const s = await cliente.subcategoria.findFirst({ where: { id }, select: { nome: true, categoria: true } });
  return s && { nome: s.nome, categoria: s.categoria };
}

/** Marcador das movimentações: a última gravada por este Administrador antes da ação. */
async function ultimaMovimentacao(cliente: ClienteDaTransacao, administradorId: string): Promise<string | null> {
  const m = await cliente.movimentacaoEstoque.findFirst({ where: { usuarioId: administradorId }, orderBy: { registradoEm: "desc" }, select: { id: true } });
  return m?.id ?? null;
}

async function estadoDaMovimentacao(cliente: ClienteDaTransacao, id: string): Promise<Estado> {
  const m = await cliente.movimentacaoEstoque.findFirst({ where: { id }, select: { itemId: true, tipo: true, quantidade: true, motivo: true, item: { select: { nome: true } } } });
  return m && { itemId: m.itemId, item: m.item.nome, movimento: m.tipo, quantidade: quantidade(m.quantidade), motivo: m.motivo };
}

const OBSERVACAO_DO_DESFAZER = "Correção do suporte desfeita";


// ------------------------------------------------------------------ Calculadora

/** Os parâmetros de precificação do negócio (UC16): o registro afetado é o próprio negócio. */
async function estadoDosParametros(cliente: ClienteDaTransacao): Promise<Estado> {
  const n = await cliente.negocio.findFirst({
    select: { taxaCartaoMedia: true, capacidadeMensal: true, unidadeCapacidade: true, ticketMedioEstimado: true, faturamentoMensalEstimado: true, cmvEstimado: true, margemLucroMeta: true },
  });
  return (
    n && {
      taxaCartao: decimal(n.taxaCartaoMedia),
      capacidadeMensal: decimal(n.capacidadeMensal),
      unidadeCapacidade: n.unidadeCapacidade,
      ticketMedio: decimal(n.ticketMedioEstimado),
      faturamentoEstimado: decimal(n.faturamentoMensalEstimado),
      cmvEstimado: decimal(n.cmvEstimado),
      margemMeta: decimal(n.margemLucroMeta),
    }
  );
}

async function estadoDoPreco(cliente: ClienteDaTransacao, id: string): Promise<Estado> {
  const i = await cliente.item.findFirst({ where: { id }, select: { nome: true, precoAtual: true } });
  return i && { nome: i.nome, preco: decimal(i.precoAtual) };
}

/** Preço anterior de volta, num registro novo (o histórico mantém tudo). */
async function voltarPreco(c: ContextoDoDesfazer, alvo: string, antes: Estado) {
  if (antes?.preco === null || antes?.preco === undefined) throw new DesfazerRecusado("O item não tinha preço antes da correção. Ajuste direto no Catálogo.");
  await catalogoDa(c).definirPreco(alvo, Number(antes.preco), c.donoId, "MANUAL");
}

// ------------------------------------------------------------------ Financeiro

const competencia = (d: Date | null) => (d ? d.toISOString().slice(0, 7) : "");
const centavos = (v: unknown) => (v === null || v === undefined ? null : Math.round(Number(v) * 100));

async function estadoDoLancamento(cliente: ClienteDaTransacao, id: string): Promise<Estado> {
  const l = await cliente.lancamentoFinanceiro.findFirst({ where: { id, origem: "AVULSO" }, select: { tipo: true, categoria: true, valor: true, descricao: true, data: true } });
  return l && { descricao: l.descricao, tipo: l.tipo, categoria: l.categoria, valor: decimal(l.valor), data: diaLocal(l.data) };
}

/** A conta manual, sem o fornecedor ou o cliente: o vínculo não muda na correção e é dado pessoal (INV-009). */
async function estadoDaConta(cliente: ClienteDaTransacao, id: string): Promise<Estado> {
  const c = await cliente.contaPagarReceber.findFirst({
    where: { id, parcelaId: null, despesaFixaId: null },
    select: { tipo: true, descricao: true, categoria: true, valorTotal: true, vencimento: true },
  });
  return c && { descricao: c.descricao, tipo: c.tipo, categoria: c.categoria, valor: decimal(c.valorTotal), vencimento: diaLocal(c.vencimento) };
}

/** A despesa fixa e as competências das contas que ela já gerou (OPEN-015), sem o fornecedor. */
async function estadoDaDespesa(cliente: ClienteDaTransacao, id: string): Promise<Estado> {
  const d = await cliente.despesaFixa.findFirst({
    where: { id },
    select: { descricao: true, valorMensal: true, diaVencimento: true, categoria: true, ativo: true, contas: { select: { competencia: true }, orderBy: { competencia: "asc" } } },
  });
  return (
    d && {
      descricao: d.descricao,
      valor: decimal(d.valorMensal),
      diaVencimento: d.diaVencimento,
      categoria: d.categoria,
      ativo: d.ativo,
      geradas: d.contas.map((c) => competencia(c.competencia)),
    }
  );
}

/** Marcador das contas criadas: as contas manuais deste Administrador antes da ação. */
async function contasDoAdministrador(cliente: ClienteDaTransacao, administradorId: string): Promise<string[]> {
  return (await cliente.contaPagarReceber.findMany({ where: { criadaPorId: administradorId }, select: { id: true } })).map((c) => c.id);
}

const idDoResultado = (resultado: unknown): string | null => {
  const r = resultado as { status?: string; id?: string } | undefined;
  return r?.status === "salvo" && typeof r.id === "string" && UUID.test(r.id) ? r.id : null;
};

/**
 * Contas geradas pela despesa desde a correção (OPEN-015): as das competências que não existiam antes.
 * Se alguma já tem pagamento, o desfazer é recusado com o mês; senão, são canceladas (nada é apagado).
 */
async function cancelarContasGeradas(c: ContextoDoDesfazer, despesaId: string, antes: Estado) {
  const existiam = new Set((antes?.geradas as string[] | undefined) ?? []);
  const contas = await c.cliente.contaPagarReceber.findMany({
    where: { despesaFixaId: despesaId },
    select: { id: true, competencia: true, status: true, valorPago: true },
    orderBy: { competencia: "asc" },
  });
  const novas = contas.filter((x) => !existiam.has(competencia(x.competencia)));
  const paga = novas.find((x) => x.status === "QUITADA" || Number(x.valorPago) > 0);
  if (paga) throw new DesfazerRecusado(M.contaDaDespesaPaga(competenciaBrasileira(competencia(paga.competencia))));
  return async () => {
    const abertas = novas.filter((x) => x.status === "ABERTA").map((x) => x.id);
    if (abertas.length) await c.cliente.contaPagarReceber.updateMany({ where: { id: { in: abertas }, despesaFixaId: despesaId, status: "ABERTA" }, data: { status: "CANCELADA" } });
  };
}

/** O vínculo atual da conta, que o desfazer mantém como está (5.4, "Vínculo como está"). */
async function vinculoDaConta(cliente: ClienteDaTransacao, id: string): Promise<{ pessoaId: string | null; numeroDocumento: string | null }> {
  const v = await cliente.contaPagarReceber.findFirst({ where: { id }, select: { fornecedorId: true, clienteId: true, numeroDocumento: true } });
  return { pessoaId: v?.fornecedorId ?? v?.clienteId ?? null, numeroDocumento: v?.numeroDocumento ?? null };
}

const DEFINICOES: Record<IdDaCorrecao, Definicao> = {
  "catalogo.editarItem": {
    alvo: (args) => doFormulario(args, "itemId"),
    estado: estadoDoItem,
    nome: (e) => String(e?.nome ?? "Item"),
    async desfazer(c, alvo, antes, _depois, atual) {
      // Volta só os campos que a correção mudou; o resto fica como está agora.
      await catalogoDa(c).editar(alvo, dadosDoItem({ ...atual!, ...antes! }), c.donoId);
    },
  },
  "catalogo.definirPreco": {
    alvo: (args) => doFormulario(args, "itemId"),
    async estado(cliente, id) {
      const i = await cliente.item.findFirst({ where: { id }, select: { nome: true, precoAtual: true } });
      return i && { nome: i.nome, preco: decimal(i.precoAtual) };
    },
    nome: (e) => String(e?.nome ?? "Item"),
    async desfazer(c, alvo, antes) {
      if (antes?.preco === null || antes?.preco === undefined) throw new DesfazerRecusado("O item não tinha preço antes da correção. Ajuste direto no Catálogo.");
      await catalogoDa(c).definirPreco(alvo, Number(antes.preco), c.donoId, "MANUAL");
    },
  },
  "catalogo.arquivarItem": {
    alvo: (args) => doFormulario(args, "itemId"),
    async estado(cliente, id) {
      const i = await cliente.item.findFirst({ where: { id }, select: { nome: true, arquivadoEm: true } });
      return i && { nome: i.nome, arquivado: i.arquivadoEm !== null };
    },
    nome: (e) => String(e?.nome ?? "Item"),
    async desfazer(c, alvo, _antes, depois) {
      await catalogoDa(c).arquivar(alvo, !depois?.arquivado);
    },
  },
  "catalogo.criarSubcategoria": {
    marcador: async () => null,
    criado: async (_c, _a, _m, resultado) => {
      const r = resultado as { status?: string; subcategoria?: { id?: string } } | undefined;
      return r?.status === "salvo" && r.subcategoria?.id ? r.subcategoria.id : null;
    },
    estado: estadoDaSubcategoria,
    nome: (e) => String(e?.nome ?? "Subcategoria"),
    async desfazer(c, alvo) {
      const uso = await catalogoDa(c).usoDaSubcategoria(alvo);
      if (uso.itensAtivos + uso.itensArquivados > 0) throw new DesfazerRecusado(`A subcategoria "${uso.nome}" já tem itens. Ajuste direto no Catálogo.`);
      await catalogoDa(c).excluirSubcategoria(alvo);
    },
  },
  "catalogo.renomearSubcategoria": {
    alvo: (args) => doFormulario(args, "subcategoriaId"),
    estado: estadoDaSubcategoria,
    nome: (e) => String(e?.nome ?? "Subcategoria"),
    async desfazer(c, alvo, antes) {
      const nome = String(antes?.nome);
      await catalogoDa(c).renomearSubcategoria(alvo, { nome, nomeChave: normalizarNome(nome) });
    },
  },
  "estoque.registrarEntrada": {
    marcador: ultimaMovimentacao,
    criado: async (cliente, administradorId, marcador) => {
      const agora = await ultimaMovimentacao(cliente, administradorId);
      return agora && agora !== marcador ? agora : null;
    },
    estado: estadoDaMovimentacao,
    nome: (e) => String(e?.item ?? "Item"),
    async desfazer(c, _alvo, _antes, depois) {
      // 5.4: saída manual da mesma quantidade, motivo "Outro", com a observação.
      await estoqueDa(c).registrar({
        itemId: String(depois!.itemId),
        tipo: "SAIDA_MANUAL",
        quantidade: Number(depois!.quantidade),
        usuarioId: c.donoId,
        data: c.agora,
        motivo: "OUTRO",
        observacao: OBSERVACAO_DO_DESFAZER,
      });
    },
  },
  "estoque.registrarSaida": {
    marcador: ultimaMovimentacao,
    criado: async (cliente, administradorId, marcador) => {
      const agora = await ultimaMovimentacao(cliente, administradorId);
      return agora && agora !== marcador ? agora : null;
    },
    estado: estadoDaMovimentacao,
    nome: (e) => String(e?.item ?? "Item"),
    async desfazer(c, _alvo, _antes, depois) {
      await estoqueDa(c).registrar({
        itemId: String(depois!.itemId),
        tipo: "ENTRADA",
        quantidade: Number(depois!.quantidade),
        usuarioId: c.donoId,
        data: c.agora,
        observacao: OBSERVACAO_DO_DESFAZER,
      });
    },
  },
  "estoque.definirMinimo": {
    alvo: (args) => doFormulario(args, "itemId"),
    async estado(cliente, id) {
      const i = await cliente.item.findFirst({ where: { id }, select: { nome: true, estoqueMinimo: true } });
      return i && { nome: i.nome, estoqueMinimo: quantidade(i.estoqueMinimo) };
    },
    nome: (e) => String(e?.nome ?? "Item"),
    async desfazer(c, alvo, antes) {
      const v = antes?.estoqueMinimo;
      await estoqueDa(c).definirMinimo(alvo, v === null || v === undefined ? null : Number(v));
    },
  },
  "calculadora.salvarParametros": {
    alvo: (_args, negocioId) => negocioId,
    estado: (cliente) => estadoDosParametros(cliente),
    nome: () => "Parâmetros de precificação",
    async desfazer(c, _alvo, antes, _depois, atual) {
      const e = { ...atual!, ...antes! };
      const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
      await precificacaoDa(c).salvarParametros({
        taxaCartao: Number(e.taxaCartao ?? 0),
        capacidadeMensal: n(e.capacidadeMensal),
        unidadeCapacidade: texto(e.unidadeCapacidade),
        ticketMedioCentavos: centavos(e.ticketMedio),
        faturamentoEstimadoCentavos: centavos(e.faturamentoEstimado),
        cmvEstimado: n(e.cmvEstimado),
        margemMeta: n(e.margemMeta),
      });
    },
  },
  "calculadora.confirmarPreco": {
    alvo: (args) => doFormulario(args, "itemId"),
    estado: estadoDoPreco,
    nome: (e) => String(e?.nome ?? "Item"),
    desfazer: (c, alvo, antes) => voltarPreco(c, alvo, antes),
  },
  "financeiro.lancarAvulso": {
    marcador: async () => null,
    criado: async (_c, _a, _m, resultado) => idDoResultado(resultado),
    estado: estadoDoLancamento,
    nome: (e) => String(e?.descricao ?? "Lançamento"),
    async desfazer(c, alvo) {
      await financeiroDa(c).estornar(alvo, c.donoId, c.agora);
    },
  },
  "financeiro.criarConta": {
    // A ação leva ao detalhe da conta (redirecionamento): o id sai das contas novas deste Administrador.
    marcador: contasDoAdministrador,
    criado: async (cliente, administradorId, marcador) => {
      const antes = new Set(marcador as string[]);
      return (await contasDoAdministrador(cliente, administradorId)).find((id) => !antes.has(id)) ?? null;
    },
    estado: estadoDaConta,
    nome: (e) => String(e?.descricao ?? "Conta"),
    async desfazer(c, alvo) {
      await financeiroDa(c).cancelarConta(alvo);
    },
  },
  "financeiro.editarConta": {
    alvo: (args) => doFormulario(args, "contaId"),
    estado: estadoDaConta,
    nome: (e) => String(e?.descricao ?? "Conta"),
    async desfazer(c, alvo, antes, _depois, atual) {
      const e = { ...atual!, ...antes! };
      const dados: DadosDeConta = {
        tipo: e.tipo as DadosDeConta["tipo"],
        descricao: String(e.descricao ?? ""),
        categoria: e.categoria as DadosDeConta["categoria"],
        valorCentavos: centavos(e.valor) ?? 0,
        vencimento: String(e.vencimento),
        ...(await vinculoDaConta(c.cliente, alvo)),
      };
      await financeiroDa(c).editarConta(alvo, dados);
    },
  },
  "financeiro.criarDespesa": {
    marcador: async () => null,
    criado: async (_c, _a, _m, resultado) => idDoResultado(resultado),
    estado: estadoDaDespesa,
    nome: (e) => String(e?.descricao ?? "Despesa fixa"),
    async desfazer(c, alvo, antes) {
      const cancelar = await cancelarContasGeradas(c, alvo, antes);
      await financeiroDa(c).definirAtivo(alvo, false, c.hoje);
      await cancelar();
    },
  },
  "financeiro.editarDespesa": {
    alvo: (args) => doFormulario(args, "despesaId"),
    estado: estadoDaDespesa,
    nome: (e) => String(e?.descricao ?? "Despesa fixa"),
    async desfazer(c, alvo, antes, _depois, atual) {
      const e = { ...atual!, ...antes! };
      const despesa = await c.cliente.despesaFixa.findFirst({ where: { id: alvo }, select: { origem: true, fornecedorId: true } });
      if (!despesa) throw new DespesaNaoEncontrada();
      // O DAS do MEI só tem o dia (5.6); a manual volta os campos, com o fornecedor como está.
      if (despesa.origem === "DAS_MEI") return financeiroDa(c).definirDiaVencimento(alvo, Number(e.diaVencimento));
      await financeiroDa(c).editarDespesa(alvo, {
        descricao: String(e.descricao),
        valorCentavos: centavos(e.valor) ?? 0,
        diaVencimento: Number(e.diaVencimento),
        categoria: e.categoria as DadosDeConta["categoria"],
        fornecedorId: despesa.fornecedorId,
      });
    },
  },
  "financeiro.definirAtivo": {
    alvo: (args) => doFormulario(args, "despesaId"),
    estado: estadoDaDespesa,
    nome: (e) => String(e?.descricao ?? "Despesa fixa"),
    async desfazer(c, alvo, antes, depois) {
      const f = financeiroDa(c);
      if (depois?.ativo === true) {
        // Desfazer a ativação: desativa e cancela as contas geradas a partir dela, se nenhuma foi paga (OPEN-015).
        const cancelar = await cancelarContasGeradas(c, alvo, antes);
        await f.definirAtivo(alvo, false, c.hoje);
        await cancelar();
      } else {
        // Desfazer a desativação: reativa como o Dono reativaria, com a conta do mês (SPEC-009, 5.5).
        await f.definirAtivo(alvo, true, c.hoje);
        await f.conferir(c.hoje);
      }
    },
  },
};

/** As movimentações nunca mudam depois de gravadas: o "depois" sempre confere. */
const IMUTAVEIS = new Set<IdDaCorrecao>(["estoque.registrarEntrada", "estoque.registrarSaida", "financeiro.lancarAvulso"]);

// ------------------------------------------------------------------ consultas

export type CorrecaoDoNegocio = {
  id: string;
  acessoId: string | null;
  acao: IdDaCorrecao;
  rotulo: string;
  modulo: string;
  registro: string;
  antes: Estado;
  depois: Estado;
  criadoEm: Date;
  autor: string;
  desfeitaEm: Date | null;
  desfeitaPor: string | null;
  /** Ainda dá para desfazer (só o prazo e a situação; a conferência do estado é no desfazer). */
  podeDesfazer: boolean;
};

/** O que o evento `CORRECAO` guarda: a ação, o registro afetado e o antes e o depois dos campos mudados. */
type DadosDaCorrecao = { acao: IdDaCorrecao; alvo: string; registro: string; antes: Estado; depois: Estado };

export function criarConsultasDeCorrecoes(base: PrismaClient) {
  return {
    /**
     * Executa uma correção (5.3): a ação (`corpo`) e o evento com o antes e o depois na mesma
     * transação. `interrupcao` reconhece o redirecionamento do Next, que conta como sucesso e é
     * repassado depois de gravar. Sem mudança real (erro de validação, mesmo valor), nada é registrado.
     */
    async executar<R>(
      c: { negocioId: string; administradorId: string; acessoId: string },
      id: IdDaCorrecao,
      args: unknown[],
      corpo: () => Promise<R>,
      interrupcao: (e: unknown) => boolean = () => false,
    ): Promise<R> {
      const def = DEFINICOES[id];
      let redirecionar: unknown = null;
      const resultado = await comNegocio(base, { negocioId: c.negocioId, usuarioId: c.administradorId }).$transaction(
        async (tx) => {
          const cliente = achatar(tx as unknown as ClienteDaTransacao);
          return transacaoDaCorrecao.run({ negocioId: c.negocioId, cliente }, async () => {
            const alvoAntes = def.alvo?.(args, c.negocioId) ?? null;
            const antes = alvoAntes ? await def.estado(cliente, alvoAntes) : null;
            const marcador = def.marcador ? await def.marcador(cliente, c.administradorId) : null;
            let r: R | undefined;
            // O corpo roda num savepoint: se o serviço do módulo engolir um erro do banco e responder
            // "erro" (os serviços traduzem as falhas em mensagens), a transação fica abortada. Aí volta
            // ao savepoint, nada da ação fica e não há correção a registrar.
            const bruto = cliente as unknown as { $executeRawUnsafe: (sql: string) => Promise<number> };
            await bruto.$executeRawUnsafe("SAVEPOINT he_corpo_da_correcao");
            try {
              r = await corpo();
            } catch (e) {
              if (!interrupcao(e)) throw e;
              redirecionar = e;
            }
            try {
              await bruto.$executeRawUnsafe("RELEASE SAVEPOINT he_corpo_da_correcao");
            } catch {
              await bruto.$executeRawUnsafe("ROLLBACK TO SAVEPOINT he_corpo_da_correcao");
              return r as R;
            }
            const alvo = alvoAntes ?? (def.criado ? await def.criado(cliente, c.administradorId, marcador, r) : null);
            if (alvo) {
              const depois = await def.estado(cliente, alvo);
              const mudanca = diferenca(antes, depois);
              if (mudanca) {
                const dados: DadosDaCorrecao = { acao: id, alvo, registro: def.nome(depois ?? antes), ...mudanca };
                await cliente.registroSuporte.create({
                  data: {
                    negocioId: c.negocioId,
                    acessoId: c.acessoId,
                    usuarioId: c.administradorId,
                    evento: "CORRECAO",
                    modulo: moduloDaCorrecao(id),
                    descricao: `${CORRECOES_PERMITIDAS[id].rotulo}: ${def.nome(depois ?? antes)}`.slice(0, 200),
                    dados: dados as unknown as Prisma.InputJsonValue,
                  },
                });
              }
            }
            return r as R;
          });
        },
        { timeout: 30_000, maxWait: 10_000 },
      );
      if (redirecionar) throw redirecionar;
      return resultado;
    },

    /** Correções do negócio para "Acessos do suporte" (5.10), com quem desfez e quando. */
    async correcoesDoNegocio(negocioId: string, agora: Date): Promise<CorrecaoDoNegocio[]> {
      const lista = await comNegocio(base, { negocioId }).registroSuporte.findMany({
        where: { evento: "CORRECAO" },
        orderBy: { criadoEm: "desc" },
        take: 200,
        select: {
          id: true,
          acessoId: true,
          modulo: true,
          dados: true,
          criadoEm: true,
          usuario: { select: { nome: true } },
          desfeitas: { select: { criadoEm: true, usuario: { select: { nome: true } } } },
        },
      });
      return lista.flatMap((r) => {
        const d = r.dados as unknown as DadosDaCorrecao | null;
        if (!d || !Object.hasOwn(CORRECOES_PERMITIDAS, d.acao)) return [];
        const desfeita = r.desfeitas[0] ?? null;
        return [
          {
            id: r.id,
            acessoId: r.acessoId,
            acao: d.acao,
            rotulo: CORRECOES_PERMITIDAS[d.acao].rotulo,
            modulo: ROTULO_MODULO[moduloDaCorrecao(d.acao)],
            registro: d.registro ?? DEFINICOES[d.acao].nome(d.depois ?? d.antes),
            antes: d.antes,
            depois: d.depois,
            criadoEm: r.criadoEm,
            autor: r.usuario.nome,
            desfeitaEm: desfeita?.criadoEm ?? null,
            desfeitaPor: desfeita?.usuario.nome ?? null,
            podeDesfazer: !desfeita && dentroDoPrazoDeDesfazer(r.criadoEm, agora),
          },
        ];
      });
    },

    /**
     * Desfazer (5.5): só o Dono (a guarda da ação confere o papel), até 30 dias, uma vez, e só se o
     * estado atual for o "depois". A compensação usa as mesmas funções do módulo, em nome do Dono, e
     * grava `CORRECAO_DESFEITA` na mesma transação. Nada é apagado.
     */
    async desfazer(correcaoId: string, negocioId: string, donoId: string, agora: Date): Promise<void> {
      if (!UUID.test(correcaoId)) throw new DesfazerRecusado(M.naoPodeMaisDesfazer);
      await comNegocio(base, { negocioId, usuarioId: donoId }).$transaction(
        async (tx) => {
          const cliente = achatar(tx as unknown as ClienteDaTransacao);
          // SPEC-019 (5.7, OPEN-018): no negócio suspenso, o desfazer é recusado como as demais gravações, e
          // os 30 dias continuam contando. A trava do negócio faz uma suspensão simultânea esperar (e põe em fila
          // dois desfazer do mesmo negócio, que podem gravar nele, como os parâmetros da Calculadora).
          const negocio = await cliente.$queryRaw<{ suspenso: boolean }[]>`
            SELECT "suspensoEm" IS NOT NULL AS "suspenso" FROM "Negocio" WHERE "id" = ${negocioId}::uuid FOR UPDATE`;
          if (negocio[0]?.suspenso) throw new DesfazerRecusado(MENSAGENS_DA_SUSPENSAO.desfazer);
          // Trava a correção: dois cliques no "Desfazer" não passam juntos (o índice único também garante).
          const travada = await cliente.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "RegistroSuporte" WHERE "id" = ${correcaoId}::uuid AND "negocioId" = ${negocioId}::uuid AND "evento"::text = 'CORRECAO' FOR UPDATE`;
          if (travada.length === 0) throw new DesfazerRecusado(M.naoPodeMaisDesfazer);
          const r = await cliente.registroSuporte.findFirst({ where: { id: correcaoId }, select: { dados: true, criadoEm: true, acessoId: true, modulo: true, desfeitas: { select: { id: true } } } });
          const d = r?.dados as unknown as DadosDaCorrecao | null;
          if (!r || !d || r.desfeitas.length > 0 || !dentroDoPrazoDeDesfazer(r.criadoEm, agora) || !Object.hasOwn(DEFINICOES, d.acao)) {
            throw new DesfazerRecusado(M.naoPodeMaisDesfazer);
          }
          const def = DEFINICOES[d.acao];
          const atual = await def.estado(cliente, d.alvo);
          if (!IMUTAVEIS.has(d.acao) && !confere(atual, d.depois)) {
            throw new DesfazerRecusado(M.registroMudou(atual ? def.nome(atual) : d.registro, ROTULO_MODULO[moduloDaCorrecao(d.acao)]));
          }
          try {
            await def.desfazer({ cliente, negocioId, donoId, agora, hoje: hojeLocal(agora) }, d.alvo, d.antes, d.depois, atual);
          } catch (e) {
            if (e instanceof DesfazerRecusado) throw e;
            const mensagem = mensagemDoErro(e, d.registro, ROTULO_MODULO[moduloDaCorrecao(d.acao)]);
            if (mensagem) throw new DesfazerRecusado(mensagem);
            throw e;
          }
          const depoisDoDesfazer = await def.estado(cliente, d.alvo);
          const desfeito = diferenca(atual, depoisDoDesfazer) ?? { antes: null, depois: null };
          await cliente.registroSuporte.create({
            data: {
              negocioId,
              acessoId: r.acessoId,
              usuarioId: donoId,
              evento: "CORRECAO_DESFEITA",
              modulo: r.modulo,
              correcaoId,
              descricao: `Desfez: ${CORRECOES_PERMITIDAS[d.acao].rotulo} — ${d.registro}`.slice(0, 200),
              dados: { acao: d.acao, alvo: d.alvo, registro: d.registro, ...desfeito } as unknown as Prisma.InputJsonValue,
            },
          });
        },
        { timeout: 30_000, maxWait: 10_000 },
      );
    },
  };
}

export type ConsultasDeCorrecoes = ReturnType<typeof criarConsultasDeCorrecoes>;
