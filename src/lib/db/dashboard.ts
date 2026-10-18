import { intervaloDaCompetencia, intervaloDoDia } from "@/lib/dominio/datas";
import { competenciasDaProjecao, inicioDaSerieDiaria, inicioDaSerieMensal, serieDiaria, type ContaParaProjecao, type DespesaParaProjecao } from "@/lib/dominio/dashboard";
import { centavosDe, competenciaDoDia, somarMeses, vencimentoNaCompetencia } from "@/lib/dominio/financeiro";
import type { ClienteDoNegocio } from "./cliente-do-negocio";

/**
 * Leituras do Dashboard (SPEC-012). Só leitura (INV-007): agregados no banco pelos índices
 * `Venda(negocioId, data, status)` e `ContaPagarReceber(negocioId, vencimento, status)`.
 * As consultas SQL diretas filtram o negocioId à mão (INV-006); dias e meses em São Paulo.
 */

export type VendasDoDia = { quantidade: number; totalCentavos: number; ticketMedioCentavos: number | null };

const diaDaData = (d: Date) => d.toISOString().slice(0, 10);

export function criarConsultasDoDashboard(cliente: ClienteDoNegocio, negocioId: string) {
  return {
    /** Vendas concluídas de hoje (RF42, RF63, OPEN-006). */
    async vendasDoDia(hoje: string): Promise<VendasDoDia> {
      const { inicio, fim } = intervaloDoDia(hoje);
      const r = await cliente.venda.aggregate({
        where: { status: "CONCLUIDA", data: { gte: inicio, lt: fim } },
        _count: { _all: true },
        _sum: { valorTotal: true },
      });
      const quantidade = r._count._all;
      const totalCentavos = r._sum.valorTotal === null ? 0 : centavosDe(r._sum.valorTotal);
      return { quantidade, totalCentavos, ticketMedioCentavos: quantidade ? Math.round(totalCentavos / quantidade) : null };
    },

    /** Faturamento por dia local dos últimos 30 dias (RN21: canceladas fora). */
    async vendasPorDia(hoje: string): Promise<Record<string, number>> {
      const desde = intervaloDoDia(inicioDaSerieDiaria(hoje)).inicio;
      const ate = intervaloDoDia(hoje).fim;
      const linhas = await cliente.$queryRaw<{ dia: string; total: unknown }[]>`
        SELECT to_char(("data" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia, SUM("valorTotal") AS total
        FROM "Venda"
        WHERE "negocioId" = ${negocioId}::uuid AND status = 'CONCLUIDA' AND "data" >= ${desde} AND "data" < ${ate}
        GROUP BY 1`;
      return Object.fromEntries(linhas.map((l) => [l.dia, centavosDe(l.total)]));
    },

    /** Faturamento por competência dos últimos 12 meses, com o mês atual até hoje (RN21). */
    async vendasPorMes(hoje: string): Promise<Record<string, number>> {
      const desde = intervaloDaCompetencia(inicioDaSerieMensal(hoje)).inicio;
      const ate = intervaloDoDia(hoje).fim;
      const linhas = await cliente.$queryRaw<{ comp: string; total: unknown }[]>`
        SELECT to_char(("data" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS comp, SUM("valorTotal") AS total
        FROM "Venda"
        WHERE "negocioId" = ${negocioId}::uuid AND status = 'CONCLUIDA' AND "data" >= ${desde} AND "data" < ${ate}
        GROUP BY 1`;
      return Object.fromEntries(linhas.map((l) => [l.comp, centavosDe(l.total)]));
    },

    /**
     * Mesmos 12 meses do gráfico, um ano antes (SPEC-016, 5.5; só no plano pago — OPEN-007):
     * a chave é o mês correspondente da janela atual, para casar com a série de vendasPorMes.
     */
    async vendasPorMesAnoAnterior(hoje: string): Promise<Record<string, number>> {
      const inicio = inicioDaSerieMensal(hoje);
      const desde = intervaloDaCompetencia(somarMeses(inicio, -12)).inicio;
      const ate = intervaloDaCompetencia(somarMeses(competenciaDoDia(hoje), -11)).inicio;
      const linhas = await cliente.$queryRaw<{ comp: string; total: unknown }[]>`
        SELECT to_char(("data" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS comp, SUM("valorTotal") AS total
        FROM "Venda"
        WHERE "negocioId" = ${negocioId}::uuid AND status = 'CONCLUIDA' AND "data" >= ${desde} AND "data" < ${ate}
        GROUP BY 1`;
      return Object.fromEntries(linhas.map((l) => [somarMeses(l.comp, 12), centavosDe(l.total)]));
    },

    /** Quanto entrou por forma de pagamento nas vendas concluídas do mês (SPEC-016, 5.5); crédito de troca fica fora. */
    async formasDoMes(hoje: string): Promise<{ forma: "PIX" | "DINHEIRO" | "DEBITO" | "CREDITO"; valorCentavos: number }[]> {
      const { inicio } = intervaloDaCompetencia(competenciaDoDia(hoje));
      const ate = intervaloDoDia(hoje).fim;
      const linhas = await cliente.$queryRaw<{ forma: "PIX" | "DINHEIRO" | "DEBITO" | "CREDITO"; total: unknown }[]>`
        SELECT p.forma, SUM(p.valor) AS total
        FROM "Pagamento" p JOIN "Venda" v ON v.id = p."vendaId"
        WHERE v."negocioId" = ${negocioId}::uuid AND v.status = 'CONCLUIDA' AND v."data" >= ${inicio} AND v."data" < ${ate}
          AND p.forma <> 'CREDITO_TROCA'
        GROUP BY 1`;
      return linhas.map((l) => ({ forma: l.forma, valorCentavos: centavosDe(l.total) }));
    },

    /**
     * Saldo ao fim de cada um dos últimos 30 dias (faixa do caixa — SPEC-016, 5.3): o saldo
     * antes da janela mais as entradas e saídas de cada dia local. Mesmo saldo real do
     * Financeiro (RN14): o último ponto é o "Saldo atual".
     */
    async saldoDiario(hoje: string): Promise<{ dia: string; saldoCentavos: number }[]> {
      const inicio = inicioDaSerieDiaria(hoje);
      const desde = intervaloDoDia(inicio).inicio;
      const ate = intervaloDoDia(hoje).fim;
      const [[antes], porDia] = await Promise.all([
        cliente.$queryRaw<{ saldo: unknown }[]>`
          SELECT COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE -valor END), 0) AS saldo
          FROM "LancamentoFinanceiro" WHERE "negocioId" = ${negocioId}::uuid AND "data" < ${desde}`,
        cliente.$queryRaw<{ dia: string; liquido: unknown }[]>`
          SELECT to_char(("data" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia,
                 SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE -valor END) AS liquido
          FROM "LancamentoFinanceiro"
          WHERE "negocioId" = ${negocioId}::uuid AND "data" >= ${desde} AND "data" < ${ate}
          GROUP BY 1`,
      ]);
      const liquido = Object.fromEntries(porDia.map((l) => [l.dia, centavosDe(l.liquido)]));
      return serieDiaria(hoje, {}).pontos.reduce<{ dia: string; saldoCentavos: number }[]>((acc, p) => {
        const anterior = acc.length ? acc[acc.length - 1].saldoCentavos : centavosDe(antes.saldo);
        acc.push({ dia: p.periodo, saldoCentavos: anterior + (liquido[p.periodo] ?? 0) });
        return acc;
      }, []);
    },

    /** Lançamentos de hoje, do mais recente ao mais antigo ("Ver o dia" — SPEC-016, 5.3). */
    async movimentosDeHoje(hoje: string, limite = 12): Promise<{ id: string; hora: string; descricao: string; tipo: "ENTRADA" | "SAIDA"; valorCentavos: number }[]> {
      const { inicio, fim } = intervaloDoDia(hoje);
      const lista = await cliente.lancamentoFinanceiro.findMany({
        where: { data: { gte: inicio, lt: fim } },
        orderBy: [{ data: "desc" }, { id: "desc" }],
        take: limite,
        select: { id: true, data: true, tipo: true, valor: true, descricao: true, categoria: true, venda: { select: { numero: true } }, conta: { select: { descricao: true } } },
      });
      const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
      return lista.map((l) => ({
        id: l.id,
        hora: hora.format(l.data),
        descricao: l.descricao ?? (l.venda ? `Venda nº ${l.venda.numero}` : (l.conta?.descricao ?? "Lançamento")),
        tipo: l.tipo,
        valorCentavos: centavosDe(l.valor),
      }));
    },

    /**
     * Insumos da projeção (RF68, 5.5): contas abertas/parciais até o último mês (as vencidas
     * também — OPEN-004), despesas fixas ativas com o valor de cada competência e as
     * competências que já têm conta gerada (em qualquer situação — INV-005).
     */
    async insumosDaProjecao(hoje: string): Promise<{ contas: ContaParaProjecao[]; despesas: DespesaParaProjecao[]; competenciasGeradas: Set<string> }> {
      const comps = competenciasDaProjecao(hoje);
      const ate = intervaloDaCompetencia(somarMeses(comps[comps.length - 1], 1)).inicio;
      const [contas, despesas, negocio] = await Promise.all([
        cliente.$queryRaw<{ tipo: "PAGAR" | "RECEBER"; dia: string; restante: unknown }[]>`
          SELECT tipo, to_char((vencimento AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia,
                 SUM("valorTotal" - "valorPago") AS restante
          FROM "ContaPagarReceber"
          WHERE "negocioId" = ${negocioId}::uuid AND status IN ('ABERTA', 'PARCIAL') AND vencimento < ${ate}
          GROUP BY 1, 2`,
        cliente.despesaFixa.findMany({
          where: { ativo: true },
          select: { id: true, valorMensal: true, diaVencimento: true, origem: true, geraDesde: true },
        }),
        cliente.negocio.findFirst({ select: { atividadeMei: true } }),
      ]);

      const ids = despesas.map((d) => d.id);
      const [geradas, parametrosDas] = await Promise.all([
        ids.length
          ? cliente.contaPagarReceber.findMany({
              where: { despesaFixaId: { in: ids }, competencia: { gte: new Date(`${comps[0]}-01T00:00:00Z`), lte: new Date(`${comps[comps.length - 1]}-01T00:00:00Z`) } },
              select: { despesaFixaId: true, competencia: true },
            })
          : Promise.resolve([]),
        despesas.some((d) => d.origem === "DAS_MEI") && negocio?.atividadeMei
          ? cliente.parametroMei.findMany({ where: { atividade: negocio.atividadeMei }, select: { vigenteDesde: true, valorDasMensal: true }, orderBy: { vigenteDesde: "desc" } })
          : Promise.resolve([]),
      ]);

      /** DAS pelo parâmetro vigente no dia do vencimento (como a geração da conta — SPEC-009). */
      const das = (vencimento: string) => {
        const p = parametrosDas.find((x) => diaDaData(x.vigenteDesde) <= vencimento);
        return p ? centavosDe(p.valorDasMensal) : null;
      };

      return {
        contas: contas.map((c) => ({ tipo: c.tipo, vencimento: c.dia, restanteCentavos: centavosDe(c.restante) })),
        despesas: despesas.map((d) => ({
          id: d.id,
          primeiraCompetencia: competenciaDoDia(diaDaData(d.geraDesde)),
          valorPorCompetencia: Object.fromEntries(
            comps.map((comp) => [comp, d.origem === "DAS_MEI" ? das(vencimentoNaCompetencia(comp, d.diaVencimento)) : d.valorMensal === null ? null : centavosDe(d.valorMensal)]),
          ),
        })),
        competenciasGeradas: new Set(geradas.map((g) => `${g.despesaFixaId}|${diaDaData(g.competencia!).slice(0, 7)}`)),
      };
    },
  };
}

export type ConsultasDoDashboard = ReturnType<typeof criarConsultasDoDashboard>;
