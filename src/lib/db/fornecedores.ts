import type { StatusConta } from "@/generated/prisma/enums";
import type { DadosDoCliente } from "@/lib/clientes/validacao";
import { dataBrasileira, diaLocal } from "@/lib/dominio/datas";
import { faltandoParaNota, nomeDeExibicao, type TipoCliente } from "@/lib/dominio/cliente";
import { centavosDe, estaAtrasada } from "@/lib/dominio/financeiro";
import { FORNECEDOR_ANONIMO } from "@/lib/dominio/lgpd";
import { pode, type Matriz } from "@/lib/dominio/permissoes";
import { CAMPOS, CAMPOS_DO_FORMULARIO, condicaoDaBusca, ehUnicidade, exibicaoDoCadastro, type ClienteDaLista, type DetalheDoCliente, type ValoresDoCliente, type Visao } from "./clientes";
import type { ClienteDoNegocio } from "./cliente-do-negocio";

/**
 * Fornecedores do negócio (SPEC-026, 5.1 a 5.3): lista, detalhe com as contas, cadastro, edição e
 * exclusão. Os mesmos campos e a mesma máscara do cliente (OPEN-002, OPEN-005), aplicada aqui, no
 * servidor: quem não pode editar no Financeiro nunca recebe o documento, o e-mail, o telefone nem
 * o endereço completos; o suporte, nem o nome (OPEN-011).
 */

export class FornecedorNaoEncontrado extends Error {
  constructor() {
    super("Fornecedor não encontrado.");
    this.name = "FornecedorNaoEncontrado";
  }
}

/** Documento já usado por outro fornecedor ativo do negócio (5.1, item 4; INV-005). */
export class DocumentoDoFornecedorRepetido extends Error {
  constructor(
    public readonly tipo: TipoCliente,
    /** Nome do outro fornecedor, já com a máscara de quem pediu (null no modo suporte). */
    public readonly outro: string | null,
  ) {
    super("Documento repetido.");
    this.name = "DocumentoDoFornecedorRepetido";
  }
}

/** A visão sai do contexto (OPEN-005): suporte; Financeiro — editar vê tudo; quem só vê, mascarado. */
export function visaoDoFornecedor(contexto: { modoSuporte?: boolean; permissoes: Matriz }): Visao {
  if (contexto.modoSuporte) return "suporte";
  return pode(contexto.permissoes, "financeiro", "editar") ? "completa" : "mascarada";
}

export const LIMITE_DE_FORNECEDORES = 500;
export const LIMITE_DE_CONTAS_DO_FORNECEDOR = 50;

export type FornecedorDaLista = ClienteDaLista;
export type DetalheDoFornecedor = DetalheDoCliente;
export type ValoresDoFornecedor = ValoresDoCliente;

export type ContaDoFornecedor = {
  id: string;
  descricao: string | null;
  numeroDocumento: string | null;
  /** dd/mm/aaaa. */
  vencimento: string;
  valorCentavos: number;
  status: StatusConta;
  atrasada: boolean;
};

/** Para os seletores das contas e das despesas (5.4): só o nome (OPEN-006). */
export type OpcaoDePessoa = { id: string; nome: string };

/** Todos os dados pessoais vazios (INV-006; o banco confere com Fornecedor_anonimizado_sem_dados). */
export const FORNECEDOR_SEM_DADOS = {
  nome: FORNECEDOR_ANONIMO,
  nomeFantasia: null,
  documento: null,
  situacaoIe: null,
  inscricaoEstadual: null,
  inscricaoMunicipal: null,
  nomeContato: null,
  email: null,
  telefone: null,
  cep: null,
  logradouro: null,
  numero: null,
  complemento: null,
  bairro: null,
  municipio: null,
  uf: null,
} as const;

