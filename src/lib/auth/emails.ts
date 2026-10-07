import "server-only";
import { enviarEmail } from "@/lib/integracoes/email";

/**
 * Aviso ao dono de um e-mail já cadastrado (SPEC-002, 5.1): quem tenta se cadastrar
 * vê a mesma resposta de sucesso, e o dono do e-mail recebe este aviso. Enviado pela
 * API do Resend (OPEN-002); sem RESEND_API_KEY e EMAIL_REMETENTE, não é enviado.
 */
export async function enviarAvisoDeContaExistente(email: string, origem: string): Promise<void> {
  await enviarEmail(
    {
      para: email,
      assunto: "Você já tem uma conta no Health Enterprise",
      texto: [
        "Olá!",
        "",
        "Alguém (talvez você) tentou criar uma conta no Health Enterprise com este e-mail, mas ele já está cadastrado.",
        `Para entrar, acesse ${origem}/entrar. Se esqueceu a senha, use "Esqueci a senha" em ${origem}/esqueci-a-senha.`,
        "",
        "Se não foi você, pode ignorar esta mensagem: nada foi alterado na sua conta.",
      ].join("\n"),
    },
    "auth",
  );
}
