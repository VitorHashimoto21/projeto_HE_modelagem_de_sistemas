import type { AuthError, SupabaseClient } from "@supabase/supabase-js";
import type {
  AdaptadorDeAutenticacao,
  ResultadoCadastro,
  ResultadoEntrar,
  ResultadoEnvio,
  ResultadoNovaSenha,
} from "./adaptador";

/**
 * Adaptador do Supabase Auth (ADR-003). Traduz os erros do Supabase para os erros
 * do contrato, sem repassar detalhes técnicos à interface (SPEC-002, seção 8).
 */

const limite = (e: AuthError) =>
  e.status === 429 || e.code === "over_request_rate_limit" || e.code === "over_email_send_rate_limit";

function erroDeEnvio(e: AuthError | null): ResultadoEnvio {
  if (!e) return { ok: true };
  if (limite(e)) return { ok: false, erro: "MuitasTentativas" };
  // E-mail inexistente ou já confirmado não muda a resposta (INV-004).
  if (e.code === "user_not_found" || e.code === "email_address_invalid") return { ok: true };
  console.error("[auth] falha ao enviar e-mail:", e.code ?? e.status);
  return { ok: false, erro: "FalhaInterna" };
}

export function criarAdaptadorSupabase(supabase: SupabaseClient): AdaptadorDeAutenticacao {
  return {
    async cadastrar({ nome, email, senha, versaoTermos, urlDeConfirmacao }): Promise<ResultadoCadastro> {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          emailRedirectTo: urlDeConfirmacao,
          // Lidos pelo gatilho he_criar_usuario, que cria o Usuario na mesma transação.
          data: { nome, aceiteTermos: "true", versaoTermosAceita: versaoTermos },
        },
      });
      if (error) {
        if (error.code === "weak_password") return { ok: false, erro: "SenhaRecusada" };
        if (limite(error)) return { ok: false, erro: "MuitasTentativas" };
        if (error.code === "user_already_exists" || error.code === "email_exists") return { ok: true, contaJaExistia: true };
        console.error("[auth] falha no cadastro:", error.code ?? error.status);
        return { ok: false, erro: "FalhaInterna" };
      }
      // Com a confirmação de e-mail ligada, um e-mail já confirmado volta como usuário
      // "ofuscado", sem identidades e sem criar nada (comportamento do Supabase).
      const contaJaExistia = (data.user?.identities?.length ?? 0) === 0;
      return { ok: true, contaJaExistia };
    },

    async entrar(email, senha): Promise<ResultadoEntrar> {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        if (error.code === "email_not_confirmed") return { ok: false, erro: "EmailNaoConfirmado" };
        if (limite(error)) return { ok: false, erro: "MuitasTentativas" };
        if (error.code === "invalid_credentials" || error.status === 400) return { ok: false, erro: "CredenciaisInvalidas" };
        console.error("[auth] falha no login:", error.code ?? error.status);
        return { ok: false, erro: "FalhaInterna" };
      }
      return { ok: true, usuarioId: data.user.id };
    },

    async sair(escopo) {
      const { error } = await supabase.auth.signOut({ scope: escopo === "outras" ? "others" : "local" });
      if (error) console.error("[auth] falha ao encerrar sessão:", error.code ?? error.status);
    },

    async reenviarConfirmacao(email, urlDeConfirmacao) {
      const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: urlDeConfirmacao } });
      return erroDeEnvio(error);
    },

    async pedirRecuperacao(email, urlDeRetorno) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: urlDeRetorno });
      return erroDeEnvio(error);
    },

    async confirmarLink({ tokenHash, codigo, tipo }) {
      // token_hash: modelo de e-mail recomendado (funciona em outro aparelho);
      // code: modelo padrão do Supabase (PKCE, mesmo navegador do pedido).
      const { error } = tokenHash
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })
        : codigo
          ? await supabase.auth.exchangeCodeForSession(codigo)
          : { error: true };
      return { ok: !error };
    },

    async definirSenha(senha): Promise<ResultadoNovaSenha> {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (!error) return { ok: true };
      if (error.code === "same_password") return { ok: false, erro: "MesmaSenha" };
      if (error.code === "weak_password") return { ok: false, erro: "SenhaRecusada" };
      if (error.code === "session_not_found" || error.code === "session_expired" || error.status === 401) {
        return { ok: false, erro: "SemSessao" };
      }
      console.error("[auth] falha ao trocar a senha:", error.code ?? error.status);
      return { ok: false, erro: "FalhaInterna" };
    },

    async usuarioDaSessao() {
      // getClaims valida o JWT (assinatura e validade) no servidor — nunca confiar só no cookie.
      const { data, error } = await supabase.auth.getClaims();
      if (error || !data?.claims?.sub) return null;
      return data.claims.sub;
    },
  };
}
