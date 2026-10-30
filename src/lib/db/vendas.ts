import type { FormaPagamento, StatusConta, StatusVenda, TipoItem, TipoMovimentacao } from "@/generated/prisma/enums";
import { custoTotal } from "@/lib/dominio/catalogo";
import { intervaloDoDia } from "@/lib/dominio/datas";
import { faltandoParaNota, nomeDeExibicao } from "@/lib/dominio/cliente";
import { mascararNome } from "@/lib/dominio/suporte";
import {
  acertoDoCancelamento,
  custoUnitarioComMateriais,
  dividirEmParcelas,
  ehImediato,
  FORMAS_DE_PAGAMENTO,
  FORMAS_DE_REEMBOLSO,
  materiaisPadraoDaLinha,
  paraCentavos,
  subtotalEmCentavos,
  vencimentoDaParcela,
  type FormaDeReembolso,
} from "@/lib/dominio/venda";
import type { DadosDoCarrinho } from "@/lib/vendas/validacao";
import type { ClienteDoNegocio } from "./cliente-do-negocio";
import { EstoqueInsuficiente, instanteDaOcorrencia, movimentar } from "./estoque";

/**
 * Vendas do negócio ativo (SPEC-008). A venda inteira é uma transação (INV-001): número,
 * venda, itens, baixas de estoque (primitiva da SPEC-007), pagamentos, lançamentos e
 * parcelas com contas a receber. Preço e custo vêm sempre do banco (INV-002, INV-007), salvo os
 * ajustes da SPEC-017: preço da linha (com Vendas — editar e motivo) e materiais usados.
 * O cancelamento e a troca (SPEC-011) desfazem esses efeitos numa única transação.
 */

