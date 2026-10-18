/**
 * Plano gratuito × pago (SPEC-013). Pura: sem framework nem banco. O plano limita
 * funcionalidades, nunca volume (RN18): nada aqui conta registros.
 */
import { competenciaDoDia, somarMeses } from "./financeiro";

export type Plano = "GRATUITO" | "PAGO";

/** Funcionalidades exclusivas do plano pago (RF45, RF47). */
export const FUNCIONALIDADES_DO_PAGO = ["relatorios", "historicoCompleto", "multiplosColaboradores"] as const;
export type FuncionalidadeDoPago = (typeof FUNCIONALIDADES_DO_PAGO)[number];

export const ROTULO_PLANO: Record<Plano, string> = { GRATUITO: "Gratuito", PAGO: "Pago" };

export const ROTULO_FUNCIONALIDADE: Record<FuncionalidadeDoPago, string> = {
  relatorios: "Relatórios avançados: rentabilidade por item e exportação em CSV e PDF",
  historicoCompleto: "Histórico completo (acima de 12 meses) nas listas e filtros",
  multiplosColaboradores: "Mais de 1 colaborador na equipe",
};

/** O que os dois planos têm (RF46, RF47): sem limite de produtos, vendas ou lançamentos. */
export const INCLUIDO_NOS_DOIS = [
  "Produtos, serviços, vendas e lançamentos sem limite",
  "Estoque, Financeiro e Dashboard",
  "Calculadora de preços completa",
  "Dono + 1 colaborador",
] as const;

/** Plano mínimo de cada funcionalidade: hoje todas só no pago (a lista permite mudar uma a uma). */
const PLANO_MINIMO: Record<FuncionalidadeDoPago, Plano> = { relatorios: "PAGO", historicoCompleto: "PAGO", multiplosColaboradores: "PAGO" };

export const podeNoPlano = (plano: Plano, f: FuncionalidadeDoPago): boolean => plano === "PAGO" || PLANO_MINIMO[f] === "GRATUITO";

/** Colaboradores permitidos no plano gratuito, além do Dono (RF47). */
export const LIMITE_DO_PLANO_GRATUITO = 1;

export const MESES_DO_HISTORICO_GRATUITO = 12;

/**
 * Primeiro dia visível nas listas com histórico (RN18, OPEN-005): no gratuito, o dia 1º
 * do mês atual − 11; no pago, null (sem limite).
 */
export function inicioDoHistorico(plano: Plano, hoje: string): string | null {
  if (podeNoPlano(plano, "historicoCompleto")) return null;
  return `${somarMeses(competenciaDoDia(hoje), -(MESES_DO_HISTORICO_GRATUITO - 1))}-01`;
}

/** Ajusta um dia ao limite do histórico; `ajustado` diz se foi preciso mudar. */
export function limitarDia(dia: string, inicio: string | null): { dia: string; ajustado: boolean } {
  return inicio !== null && dia < inicio ? { dia: inicio, ajustado: true } : { dia, ajustado: false };
}

/** Ajusta uma competência (AAAA-MM) ao limite do histórico. */
export function limitarCompetencia(comp: string, inicio: string | null): { comp: string; ajustado: boolean } {
  const min = inicio?.slice(0, 7) ?? null;
  return min !== null && comp < min ? { comp: min, ajustado: true } : { comp, ajustado: false };
}

export type ColaboradorNaTroca = { id: string; papel: "GERENTE" | "COLABORADOR" };

/**
 * Volta ao gratuito (OPEN-001): fica com acesso só o colaborador escolhido pelo Dono
 * (ou ninguém, se ele não escolher); os outros são suspensos e os convites pendentes
 * cancelados. A escolha precisa ser um dos colaboradores atuais.
 */
export function planejarVoltaAoGratuito(
  colaboradores: ColaboradorNaTroca[],
  manterId: string | null,
): { ok: true; manter: string | null; suspender: string[] } | { ok: false; erro: "EscolhaInvalida" } {
  if (manterId !== null && !colaboradores.some((c) => c.id === manterId)) return { ok: false, erro: "EscolhaInvalida" };
  return { ok: true, manter: manterId, suspender: colaboradores.filter((c) => c.id !== manterId).map((c) => c.id) };
}
