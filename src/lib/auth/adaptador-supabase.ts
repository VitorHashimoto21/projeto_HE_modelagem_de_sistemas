import type { AuthError, SupabaseClient } from "@supabase/supabase-js";
import type {
  AdaptadorDeAutenticacao,
  FatorDoUsuario,
  ResultadoCadastro,
  ResultadoDaRemocaoDoFator,
  ResultadoDoCadastroDoFator,
  ResultadoDoCodigo,
  ResultadoEntrar,
  ResultadoEnvio,
  ResultadoNovaSenha,
  SessaoAtual,
} from "./adaptador";
import { instantesDasClaims } from "@/lib/dominio/segundo-fator";

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

/**
 * O SDK entrega o QR code como "data:image/svg+xml;utf-8," seguido do SVG cru. Um "#" no SVG (uma cor,
 * por exemplo) corta a imagem no navegador; codificado, o mesmo SVG sempre aparece.
 */
export function qrCodeComoImagem(qrCode: string): string {
  const prefixo = "data:image/svg+xml;utf-8,";
  return qrCode.startsWith(prefixo) ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode.slice(prefixo.length))}` : qrCode;
}

export function criarAdaptadorSupabase(supabase: SupabaseClient): AdaptadorDeAutenticacao {
  async function sessaoAtual(): Promise<SessaoAtual | null> {
    // getClaims valida o JWT (assinatura e validade) no servidor — nunca confiar só no cookie.
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) return null;
    // SPEC-018 (RNF12) e SPEC-019 (5.1): o "amr" guarda o momento do login com senha e o do último
    // código, e não muda na renovação da sessão; o "aal" diz se o código já foi verificado.
    const s = instantesDasClaims(data.claims as Record<string, unknown>);
    return { usuarioId: data.claims.sub, autenticadoEm: s.senhaEm, nivel: s.nivel, codigoEm: s.codigoEm };
  }

  async function fatores(): Promise<FatorDoUsuario[]> {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) {
      if (error) console.error("[auth] falha ao listar os autenticadores:", error.code ?? error.status);
      return [];
    }
    return data.all
      .filter((f) => f.factor_type === "totp")
      .map((f) => ({ id: f.id, nome: f.friendly_name ?? "Autenticador", criadoEm: new Date(f.created_at), verificado: f.status === "verified" }))
      .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());
  }

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
      // SPEC-019 (OPEN-017): conta com 2º fator só troca a senha numa sessão aal2.
      if (error.code === "insufficient_aal") return { ok: false, erro: "SegundoFatorNecessario" };
      if (error.code === "session_not_found" || error.code === "session_expired" || error.status === 401) {
        return { ok: false, erro: "SemSessao" };
      }
      console.error("[auth] falha ao trocar a senha:", error.code ?? error.status);
      return { ok: false, erro: "FalhaInterna" };
    },

    async usuarioDaSessao() {
      return (await sessaoAtual())?.usuarioId ?? null;
    },

    sessaoAtual,

    fatores,

    async iniciarCadastroDoFator(nome, emissor): Promise<ResultadoDoCadastroDoFator> {
      // Um cadastro não concluído (QR code gerado e código nunca digitado) não serve para nada:
      // sai antes do novo, para não acumular fatores pendentes no Supabase.
      for (const f of await fatores()) {
        if (!f.verificado) await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: nome, issuer: emissor });
      if (error || !data) {
        if (error?.code === "mfa_factor_name_conflict") return { ok: false, erro: "NomeRepetido" };
        if (error?.code === "too_many_enrolled_mfa_factors") return { ok: false, erro: "MuitosFatores" };
        if (error?.code === "insufficient_aal") return { ok: false, erro: "SegundoFatorNecessario" };
        if (error && limite(error)) return { ok: false, erro: "MuitasTentativas" };
        console.error("[auth] falha ao cadastrar o autenticador:", error?.code ?? error?.status);
        return { ok: false, erro: "FalhaInterna" };
      }
      return { ok: true, fatorId: data.id, qrCode: qrCodeComoImagem(data.totp.qr_code), segredo: data.totp.secret };
    },

    async verificarCodigo(fatorId, codigo): Promise<ResultadoDoCodigo> {
      // Com sucesso, o Supabase devolve a sessão aal2 (gravada nos cookies pelo @supabase/ssr).
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fatorId, code: codigo });
      if (!error) return { ok: true };
      if (limite(error)) return { ok: false, erro: "MuitasTentativas" };
      if (
        error.code === "mfa_verification_failed" ||
        error.code === "mfa_verification_rejected" ||
        error.code === "mfa_challenge_expired" ||
        error.code === "mfa_factor_not_found" ||
        error.status === 400 ||
        error.status === 422
      ) {
        return { ok: false, erro: "CodigoInvalido" };
      }
      console.error("[auth] falha ao verificar o código:", error.code ?? error.status);
      return { ok: false, erro: "FalhaInterna" };
    },

    async removerFator(fatorId): Promise<ResultadoDaRemocaoDoFator> {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: fatorId });
      if (!error) return { ok: true };
      if (error.code === "insufficient_aal") return { ok: false, erro: "SegundoFatorNecessario" };
      console.error("[auth] falha ao remover o autenticador:", error.code ?? error.status);
      return { ok: false, erro: "FalhaInterna" };
    },
  };
}
