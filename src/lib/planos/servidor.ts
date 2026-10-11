import "server-only";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { planos } from "@/lib/db";
import type { DependenciasDoPlano } from "./servicos";

/** Dependências reais dos fluxos do plano para o Dono do negócio ativo (SPEC-013). */
export function dependenciasDoPlano(m: ContextoDoMembro): DependenciasDoPlano {
  const doNegocio = planos().doNegocio(m.negocioId);
  return { alterarPlano: doNegocio.alterarPlano, trocarAcesso: doNegocio.trocarAcesso, usuarioId: m.usuarioId, agora: new Date() };
}

/** Plano do negócio do membro (guarda de plano — 5.5). Negócio indisponível conta como gratuito. */
export async function planoDoMembro(m: Pick<ContextoDoMembro, "negocioId">): Promise<"GRATUITO" | "PAGO"> {
  return (await planos().planoDoNegocio(m.negocioId)) ?? "GRATUITO";
}
