import "server-only";
import { ambiente } from "@/lib/env";

/**
 * Aviso ao dono de um e-mail já cadastrado (SPEC-002, 5.1): quem tenta se cadastrar
 * vê a mesma resposta de sucesso, e o dono do e-mail recebe este aviso. Enviado pela
 * API do Resend (OPEN-002); sem RESEND_API_KEY e EMAIL_REMETENTE, não é enviado.
 */
export async function enviarAvisoDeContaExistente(email: string, origem: string): Promise<void> {
  const { RESEND_API_KEY, EMAIL_REMETENTE } = ambiente();
  if (!RESEND_API_KEY || !EMAIL_REMETENTE) return;

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_REMETENTE,
      to: [email],
      subject: "Você já tem uma conta no Health Enterprise",
      text: [
        "Olá!",
        "",
        "Alguém (talvez você) tentou criar uma conta no Health Enterprise com este e-mail, mas ele já está cadastrado.",
        `Para entrar, acesse ${origem}/entrar. Se esqueceu a senha, use "Esqueci a senha" em ${origem}/esqueci-a-senha.`,
        "",
        "Se não foi você, pode ignorar esta mensagem: nada foi alterado na sua conta.",
      ].join("\n"),
    }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!resposta.ok) console.error("[auth] falha ao enviar o aviso de conta existente:", resposta.status);
}
