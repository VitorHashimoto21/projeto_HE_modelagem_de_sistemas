import type {
  AtividadeMei,
  CategoriaLancamento,
  MotivoAcrescimo,
  MotivoDesconto,
  OrigemDespesaFixa,
  OrigemLancamento,
  StatusConta,
  TipoConta,
  TipoLancamento,
} from "@/generated/prisma/enums";
import { intervaloDaCompetencia, intervaloDoDia } from "@/lib/dominio/datas";
import {
  centavosDe,
  competenciaDoDia,
  competenciasDevidas,
  descricaoDaContaFixa,
  descricaoDoEstorno,
  DIA_VENCIMENTO_DAS,
  estaAtrasada,
  descontoDaTaxa,
  primeiraCompetencia,
  reaisTexto,
  restanteDaConta,
  tipoDoPagamento,
  vencimentoNaCompetencia,
} from "@/lib/dominio/financeiro";
import { filtraPagamentos, SEM_FILTROS, type FiltrosDasContas, type FormaDoPagamento } from "@/lib/dominio/contas";
import { nomeDeExibicao, type TipoCliente } from "@/lib/dominio/cliente";
import { mascararNome } from "@/lib/dominio/suporte";
import { ClienteNaoEncontrado } from "./clientes";
import type { ClienteDoNegocio } from "./cliente-do-negocio";
import { autorDoHistorico } from "./autor";
import { FornecedorNaoEncontrado } from "./fornecedores";

/**
 * Financeiro do negócio ativo (SPEC-009). Leituras e escritas pelo cliente do negócio; as
 * consultas SQL diretas (pagamento condicional, agregados e trava) filtram o negocioId à mão.
 * Dinheiro entra e sai daqui em centavos inteiros.
 */

