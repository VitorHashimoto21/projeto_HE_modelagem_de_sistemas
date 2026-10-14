import { analisarNegocio, type DependenciasDaCalculadora, type MotivoDoBloqueio } from "@/lib/calculadora/servicos";
import type { ConsultasDoDashboard, VendasDoDia } from "@/lib/db/dashboard";
import { montarProjecao, semaforo, serieDiaria, serieMensal, type Projecao, type Semaforo, type Serie } from "@/lib/dominio/dashboard";
import { competenciaDoDia } from "@/lib/dominio/financeiro";

/**
 * Dashboard (SPEC-012, 5.1–5.5): carregadores dos cartões. Cada cartão carrega por conta
 * própria (RF44) e só é chamado se o membro puder vê-lo (INV-004); PE e meta vêm da
 * Calculadora e o saldo do Financeiro, sem fórmula duplicada (INV-001).
 */

export type DependenciasDoDashboard = {
  dashboard: ConsultasDoDashboard;
  saldoAtual: (hoje: string) => Promise<number>;
  calculadora: DependenciasDaCalculadora;
  /** Dia local de hoje (São Paulo) — injetável nos testes. */
  hoje: string;
};

export const MENSAGENS_DASHBOARD = {
  falhaNoCartao: "Não foi possível carregar este indicador agora.",
  semCmv: "Para o ponto de equilíbrio sem histórico de vendas, informe o custo dos produtos e insumos (CMV%) nos parâmetros de precificação.",
  inviavel: "Com os parâmetros atuais o ponto de equilíbrio não fecha: custos, imposto e taxa de cartão somam 100% ou mais. Revise os parâmetros de precificação.",
  semMeta: "Configure a margem de lucro desejada para ver a meta.",
  rodapeProjecao: "Projeção a partir das contas registradas e das despesas fixas ativas; não inclui vendas futuras.",
} as const;

export function carregarVendasDoDia(deps: Pick<DependenciasDoDashboard, "dashboard" | "hoje">): Promise<VendasDoDia> {
  return deps.dashboard.vendasDoDia(deps.hoje);
}

export type VisaoDoGrafico = "dias" | "meses";

export async function carregarGrafico(visao: VisaoDoGrafico, deps: Pick<DependenciasDoDashboard, "dashboard" | "hoje">): Promise<Serie> {
  return visao === "meses" ? serieMensal(deps.hoje, await deps.dashboard.vendasPorMes(deps.hoje)) : serieDiaria(deps.hoje, await deps.dashboard.vendasPorDia(deps.hoje));
}

export type EstadoDoSemaforo =
  | { status: "ok"; semaforo: Semaforo; margemMeta: number | null }
  | { status: "indisponivel"; motivo: MotivoDoBloqueio | "sem-cmv" | "inviavel"; mensagem: string };

/** Semáforo (RF57): faturamento do mês atual × PE e meta da Calculadora. */
export async function carregarSemaforo(deps: DependenciasDoDashboard): Promise<EstadoDoSemaforo> {
  const [analise, porMes] = await Promise.all([analisarNegocio(deps.calculadora), deps.dashboard.vendasPorMes(deps.hoje)]);
  if (analise.status === "bloqueado") return { status: "indisponivel", motivo: analise.motivo, mensagem: analise.mensagem };
  if (analise.base.cmv.percentual === null) return { status: "indisponivel", motivo: "sem-cmv", mensagem: MENSAGENS_DASHBOARD.semCmv };
  if (analise.pontoDeEquilibrioCentavos === null) return { status: "indisponivel", motivo: "inviavel", mensagem: MENSAGENS_DASHBOARD.inviavel };
  return {
    status: "ok",
    margemMeta: analise.base.margemMeta,
    semaforo: semaforo({
      faturamentoCentavos: porMes[competenciaDoDia(deps.hoje)] ?? 0,
      pontoDeEquilibrioCentavos: analise.pontoDeEquilibrioCentavos,
      metaCentavos: analise.metaCentavos,
      hoje: deps.hoje,
    }),
  };
}

/** Projeção de caixa (RF68): mês atual + 5 (OPEN-004). */
export async function carregarProjecao(deps: Pick<DependenciasDoDashboard, "dashboard" | "saldoAtual" | "hoje">): Promise<Projecao> {
  const [saldoAtualCentavos, insumos] = await Promise.all([deps.saldoAtual(deps.hoje), deps.dashboard.insumosDaProjecao(deps.hoje)]);
  return montarProjecao({ hoje: deps.hoje, saldoAtualCentavos, ...insumos });
}

/** Falha de um cartão fica só nele (5.1): a página continua com os outros. */
export async function cartaoSeguro<T>(nome: string, carregar: () => Promise<T>): Promise<{ ok: true; dados: T } | { ok: false }> {
  try {
    return { ok: true, dados: await carregar() };
  } catch (e) {
    console.error(`[dashboard] falha no cartão ${nome}:`, e instanceof Error ? e.name : "erro");
    return { ok: false };
  }
}

// ---------- Faixa do caixa (SPEC-016, 5.3) ----------

export type TomDaSaude = "ok" | "atencao" | "perigo" | "neutro";

export type DadosDaFaixa = {
  saldoCentavos: number;
  tendencia: number[];
  entrouHojeCentavos: number;
  saiuHojeCentavos: number;
  saude: { tom: TomDaSaude; rotulo: string };
  movimentos: { id: string; hora: string; descricao: string; tipo: "ENTRADA" | "SAIDA"; valorCentavos: number }[];
};

/** Saúde do mês em uma palavra para a faixa, a partir do semáforo da SPEC-012 (sem fórmula nova). */
export function saudeDoSemaforo(e: EstadoDoSemaforo): DadosDaFaixa["saude"] {
  if (e.status === "indisponivel") return { tom: "neutro", rotulo: "Saúde indisponível" };
  const cor = e.semaforo.cor;
  if (cor === "vermelho") return { tom: "perigo", rotulo: "Déficit no mês" };
  if (cor === "amarelo") return { tom: "atencao", rotulo: "Atenção no mês" };
  if (cor === "verde") return { tom: "ok", rotulo: "Saudável no mês" };
  return { tom: "ok", rotulo: "Equilíbrio atingido" };
}

/** Dados da faixa do caixa: as mesmas fontes do Painel (INV-001 da SPEC-012). */
export async function carregarFaixa(deps: DependenciasDoDashboard): Promise<DadosDaFaixa> {
  const [diario, movimentos, semaforo] = await Promise.all([
    deps.dashboard.saldoDiario(deps.hoje),
    deps.dashboard.movimentosDeHoje(deps.hoje, 500),
    carregarSemaforo(deps).catch(() => ({ status: "indisponivel", motivo: "inviavel", mensagem: "" }) as EstadoDoSemaforo),
  ]);
  const hoje = movimentos.reduce(
    (s, m) => (m.tipo === "ENTRADA" ? { ...s, entrou: s.entrou + m.valorCentavos } : { ...s, saiu: s.saiu + m.valorCentavos }),
    { entrou: 0, saiu: 0 },
  );
  return {
    saldoCentavos: diario.length ? diario[diario.length - 1].saldoCentavos : await deps.saldoAtual(deps.hoje),
    tendencia: diario.map((d) => d.saldoCentavos),
    entrouHojeCentavos: hoje.entrou,
    saiuHojeCentavos: hoje.saiu,
    saude: saudeDoSemaforo(semaforo),
    movimentos: movimentos.slice(0, 12),
  };
}
