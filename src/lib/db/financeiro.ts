import type { AtividadeMei, CategoriaLancamento, OrigemDespesaFixa, OrigemLancamento, StatusConta, TipoConta, TipoLancamento } from "@/generated/prisma/enums";
import { intervaloDaCompetencia, intervaloDoDia } from "@/lib/dominio/datas";
import {
  centavosDe,
  competenciaDoDia,
  competenciasDevidas,
  descricaoDaContaFixa,
  descricaoDoEstorno,
  DIA_VENCIMENTO_DAS,
  estaAtrasada,
  primeiraCompetencia,
  reaisTexto,
  tipoDoPagamento,
  vencimentoNaCompetencia,
} from "@/lib/dominio/financeiro";
import type { ClienteDoNegocio } from "./cliente-do-negocio";

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
};

/**
 * Pagamento ou recebimento de conta (5.3, INV-002 a INV-004): atualização condicional do
 * valor pago e do status com RETURNING, mais o lançamento vinculado, na transação de quem
 * chama. A linha da conta fica travada até o fim da transação, então pagamentos simultâneos
 * nunca ultrapassam o total.
 */
export async function pagarConta(tx: Tx, negocioId: string, p: Pagamento): Promise<{ tipo: TipoConta; status: StatusConta; restanteCentavos: number; lancamentoId: string }> {
  if (!UUID.test(p.contaId)) throw new ContaNaoEncontrada();
  const v = reaisTexto(p.valorCentavos);
  const linhas = await tx.$queryRaw<{ tipo: TipoConta; categoria: CategoriaLancamento; descricao: string | null; valorTotal: unknown; valorPago: unknown; status: StatusConta }[]>`
    UPDATE "ContaPagarReceber"
    SET "valorPago" = "valorPago" + ${v}::numeric,
        status = (CASE WHEN "valorPago" + ${v}::numeric >= "valorTotal" THEN 'QUITADA' ELSE 'PARCIAL' END)::"StatusConta"
    WHERE id = ${p.contaId}::uuid AND "negocioId" = ${negocioId}::uuid
      AND status IN ('ABERTA', 'PARCIAL') AND "valorPago" + ${v}::numeric <= "valorTotal"
    RETURNING tipo, categoria, descricao, "valorTotal", "valorPago", status`;

  if (linhas.length === 0) {
    const conta = await tx.contaPagarReceber.findFirst({ where: { id: p.contaId }, select: { status: true, valorTotal: true, valorPago: true } });
    if (!conta) throw new ContaNaoEncontrada();
    if (conta.status === "QUITADA" || conta.status === "CANCELADA") throw new ContaEncerrada(conta.status);
    throw new ValorAcimaDoRestante(centavosDe(conta.valorTotal) - centavosDe(conta.valorPago));
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
    },
    select: { id: true },
  });
  return { tipo: c.tipo, status: c.status, restanteCentavos: centavosDe(c.valorTotal) - centavosDe(c.valorPago), lancamentoId: lancamento.id };
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
export type FiltroDasContas = { tipo: TipoConta; situacao: SituacaoFiltrada; pagina?: number };

export type ContaExibida = {
  id: string;
  tipo: TipoConta;
  categoria: CategoriaLancamento;
  descricao: string | null;
  totalCentavos: number;
  pagoCentavos: number;
  restanteCentavos: number;
  vencimento: string;
  status: StatusConta;
  atrasada: boolean;
  origem: "venda" | "despesa" | "manual";
};

export type DetalheDaConta = ContaExibida & {
  criadaPor: string | null;
  venda: { id: string; numero: number } | null;
  despesa: { id: string; descricao: string } | null;
  lancamentos: { id: string; valorCentavos: number; data: Date; registradoPor: string | null }[];
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
};

export const LANCAMENTOS_POR_PAGINA = 100;
export const CONTAS_POR_PAGINA = 100;

export type DadosDeLancamento = { tipo: TipoLancamento; valorCentavos: number; categoria: CategoriaLancamento; descricao: string; data: Date; usuarioId: string };
export type DadosDeConta = { tipo: TipoConta; descricao: string; categoria: CategoriaLancamento; valorCentavos: number; vencimento: string };
export type DadosDeDespesa = { descricao: string; valorCentavos: number; diaVencimento: number; categoria: CategoriaLancamento };

