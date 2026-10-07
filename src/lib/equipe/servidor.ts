import "server-only";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { obterContexto, origemDaRequisicao } from "@/lib/auth/servidor";
import { equipe } from "@/lib/db";
import { enviarEmail } from "@/lib/integracoes/email";
import { gravarNegocioAtivo, limparNegocioAtivo } from "@/lib/negocio/servidor";
import type { DependenciasDaEquipe } from "./servicos";

/** Dependências reais dos fluxos da equipe: contexto da requisição, banco, Resend e cookies. */
export async function dependenciasDaEquipe(membro?: ContextoDoMembro | null): Promise<DependenciasDaEquipe> {
  const contexto = await obterContexto();
  const membroDoContexto =
    contexto?.negocioId && contexto.papel && contexto.permissoes
      ? { usuarioId: contexto.usuarioId, negocioId: contexto.negocioId, papel: contexto.papel, permissoes: contexto.permissoes }
      : null;
  return {
    usuarioId: contexto?.usuarioId ?? null,
    membro: membro ?? membroDoContexto,
    consultas: equipe(),
    enviarEmail: (m) => enviarEmail(m, "equipe"),
    origem: await origemDaRequisicao(),
    agora: () => new Date(),
    definirNegocioAtivo: gravarNegocioAtivo,
    negocioAtivo: contexto?.negocioId ?? null,
    limparNegocioAtivo,
  };
}