export class ItemNaoVendavel extends Error {
  constructor(public readonly nome: string, public readonly motivo: "sem-preco" | "sem-ncm" | "arquivado" | "inexistente") {
    super("Item não pode ser vendido.");
    this.name = "ItemNaoVendavel";
  }
}
export class PrecoMudou extends Error {
  constructor(public readonly itens: { nome: string; precoCentavos: number }[]) {
    super("O preço mudou.");
    this.name = "PrecoMudou";
  }
}
export class SomaDivergente extends Error {
  constructor(public readonly totalCentavos: number) {
    super("A soma dos pagamentos não bate com o total.");
    this.name = "SomaDivergente";
  }
}
export class EstoqueInsuficienteNaVenda extends Error {
  constructor(public readonly nome: string, public readonly saldo: number, public readonly unidade: string) {
    super("Estoque insuficiente.");
    this.name = "EstoqueInsuficienteNaVenda";
  }
}
/** SPEC-017: material ajustado que não é do serviço, ou ajuste de materiais num produto. */
export class MaterialInvalido extends Error {
  constructor(public readonly nome: string) {
    super("Material inválido para este item.");
    this.name = "MaterialInvalido";
  }
}
/** SPEC-017 (OPEN-005, INV-003): ajuste de preço sem Vendas — editar. */
export class AjusteDePrecoSemPermissao extends Error {
  constructor() {
    super("Sem permissão para ajustar o preço.");
    this.name = "AjusteDePrecoSemPermissao";
  }
}
export class ClienteInvalido extends Error {
  constructor() {
    super("Cliente inválido.");
    this.name = "ClienteInvalido";
  }
}
export class VendaNaoEncontrada extends Error {
  constructor() {
    super("Venda não encontrada.");
    this.name = "VendaNaoEncontrada";
  }
}
export class VendaJaCancelada extends Error {
  constructor() {
    super("Esta venda já foi cancelada.");
    this.name = "VendaJaCancelada";
  }
}
export class TrocaAcimaDoOriginal extends Error {
  constructor(public readonly limiteCentavos: number) {
    super("A troca passa do valor da venda original.");
    this.name = "TrocaAcimaDoOriginal";
  }
}
export class RestanteDaTroca extends Error {
  constructor(public readonly restanteCentavos: number, public readonly creditoCentavos: number) {
    super("Os pagamentos não cobrem o restante da troca.");
    this.name = "RestanteDaTroca";
  }
}
export class FormaDeReembolsoAusente extends Error {
  constructor(public readonly reembolsoCentavos: number) {
    super("Escolha como o valor será devolvido.");
    this.name = "FormaDeReembolsoAusente";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (d: unknown) => (d === null || d === undefined ? null : Number(String(d)));
const reais = (centavos: number) => (centavos / 100).toFixed(2);
const meioDia = (dia: string) => new Date(intervaloDoDia(dia).inicio.getTime() + 12 * 3_600_000);
const ehUnicidade = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

/** Transação (ou cliente) do negócio. */
type Tx = Parameters<typeof movimentar>[0] &
  Pick<ClienteDoNegocio, "$executeRaw" | "venda" | "itemVenda" | "pagamento" | "parcela" | "contaPagarReceber" | "lancamentoFinanceiro">;

type LinhaPreparada = DadosDoCarrinho["linhas"][number] & {
  nome: string;
  tipo: TipoItem;
  /** Preço cobrado: o oficial, ou o ajustado (SPEC-017). */
  precoCentavos: number;
  /** Preço oficial no momento da gravação (comparado com o "preço visto" e gravado no ajuste). */
  precoOficialCentavos: number;
  custo: number;
  /** Quantidade de cada material baixada por esta linha (padrão ou ajustada). */
  baixas: { materialId: string; quantidade: number }[];
  subtotal: number;
};

export type OpcoesDaVenda = { podeAjustarPreco?: boolean };

export type ItemVendavel = {
  id: string;
  nome: string;
  /** SPEC-024: código interno (busca e Enter na Nova venda e na troca), ou null. */
  codigo: string | null;
  tipo: TipoItem;
  unidadeMedida: string;
  preco: number;
  /** Saldo do produto físico (null para serviço). */
  saldo: number | null;
  /** Custo próprio e dos materiais (SPEC-017: aviso de preço abaixo do custo). */
  custoBase: number;
  materiais: { materialId: string; nome: string; quantidade: number; saldo: number; unidadeMedida: string; custo: number }[];
};

export type VendaResumida = {
  id: string;
  numero: number;
  data: Date;
  valorTotal: number;
  status: StatusVenda;
  cliente: string | null;
  registradaPor: string;
  itens: number;
  formas: FormaPagamento[];
  /** SPEC-017: alguma linha com preço ajustado. */
  precoAjustado: boolean;
};

export type DetalheDaVenda = VendaResumida & {
  itensVenda: {
    itemId: string;
    nome: string;
    /** SPEC-024 (5.3): o código atual do item (a venda não guarda cópia, como o nome). */
    codigo: string | null;
    unidadeMedida: string;
    quantidade: number;
    precoUnitario: number;
    subtotal: number;
    /** SPEC-017: preço oficial e motivo quando o preço foi ajustado; materiais ajustados. */
    precoOficial: number | null;
    motivoAjustePreco: string | null;
    materiaisAjustados: boolean;
  }[];
  pagamentos: {
    forma: FormaPagamento;
    valor: number;
    parcelas: { numero: number; valor: number; vencimento: Date; status: StatusConta | null; valorPago: number }[];
  }[];
  movimentacoes: { itemId: string; nome: string; tipo: TipoMovimentacao; quantidade: number; saldoAnterior: number; saldoPosterior: number }[];
  /** SPEC-011: auditoria do cancelamento, reembolso e ligação com a troca. */
  cancelamento: { em: Date; por: string; motivo: string; reembolso: { valor: number; descricao: string } | null } | null;
  trocaDe: { id: string; numero: number } | null;
  trocadaPor: { id: string; numero: number } | null;
};

export type Cancelamento = {
  motivo: string;
  formaReembolso: FormaDeReembolso | null;
  /** Carrinho da troca (SPEC-011, 5.2): os pagamentos são só o restante, além do crédito. */
  troca?: DadosDoCarrinho;
};

export type ResultadoDoCancelamento = {
  numero: number;
  trocaId: string | null;
  trocaNumero: number | null;
  creditoCentavos: number;
  reembolsoCentavos: number;
  jaExistia: boolean;
};

export type PreviaDoCancelamento = {
  id: string;
  numero: number;
  status: StatusVenda;
  valorTotalCentavos: number;
  trocaDe: { id: string; numero: number } | null;
  /** Cliente da venda, se ainda ativo: a troca já começa com ele (SPEC-022, 5.10, item 4). */
  clienteId: string | null;
  devolucoes: { itemId: string; nome: string; unidadeMedida: string; quantidade: number }[];
  contasAbertas: { quantidade: number; restanteCentavos: number };
  recebidoCentavos: number;
};

/** Cliente no seletor da venda (SPEC-022, 5.10): nome de exibição e o que falta para a nota. */
export type ClienteDaVenda = { id: string; nome: string; faltando: string[] };

export function criarConsultasDeVendas(cliente: ClienteDoNegocio, negocioId: string, opcoes: { mascararClientes?: boolean } = {}) {
  /** SPEC-018 (INV-006): no modo suporte, nome e contato do cliente saem do servidor mascarados. */
  const nomeDoCliente = (nome: string | null | undefined) => (nome ? (opcoes.mascararClientes ? mascararNome(nome) : nome) : null);
  /**
   * Linhas com preço e custo do banco (INV-002, INV-007) e o total — antes da transação. Com
   * os ajustes da SPEC-017: preço cobrado (exige `podeAjustarPreco`) e materiais usados.
   */
  async function prepararVenda(c: DadosDoCarrinho, opcoes: OpcoesDaVenda = {}): Promise<{ linhas: LinhaPreparada[]; total: number }> {
    // SPEC-021 (RN35): com a nota fiscal de produtos ligada, produto físico sem NCM não entra (o estado
    // do negócio é lido aqui, na gravação, e não o que estava na tela).
    const negocio = await cliente.negocio.findFirst({ select: { emiteNotaDeProduto: true } });
    const itens = await cliente.item.findMany({
      where: { id: { in: c.linhas.map((l) => l.itemId) } },
      select: {
        id: true,
        nome: true,
        tipo: true,
        ncm: true,
        precoAtual: true,
        custoBase: true,
        arquivadoEm: true,
        materiais: { select: { materialId: true, quantidade: true, material: { select: { custoBase: true } } } },
      },
    });
    const porId = new Map(itens.map((i) => [i.id, i]));
    const linhas = c.linhas.map((l) => {
      const i = porId.get(l.itemId);
      if (!i) throw new ItemNaoVendavel("Item", "inexistente");
      if (i.arquivadoEm) throw new ItemNaoVendavel(i.nome, "arquivado");
      if (i.precoAtual === null) throw new ItemNaoVendavel(i.nome, "sem-preco");
      if (negocio?.emiteNotaDeProduto && i.tipo === "PRODUTO_FISICO" && i.ncm === null) throw new ItemNaoVendavel(i.nome, "sem-ncm");
      if (l.ajustePreco && !opcoes.podeAjustarPreco) throw new AjusteDePrecoSemPermissao();
      const precoOficialCentavos = paraCentavos(num(i.precoAtual)!);
      const precoCentavos = l.ajustePreco?.precoCentavos ?? precoOficialCentavos;
      const vinculos = i.materiais.map((m) => ({ materialId: m.materialId, quantidade: num(m.quantidade)!, custo: num(m.material.custoBase)! }));
      let baixas = i.tipo === "PRODUTO_FISICO" ? [] : materiaisPadraoDaLinha(vinculos, l.quantidade);
      let custo = custoTotal(num(i.custoBase)!, vinculos);
      if (l.materiais) {
        // OPEN-001: só a quantidade dos materiais já vinculados ao serviço; o que não vier, fica no padrão.
        if (i.tipo !== "SERVICO") throw new MaterialInvalido(i.nome);
        const informados = new Map(l.materiais.map((m) => [m.materialId, m.quantidade]));
        if ([...informados.keys()].some((id) => !vinculos.some((v) => v.materialId === id))) throw new MaterialInvalido(i.nome);
        baixas = baixas.map((b) => ({ ...b, quantidade: informados.get(b.materialId) ?? b.quantidade }));
        custo = custoUnitarioComMateriais(
          num(i.custoBase)!,
          vinculos.map((v) => ({ custo: v.custo, quantidade: baixas.find((b) => b.materialId === v.materialId)!.quantidade })),
          l.quantidade,
        );
      }
      return {
        ...l,
        nome: i.nome,
        tipo: i.tipo,
        precoCentavos,
        precoOficialCentavos,
        custo,
        baixas,
        subtotal: subtotalEmCentavos(precoCentavos, l.quantidade),
      };
    });
    if (c.clienteId && !(await cliente.cliente.findFirst({ where: { id: c.clienteId, anonimizadoEm: null }, select: { id: true } }))) {
      throw new ClienteInvalido();
    }
    return { linhas, total: linhas.reduce((s, l) => s + l.subtotal, 0) };
  }

  /** Soma dos pagamentos = esperado; se não, diz se foi o preço que mudou (INV-002). */
  function conferirSoma(linhas: LinhaPreparada[], total: number, pago: number, esperado: number, credito?: number) {
    if (pago === esperado) return;
    // Linhas com preço ajustado cobram o ajuste: a mudança do oficial não muda o total (SPEC-017, 5.3).
    const mudaram = linhas.filter((l) => !l.ajustePreco && l.precoVistoCentavos !== null && l.precoVistoCentavos !== l.precoOficialCentavos);
    if (mudaram.length) throw new PrecoMudou(mudaram.map((l) => ({ nome: l.nome, precoCentavos: l.precoOficialCentavos })));
    if (credito !== undefined) throw new RestanteDaTroca(esperado, credito);
    throw new SomaDivergente(total);
  }

  /** Recebido da venda (SPEC-011, INV-004): entradas imediatas + pago nas contas + crédito de troca usado (OPEN-006). */
  async function recebido(tx: Pick<ClienteDoNegocio, "$queryRaw">, vendaId: string): Promise<number> {
    const [r] = await tx.$queryRaw<{ imediato: unknown; contas: unknown; credito: unknown }[]>`
      SELECT
        (SELECT COALESCE(SUM(valor), 0) FROM "LancamentoFinanceiro"
          WHERE "vendaId" = ${vendaId}::uuid AND "negocioId" = ${negocioId}::uuid AND origem = 'VENDA' AND tipo = 'ENTRADA') AS imediato,
        (SELECT COALESCE(SUM(c."valorPago"), 0) FROM "ContaPagarReceber" c
          JOIN "Parcela" p ON p.id = c."parcelaId" JOIN "Pagamento" pg ON pg.id = p."pagamentoId"
          WHERE pg."vendaId" = ${vendaId}::uuid AND c."negocioId" = ${negocioId}::uuid) AS contas,
        (SELECT COALESCE(SUM(valor), 0) FROM "Pagamento"
          WHERE "vendaId" = ${vendaId}::uuid AND "negocioId" = ${negocioId}::uuid AND forma = 'CREDITO_TROCA') AS credito`;
    return paraCentavos(num(r.imediato)!) + paraCentavos(num(r.contas)!) + paraCentavos(num(r.credito)!);
  }

  /**
   * Grava a venda dentro de uma transação (5.2): número sequencial, itens, baixas de estoque e
   * pagamentos. A troca (SPEC-011) usa a mesma função, com a venda de origem e o crédito.
   */
  async function gravarVenda(
    tx: Tx,
    c: DadosDoCarrinho,
    linhas: LinhaPreparada[],
    total: number,
    usuarioId: string,
    data: Date,
    troca?: { vendaOrigemId: string; creditoTrocaCentavos: number },
  ): Promise<{ id: string; numero: number }> {
    // Número sequencial (OPEN-007): a trava da linha do negócio serializa as vendas
    // do mesmo negócio; se a transação falhar, o incremento também é desfeito.
    const [{ numero }] = await tx.$queryRaw<{ numero: number }[]>`
      UPDATE "Negocio" SET "proximoNumeroVenda" = "proximoNumeroVenda" + 1
      WHERE id = ${negocioId}::uuid RETURNING "proximoNumeroVenda" - 1 AS numero`;
    const venda = await tx.venda.create({
      data: { id: c.id, negocioId, clienteId: c.clienteId, data, valorTotal: reais(total), numero, registradaPorId: usuarioId, vendaOrigemId: troca?.vendaOrigemId ?? null },
      select: { id: true, numero: true },
    });
    await tx.itemVenda.createMany({
      data: linhas.map((l) => ({
        negocioId,
        vendaId: venda.id,
        itemId: l.itemId,
        quantidade: l.quantidade.toFixed(3),
        precoUnitario: reais(l.precoCentavos),
        custoUnitario: l.custo.toFixed(2),
        // SPEC-017 (INV-002): o ajuste guarda o preço oficial do momento e o motivo.
        precoOficial: l.ajustePreco ? reais(l.precoOficialCentavos) : null,
        motivoAjustePreco: l.ajustePreco?.motivo ?? null,
        materiaisAjustados: Boolean(l.materiais),
      })),
    });

    // Baixa de estoque (RN05, RN06): produto físico pela quantidade; serviço, pelos materiais.
    const baixar = async (itemId: string, quantidade: number, nome: string, exigirAtivo: boolean) => {
      try {
        await movimentar(tx, negocioId, { itemId, tipo: "SAIDA_VENDA", quantidade, vendaId: venda.id, data, usuarioId, exigirAtivo });
      } catch (e) {
        if (e instanceof EstoqueInsuficiente) {
          const m = await tx.item.findFirst({ where: { id: itemId }, select: { nome: true, unidadeMedida: true } });
          throw new EstoqueInsuficienteNaVenda(m?.nome ?? nome, e.saldo, m?.unidadeMedida ?? "");
        }
        throw e;
      }
    };
    for (const l of linhas) {
      if (l.tipo === "PRODUTO_FISICO") await baixar(l.itemId, l.quantidade, l.nome, true);
      else {
        // Quantidades padrão (catálogo × quantidade) ou as usadas na venda (SPEC-017, INV-004).
        for (const b of l.baixas) {
          // Material arquivado continua sendo consumido pelo serviço (SPEC-006, OPEN-006).
          if (b.quantidade > 0) await baixar(b.materialId, b.quantidade, l.nome, false);
        }
      }
    }

    // Crédito de troca (RN26): pagamento sem lançamento — o dinheiro já está no caixa desde a venda original.
    if (troca && troca.creditoTrocaCentavos > 0) {
      await tx.pagamento.create({ data: { negocioId, vendaId: venda.id, forma: "CREDITO_TROCA", valor: reais(troca.creditoTrocaCentavos), parcelas: 1 } });
    }

    // Pagamentos (RN09, RN10, RN11).
    for (const p of c.pagamentos) {
      const pagamento = await tx.pagamento.create({
        data: { negocioId, vendaId: venda.id, forma: p.forma, valor: reais(p.valorCentavos), parcelas: p.parcelas },
        select: { id: true },
      });
      if (ehImediato(p.forma)) {
        // A forma vai na descrição para distinguir os lançamentos de um pagamento misto no
        // extrato (como já acontece no reembolso).
        await tx.lancamentoFinanceiro.create({
          data: {
            negocioId,
            vendaId: venda.id,
            origem: "VENDA",
            tipo: "ENTRADA",
            categoria: "VENDAS",
            descricao: `Venda nº ${venda.numero} — ${FORMAS_DE_PAGAMENTO[p.forma]}`,
            valor: reais(p.valorCentavos),
            data,
            usuarioId,
          },
        });
        continue;
      }
      const valores = dividirEmParcelas(p.valorCentavos, p.parcelas);
      for (let k = 1; k <= valores.length; k++) {
        const vencimento = meioDia(vencimentoDaParcela(c.dia, k));
        const parcela = await tx.parcela.create({
          data: { negocioId, pagamentoId: pagamento.id, numero: k, valor: reais(valores[k - 1]), vencimento },
          select: { id: true },
        });
        await tx.contaPagarReceber.create({
          data: {
            negocioId,
            parcelaId: parcela.id,
            tipo: "RECEBER",
            categoria: "VENDAS",
            descricao: `Venda nº ${venda.numero} — parcela ${k}/${valores.length}`,
            valorTotal: reais(valores[k - 1]),
            vencimento,
            status: "ABERTA",
          },
        });
      }
    }
    return venda;
  }

  return {
    /** SPEC-021: opção "Emito nota fiscal de produtos" (condição do aviso de cliente incompleto, SPEC-022 5.4). */
    async emiteNotaDeProduto(): Promise<boolean> {
      const negocio = await cliente.negocio.findFirst({ select: { emiteNotaDeProduto: true } });
      return negocio?.emiteNotaDeProduto ?? false;
    },

    /** SPEC-021 (5.6): produtos físicos com preço que estão fora da venda por falta de NCM (opção ligada). */
    async foraDaVendaPorFaltaDeNcm(): Promise<number> {
      const negocio = await cliente.negocio.findFirst({ select: { emiteNotaDeProduto: true } });
      if (!negocio?.emiteNotaDeProduto) return 0;
      return cliente.item.count({ where: { arquivadoEm: null, precoAtual: { not: null }, tipo: "PRODUTO_FISICO", ncm: null } });
    },

    /**
     * Itens que podem entrar na venda: não arquivados e com preço oficial (RN23). Com a nota fiscal de
     * produtos ligada, também sem os produtos físicos sem NCM (SPEC-021, RN35).
     */
    async itensVendaveis(): Promise<ItemVendavel[]> {
      const negocio = await cliente.negocio.findFirst({ select: { emiteNotaDeProduto: true } });
      const itens = await cliente.item.findMany({
        where: {
          arquivadoEm: null,
          precoAtual: { not: null },
          ...(negocio?.emiteNotaDeProduto ? { OR: [{ tipo: "SERVICO" as const }, { ncm: { not: null } }] } : {}),
        },
        select: {
          id: true,
          nome: true,
          codigo: true,
          tipo: true,
          unidadeMedida: true,
          precoAtual: true,
          custoBase: true,
          quantidadeEstoque: true,
          materiais: { select: { materialId: true, quantidade: true, material: { select: { nome: true, quantidadeEstoque: true, unidadeMedida: true, custoBase: true } } } },
        },
        orderBy: { nome: "asc" },
        take: 2000,
      });
      return itens.map((i) => ({
        id: i.id,
        nome: i.nome,
        codigo: i.codigo,
        tipo: i.tipo,
        unidadeMedida: i.unidadeMedida,
        preco: num(i.precoAtual)!,
        saldo: i.tipo === "PRODUTO_FISICO" ? num(i.quantidadeEstoque) : null,
        custoBase: num(i.custoBase)!,
        materiais: i.materiais.map((m) => ({
          materialId: m.materialId,
          nome: m.material.nome,
          quantidade: num(m.quantidade)!,
          saldo: num(m.material.quantidadeEstoque)!,
          unidadeMedida: m.material.unidadeMedida,
          custo: num(m.material.custoBase)!,
        })),
      }));
    },

    /**
     * Seletor de cliente da venda (SPEC-022, 5.10): só o nome de exibição e o que falta para a
     * nota (aviso da 5.4), sem dado pessoal; anonimizados ficam fora (INV-011).
     */
    async clientes(): Promise<ClienteDaVenda[]> {
      const lista = await cliente.cliente.findMany({
        where: { anonimizadoEm: null },
        select: {
          id: true,
          tipo: true,
          nome: true,
          nomeFantasia: true,
          documento: true,
          situacaoIe: true,
          inscricaoEstadual: true,
          cep: true,
          logradouro: true,
          numero: true,
          bairro: true,
          municipio: true,
          uf: true,
        },
        orderBy: { nome: "asc" },
        take: 1000,
      });
      return lista
        .map((c) => ({ id: c.id, nome: opcoes.mascararClientes ? mascararNome(nomeDeExibicao(c)) : nomeDeExibicao(c), faltando: faltandoParaNota(c) }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },

    /**
     * Registra a venda (5.2). Se o carrinho já virou venda (clique duplo, rede lenta),
     * devolve a venda existente em vez de criar outra (INV-009).
     */
    async registrar(c: DadosDoCarrinho, usuarioId: string, agora = new Date(), opcoes: OpcoesDaVenda = {}): Promise<{ id: string; numero: number; jaExistia: boolean }> {
      const existente = await cliente.venda.findFirst({ where: { id: c.id }, select: { id: true, numero: true } });
      if (existente) return { ...existente, jaExistia: true };
      const { linhas, total } = await prepararVenda(c, opcoes);
      conferirSoma(linhas, total, c.pagamentos.reduce((s, p) => s + p.valorCentavos, 0), total);
      const data = instanteDaOcorrencia(c.dia, agora);
      try {
        return await cliente.$transaction(async (tx) => ({ ...(await gravarVenda(tx as unknown as Tx, c, linhas, total, usuarioId, data)), jaExistia: false }), {
          timeout: 30_000,
        });
      } catch (e) {
        // Envio simultâneo do mesmo carrinho: a outra transação gravou a venda primeiro.
        if (ehUnicidade(e)) {
          const gravada = await cliente.venda.findFirst({ where: { id: c.id }, select: { id: true, numero: true } });
          if (gravada) return { ...gravada, jaExistia: true };
        }
        throw e;
      }
    },

    /** Prévia do cancelamento (SPEC-011, 5.1): o que volta, o que é cancelado e o recebido. */
    async previaDoCancelamento(id: string): Promise<PreviaDoCancelamento> {
      if (!UUID.test(id)) throw new VendaNaoEncontrada();
      const v = await cliente.venda.findFirst({
        where: { id },
        select: {
          id: true,
          numero: true,
          status: true,
          valorTotal: true,
          vendaOrigem: { select: { id: true, numero: true } },
          cliente: { select: { id: true, anonimizadoEm: true } },
          movimentacoes: { where: { tipo: "SAIDA_VENDA" }, select: { itemId: true, quantidade: true, item: { select: { nome: true, unidadeMedida: true } } } },
        },
      });
      if (!v) throw new VendaNaoEncontrada();
      const devolucoes = new Map<string, { itemId: string; nome: string; unidadeMedida: string; quantidade: number }>();
      for (const m of v.movimentacoes) {
        const atual = devolucoes.get(m.itemId) ?? { itemId: m.itemId, nome: m.item.nome, unidadeMedida: m.item.unidadeMedida, quantidade: 0 };
        devolucoes.set(m.itemId, { ...atual, quantidade: Math.round((atual.quantidade + num(m.quantidade)!) * 1000) / 1000 });
      }
      const [r, [contas]] = await Promise.all([
        recebido(cliente, v.id),
        cliente.$queryRaw<{ quantidade: number; restante: unknown }[]>`
          SELECT COUNT(*)::int AS quantidade, COALESCE(SUM(c."valorTotal" - c."valorPago"), 0) AS restante
          FROM "ContaPagarReceber" c JOIN "Parcela" p ON p.id = c."parcelaId" JOIN "Pagamento" pg ON pg.id = p."pagamentoId"
          WHERE pg."vendaId" = ${v.id}::uuid AND c."negocioId" = ${negocioId}::uuid AND c.status IN ('ABERTA', 'PARCIAL')`,
      ]);
      return {
        id: v.id,
        numero: v.numero,
        status: v.status,
        valorTotalCentavos: paraCentavos(num(v.valorTotal)!),
        trocaDe: v.vendaOrigem,
        clienteId: v.cliente && !v.cliente.anonimizadoEm ? v.cliente.id : null,
        devolucoes: [...devolucoes.values()],
        contasAbertas: { quantidade: contas.quantidade, restanteCentavos: paraCentavos(num(contas.restante)!) },
        recebidoCentavos: r,
      };
    },

    /**
     * Cancelar (e, opcionalmente, trocar) a venda numa única transação (SPEC-011, 5.1 e 5.2;
     * RN25, RN26, INV-001): status, estorno exato do estoque, contas abertas canceladas,
     * venda de troca com crédito e lançamento de reembolso.
     */
    async cancelar(id: string, d: Cancelamento, usuarioId: string, agora = new Date()): Promise<ResultadoDoCancelamento> {
      if (!UUID.test(id)) throw new VendaNaoEncontrada();
      // Troca reenviada (clique duplo): a venda de troca já existe e aponta para esta venda.
      if (d.troca) {
        const ja = await cliente.venda.findFirst({ where: { id: d.troca.id }, select: { id: true, numero: true, vendaOrigemId: true } });
        if (ja) {
          if (ja.vendaOrigemId !== id) throw new VendaNaoEncontrada();
          return { numero: 0, trocaId: ja.id, trocaNumero: ja.numero, creditoCentavos: 0, reembolsoCentavos: 0, jaExistia: true };
        }
      }
      const troca = d.troca ? await prepararVenda(d.troca) : null;
      try {
        return await cliente.$transaction(
          async (t) => {
            const tx = t as unknown as Tx;
            // 1) Status por atualização condicional: dois cancelamentos simultâneos nunca acontecem (INV-006).
            const [venda] = await tx.$queryRaw<{ numero: number; valorTotal: unknown }[]>`
              UPDATE "Venda" SET status = 'CANCELADA', "canceladaEm" = ${agora}, "canceladaPorId" = ${usuarioId}::uuid, "motivoCancelamento" = ${d.motivo}
              WHERE id = ${id}::uuid AND "negocioId" = ${negocioId}::uuid AND status = 'CONCLUIDA'
              RETURNING numero, "valorTotal"`;
            if (!venda) {
              const existe = await tx.venda.findFirst({ where: { id }, select: { status: true } });
              throw existe ? new VendaJaCancelada() : new VendaNaoEncontrada();
            }
            const valorTotal = paraCentavos(num(venda.valorTotal)!);
            if (troca && troca.total > valorTotal) throw new TrocaAcimaDoOriginal(valorTotal);

            // 2) Estoque: cada baixa da venda volta com a mesma quantidade (INV-002), mesmo de item arquivado.
            const baixas = await tx.movimentacaoEstoque.findMany({
              where: { vendaId: id, tipo: "SAIDA_VENDA" },
              select: { itemId: true, quantidade: true },
              orderBy: { registradoEm: "asc" },
            });
            for (const b of baixas) {
              await movimentar(tx, negocioId, {
                itemId: b.itemId,
                tipo: "ENTRADA_ESTORNO",
                quantidade: num(b.quantidade)!,
                vendaId: id,
                data: agora,
                usuarioId,
                exigirAtivo: false,
                observacao: `Cancelamento da venda nº ${venda.numero}`,
              });
            }

            // 3) Contas abertas da venda → canceladas; o recebido é lido depois, com as contas travadas.
            await tx.$executeRaw`
              UPDATE "ContaPagarReceber" c SET status = 'CANCELADA'
              FROM "Parcela" p, "Pagamento" pg
              WHERE c."parcelaId" = p.id AND p."pagamentoId" = pg.id AND pg."vendaId" = ${id}::uuid
                AND c."negocioId" = ${negocioId}::uuid AND c.status IN ('ABERTA', 'PARCIAL')`;
            const acerto = acertoDoCancelamento(await recebido(tx, id), troca ? troca.total : null);

            // 4) Troca: nova venda com crédito de troca (sem lançamento) e o restante em formas normais.
            let nova: { id: string; numero: number } | null = null;
            if (troca && d.troca) {
              conferirSoma(troca.linhas, troca.total, d.troca.pagamentos.reduce((s, p) => s + p.valorCentavos, 0), acerto.restanteCentavos, acerto.creditoCentavos);
              nova = await gravarVenda(tx, d.troca, troca.linhas, troca.total, usuarioId, agora, { vendaOrigemId: id, creditoTrocaCentavos: acerto.creditoCentavos });
            }

            // 5) Reembolso: um lançamento de saída com a forma escolhida (OPEN-003).
            if (acerto.reembolsoCentavos > 0) {
              if (!d.formaReembolso) throw new FormaDeReembolsoAusente(acerto.reembolsoCentavos);
              await tx.lancamentoFinanceiro.create({
                data: {
                  negocioId,
                  vendaId: id,
                  origem: "ESTORNO",
                  estorno: true,
                  tipo: "SAIDA",
                  categoria: "VENDAS",
                  valor: reais(acerto.reembolsoCentavos),
                  descricao: `Reembolso da venda nº ${venda.numero} — ${FORMAS_DE_REEMBOLSO[d.formaReembolso]}`,
                  data: agora,
                  usuarioId,
                },
              });
            }
            return {
              numero: venda.numero,
              trocaId: nova?.id ?? null,
              trocaNumero: nova?.numero ?? null,
              creditoCentavos: acerto.creditoCentavos,
              reembolsoCentavos: acerto.reembolsoCentavos,
              jaExistia: false,
            };
          },
          { timeout: 30_000 },
        );
      } catch (e) {
        // A mesma troca enviada duas vezes ao mesmo tempo: a outra transação gravou primeiro (e,
        // por isso, esta encontrou a venda já cancelada ou o id da troca já usado).
        if (d.troca && (ehUnicidade(e) || e instanceof VendaJaCancelada)) {
          const gravada = await cliente.venda.findFirst({ where: { id: d.troca.id, vendaOrigemId: id }, select: { id: true, numero: true } });
          if (gravada) return { numero: 0, trocaId: gravada.id, trocaNumero: gravada.numero, creditoCentavos: 0, reembolsoCentavos: 0, jaExistia: true };
        }
        throw e;
      }
    },

    /** Histórico (5.4): vendas no intervalo [inicio, fim), da mais nova para a mais antiga. */
    async listar(inicio: Date, fim: Date): Promise<{ vendas: VendaResumida[]; totalConcluidas: number }> {
      const vendas = await cliente.venda.findMany({
        where: { data: { gte: inicio, lt: fim } },
        orderBy: [{ data: "desc" }, { numero: "desc" }],
        take: 2000,
        select: {
          id: true,
          numero: true,
          data: true,
          valorTotal: true,
          status: true,
          cliente: { select: { nome: true } },
          registradaPor: { select: { nome: true } },
          pagamentos: { select: { forma: true } },
          _count: { select: { itens: true } },
          itens: { where: { precoOficial: { not: null } }, select: { id: true }, take: 1 },
        },
      });
      const lista = vendas.map((v) => ({
        id: v.id,
        numero: v.numero,
        data: v.data,
        valorTotal: num(v.valorTotal)!,
        status: v.status,
        cliente: nomeDoCliente(v.cliente?.nome),
        registradaPor: v.registradaPor.nome,
        itens: v._count.itens,
        formas: [...new Set(v.pagamentos.map((p) => p.forma))],
        precoAjustado: v.itens.length > 0,
      }));
      const totalConcluidas = lista.filter((v) => v.status === "CONCLUIDA").reduce((s, v) => s + paraCentavos(v.valorTotal), 0) / 100;
      return { vendas: lista, totalConcluidas };
    },

    async detalhar(id: string): Promise<DetalheDaVenda> {
      if (!UUID.test(id)) throw new VendaNaoEncontrada();
      const v = await cliente.venda.findFirst({
        where: { id },
        include: {
          cliente: { select: { nome: true } },
          registradaPor: { select: { nome: true } },
          canceladaPor: { select: { nome: true } },
          vendaOrigem: { select: { id: true, numero: true } },
          vendaTroca: { select: { id: true, numero: true } },
          lancamentos: { where: { estorno: true }, select: { valor: true, descricao: true } },
          itens: { include: { item: { select: { nome: true, codigo: true, unidadeMedida: true } } } },
          pagamentos: { include: { detalheParcelas: { include: { conta: { select: { status: true, valorPago: true } } }, orderBy: { numero: "asc" } } } },
          movimentacoes: { include: { item: { select: { nome: true } } }, orderBy: { registradoEm: "asc" } },
        },
      });
      if (!v) throw new VendaNaoEncontrada();
      const reembolso = v.lancamentos[0];
      return {
        id: v.id,
        numero: v.numero,
        data: v.data,
        valorTotal: num(v.valorTotal)!,
        status: v.status,
        cliente: nomeDoCliente(v.cliente?.nome),
        registradaPor: v.registradaPor.nome,
        itens: v.itens.length,
        formas: [...new Set(v.pagamentos.map((p) => p.forma))],
        precoAjustado: v.itens.some((i) => i.precoOficial !== null),
        itensVenda: v.itens.map((i) => ({
          itemId: i.itemId,
          nome: i.item.nome,
          codigo: i.item.codigo,
          unidadeMedida: i.item.unidadeMedida,
          quantidade: num(i.quantidade)!,
          precoUnitario: num(i.precoUnitario)!,
          subtotal: subtotalEmCentavos(paraCentavos(num(i.precoUnitario)!), num(i.quantidade)!) / 100,
          precoOficial: num(i.precoOficial),
          motivoAjustePreco: i.motivoAjustePreco,
          materiaisAjustados: i.materiaisAjustados,
        })),
        pagamentos: v.pagamentos.map((p) => ({
          forma: p.forma,
          valor: num(p.valor)!,
          parcelas: p.detalheParcelas.map((pa) => ({
            numero: pa.numero,
            valor: num(pa.valor)!,
            vencimento: pa.vencimento,
            status: pa.conta?.status ?? null,
            valorPago: num(pa.conta?.valorPago ?? 0)!,
          })),
        })),
        movimentacoes: v.movimentacoes.map((m) => ({
          itemId: m.itemId,
          nome: m.item.nome,
          tipo: m.tipo,
          quantidade: num(m.quantidade)!,
          saldoAnterior: num(m.saldoAnterior)!,
          saldoPosterior: num(m.saldoPosterior)!,
        })),
        cancelamento:
          v.status === "CANCELADA" && v.canceladaEm
            ? {
                em: v.canceladaEm,
                por: v.canceladaPor?.nome ?? "—",
                motivo: v.motivoCancelamento ?? "",
                reembolso: reembolso ? { valor: num(reembolso.valor)!, descricao: reembolso.descricao ?? "Reembolso" } : null,
              }
            : null,
        trocaDe: v.vendaOrigem,
        trocadaPor: v.vendaTroca,
      };
    },
  };
}

export type ConsultasDeVendas = ReturnType<typeof criarConsultasDeVendas>;
