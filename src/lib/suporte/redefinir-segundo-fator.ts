import { createClient } from "@supabase/supabase-js";
import type { ConsultasDeSuporte } from "@/lib/db/suporte";

/**
 * Redefinição do 2º fator pelo workflow "Administradores" (SPEC-019, 5.1; OPEN-002): outra pessoa da
 * equipe apaga os autenticadores de quem perdeu todos. Os fatores ficam no Supabase Auth e saem pela
 * API de administração, com a chave secreta do ambiente; só depois o HE grava a redefinição, que
 * invalida as sessões abertas antes dela (INV-001), e o registro mostra quem redefiniu (CA-05).
 */

/** O pedaço da API de administração do Supabase Auth que a redefinição usa. */
export type ApiDeAdministracao = {
  listarFatores(usuarioId: string): Promise<string[] | null>;
  apagarFator(usuarioId: string, fatorId: string): Promise<boolean>;
};

export type ResultadoDaRedefinicao =
  | { ok: true; removidos: number }
  | { ok: false; erro: "ContaInexistente" | "NaoEAdministrador" | "FalhaNoSupabase" };

export const MENSAGENS_DA_REDEFINICAO = {
  ContaInexistente: "Conta não encontrada.",
  NaoEAdministrador: "A conta não é de Administrador. A redefinição vale só para as contas do suporte.",
  FalhaNoSupabase: "O Supabase não apagou os autenticadores. Confira a chave secreta e a URL do ambiente e rode de novo; nada foi gravado no HE.",
} as const;

export async function redefinirSegundoFator(
  email: string,
  responsavel: string,
  agora: Date,
  deps: { consultas: Pick<ConsultasDeSuporte, "contaParaRedefinir" | "registrarRedefinicao">; api: ApiDeAdministracao },
): Promise<ResultadoDaRedefinicao> {
  const conta = await deps.consultas.contaParaRedefinir(email);
  if (!conta.ok) return conta;
  const fatores = await deps.api.listarFatores(conta.usuarioId);
  if (!fatores) return { ok: false, erro: "FalhaNoSupabase" };
  for (const id of fatores) {
    if (!(await deps.api.apagarFator(conta.usuarioId, id))) return { ok: false, erro: "FalhaNoSupabase" };
  }
  await deps.consultas.registrarRedefinicao(conta.usuarioId, responsavel, fatores.length, agora);
  return { ok: true, removidos: fatores.length };
}

/** A API real, com a chave secreta passada por variável de ambiente (nunca no comando). */
export function apiDeAdministracaoDoSupabase(url: string, chaveSecreta: string): ApiDeAdministracao {
  const admin = createClient(url, chaveSecreta, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin.mfa;
  return {
    async listarFatores(usuarioId) {
      const { data, error } = await admin.listFactors({ userId: usuarioId });
      if (error || !data) {
        console.error("[admin] falha ao listar os autenticadores:", error?.code ?? error?.status);
        return null;
      }
      return data.factors.map((f) => f.id);
    },
    async apagarFator(usuarioId, fatorId) {
      const { error } = await admin.deleteFactor({ id: fatorId, userId: usuarioId });
      if (error && error.status !== 404) {
        console.error("[admin] falha ao apagar um autenticador:", error.code ?? error.status);
        return false;
      }
      return true;
    },
  };
}
