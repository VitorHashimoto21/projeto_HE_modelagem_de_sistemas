import "server-only";
import { comNegocio, type ContextoDeNegocio } from "./cliente-do-negocio";
import { prismaBase } from "./prisma";

export { ContextoDeNegocioAusente, NegocioDivergente, OperacaoForaDoContexto } from "./erros";
export type { ClienteDoNegocio, ContextoDeNegocio } from "./cliente-do-negocio";

/**
 * Acesso aos dados de um negócio (SPEC-001, seção 9). Toda operação fica restrita
 * ao negocioId do contexto; sem contexto, lança ContextoDeNegocioAusente.
 * A partir da SPEC-002, o contexto vem da sessão autenticada.
 */
export function clienteDoNegocio(contexto: ContextoDeNegocio | null | undefined) {
  return comNegocio(prismaBase(), contexto);
}

/** Verificação de saúde do banco (CA-10): true se o banco responde. */
export async function bancoDisponivel(): Promise<boolean> {
  try {
    await prismaBase().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