export class LancamentoNaoEncontrado extends Error {
  constructor() {
    super("Lançamento não encontrado.");
    this.name = "LancamentoNaoEncontrado";
  }
}
export class JaEstornado extends Error {
  constructor() {
    super("Este lançamento já foi estornado.");
    this.name = "JaEstornado";
  }
}
export class NaoEstornavel extends Error {
  constructor(public readonly origem: OrigemLancamento) {
    super("Este lançamento não pode ser estornado.");
    this.name = "NaoEstornavel";
  }
}
export class SaldoInicialJaInformado extends Error {
  constructor() {
    super("O saldo inicial já foi informado.");
    this.name = "SaldoInicialJaInformado";
  }
}
export class ContaNaoEncontrada extends Error {
  constructor() {
    super("Conta não encontrada.");
    this.name = "ContaNaoEncontrada";
  }
}
export class ContaEncerrada extends Error {
  constructor(public readonly status: StatusConta) {
    super("Conta quitada ou cancelada.");
    this.name = "ContaEncerrada";
  }
}
export class ValorAcimaDoRestante extends Error {
  constructor(public readonly restanteCentavos: number) {
    super("Valor acima do restante da conta.");
    this.name = "ValorAcimaDoRestante";
  }
}
/** SPEC-028 (5.5): conta cancelada, ou de venda cancelada, não tem pagamento estornado. */
export class EstornoNaoPermitido extends Error {
  constructor() {
    super("Esta conta foi cancelada ou é de uma venda cancelada; o pagamento não pode ser estornado.");
    this.name = "EstornoNaoPermitido";
  }
}
export class ContaNaoEditavel extends Error {
  constructor(public readonly motivo: "venda" | "despesa" | "com-pagamento" | "encerrada") {
    super("Esta conta não pode ser alterada.");
    this.name = "ContaNaoEditavel";
  }
}
export class DespesaNaoEncontrada extends Error {
  constructor() {
    super("Despesa fixa não encontrada.");
    this.name = "DespesaNaoEncontrada";
  }
}
export class DasNaoEditavel extends Error {
  constructor() {
    super("O DAS do MEI só permite alterar o dia de vencimento.");
    this.name = "DasNaoEditavel";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const meioDia = (dia: string) => new Date(intervaloDoDia(dia).inicio.getTime() + 12 * 3_600_000);
const diaDaData = (d: Date) => d.toISOString().slice(0, 10);
const dataDaCompetencia = (comp: string) => new Date(`${comp}-01T00:00:00Z`);
const ehUnicidade = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
/** Dia local do instante gravado (meio-dia local para vencimentos e datas retroativas). */
const diaLocalDe = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

/** Transação (ou cliente) do negócio. */
type Tx = Pick<ClienteDoNegocio, "$queryRaw" | "contaPagarReceber" | "lancamentoFinanceiro">;

export type Pagamento = {
  contaId: string;
  valorCentavos: number;
  /** Instante do pagamento (OPEN-007). */
  data: Date;
  /** Nulo só no recebimento automático das parcelas (OPEN-008). */
  usuarioId: string | null;
  /** SPEC-026 (OPEN-008): obrigatória nos pagamentos pela tela; cartão de crédito no recebimento automático. */
  forma: FormaDoPagamento;
  /** SPEC-028 (OPEN-001, OPEN-005): desconto e acréscimo, cada um com o motivo; zero quando ausentes. */
  descontoCentavos?: number;
  acrescimoCentavos?: number;
  motivoDesconto?: MotivoDesconto | null;
  motivoAcrescimo?: MotivoAcrescimo | null;
  observacao?: string | null;
};

type ValoresLidos = { valorTotal: unknown; valorPago: unknown; valorDesconto: unknown; valorAcrescimo: unknown };
const restanteLido = (c: ValoresLidos) =>
  restanteDaConta({
    totalCentavos: centavosDe(c.valorTotal),
    pagoCentavos: centavosDe(c.valorPago),
    descontoCentavos: centavosDe(c.valorDesconto),
    acrescimoCentavos: centavosDe(c.valorAcrescimo),
  });

/**
 * Pagamento ou recebimento de conta (5.3, INV-002 a INV-004; SPEC-028, INV-001 a INV-003):
 * atualização condicional do pago, dos totais de desconto e acréscimo e do status com RETURNING,
 * mais o lançamento vinculado, na transação de quem chama. O lançamento é do valor real; a conta
 * abate valor + desconto − acréscimo. A linha da conta fica travada até o fim da transação, então
 * pagamentos simultâneos nunca ultrapassam o restante.
 */
export async function pagarConta(tx: Tx, negocioId: string, p: Pagamento): Promise<{ tipo: TipoConta; status: StatusConta; restanteCentavos: number; lancamentoId: string }> {
  if (!UUID.test(p.contaId)) throw new ContaNaoEncontrada();
  const v = reaisTexto(p.valorCentavos);
  const d = reaisTexto(p.descontoCentavos ?? 0);
  const a = reaisTexto(p.acrescimoCentavos ?? 0);
  const linhas = await tx.$queryRaw<({ tipo: TipoConta; categoria: CategoriaLancamento; descricao: string | null; status: StatusConta } & ValoresLidos)[]>`
    UPDATE "ContaPagarReceber"
    SET "valorPago" = "valorPago" + ${v}::numeric,
        "valorDesconto" = "valorDesconto" + ${d}::numeric,
        "valorAcrescimo" = "valorAcrescimo" + ${a}::numeric,
        status = (CASE WHEN "valorPago" + "valorDesconto" - "valorAcrescimo" + ${v}::numeric + ${d}::numeric - ${a}::numeric >= "valorTotal"
                       THEN 'QUITADA' ELSE 'PARCIAL' END)::"StatusConta"
    WHERE id = ${p.contaId}::uuid AND "negocioId" = ${negocioId}::uuid AND status IN ('ABERTA', 'PARCIAL')
      AND "valorPago" + "valorDesconto" - "valorAcrescimo" + ${v}::numeric + ${d}::numeric - ${a}::numeric <= "valorTotal"
    RETURNING tipo, categoria, descricao, "valorTotal", "valorPago", "valorDesconto", "valorAcrescimo", status`;

  if (linhas.length === 0) {
    const conta = await tx.contaPagarReceber.findFirst({
      where: { id: p.contaId },
      select: { status: true, valorTotal: true, valorPago: true, valorDesconto: true, valorAcrescimo: true },
    });
    if (!conta) throw new ContaNaoEncontrada();
    if (conta.status === "QUITADA" || conta.status === "CANCELADA") throw new ContaEncerrada(conta.status);
    throw new ValorAcimaDoRestante(restanteLido(conta));
  }

  const c = linhas[0];
  const lancamento = await tx.lancamentoFinanceiro.create({
    data: {
      negocioId,
      contaId: p.contaId,
      origem: "CONTA",
      tipo: tipoDoPagamento(c.tipo),
      categoria: c.categoria,
      valor: v,
      descricao: c.descricao ? c.descricao.slice(0, 120) : null,
      data: p.data,
      usuarioId: p.usuarioId,
      formaPagamento: p.forma,
      desconto: d,
      acrescimo: a,
      motivoDesconto: p.descontoCentavos ? (p.motivoDesconto ?? null) : null,
      motivoAcrescimo: p.acrescimoCentavos ? (p.motivoAcrescimo ?? null) : null,
      observacaoPagamento: p.observacao ?? null,
    },
    select: { id: true },
  });
  return { tipo: c.tipo, status: c.status, restanteCentavos: restanteLido(c), lancamentoId: lancamento.id };
}

/**
 * Estorno do pagamento de conta (SPEC-028, 5.5; INV-001, INV-006): o lançamento contrário, ligado ao
 * original e à mesma conta, e a conta sem o valor, o desconto e o acréscimo daquele pagamento, numa
 * transação. A linha da conta fica travada; um segundo estorno do mesmo pagamento esbarra na
 * unicidade do vínculo com o original. Nunca numa conta cancelada nem na de venda cancelada, cujo
 * valor recebido o cancelamento já devolveu (RN25).
 */
export async function estornarPagamento(tx: Tx, negocioId: string, lancamentoId: string, usuarioId: string, agora: Date): Promise<{ id: string; contaId: string; status: StatusConta; restanteCentavos: number }> {
  if (!UUID.test(lancamentoId)) throw new LancamentoNaoEncontrado();
  const l = await tx.lancamentoFinanceiro.findFirst({
    where: { id: lancamentoId, origem: "CONTA" },
    select: { contaId: true, tipo: true, categoria: true, valor: true, desconto: true, acrescimo: true, descricao: true, data: true, estornadoPor: { select: { id: true } } },
  });
  if (!l || !l.contaId) throw new LancamentoNaoEncontrado();
  if (l.estornadoPor) throw new JaEstornado();
  const [conta] = await tx.$queryRaw<{ status: StatusConta; vendaCancelada: boolean }[]>`
    SELECT c.status, COALESCE(v.status = 'CANCELADA', false) AS "vendaCancelada"
    FROM "ContaPagarReceber" c
    LEFT JOIN "Parcela" p ON p.id = c."parcelaId"
    LEFT JOIN "Pagamento" pg ON pg.id = p."pagamentoId"
    LEFT JOIN "Venda" v ON v.id = pg."vendaId"
    WHERE c.id = ${l.contaId}::uuid AND c."negocioId" = ${negocioId}::uuid
    FOR UPDATE OF c`;
  if (!conta) throw new ContaNaoEncontrada();
  if (conta.status === "CANCELADA" || conta.vendaCancelada) throw new EstornoNaoPermitido();

  let estorno: { id: string };
  try {
    estorno = await tx.lancamentoFinanceiro.create({
      data: {
        negocioId,
        contaId: l.contaId,
        estornoDeId: lancamentoId,
        origem: "ESTORNO",
        tipo: l.tipo === "ENTRADA" ? "SAIDA" : "ENTRADA",
        categoria: l.categoria,
        valor: l.valor,
        descricao: descricaoDoEstorno(l.descricao),
        // Etapa 4 (OPEN-009): o estorno corrige um registro, e não é dinheiro saindo de novo. Fica na data do
        // pagamento original, para os dois se anularem no mesmo dia; o momento do estorno fica em registradoEm.
        data: l.data,
        registradoEm: agora,
        usuarioId,
      },
      select: { id: true },
    });
  } catch (e) {
    if (ehUnicidade(e)) throw new JaEstornado();
    throw e;
  }
  const v = String(l.valor), d = String(l.desconto), a = String(l.acrescimo);
  const [c] = await tx.$queryRaw<({ status: StatusConta } & ValoresLidos)[]>`
    UPDATE "ContaPagarReceber"
    SET "valorPago" = "valorPago" - ${v}::numeric,
        "valorDesconto" = "valorDesconto" - ${d}::numeric,
        "valorAcrescimo" = "valorAcrescimo" - ${a}::numeric,
        status = (CASE WHEN "valorPago" - ${v}::numeric + "valorDesconto" - ${d}::numeric - "valorAcrescimo" + ${a}::numeric <= 0
                       THEN 'ABERTA' ELSE 'PARCIAL' END)::"StatusConta"
    WHERE id = ${l.contaId}::uuid AND "negocioId" = ${negocioId}::uuid
    RETURNING status, "valorTotal", "valorPago", "valorDesconto", "valorAcrescimo"`;
  return { id: estorno.id, contaId: l.contaId, status: c.status, restanteCentavos: restanteLido(c) };
}

export type LancamentoExibido = {
  id: string;
  tipo: TipoLancamento;
  origem: OrigemLancamento;
  categoria: CategoriaLancamento;
  valorCentavos: number;
  data: Date;
  registradoPor: string | null;
  descricao: string | null;
  venda: { id: string; numero: number } | null;
  conta: { id: string; descricao: string | null } | null;
  estornoDeId: string | null;
  estornado: boolean;
};

export type FluxoDeCaixa = {
  mes: string;
  saldoAtualCentavos: number;
  saldoInicioCentavos: number;
  entradasCentavos: number;
  saidasCentavos: number;
  saldoFimCentavos: number;
  saldoInicialInformado: boolean;
  lancamentos: LancamentoExibido[];
  pagina: number;
  paginas: number;
};

export type FiltroDoFluxo = { mes: string; categoria?: CategoriaLancamento; tipo?: TipoLancamento; pagina?: number };

export type SituacaoFiltrada = "abertas" | "atrasadas" | "quitadas" | "canceladas" | "todas";
/** `desde`: limite do histórico do plano gratuito (SPEC-013, OPEN-005) — quitadas e canceladas antes dele ficam fora. */
export type FiltroDasContas = { tipo: TipoConta; situacao: SituacaoFiltrada; pagina?: number; desde?: string | null; filtros?: FiltrosDasContas };

/** SPEC-026 (5.4): fornecedor (conta a pagar) ou cliente (conta a receber; na de venda, o da venda). */
export type PessoaDaConta = { id: string; nome: string; papel: "fornecedor" | "cliente"; daVenda: boolean };

/** SPEC-026 (5.6, item 4): totais de todas as contas filtradas, sem as canceladas nos valores. SPEC-028 (5.6): descontos e acréscimos. */
export type TotaisDasContas = { quantidade: number; totalCentavos: number; pagoCentavos: number; descontoCentavos: number; acrescimoCentavos: number; emAbertoCentavos: number };

export type ContaExibida = {
  id: string;
  tipo: TipoConta;
  categoria: CategoriaLancamento;
  descricao: string | null;
  totalCentavos: number;
  pagoCentavos: number;
  /** SPEC-028: totais dos descontos e dos acréscimos dos pagamentos. */
  descontoCentavos: number;
  acrescimoCentavos: number;
  restanteCentavos: number;
  vencimento: string;
  status: StatusConta;
  atrasada: boolean;
  origem: "venda" | "despesa" | "manual";
  pessoa: PessoaDaConta | null;
  numeroDocumento: string | null;
};

export type DetalheDaConta = ContaExibida & {
  criadaPor: string | null;
  venda: { id: string; numero: number } | null;
  despesa: { id: string; descricao: string } | null;
  lancamentos: {
    id: string;
    valorCentavos: number;
    data: Date;
    registradoPor: string | null;
    forma: FormaDoPagamento | null;
    /** SPEC-028: desconto e acréscimo do pagamento, com o motivo e a observação. */
    descontoCentavos: number;
    acrescimoCentavos: number;
    motivoDesconto: MotivoDesconto | null;
    motivoAcrescimo: MotivoAcrescimo | null;
    observacao: string | null;
    /** SPEC-028 (5.4, 5.5): quando e por quem o pagamento foi estornado. */
    estorno: { data: Date; registradoPor: string | null } | null;
  }[];
  /** SPEC-028 (5.5): os pagamentos podem ser estornados (nem conta cancelada, nem de venda cancelada). */
  estornavel: boolean;
  /** SPEC-028 (5.2): desconto sugerido pela taxa média da maquininha, nas contas de venda no cartão em aberto. */
  taxaSugerida: { taxa: number; descontoCentavos: number } | null;
};

export type DespesaExibida = {
  id: string;
  descricao: string;
  /** Nulo no DAS do MEI: o valor vem do parâmetro vigente (OPEN-005). */
  valorCentavos: number | null;
  diaVencimento: number;
  categoria: CategoriaLancamento;
  origem: OrigemDespesaFixa;
  ativo: boolean;
  /** SPEC-026 (5.4, item 4): repassado às contas que a despesa gerar. */
  fornecedor: { id: string; nome: string } | null;
};

export const LANCAMENTOS_POR_PAGINA = 100;
export const CONTAS_POR_PAGINA = 100;

export type DadosDeLancamento = { tipo: TipoLancamento; valorCentavos: number; categoria: CategoriaLancamento; descricao: string; data: Date; usuarioId: string };
/** SPEC-026: `pessoaId` é o fornecedor na conta a pagar e o cliente na conta a receber. */
export type DadosDoVinculo = { pessoaId: string | null; numeroDocumento: string | null };
export type DadosDeConta = { tipo: TipoConta; descricao: string; categoria: CategoriaLancamento; valorCentavos: number; vencimento: string } & Partial<DadosDoVinculo>;
export type DadosDeDespesa = { descricao: string; valorCentavos: number; diaVencimento: number; categoria: CategoriaLancamento; fornecedorId: string | null };

export function criarConsultasFinanceiras(cliente: ClienteDoNegocio, negocioId: string, opcoes: { mascararNomes?: boolean } = {}) {
  /** SPEC-026 (OPEN-011): no modo suporte, o nome do fornecedor e do cliente sai mascarado. */
  const nomeVisto = (p: { tipo: TipoCliente; nome: string; nomeFantasia: string | null }) => {
    const nome = nomeDeExibicao(p);
    return opcoes.mascararNomes ? mascararNome(nome) : nome;
  };

  const origemDaConta = (c: { parcelaId: string | null; despesaFixaId: string | null }) =>
    c.parcelaId ? ("venda" as const) : c.despesaFixaId ? ("despesa" as const) : ("manual" as const);

  type PessoaLida = { id: string; tipo: TipoCliente; nome: string; nomeFantasia: string | null } | null;
  type ContaLida = {
    id: string;
    tipo: TipoConta;
    categoria: CategoriaLancamento;
    descricao: string | null;
    valorTotal: unknown;
    valorPago: unknown;
    valorDesconto: unknown;
    valorAcrescimo: unknown;
    vencimento: Date;
    status: StatusConta;
    parcelaId: string | null;
    despesaFixaId: string | null;
    numeroDocumento: string | null;
    fornecedor: PessoaLida;
    cliente: PessoaLida;
    parcela: { pagamento: { venda: { cliente: PessoaLida } } } | null;
  };

  function pessoaDaConta(c: ContaLida): PessoaDaConta | null {
    if (c.fornecedor) return { id: c.fornecedor.id, nome: nomeVisto(c.fornecedor), papel: "fornecedor", daVenda: false };
    if (c.cliente) return { id: c.cliente.id, nome: nomeVisto(c.cliente), papel: "cliente", daVenda: false };
    const daVenda = c.parcela?.pagamento.venda.cliente;
    if (daVenda) return { id: daVenda.id, nome: nomeVisto(daVenda), papel: "cliente", daVenda: true };
    return null;
  }

  function exibirConta(c: ContaLida, hoje: string): ContaExibida {
    const valores = {
      totalCentavos: centavosDe(c.valorTotal),
      pagoCentavos: centavosDe(c.valorPago),
      descontoCentavos: centavosDe(c.valorDesconto),
      acrescimoCentavos: centavosDe(c.valorAcrescimo),
    };
    const vencimento = diaLocalDe(c.vencimento);
    return {
      id: c.id,
      tipo: c.tipo,
      categoria: c.categoria,
      descricao: c.descricao,
      ...valores,
      restanteCentavos: c.status === "CANCELADA" ? 0 : restanteDaConta(valores),
      vencimento,
      status: c.status,
      atrasada: estaAtrasada({ ...valores, vencimento, status: c.status }, hoje),
      origem: origemDaConta(c),
      pessoa: pessoaDaConta(c),
      numeroDocumento: c.numeroDocumento,
    };
  }

  const camposDaConta = {
    id: true,
    tipo: true,
    categoria: true,
    descricao: true,
    valorTotal: true,
    valorPago: true,
    valorDesconto: true,
    valorAcrescimo: true,
    vencimento: true,
    status: true,
    parcelaId: true,
    despesaFixaId: true,
    numeroDocumento: true,
    fornecedor: { select: { id: true, tipo: true, nome: true, nomeFantasia: true } },
    cliente: { select: { id: true, tipo: true, nome: true, nomeFantasia: true } },
    parcela: { select: { pagamento: { select: { venda: { select: { cliente: { select: { id: true, tipo: true, nome: true, nomeFantasia: true } } } } } } } },
  } as const;

  const camposDaDespesa = {
    id: true,
    descricao: true,
    valorMensal: true,
    diaVencimento: true,
    categoria: true,
    origem: true,
    ativo: true,
    fornecedor: { select: { id: true, tipo: true, nome: true, nomeFantasia: true } },
  } as const;

  function exibirDespesa(d: {
    id: string;
    descricao: string;
    valorMensal: unknown;
    diaVencimento: number;
    categoria: CategoriaLancamento;
    origem: OrigemDespesaFixa;
    ativo: boolean;
    fornecedor: { id: string; tipo: TipoCliente; nome: string; nomeFantasia: string | null } | null;
  }): DespesaExibida {
    return {
      id: d.id,
      descricao: d.descricao,
      valorCentavos: d.valorMensal === null ? null : centavosDe(d.valorMensal),
      diaVencimento: d.diaVencimento,
      categoria: d.categoria,
      origem: d.origem,
      ativo: d.ativo,
      fornecedor: d.fornecedor && { id: d.fornecedor.id, nome: nomeVisto(d.fornecedor) },
    };
  }

  /** Saldo inicial vigente: informado e não estornado (OPEN-001). */
  const saldoInicialVigente = () => cliente.lancamentoFinanceiro.count({ where: { origem: "SALDO_INICIAL", estornadoPor: { is: null } } });

  // ---------- Conferência: DAS, contas das despesas fixas e parcelas (RF67, OPEN-008) ----------

  /** O DAS do MEI existe e está ativo só enquanto o negócio é MEI com atividade (5.6). */
  async function sincronizarDas(hoje: string) {
    const n = await cliente.negocio.findFirst({ select: { regimeTributario: true, atividadeMei: true } });
    const mei = n?.regimeTributario === "MEI" && n.atividadeMei !== null;
    // O id da despesa do DAS é o id do negócio: no máximo uma, mesmo com conferências simultâneas.
    const das = await cliente.despesaFixa.findFirst({ where: { id: negocioId }, select: { ativo: true, diaVencimento: true } });
    if (mei && !das) {
      try {
        await cliente.despesaFixa.create({
          data: {
            id: negocioId,
            negocioId,
            descricao: "DAS do MEI",
            valorMensal: null,
            diaVencimento: DIA_VENCIMENTO_DAS,
            categoria: "IMPOSTOS",
            origem: "DAS_MEI",
            geraDesde: dataDaCompetencia(primeiraCompetencia(hoje, DIA_VENCIMENTO_DAS)),
          },
        });
      } catch (e) {
        if (!ehUnicidade(e)) throw e;
      }
    } else if (mei && das && !das.ativo) {
      await cliente.despesaFixa.updateMany({
        where: { id: negocioId, ativo: false },
        data: { ativo: true, geraDesde: dataDaCompetencia(primeiraCompetencia(hoje, das.diaVencimento)) },
      });
    } else if (!mei && das?.ativo) {
      await cliente.despesaFixa.updateMany({ where: { id: negocioId, ativo: true }, data: { ativo: false } });
    }
  }

  /** Uma conta a pagar por despesa ativa e competência devida (INV-005: restrição única + skipDuplicates). */
  async function gerarContasFixas(hoje: string): Promise<number> {
    const atual = competenciaDoDia(hoje);
    const despesas = await cliente.despesaFixa.findMany({
      where: { ativo: true },
      select: { id: true, descricao: true, valorMensal: true, diaVencimento: true, categoria: true, origem: true, geraDesde: true, fornecedorId: true },
    });
    if (despesas.length === 0) return 0;

    const devidas = despesas.map((d) => ({ d, comps: competenciasDevidas(competenciaDoDia(diaDaData(d.geraDesde)), atual) })).filter((x) => x.comps.length);
    if (devidas.length === 0) return 0;
    const desde = devidas.reduce((m, x) => (x.comps[0] < m ? x.comps[0] : m), atual);
    const existentes = await cliente.contaPagarReceber.findMany({
      where: { despesaFixaId: { in: devidas.map((x) => x.d.id) }, competencia: { gte: dataDaCompetencia(desde) } },
      select: { despesaFixaId: true, competencia: true },
    });
    const ja = new Set(existentes.map((c) => `${c.despesaFixaId}|${diaDaData(c.competencia!).slice(0, 7)}`));

    let atividade: AtividadeMei | null = null;
    if (devidas.some((x) => x.d.origem === "DAS_MEI")) {
      atividade = (await cliente.negocio.findFirst({ select: { atividadeMei: true } }))?.atividadeMei ?? null;
    }
    const dasPorDia = new Map<string, number | null>();
    async function valorDoDas(dia: string): Promise<number | null> {
      if (!atividade) return null;
      if (!dasPorDia.has(dia)) {
        const p = await cliente.parametroMei.findFirst({
          where: { atividade, vigenteDesde: { lte: new Date(`${dia}T00:00:00Z`) } },
          orderBy: { vigenteDesde: "desc" },
          select: { valorDasMensal: true },
        });
        dasPorDia.set(dia, p ? centavosDe(p.valorDasMensal) : null);
      }
      return dasPorDia.get(dia)!;
    }

    const novas: {
      negocioId: string;
      despesaFixaId: string;
      competencia: Date;
      tipo: TipoConta;
      categoria: CategoriaLancamento;
      descricao: string;
      valorTotal: string;
      vencimento: Date;
      fornecedorId: string | null;
    }[] = [];
    for (const { d, comps } of devidas) {
      for (const comp of comps) {
        if (ja.has(`${d.id}|${comp}`)) continue;
        const vencimento = vencimentoNaCompetencia(comp, d.diaVencimento);
        const valor = d.origem === "DAS_MEI" ? await valorDoDas(vencimento) : centavosDe(d.valorMensal);
        if (!valor || !(valor > 0)) {
          if (d.origem === "DAS_MEI") console.error("[financeiro] DAS sem parâmetro vigente para", vencimento);
          continue;
        }
        novas.push({
          negocioId,
          despesaFixaId: d.id,
          competencia: dataDaCompetencia(comp),
          tipo: "PAGAR",
          categoria: d.categoria,
          descricao: descricaoDaContaFixa(d.descricao, comp),
          valorTotal: reaisTexto(valor),
          vencimento: meioDia(vencimento),
          // SPEC-026 (5.4, item 4): a conta nasce com o fornecedor da despesa.
          fornecedorId: d.fornecedorId,
        });
      }
    }
    if (novas.length === 0) return 0;
    const { count } = await cliente.contaPagarReceber.createMany({ data: novas, skipDuplicates: true });
    return count;
  }

  /**
   * Parcelas do cartão vencidas até hoje: quitadas com entrada na data do vencimento (OPEN-008). SPEC-028
   * (5.2): com a taxa média da maquininha, o desconto da taxa; a conta com pagamento estornado fica de
   * fora, para o recebimento certo ser registrado à mão.
   */
  async function receberParcelasVencidas(hoje: string): Promise<number> {
    const taxa = await taxaDaMaquininha();
    const contas = await cliente.contaPagarReceber.findMany({
      where: {
        parcelaId: { not: null },
        status: { in: ["ABERTA", "PARCIAL"] },
        vencimento: { lt: intervaloDoDia(hoje).fim },
        lancamentos: { none: { origem: "ESTORNO" } },
      },
      select: { id: true, valorTotal: true, valorPago: true, valorDesconto: true, valorAcrescimo: true, vencimento: true },
      orderBy: { vencimento: "asc" },
      take: 1000,
    });
    let recebidas = 0;
    for (const c of contas) {
      try {
        const restante = restanteLido(c);
        const desconto = descontoDaTaxa(restante, taxa);
        await cliente.$transaction((tx) =>
          pagarConta(tx as unknown as Tx, negocioId, {
            contaId: c.id,
            valorCentavos: restante - desconto,
            data: c.vencimento,
            usuarioId: null,
            // SPEC-026 (5.5, item 4): a forma da venda.
            forma: "CREDITO",
            descontoCentavos: desconto,
            motivoDesconto: desconto ? "TAXA_MAQUININHA" : null,
          }),
        );
        recebidas++;
      } catch (e) {
        // Pagamento simultâneo mudou o restante: a próxima conferência recebe o que faltar.
        if (!(e instanceof ValorAcimaDoRestante || e instanceof ContaEncerrada)) throw e;
      }
    }
    return recebidas;
  }

  /** Taxa média da maquininha do negócio (RF51), em %; zero se não informada. */
  async function taxaDaMaquininha(): Promise<number> {
    const n = await cliente.negocio.findFirst({ select: { taxaCartaoMedia: true } });
    return n ? Number(String(n.taxaCartaoMedia)) : 0;
  }

  /**
   * Condição sobre os pagamentos (lançamentos da conta) para os filtros de data e de forma (5.6). SPEC-028
   * (5.5, item 7): só os pagamentos válidos, sem os estornados nem os estornos.
   */
  function condicaoDoPagamento(filtros: FiltrosDasContas) {
    if (!filtraPagamentos(filtros)) return null;
    return {
      origem: "CONTA" as const,
      estornadoPor: { is: null },
      ...(filtros.pagamentoDe || filtros.pagamentoAte
        ? {
            data: {
              ...(filtros.pagamentoDe ? { gte: intervaloDoDia(filtros.pagamentoDe).inicio } : {}),
              ...(filtros.pagamentoAte ? { lt: intervaloDoDia(filtros.pagamentoAte).fim } : {}),
            },
          }
        : {}),
      ...(filtros.forma ? { formaPagamento: filtros.forma === "NAO_INFORMADA" ? null : filtros.forma } : {}),
    };
  }

  /** As condições dos filtros novos (5.6, item 2), uma por entrada do AND. */
  function condicoesDosFiltros(tipo: TipoConta, filtros: FiltrosDasContas, pagamento: ReturnType<typeof condicaoDoPagamento>): object[] {
    const e: object[] = [];
    if (filtros.busca) {
      e.push({ OR: [{ descricao: { contains: filtros.busca, mode: "insensitive" as const } }, { numeroDocumento: { contains: filtros.busca, mode: "insensitive" as const } }] });
    }
    if (filtros.vencimentoDe || filtros.vencimentoAte) {
      e.push({
        vencimento: {
          ...(filtros.vencimentoDe ? { gte: intervaloDoDia(filtros.vencimentoDe).inicio } : {}),
          ...(filtros.vencimentoAte ? { lt: intervaloDoDia(filtros.vencimentoAte).fim } : {}),
        },
      });
    }
    if (pagamento) e.push({ lancamentos: { some: pagamento } });
    if (filtros.pessoaId) {
      e.push(
        tipo === "PAGAR"
          ? { fornecedorId: filtros.pessoaId }
          : { OR: [{ clienteId: filtros.pessoaId }, { parcela: { is: { pagamento: { is: { venda: { is: { clienteId: filtros.pessoaId } } } } } } }] },
      );
    }
    if (filtros.categoria) e.push({ categoria: filtros.categoria });
    if (filtros.origem === "manual") e.push({ parcelaId: null, despesaFixaId: null });
    else if (filtros.origem === "despesa") e.push({ despesaFixaId: { not: null } });
    else if (filtros.origem === "venda") e.push({ parcelaId: { not: null } });
    return e;
  }

  /**
   * Confere o fornecedor ou o cliente escolhido (5.4): ativo e do negócio. O que já está na conta
   * vale mesmo se tiver sido anonimizado depois (a correção só do nº do documento não o perde).
   */
  async function conferirPessoa(tipo: TipoConta, pessoaId: string | null, atual: string | null = null): Promise<{ fornecedorId: string | null; clienteId: string | null }> {
    if (!pessoaId) return { fornecedorId: null, clienteId: null };
    if (pessoaId !== atual) {
      if (!UUID.test(pessoaId)) throw tipo === "PAGAR" ? new FornecedorNaoEncontrado() : new ClienteNaoEncontrado();
      const existe =
        tipo === "PAGAR"
          ? await cliente.fornecedor.count({ where: { id: pessoaId, anonimizadoEm: null } })
          : await cliente.cliente.count({ where: { id: pessoaId, anonimizadoEm: null } });
      if (!existe) throw tipo === "PAGAR" ? new FornecedorNaoEncontrado() : new ClienteNaoEncontrado();
    }
    return tipo === "PAGAR" ? { fornecedorId: pessoaId, clienteId: null } : { fornecedorId: null, clienteId: pessoaId };
  }

  return {
    /** Conferência do negócio (5.5): rotina diária e abertura do Financeiro e do Painel. */
    async conferir(hoje: string): Promise<{ contasCriadas: number; parcelasRecebidas: number }> {
      await sincronizarDas(hoje);
      const contasCriadas = await gerarContasFixas(hoje);
      const parcelasRecebidas = await receberParcelasVencidas(hoje);
      return { contasCriadas, parcelasRecebidas };
    },

    // ---------- Caixa (5.1, 5.2) ----------

    /** Saldo real até o fim de hoje (RN14) — o mesmo "Saldo atual" do fluxo; usado pelo Dashboard (SPEC-012). */
    async saldoAtual(hoje: string): Promise<number> {
      const fimDeHoje = intervaloDoDia(hoje).fim;
      const [t] = await cliente.$queryRaw<{ atual: unknown }[]>`
        SELECT COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE -valor END), 0) AS atual
        FROM "LancamentoFinanceiro" WHERE "negocioId" = ${negocioId}::uuid AND "data" < ${fimDeHoje}`;
      return centavosDe(t.atual);
    },

    /** Fluxo de caixa do mês (AAAA-MM): totais pelo período inteiro; a lista com os filtros. */
    async fluxo(f: FiltroDoFluxo, hoje: string): Promise<FluxoDeCaixa> {
      const periodo = intervaloDaCompetencia(f.mes);
      const fimDeHoje = intervaloDoDia(hoje).fim;
      const where = {
        data: { gte: periodo.inicio, lt: periodo.fim },
        ...(f.categoria ? { categoria: f.categoria } : {}),
        ...(f.tipo ? { tipo: f.tipo } : {}),
      };
      const [[t], total, informado] = await Promise.all([
        cliente.$queryRaw<{ atual: unknown; inicio: unknown; entradas: unknown; saidas: unknown }[]>`
          SELECT
            COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE -valor END) FILTER (WHERE "data" < ${fimDeHoje}), 0) AS atual,
            COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE -valor END) FILTER (WHERE "data" < ${periodo.inicio}), 0) AS inicio,
            COALESCE(SUM(valor) FILTER (WHERE tipo = 'ENTRADA' AND "data" >= ${periodo.inicio} AND "data" < ${periodo.fim}), 0) AS entradas,
            COALESCE(SUM(valor) FILTER (WHERE tipo = 'SAIDA' AND "data" >= ${periodo.inicio} AND "data" < ${periodo.fim}), 0) AS saidas
          FROM "LancamentoFinanceiro" WHERE "negocioId" = ${negocioId}::uuid`,
        cliente.lancamentoFinanceiro.count({ where }),
        saldoInicialVigente(),
      ]);
      const paginas = Math.max(1, Math.ceil(total / LANCAMENTOS_POR_PAGINA));
      const pagina = Math.min(Math.max(1, Math.floor(f.pagina ?? 1) || 1), paginas);
      const linhas = await cliente.lancamentoFinanceiro.findMany({
        where,
        orderBy: [{ data: "desc" }, { id: "desc" }],
        skip: (pagina - 1) * LANCAMENTOS_POR_PAGINA,
        take: LANCAMENTOS_POR_PAGINA,
        select: {
          id: true,
          tipo: true,
          origem: true,
          categoria: true,
          valor: true,
          data: true,
          descricao: true,
          estornoDeId: true,
          usuario: { select: { nome: true, administradorEm: true } },
          venda: { select: { id: true, numero: true } },
          conta: { select: { id: true, descricao: true } },
          estornadoPor: { select: { id: true } },
        },
      });
      const inicio = centavosDe(t.inicio);
      const entradas = centavosDe(t.entradas);
      const saidas = centavosDe(t.saidas);
      return {
        mes: f.mes,
        saldoAtualCentavos: centavosDe(t.atual),
        saldoInicioCentavos: inicio,
        entradasCentavos: entradas,
        saidasCentavos: saidas,
        saldoFimCentavos: inicio + entradas - saidas,
        saldoInicialInformado: informado > 0,
        pagina,
        paginas,
        lancamentos: linhas.map((l) => ({
          id: l.id,
          tipo: l.tipo,
          origem: l.origem,
          categoria: l.categoria,
          valorCentavos: centavosDe(l.valor),
          data: l.data,
          registradoPor: l.usuario ? autorDoHistorico(l.usuario) : null,
          descricao: l.descricao,
          venda: l.venda,
          conta: l.conta,
          estornoDeId: l.estornoDeId,
          estornado: l.estornadoPor !== null,
        })),
      };
    },

    /**
     * Entradas e saídas de cada dia do mês (gráfico "Fluxo do mês" — SPEC-016, 5.5). Mesmos
     * lançamentos dos totais do caixa; o dia é o de São Paulo. Dias sem movimento vêm zerados.
     */
    async fluxoDiario(mes: string): Promise<{ dia: string; entradasCentavos: number; saidasCentavos: number }[]> {
      const periodo = intervaloDaCompetencia(mes);
      const linhas = await cliente.$queryRaw<{ dia: string; entradas: unknown; saidas: unknown }[]>`
        SELECT to_char(("data" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia,
               COALESCE(SUM(valor) FILTER (WHERE tipo = 'ENTRADA'), 0) AS entradas,
               COALESCE(SUM(valor) FILTER (WHERE tipo = 'SAIDA'), 0) AS saidas
        FROM "LancamentoFinanceiro"
        WHERE "negocioId" = ${negocioId}::uuid AND "data" >= ${periodo.inicio} AND "data" < ${periodo.fim}
        GROUP BY 1`;
      const porDia = new Map(linhas.map((l) => [l.dia, l]));
      const [ano, m] = mes.split("-").map(Number);
      const dias = new Date(Date.UTC(ano, m, 0)).getUTCDate();
      return Array.from({ length: dias }, (_, i) => {
        const dia = `${mes}-${String(i + 1).padStart(2, "0")}`;
        const l = porDia.get(dia);
        return { dia, entradasCentavos: l ? centavosDe(l.entradas) : 0, saidasCentavos: l ? centavosDe(l.saidas) : 0 };
      });
    },

    async saldoInicialInformado(): Promise<boolean> {
      return (await saldoInicialVigente()) > 0;
    },

    /** Lançamento avulso (UC12a), com quem registrou (RNF05). */
    async lancar(d: DadosDeLancamento): Promise<{ id: string }> {
      return cliente.lancamentoFinanceiro.create({
        data: { negocioId, origem: "AVULSO", tipo: d.tipo, categoria: d.categoria, valor: reaisTexto(d.valorCentavos), descricao: d.descricao, data: d.data, usuarioId: d.usuarioId },
        select: { id: true },
      });
    },

    /** Saldo inicial, uma vez por negócio (OPEN-001); a linha do negócio serializa pedidos simultâneos. */
    async informarSaldoInicial(valorCentavos: number, data: Date, usuarioId: string): Promise<{ id: string }> {
      return cliente.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Negocio" WHERE id = ${negocioId}::uuid FOR UPDATE`;
        const ja = await tx.lancamentoFinanceiro.count({ where: { origem: "SALDO_INICIAL", estornadoPor: { is: null } } });
        if (ja > 0) throw new SaldoInicialJaInformado();
        return tx.lancamentoFinanceiro.create({
          data: { negocioId, origem: "SALDO_INICIAL", tipo: "ENTRADA", categoria: "OUTROS", valor: reaisTexto(valorCentavos), descricao: "Saldo inicial", data, usuarioId },
          select: { id: true },
        });
      });
    },

    /** Estorno (OPEN-003): lançamento contrário ligado ao original, no máximo uma vez (estornoDeId único). */
    /** SPEC-028: no pagamento de conta, devolve também a conta, a situação e o restante depois do estorno. */
    async estornar(id: string, usuarioId: string, agora: Date): Promise<{ id: string; contaId?: string; status?: StatusConta; restanteCentavos?: number }> {
      if (!UUID.test(id)) throw new LancamentoNaoEncontrado();
      const l = await cliente.lancamentoFinanceiro.findFirst({
        where: { id },
        select: { tipo: true, categoria: true, valor: true, origem: true, descricao: true, estornadoPor: { select: { id: true } } },
      });
      if (!l) throw new LancamentoNaoEncontrado();
      // SPEC-028 (5.5): o pagamento de conta é estornado com a conta, numa transação.
      if (l.origem === "CONTA") return cliente.$transaction((tx) => estornarPagamento(tx as unknown as Tx, negocioId, id, usuarioId, agora));
      if (l.origem !== "AVULSO" && l.origem !== "SALDO_INICIAL") throw new NaoEstornavel(l.origem);
      if (l.estornadoPor) throw new JaEstornado();
      try {
        return await cliente.lancamentoFinanceiro.create({
          data: {
            negocioId,
            estornoDeId: id,
            origem: "ESTORNO",
            tipo: l.tipo === "ENTRADA" ? "SAIDA" : "ENTRADA",
            categoria: l.categoria,
            valor: l.valor,
            descricao: descricaoDoEstorno(l.descricao),
            data: agora,
            usuarioId,
          },
          select: { id: true },
        });
      } catch (e) {
        if (ehUnicidade(e)) throw new JaEstornado();
        throw e;
      }
    },

    // ---------- Contas (5.3) ----------

    async listarContas(
      f: FiltroDasContas,
      hoje: string,
    ): Promise<{ contas: ContaExibida[]; pagina: number; paginas: number; atrasadas: number; ocultasPeloPlano: number; totais: TotaisDasContas }> {
      const inicioDeHoje = intervaloDoDia(hoje).inicio;
      const situacao =
        f.situacao === "abertas"
          ? { status: { in: ["ABERTA", "PARCIAL"] as StatusConta[] } }
          : f.situacao === "atrasadas"
            ? { status: { in: ["ABERTA", "PARCIAL"] as StatusConta[] }, vencimento: { lt: inicioDeHoje } }
            : f.situacao === "quitadas"
              ? { status: "QUITADA" as const }
              : f.situacao === "canceladas"
                ? { status: "CANCELADA" as const }
                : {};
      // Contas em aberto aparecem sempre; quitadas e canceladas, só dentro do histórico do plano.
      const desde = f.desde ? intervaloDoDia(f.desde).inicio : null;
      const limite = desde ? { OR: [{ status: { in: ["ABERTA", "PARCIAL"] as StatusConta[] } }, { vencimento: { gte: desde } }] } : {};
      // SPEC-026 (5.6): os filtros novos se somam; cada condição numa entrada do AND, sem colidir.
      const filtros = f.filtros ?? SEM_FILTROS;
      const pagamento = condicaoDoPagamento(filtros);
      const where = { tipo: f.tipo, AND: [situacao, limite, ...condicoesDosFiltros(f.tipo, filtros, pagamento)] };
      const semCanceladas = { AND: [where, { status: { not: "CANCELADA" as const } }] };
      const emAberto = { AND: [where, { status: { in: ["ABERTA", "PARCIAL"] as StatusConta[] } }] };
      const [total, atrasadas, ocultasPeloPlano, somaGeral, somaEmAberto, pagoFiltrado] = await Promise.all([
        cliente.contaPagarReceber.count({ where }),
        cliente.contaPagarReceber.count({ where: { tipo: f.tipo, status: { in: ["ABERTA", "PARCIAL"] }, vencimento: { lt: inicioDeHoje } } }),
        desde
          ? cliente.contaPagarReceber.count({
              where: { tipo: f.tipo, status: { in: (f.situacao === "quitadas" ? ["QUITADA"] : f.situacao === "canceladas" ? ["CANCELADA"] : ["QUITADA", "CANCELADA"]) as StatusConta[] }, vencimento: { lt: desde } },
            })
          : Promise.resolve(0),
        cliente.contaPagarReceber.aggregate({ where: semCanceladas, _sum: { valorTotal: true, valorPago: true, valorDesconto: true, valorAcrescimo: true } }),
        cliente.contaPagarReceber.aggregate({ where: emAberto, _sum: { valorTotal: true, valorPago: true, valorDesconto: true, valorAcrescimo: true } }),
        // Com filtro de data do pagamento ou de forma, "Pago" soma só os pagamentos que atendem (5.6, item 4).
        // SPEC-028: os descontos e os acréscimos seguem a mesma regra, pelos pagamentos que atendem ao filtro.
        filtraPagamentos(filtros)
          ? cliente.lancamentoFinanceiro.aggregate({ where: { ...pagamento, conta: { is: semCanceladas } }, _sum: { valor: true, desconto: true, acrescimo: true } })
          : Promise.resolve(null),
      ]);
      const paginas = Math.max(1, Math.ceil(total / CONTAS_POR_PAGINA));
      const pagina = Math.min(Math.max(1, Math.floor(f.pagina ?? 1) || 1), paginas);
      const decrescente = f.situacao === "quitadas" || f.situacao === "canceladas" || (f.situacao === "todas" && filtraPagamentos(filtros));
      const contas = await cliente.contaPagarReceber.findMany({
        where,
        orderBy: [{ vencimento: decrescente ? "desc" : "asc" }, { id: "asc" }],
        skip: (pagina - 1) * CONTAS_POR_PAGINA,
        take: CONTAS_POR_PAGINA,
        select: camposDaConta,
      });
      const totais: TotaisDasContas = {
        quantidade: total,
        totalCentavos: centavosDe(somaGeral._sum.valorTotal ?? 0),
        pagoCentavos: pagoFiltrado ? centavosDe(pagoFiltrado._sum.valor ?? 0) : centavosDe(somaGeral._sum.valorPago ?? 0),
        descontoCentavos: pagoFiltrado ? centavosDe(pagoFiltrado._sum.desconto ?? 0) : centavosDe(somaGeral._sum.valorDesconto ?? 0),
        acrescimoCentavos: pagoFiltrado ? centavosDe(pagoFiltrado._sum.acrescimo ?? 0) : centavosDe(somaGeral._sum.valorAcrescimo ?? 0),
        emAbertoCentavos: restanteLido({
          valorTotal: somaEmAberto._sum.valorTotal ?? 0,
          valorPago: somaEmAberto._sum.valorPago ?? 0,
          valorDesconto: somaEmAberto._sum.valorDesconto ?? 0,
          valorAcrescimo: somaEmAberto._sum.valorAcrescimo ?? 0,
        }),
      };
      return {
        contas: contas.map((c) => exibirConta(c, hoje)),
        pagina,
        paginas,
        atrasadas,
        ocultasPeloPlano: f.situacao === "abertas" || f.situacao === "atrasadas" ? 0 : ocultasPeloPlano,
        totais,
      };
    },

    async detalharConta(id: string, hoje: string): Promise<DetalheDaConta> {
      if (!UUID.test(id)) throw new ContaNaoEncontrada();
      const c = await cliente.contaPagarReceber.findFirst({
          where: { id },
          select: {
            ...camposDaConta,
            criadaPorId: true,
            parcela: {
              select: {
                pagamento: { select: { venda: { select: { id: true, numero: true, status: true, cliente: { select: { id: true, tipo: true, nome: true, nomeFantasia: true } } } } } },
              },
            },
            despesaFixa: { select: { id: true, descricao: true } },
            lancamentos: {
              // SPEC-028: só os pagamentos; o estorno aparece junto do pagamento estornado.
              where: { origem: "CONTA" },
              orderBy: { data: "asc" },
              select: {
                id: true,
                valor: true,
                data: true,
                formaPagamento: true,
                desconto: true,
                acrescimo: true,
                motivoDesconto: true,
                motivoAcrescimo: true,
                observacaoPagamento: true,
                usuario: { select: { nome: true, administradorEm: true } },
                estornadoPor: { select: { data: true, registradoEm: true, usuario: { select: { nome: true, administradorEm: true } } } },
              },
            },
          },
        });
      if (!c) throw new ContaNaoEncontrada();
      const autor = c.criadaPorId ? await cliente.membroNegocio.findFirst({ where: { usuarioId: c.criadaPorId }, select: { usuario: { select: { nome: true } } } }) : null;
      // SPEC-019 (5.3, item 3): a conta criada pelo suporte mostra "{nome} (suporte do HE)" (o Administrador não é membro).
      const doSuporte =
        c.criadaPorId && !autor ? await cliente.usuario.findFirst({ where: { id: c.criadaPorId, administradorEm: { not: null } }, select: { nome: true, administradorEm: true } }) : null;
      const conta = exibirConta(c, hoje);
      const aberta = conta.status === "ABERTA" || conta.status === "PARCIAL";
      const taxa = c.parcelaId && conta.tipo === "RECEBER" && aberta ? await taxaDaMaquininha() : 0;
      const descontoSugerido = descontoDaTaxa(conta.restanteCentavos, taxa);
      return {
        ...conta,
        taxaSugerida: descontoSugerido ? { taxa, descontoCentavos: descontoSugerido } : null,
        estornavel: conta.status !== "CANCELADA" && c.parcela?.pagamento.venda.status !== "CANCELADA",
        criadaPor: autor?.usuario.nome ?? (doSuporte ? autorDoHistorico(doSuporte) : null),
        venda: c.parcela ? { id: c.parcela.pagamento.venda.id, numero: c.parcela.pagamento.venda.numero } : null,
        despesa: c.despesaFixa,
        lancamentos: c.lancamentos.map((l) => ({
          id: l.id,
          valorCentavos: centavosDe(l.valor),
          data: l.data,
          registradoPor: l.usuario ? autorDoHistorico(l.usuario) : null,
          forma: l.formaPagamento,
          descontoCentavos: centavosDe(l.desconto),
          acrescimoCentavos: centavosDe(l.acrescimo),
          motivoDesconto: l.motivoDesconto,
          motivoAcrescimo: l.motivoAcrescimo,
          observacao: l.observacaoPagamento,
          // Quando o estorno foi feito (etapa 4); nos anteriores, a própria data do estorno.
          estorno: l.estornadoPor ? { data: l.estornadoPor.registradoEm ?? l.estornadoPor.data, registradoPor: l.estornadoPor.usuario ? autorDoHistorico(l.estornadoPor.usuario) : null } : null,
        })),
      };
    },

    async criarConta(d: DadosDeConta, usuarioId: string): Promise<{ id: string }> {
      const vinculo = await conferirPessoa(d.tipo, d.pessoaId ?? null);
      return cliente.contaPagarReceber.create({
        data: {
          negocioId,
          tipo: d.tipo,
          descricao: d.descricao,
          categoria: d.categoria,
          valorTotal: reaisTexto(d.valorCentavos),
          vencimento: meioDia(d.vencimento),
          criadaPorId: usuarioId,
          ...vinculo,
          numeroDocumento: d.numeroDocumento ?? null,
        },
        select: { id: true },
      });
    },

    /** Editar conta manual sem pagamento (OPEN-003, INV-008), com o vínculo e o documento (SPEC-026). */
    async editarConta(id: string, d: DadosDeConta): Promise<void> {
      if (!UUID.test(id)) throw new ContaNaoEncontrada();
      const atual = await cliente.contaPagarReceber.findFirst({ where: { id }, select: { fornecedorId: true, clienteId: true } });
      if (!atual) throw new ContaNaoEncontrada();
      const vinculo = await conferirPessoa(d.tipo, d.pessoaId ?? null, d.tipo === "PAGAR" ? atual.fornecedorId : atual.clienteId);
      const { count } = await cliente.contaPagarReceber.updateMany({
        where: { id, parcelaId: null, despesaFixaId: null, status: "ABERTA", valorPago: 0 },
        data: {
          tipo: d.tipo,
          descricao: d.descricao,
          categoria: d.categoria,
          valorTotal: reaisTexto(d.valorCentavos),
          vencimento: meioDia(d.vencimento),
          ...vinculo,
          numeroDocumento: d.numeroDocumento ?? null,
        },
      });
      if (count === 0) await explicarRecusa(id);
    },

    /**
     * O vínculo atual da conta (SPEC-019, OPEN-016): no modo suporte, a edição o mantém como está.
     * Só diz se há fornecedor ou cliente, sem o nome (INV-009).
     */
    async vinculoDaConta(id: string): Promise<{ tipo: TipoConta; pessoa: "fornecedor" | "cliente" | null; pessoaId: string | null; numeroDocumento: string | null }> {
      if (!UUID.test(id)) throw new ContaNaoEncontrada();
      const c = await cliente.contaPagarReceber.findFirst({ where: { id }, select: { tipo: true, fornecedorId: true, clienteId: true, numeroDocumento: true } });
      if (!c) throw new ContaNaoEncontrada();
      return {
        tipo: c.tipo,
        pessoa: c.fornecedorId ? "fornecedor" : c.clienteId ? "cliente" : null,
        pessoaId: c.fornecedorId ?? c.clienteId,
        numeroDocumento: c.numeroDocumento,
      };
    },

    /**
     * Correção do fornecedor ou cliente e do nº do documento (SPEC-026, 5.4, item 5): em qualquer
     * conta e situação, sem mexer em valor, vencimento, situação nem pagamentos (INV-002). Na conta
     * de venda no cartão, o cliente é o da venda: só o documento muda.
     */
    async corrigirVinculo(id: string, d: DadosDoVinculo): Promise<void> {
      if (!UUID.test(id)) throw new ContaNaoEncontrada();
      const c = await cliente.contaPagarReceber.findFirst({ where: { id }, select: { tipo: true, parcelaId: true, fornecedorId: true, clienteId: true } });
      if (!c) throw new ContaNaoEncontrada();
      const vinculo = c.parcelaId ? { fornecedorId: null, clienteId: null } : await conferirPessoa(c.tipo, d.pessoaId, c.tipo === "PAGAR" ? c.fornecedorId : c.clienteId);
      const { count } = await cliente.contaPagarReceber.updateMany({ where: { id }, data: { ...vinculo, numeroDocumento: d.numeroDocumento } });
      if (count === 0) throw new ContaNaoEncontrada();
    },

    /** Clientes para o seletor da conta a receber (SPEC-026, OPEN-006): só o nome, dos ativos. */
    async opcoesDeClientes(): Promise<{ id: string; nome: string }[]> {
      const lista = await cliente.cliente.findMany({
        where: { anonimizadoEm: null },
        select: { id: true, tipo: true, nome: true, nomeFantasia: true },
        orderBy: { nome: "asc" },
        take: 1000,
      });
      return lista.map((c) => ({ id: c.id, nome: nomeVisto(c) })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },

    /** Cancelar conta manual sem pagamento (OPEN-003): só muda o status; nada é apagado. */
    async cancelarConta(id: string): Promise<void> {
      if (!UUID.test(id)) throw new ContaNaoEncontrada();
      const { count } = await cliente.contaPagarReceber.updateMany({
        where: { id, parcelaId: null, despesaFixaId: null, status: "ABERTA", valorPago: 0 },
        data: { status: "CANCELADA" },
      });
      if (count === 0) await explicarRecusa(id);
    },

    async pagar(p: Pagamento) {
      return cliente.$transaction((tx) => pagarConta(tx as unknown as Tx, negocioId, p));
    },

    // ---------- Despesas fixas (5.5, 5.6) ----------

    async listarDespesas(): Promise<DespesaExibida[]> {
      const lista = await cliente.despesaFixa.findMany({
        orderBy: [{ ativo: "desc" }, { origem: "desc" }, { descricao: "asc" }],
        select: camposDaDespesa,
        take: 500,
      });
      return lista.map(exibirDespesa);
    },

    async detalharDespesa(id: string): Promise<DespesaExibida> {
      if (!UUID.test(id)) throw new DespesaNaoEncontrada();
      const d = await cliente.despesaFixa.findFirst({ where: { id }, select: camposDaDespesa });
      if (!d) throw new DespesaNaoEncontrada();
      return exibirDespesa(d);
    },

    async criarDespesa(d: DadosDeDespesa, hoje: string): Promise<{ id: string }> {
      const { fornecedorId } = await conferirPessoa("PAGAR", d.fornecedorId);
      return cliente.despesaFixa.create({
        data: {
          negocioId,
          descricao: d.descricao,
          valorMensal: reaisTexto(d.valorCentavos),
          diaVencimento: d.diaVencimento,
          categoria: d.categoria,
          origem: "MANUAL",
          geraDesde: dataDaCompetencia(primeiraCompetencia(hoje, d.diaVencimento)),
          fornecedorId,
        },
        select: { id: true },
      });
    },

    /** Alterar despesa manual: vale para as competências ainda não geradas (5.5). */
    async editarDespesa(id: string, d: DadosDeDespesa): Promise<void> {
      const atual = await this.detalharDespesa(id);
      if (atual.origem === "DAS_MEI") throw new DasNaoEditavel();
      // SPEC-026 (5.4, item 4): vale para as próximas contas; as já geradas ficam como estão.
      const { fornecedorId } = await conferirPessoa("PAGAR", d.fornecedorId, atual.fornecedor?.id ?? null);
      await cliente.despesaFixa.updateMany({
        where: { id, origem: "MANUAL" },
        data: { descricao: d.descricao, valorMensal: reaisTexto(d.valorCentavos), diaVencimento: d.diaVencimento, categoria: d.categoria, fornecedorId },
      });
    },

    /** Dia de vencimento: o único campo editável do DAS do MEI (5.6); vale também para as manuais. */
    async definirDiaVencimento(id: string, dia: number): Promise<void> {
      if (!UUID.test(id)) throw new DespesaNaoEncontrada();
      const { count } = await cliente.despesaFixa.updateMany({ where: { id }, data: { diaVencimento: dia } });
      if (count === 0) throw new DespesaNaoEncontrada();
    },

    /** Ativar/desativar despesa manual; ao reativar, a geração recomeça pelo OPEN-004 (sem meses retroativos). */
    async definirAtivo(id: string, ativo: boolean, hoje: string): Promise<void> {
      const atual = await this.detalharDespesa(id);
      if (atual.origem === "DAS_MEI") throw new DasNaoEditavel();
      if (atual.ativo === ativo) return;
      await cliente.despesaFixa.updateMany({
        where: { id, origem: "MANUAL", ativo: !ativo },
        data: ativo ? { ativo, geraDesde: dataDaCompetencia(primeiraCompetencia(hoje, atual.diaVencimento)) } : { ativo },
      });
    },

    /** DAS vigente hoje para a atividade do MEI do negócio (exibição; OPEN-005). */
    async dasVigente(hoje: string): Promise<number | null> {
      const n = await cliente.negocio.findFirst({ select: { regimeTributario: true, atividadeMei: true } });
      if (n?.regimeTributario !== "MEI" || !n.atividadeMei) return null;
      const p = await cliente.parametroMei.findFirst({
        where: { atividade: n.atividadeMei, vigenteDesde: { lte: new Date(`${hoje}T00:00:00Z`) } },
        orderBy: { vigenteDesde: "desc" },
        select: { valorDasMensal: true },
      });
      return p ? centavosDe(p.valorDasMensal) : null;
    },
  };

  /** Por que a conta não pôde ser editada/cancelada (CA-11). */
  async function explicarRecusa(id: string): Promise<never> {
    const c = await cliente.contaPagarReceber.findFirst({ where: { id }, select: { parcelaId: true, despesaFixaId: true, status: true, valorPago: true } });
    if (!c) throw new ContaNaoEncontrada();
    if (c.parcelaId) throw new ContaNaoEditavel("venda");
    if (c.despesaFixaId) throw new ContaNaoEditavel("despesa");
    if (c.status === "QUITADA" || c.status === "CANCELADA") throw new ContaNaoEditavel("encerrada");
    throw new ContaNaoEditavel("com-pagamento");
  }
}

export type ConsultasFinanceiras = ReturnType<typeof criarConsultasFinanceiras>;
