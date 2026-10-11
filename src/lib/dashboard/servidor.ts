import "server-only";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { dependenciasDaCalculadora } from "@/lib/calculadora/servidor";
import { dashboard, financeiro } from "@/lib/db";
import type { DependenciasDoDashboard } from "./servicos";

/** Dependências do Dashboard (SPEC-012) para o membro: negócio do contexto e "hoje" do servidor. */
export function dependenciasDoDashboard(m: ContextoDoMembro): DependenciasDoDashboard {
  const contexto = { negocioId: m.negocioId, usuarioId: m.usuarioId };
  const calculadora = dependenciasDaCalculadora(m);
  return { dashboard: dashboard(contexto), saldoAtual: (hoje) => financeiro(contexto).saldoAtual(hoje), calculadora, hoje: calculadora.hoje };
}