export function criarConsultasFinanceiras(cliente: ClienteDoNegocio, negocioId: string) {
  const origemDaConta = (c: { parcelaId: string | null; despesaFixaId: string | null }) =>
    c.parcelaId ? ("venda" as const) : c.despesaFixaId ? ("despesa" as const) : ("manual" as const);

  function exibirConta(
    c: { id: string; tipo: TipoConta; categoria: CategoriaLancamento; descricao: string | null; valorTotal: unknown; valorPago: unknown; vencimento: Date; status: StatusConta; parcelaId: string | null; despesaFixaId: string | null },
    hoje: string,
  ): ContaExibida {
    const totalCentavos = centavosDe(c.valorTotal);
    const pagoCentavos = centavosDe(c.valorPago);
    const vencimento = diaLocalDe(c.vencimento);
    return {
      id: c.id,
      tipo: c.tipo,
      categoria: c.categoria,
      descricao: c.descricao,
      totalCentavos,
      pagoCentavos,
      restanteCentavos: c.status === "CANCELADA" ? 0 : totalCentavos - pagoCentavos,
      vencimento,
      status: c.status,
      atrasada: estaAtrasada({ vencimento, status: c.status, totalCentavos, pagoCentavos }, hoje),
      origem: origemDaConta(c),
    };
  }

  const camposDaConta = {
    id: true,
    tipo: true,
    categoria: true,
    descricao: true,
    valorTotal: true,
    valorPago: true,
    vencimento: true,
    status: true,
    parcelaId: true,
    despesaFixaId: true,
  } as const;

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
      select: { id: true, descricao: true, valorMensal: true, diaVencimento: true, categoria: true, origem: true, geraDesde: true },
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
        });
      }
    }
    if (novas.length === 0) return 0;
    const { count } = await cliente.contaPagarReceber.createMany({ data: novas, skipDuplicates: true });
    return count;
  }

  /** Parcelas do cartão vencidas até hoje: quitadas com entrada na data do vencimento (OPEN-008). */
  async function receberParcelasVencidas(hoje: string): Promise<number> {
    const contas = await cliente.contaPagarReceber.findMany({
      where: { parcelaId: { not: null }, status: { in: ["ABERTA", "PARCIAL"] }, vencimento: { lt: intervaloDoDia(hoje).fim } },
      select: { id: true, valorTotal: true, valorPago: true, vencimento: true },
      orderBy: { vencimento: "asc" },
      take: 1000,
    });
    let recebidas = 0;
    for (const c of contas) {
      try {
        await cliente.$transaction((tx) =>
          pagarConta(tx as unknown as Tx, negocioId, {
            contaId: c.id,
            valorCentavos: centavosDe(c.valorTotal) - centavosDe(c.valorPago),
            data: c.vencimento,
            usuarioId: null,
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

  return {
    /** Conferência do negócio (5.5): rotina diária e abertura do Financeiro e do Painel. */
    async conferir(hoje: string): Promise<{ contasCriadas: number; parcelasRecebidas: number }> {
      await sincronizarDas(hoje);
      const contasCriadas = await gerarContasFixas(hoje);
      const parcelasRecebidas = await receberParcelasVencidas(hoje);
      return { contasCriadas, parcelasRecebidas };
    },

    // ---------- Caixa (5.1, 5.2) ----------

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
          usuario: { select: { nome: true } },
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
          registradoPor: l.usuario?.nome ?? null,
          descricao: l.descricao,
          venda: l.venda,
          conta: l.conta,
          estornoDeId: l.estornoDeId,
          estornado: l.estornadoPor !== null,
        })),
      };
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
    async estornar(id: string, usuarioId: string, agora: Date): Promise<{ id: string }> {
      if (!UUID.test(id)) throw new LancamentoNaoEncontrado();
      const l = await cliente.lancamentoFinanceiro.findFirst({
        where: { id },
        select: { tipo: true, categoria: true, valor: true, origem: true, descricao: true, estornadoPor: { select: { id: true } } },
      });
      if (!l) throw new LancamentoNaoEncontrado();
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

    async listarContas(f: FiltroDasContas, hoje: string): Promise<{ contas: ContaExibida[]; pagina: number; paginas: number; atrasadas: number }> {
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
      const where = { tipo: f.tipo, ...situacao };
      const [total, atrasadas] = await Promise.all([
        cliente.contaPagarReceber.count({ where }),
        cliente.contaPagarReceber.count({ where: { tipo: f.tipo, status: { in: ["ABERTA", "PARCIAL"] }, vencimento: { lt: inicioDeHoje } } }),
      ]);
      const paginas = Math.max(1, Math.ceil(total / CONTAS_POR_PAGINA));
      const pagina = Math.min(Math.max(1, Math.floor(f.pagina ?? 1) || 1), paginas);
      const contas = await cliente.contaPagarReceber.findMany({
        where,
        orderBy: [{ vencimento: f.situacao === "quitadas" || f.situacao === "canceladas" ? "desc" : "asc" }, { id: "asc" }],
        skip: (pagina - 1) * CONTAS_POR_PAGINA,
        take: CONTAS_POR_PAGINA,
        select: camposDaConta,
      });
      return { contas: contas.map((c) => exibirConta(c, hoje)), pagina, paginas, atrasadas };
    },

    async detalharConta(id: string, hoje: string): Promise<DetalheDaConta> {
      if (!UUID.test(id)) throw new ContaNaoEncontrada();
      const c = await cliente.contaPagarReceber.findFirst({
          where: { id },
          select: {
            ...camposDaConta,
            criadaPorId: true,
            parcela: { select: { pagamento: { select: { venda: { select: { id: true, numero: true } } } } } },
            despesaFixa: { select: { id: true, descricao: true } },
            lancamentos: { orderBy: { data: "asc" }, select: { id: true, valor: true, data: true, usuario: { select: { nome: true } } } },
          },
        });
      if (!c) throw new ContaNaoEncontrada();
      const autor = c.criadaPorId ? await cliente.membroNegocio.findFirst({ where: { usuarioId: c.criadaPorId }, select: { usuario: { select: { nome: true } } } }) : null;
      return {
        ...exibirConta(c, hoje),
        criadaPor: autor?.usuario.nome ?? null,
        venda: c.parcela?.pagamento.venda ?? null,
        despesa: c.despesaFixa,
        lancamentos: c.lancamentos.map((l) => ({ id: l.id, valorCentavos: centavosDe(l.valor), data: l.data, registradoPor: l.usuario?.nome ?? null })),
      };
    },

    async criarConta(d: DadosDeConta, usuarioId: string): Promise<{ id: string }> {
      return cliente.contaPagarReceber.create({
        data: { negocioId, tipo: d.tipo, descricao: d.descricao, categoria: d.categoria, valorTotal: reaisTexto(d.valorCentavos), vencimento: meioDia(d.vencimento), criadaPorId: usuarioId },
        select: { id: true },
      });
    },

    /** Editar conta manual sem pagamento (OPEN-003, INV-008). */
    async editarConta(id: string, d: DadosDeConta): Promise<void> {
      if (!UUID.test(id)) throw new ContaNaoEncontrada();
      const { count } = await cliente.contaPagarReceber.updateMany({
        where: { id, parcelaId: null, despesaFixaId: null, status: "ABERTA", valorPago: 0 },
        data: { tipo: d.tipo, descricao: d.descricao, categoria: d.categoria, valorTotal: reaisTexto(d.valorCentavos), vencimento: meioDia(d.vencimento) },
      });
      if (count === 0) await explicarRecusa(id);
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
        select: { id: true, descricao: true, valorMensal: true, diaVencimento: true, categoria: true, origem: true, ativo: true },
        take: 500,
      });
      return lista.map((d) => ({ ...d, valorCentavos: d.valorMensal === null ? null : centavosDe(d.valorMensal) }));
    },

    async detalharDespesa(id: string): Promise<DespesaExibida> {
      if (!UUID.test(id)) throw new DespesaNaoEncontrada();
      const d = await cliente.despesaFixa.findFirst({
        where: { id },
        select: { id: true, descricao: true, valorMensal: true, diaVencimento: true, categoria: true, origem: true, ativo: true },
      });
      if (!d) throw new DespesaNaoEncontrada();
      return { ...d, valorCentavos: d.valorMensal === null ? null : centavosDe(d.valorMensal) };
    },

    async criarDespesa(d: DadosDeDespesa, hoje: string): Promise<{ id: string }> {
      return cliente.despesaFixa.create({
        data: {
          negocioId,
          descricao: d.descricao,
          valorMensal: reaisTexto(d.valorCentavos),
          diaVencimento: d.diaVencimento,
          categoria: d.categoria,
          origem: "MANUAL",
          geraDesde: dataDaCompetencia(primeiraCompetencia(hoje, d.diaVencimento)),
        },
        select: { id: true },
      });
    },

    /** Alterar despesa manual: vale para as competências ainda não geradas (5.5). */
    async editarDespesa(id: string, d: DadosDeDespesa): Promise<void> {
      const atual = await this.detalharDespesa(id);
      if (atual.origem === "DAS_MEI") throw new DasNaoEditavel();
      await cliente.despesaFixa.updateMany({
        where: { id, origem: "MANUAL" },
        data: { descricao: d.descricao, valorMensal: reaisTexto(d.valorCentavos), diaVencimento: d.diaVencimento, categoria: d.categoria },
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