export function criarConsultasDeFornecedores(cliente: ClienteDoNegocio, negocioId: string, visao: Visao) {
  const { nomeVisto, paraLista, paraDetalhe } = exibicaoDoCadastro(visao);

  /** O outro fornecedor com o mesmo documento, para a mensagem de repetido. */
  async function conferirDocumento(tx: ClienteDoNegocio, dados: DadosDoCliente, exceto?: string) {
    if (!dados.documento) return;
    const outro = await tx.fornecedor.findFirst({
      where: { documento: dados.documento, anonimizadoEm: null, ...(exceto ? { id: { not: exceto } } : {}) },
      select: { tipo: true, nome: true, nomeFantasia: true },
    });
    if (outro) throw new DocumentoDoFornecedorRepetido(dados.tipo, visao === "suporte" ? null : nomeDeExibicao(outro));
  }

  return {
    visao,

    async listar(filtro: { busca?: string; incompletos?: boolean } = {}): Promise<{ fornecedores: FornecedorDaLista[]; maisFornecedores: boolean }> {
      const linhas = await cliente.fornecedor.findMany({
        where: { anonimizadoEm: null, ...condicaoDaBusca(filtro.busca ?? "") },
        select: CAMPOS,
        orderBy: { nome: "asc" },
        take: LIMITE_DE_FORNECEDORES + 1,
      });
      const lista = linhas
        .slice(0, LIMITE_DE_FORNECEDORES)
        .map(paraLista)
        .filter((f) => !filtro.incompletos || !f.completoParaNota)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return { fornecedores: lista, maisFornecedores: linhas.length > LIMITE_DE_FORNECEDORES };
    },

    /** Para o seletor da conta a pagar e da despesa fixa (5.4): os ativos, pelo nome de exibição. */
    async opcoes(): Promise<OpcaoDePessoa[]> {
      const lista = await cliente.fornecedor.findMany({
        where: { anonimizadoEm: null },
        select: { id: true, tipo: true, nome: true, nomeFantasia: true },
        orderBy: { nome: "asc" },
        take: 1000,
      });
      return lista.map((f) => ({ id: f.id, nome: nomeVisto(nomeDeExibicao(f)) })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },

    /** Detalhe (5.1, item 7): os dados, as contas a pagar (as 50 mais recentes), os totais e as despesas fixas. */
    async detalhar(id: string, hoje: string) {
      const f = await cliente.fornecedor.findFirst({ where: { id, anonimizadoEm: null }, select: CAMPOS });
      if (!f) throw new FornecedorNaoEncontrado();
      const [contas, quantidade, totais, emAberto, despesas] = await Promise.all([
        cliente.contaPagarReceber.findMany({
          where: { fornecedorId: id },
          select: { id: true, descricao: true, numeroDocumento: true, vencimento: true, valorTotal: true, valorPago: true, status: true },
          orderBy: [{ vencimento: "desc" }, { id: "asc" }],
          take: LIMITE_DE_CONTAS_DO_FORNECEDOR,
        }),
        cliente.contaPagarReceber.count({ where: { fornecedorId: id } }),
        cliente.contaPagarReceber.aggregate({ where: { fornecedorId: id }, _sum: { valorPago: true } }),
        cliente.contaPagarReceber.aggregate({ where: { fornecedorId: id, status: { in: ["ABERTA", "PARCIAL"] } }, _sum: { valorTotal: true, valorPago: true } }),
        cliente.despesaFixa.findMany({ where: { fornecedorId: id }, select: { id: true, descricao: true, ativo: true }, orderBy: [{ ativo: "desc" }, { descricao: "asc" }] }),
      ]);
      const lista: ContaDoFornecedor[] = contas.map((c) => ({
        id: c.id,
        descricao: c.descricao,
        numeroDocumento: c.numeroDocumento,
        vencimento: dataBrasileira(c.vencimento),
        valorCentavos: centavosDe(c.valorTotal),
        status: c.status,
        atrasada: estaAtrasada({ vencimento: diaLocal(c.vencimento), status: c.status, totalCentavos: centavosDe(c.valorTotal), pagoCentavos: centavosDe(c.valorPago) }, hoje),
      }));
      return {
        fornecedor: paraDetalhe(f),
        contas: lista,
        quantidadeDeContas: quantidade,
        pagoCentavos: centavosDe(totais._sum.valorPago ?? 0),
        emAbertoCentavos: centavosDe(emAberto._sum.valorTotal ?? 0) - centavosDe(emAberto._sum.valorPago ?? 0),
        despesas,
      };
    },

    /** Valores do formulário de edição: só para quem edita (a página já exige Financeiro — editar). */
    async valores(id: string): Promise<ValoresDoFornecedor> {
      if (visao !== "completa") throw new FornecedorNaoEncontrado();
      const f = await cliente.fornecedor.findFirst({ where: { id, anonimizadoEm: null }, select: CAMPOS_DO_FORMULARIO });
      if (!f) throw new FornecedorNaoEncontrado();
      return f;
    },

    /** E-mail e telefone gravados (para aceitar os antigos fora do formato). */
    async atuais(id: string): Promise<{ email: string | null; telefone: string | null } | null> {
      return cliente.fornecedor.findFirst({ where: { id, anonimizadoEm: null }, select: { email: true, telefone: true } });
    },

    async criar(dados: DadosDoCliente) {
      try {
        return await cliente.$transaction(async (tx) => {
          await conferirDocumento(tx as ClienteDoNegocio, dados);
          const f = await tx.fornecedor.create({ data: { ...dados, negocioId }, select: CAMPOS });
          return { id: f.id, nome: nomeVisto(nomeDeExibicao(f)), faltando: faltandoParaNota(f) };
        });
      } catch (e) {
        if (ehUnicidade(e)) throw new DocumentoDoFornecedorRepetido(dados.tipo, null);
        throw e;
      }
    },

    async editar(id: string, dados: DadosDoCliente) {
      try {
        await cliente.$transaction(async (tx) => {
          const atual = await tx.fornecedor.findFirst({ where: { id, anonimizadoEm: null }, select: { id: true } });
          if (!atual) throw new FornecedorNaoEncontrado();
          await conferirDocumento(tx as ClienteDoNegocio, dados, id);
          await tx.fornecedor.update({ where: { id }, data: dados });
        });
      } catch (e) {
        if (ehUnicidade(e)) throw new DocumentoDoFornecedorRepetido(dados.tipo, null);
        throw e;
      }
    },

    /**
     * Exclusão (OPEN-004, 5.3): sem contas nem despesas fixas, apaga; com elas, anonimiza — as contas
     * e as despesas continuam ligadas a ele, com os mesmos valores. A linha fica travada até o fim.
     */
    async excluir(id: string): Promise<"apagado" | "anonimizado"> {
      return cliente.$transaction(async (tx) => {
        const travado = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Fornecedor" WHERE "id" = ${id}::uuid AND "negocioId" = ${negocioId}::uuid AND "anonimizadoEm" IS NULL FOR UPDATE`;
        if (!travado.length) throw new FornecedorNaoEncontrado();
        const [contas, despesas] = await Promise.all([tx.contaPagarReceber.count({ where: { fornecedorId: id } }), tx.despesaFixa.count({ where: { fornecedorId: id } })]);
        if (contas + despesas === 0) {
          await tx.fornecedor.delete({ where: { id } });
          return "apagado";
        }
        await tx.fornecedor.update({ where: { id }, data: { ...FORNECEDOR_SEM_DADOS, anonimizadoEm: new Date() } });
        return "anonimizado";
      });
    },

    /** Quantas contas e despesas fixas tem (para o texto da confirmação de exclusão, 5.3). */
    async vinculos(id: string) {
      const [contas, despesas] = await Promise.all([cliente.contaPagarReceber.count({ where: { fornecedorId: id } }), cliente.despesaFixa.count({ where: { fornecedorId: id } })]);
      return { contas, despesas };
    },
  };
}

export type ConsultasDeFornecedores = ReturnType<typeof criarConsultasDeFornecedores>;
