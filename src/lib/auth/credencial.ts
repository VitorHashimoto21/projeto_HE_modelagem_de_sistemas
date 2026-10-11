import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Remoção da credencial no Supabase Auth (SPEC-014, OPEN-001): API administrativa com a
 * chave secreta, só no servidor. Sem a chave, nada é chamado e a pendência fica para a
 * rotina diária; usuário já inexistente no Auth conta como removido.
 */
export type ResultadoDaRemocao = "removida" | "sem-chave" | "falha";

export async function removerCredencial(usuarioId: string): Promise<ResultadoDaRemocao> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !chave) return "sem-chave";
  try {
    const admin = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await admin.auth.admin.deleteUser(usuarioId);
    if (!error || error.status === 404 || error.code === "user_not_found") return "removida";
    console.error("[lgpd] falha ao remover a credencial:", error.code ?? error.status);
    return "falha";
  } catch (e) {
    console.error("[lgpd] falha ao remover a credencial:", e instanceof Error ? e.name : "erro");
    return "falha";
  }
}
