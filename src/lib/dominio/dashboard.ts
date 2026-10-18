/**
 * Dashboard (SPEC-012): funções puras — séries do gráfico, semáforo e projeção de caixa.
 * Sem framework nem banco; dias e competências já chegam no fuso de São Paulo (RN29).
 */
import { somarDias } from "./estoque";
import { competenciaDoDia, somarMeses } from "./financeiro";

export const DIAS_DO_GRAFICO = 30;
export const MESES_DO_GRAFICO = 12;
export const MESES_DA_PROJECAO = 6;

// ---------- Gráfico de vendas (RF43, 5.3) ----------

export type PontoDaSerie = { periodo: string; totalCentavos: number };
export type Serie = { pontos: PontoDaSerie[]; totalCentavos: number; maiorCentavos: number };

function serie(periodos: string[], totais: Record<string, number>): Serie {
  const pontos = periodos.map((periodo) => ({ periodo, totalCentavos: totais[periodo] ?? 0 }));
  return {
    pontos,
    totalCentavos: pontos.reduce((s, p) => s + p.totalCentavos, 0),
    maiorCentavos: pontos.reduce((m, p) => Math.max(m, p.totalCentavos), 0),
  };
}

/** Primeiro dia da série diária: hoje − 29. */
export const inicioDaSerieDiaria = (hoje: string) => somarDias(hoje, -(DIAS_DO_GRAFICO - 1));
/** Primeira competência da série mensal: mês atual − 11. */
export const inicioDaSerieMensal = (hoje: string) => somarMeses(competenciaDoDia(hoje), -(MESES_DO_GRAFICO - 1));

/** Últimos 30 dias até hoje, um ponto por dia (dias sem venda = 0). */
export function serieDiaria(hoje: string, totaisPorDia: Record<string, number>): Serie {
  const inicio = inicioDaSerieDiaria(hoje);
  return serie(
    Array.from({ length: DIAS_DO_GRAFICO }, (_, i) => somarDias(inicio, i)),
    totaisPorDia,
  );
}

/** Últimos 12 meses até o atual (inclusive), um ponto por mês. */
export function serieMensal(hoje: string, totaisPorMes: Record<string, number>): Serie {
  const inicio = inicioDaSerieMensal(hoje);
  return serie(
    Array.from({ length: MESES_DO_GRAFICO }, (_, i) => somarMeses(inicio, i)),
    totaisPorMes,
  );
}

// ---------- Semáforo (RF56, RF57, 5.4) ----------

export type CorDoSemaforo = "vermelho" | "amarelo" | "verde" | "equilibrio";

export type Semaforo = {
  cor: CorDoSemaforo;
  faturamentoCentavos: number;
  pontoDeEquilibrioCentavos: number;
  metaCentavos: number | null;
  /** Quanto falta para o PE (0 se já atingido). */
  faltaParaPeCentavos: number;
  /** Quanto falta para a meta (null sem meta; 0 se já atingida). */
  faltaParaMetaCentavos: number | null;
  /** Progresso até a meta (ou até o PE, sem meta), de 0 a 1. */
  progresso: number;
  /** Posição do PE na barra (0 a 1) — só com meta. */
  marcaDoPe: number | null;
  /** OPEN-003: "no ritmo atual, o mês fecha em" — média por dia × dias do mês; null no último dia ou sem vendas. */
  ritmoCentavos: number | null;
};

const diasNoMes = (comp: string) => {
  const [a, m] = comp.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
};

/**
 * RF57: Vermelho (faturamento < PE), Amarelo (PE ≤ faturamento < Meta), Verde (≥ Meta).
 * Sem meta: só abaixo do PE (vermelho) ou PE atingido ("equilibrio"). A cor segue só o
 * faturamento real; o ritmo é informativo (OPEN-003).
 */
export function semaforo(e: { faturamentoCentavos: number; pontoDeEquilibrioCentavos: number; metaCentavos: number | null; hoje: string }): Semaforo {
  const { faturamentoCentavos: f, pontoDeEquilibrioCentavos: pe, metaCentavos: meta } = e;
  const cor: CorDoSemaforo = f < pe ? "vermelho" : meta === null ? "equilibrio" : f < meta ? "amarelo" : "verde";
  const alvo = meta ?? pe;
  const dia = Number(e.hoje.slice(8, 10));
  const total = diasNoMes(competenciaDoDia(e.hoje));
  return {
    cor,
    faturamentoCentavos: f,
    pontoDeEquilibrioCentavos: pe,
    metaCentavos: meta,
    faltaParaPeCentavos: Math.max(0, pe - f),
    faltaParaMetaCentavos: meta === null ? null : Math.max(0, meta - f),
    progresso: alvo <= 0 ? 1 : Math.min(1, f / alvo),
    marcaDoPe: meta === null || meta <= 0 ? null : Math.min(1, pe / meta),
    ritmoCentavos: f > 0 && dia < total ? Math.round((f / dia) * total) : null,
  };
}

// ---------- Projeção de caixa (RF68, 5.5) ----------

/** Contas abertas ou parciais, já pelo restante (valor total − valor pago). */
export type ContaParaProjecao = { tipo: "PAGAR" | "RECEBER"; vencimento: string; restanteCentavos: number };

/** Despesa fixa ativa: primeira competência devida e o valor de cada competência (o DAS muda com o parâmetro vigente). */
export type DespesaParaProjecao = { id: string; primeiraCompetencia: string; valorPorCompetencia: Record<string, number | null> };

export type MesDaProjecao = {
  competencia: string;
  entradasCentavos: number;
  saidasCentavos: number;
  /** Parte das saídas estimada pelas despesas fixas ativas (meses sem conta gerada). */
  saidasEstimadasCentavos: number;
  saldoProjetadoCentavos: number;
  negativo: boolean;
};

export type Projecao = {
  saldoAtualCentavos: number;
  meses: MesDaProjecao[];
  /** OPEN-004: contas vencidas e ainda abertas, somadas ao mês atual. */
  atrasadas: { entradasCentavos: number; saidasCentavos: number; quantidade: number };
};

/** Competências da projeção: o mês atual e os 5 seguintes (OPEN-004). */
export const competenciasDaProjecao = (hoje: string) =>
  Array.from({ length: MESES_DA_PROJECAO }, (_, i) => somarMeses(competenciaDoDia(hoje), i));

/**
 * Saldo atual + contas a receber − contas a pagar por mês de vencimento; nos meses sem a
 * conta da despesa fixa gerada, o valor da despesa ativa (INV-005: nunca os dois).
 * `competenciasGeradas`: "despesaId|AAAA-MM" de toda conta já gerada, em qualquer situação.
 */
export function montarProjecao(e: {
  hoje: string;
  saldoAtualCentavos: number;
  contas: ContaParaProjecao[];
  despesas: DespesaParaProjecao[];
  competenciasGeradas: Set<string>;
}): Projecao {
  const comps = competenciasDaProjecao(e.hoje);
  const atual = comps[0];
  const ultima = comps[comps.length - 1];
  const porMes = new Map(comps.map((c) => [c, { entradas: 0, saidas: 0, estimadas: 0 }]));
  const atrasadas = { entradasCentavos: 0, saidasCentavos: 0, quantidade: 0 };

  for (const c of e.contas) {
    if (c.restanteCentavos <= 0) continue;
    const comp = competenciaDoDia(c.vencimento);
    if (comp > ultima) continue;
    const m = porMes.get(comp < atual ? atual : comp)!;
    if (c.tipo === "RECEBER") m.entradas += c.restanteCentavos;
    else m.saidas += c.restanteCentavos;
    if (c.vencimento < e.hoje) {
      atrasadas.quantidade++;
      if (c.tipo === "RECEBER") atrasadas.entradasCentavos += c.restanteCentavos;
      else atrasadas.saidasCentavos += c.restanteCentavos;
    }
  }

  for (const d of e.despesas) {
    for (const comp of comps) {
      if (comp < d.primeiraCompetencia || e.competenciasGeradas.has(`${d.id}|${comp}`)) continue;
      const valor = d.valorPorCompetencia[comp];
      if (!valor || valor <= 0) continue;
      const m = porMes.get(comp)!;
      m.saidas += valor;
      m.estimadas += valor;
    }
  }

  let saldo = e.saldoAtualCentavos;
  const meses = comps.map((competencia) => {
    const m = porMes.get(competencia)!;
    saldo += m.entradas - m.saidas;
    return {
      competencia,
      entradasCentavos: m.entradas,
      saidasCentavos: m.saidas,
      saidasEstimadasCentavos: m.estimadas,
      saldoProjetadoCentavos: saldo,
      negativo: saldo < 0,
    };
  });
  return { saldoAtualCentavos: e.saldoAtualCentavos, meses, atrasadas };
}

// ---------- Cartões e acesso (RF44, RF63, 5.1) ----------

export type CartaoDoDashboard = "vendasDoDia" | "saldo" | "estoque" | "semaforo" | "grafico" | "projecao" | "formas" | "rentabilidade";

/** `vendas` só pesa na rentabilidade (SPEC-013, OPEN-003: Vendas e Financeiro — ver). */
type Permissoes = { dashboard: boolean; estoque: boolean; financeiro: boolean; vendas?: boolean };

/**
 * Lista única dos cartões (RF44): a ordem da tela e o que cada um exige. Um indicador
 * novo é uma linha nova aqui e o seu componente. "Dashboard: ver" é a base de todos;
 * as partes financeiras exigem também "Financeiro: ver" (SPEC-005, OPEN-003).
 */
export const CARTOES: { cartao: CartaoDoDashboard; exige: (p: Permissoes) => boolean }[] = [
  { cartao: "vendasDoDia", exige: (p) => p.dashboard },
  { cartao: "saldo", exige: (p) => p.dashboard && p.financeiro },
  { cartao: "estoque", exige: (p) => p.dashboard && p.estoque },
  { cartao: "semaforo", exige: (p) => p.dashboard && p.financeiro },
  { cartao: "grafico", exige: (p) => p.dashboard && p.financeiro },
  { cartao: "projecao", exige: (p) => p.dashboard && p.financeiro },
  // SPEC-016 (5.5): formas de pagamento e rentabilidade. A rentabilidade também segue o
  // plano (OPEN-007): no gratuito o cartão mostra a oferta, sem valores.
  { cartao: "formas", exige: (p) => p.dashboard && p.financeiro },
  { cartao: "rentabilidade", exige: (p) => p.dashboard && p.financeiro && p.vendas === true },
];

export const cartoesPermitidos = (p: Permissoes): CartaoDoDashboard[] => CARTOES.filter((c) => c.exige(p)).map((c) => c.cartao);

export const CARTOES_FINANCEIROS: readonly CartaoDoDashboard[] = ["saldo", "semaforo", "grafico", "projecao", "formas", "rentabilidade"];
