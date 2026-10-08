import "server-only";
import { ambiente } from "@/lib/env";

/**
 * Envio de e-mail transacional pela API do Resend (SPEC-002, OPEN-002; SPEC-005, OPEN-004).
 * Sem RESEND_API_KEY e EMAIL_REMETENTE, nada é enviado. Nunca lança: devolve se o envio
 * foi aceito, e os logs não trazem o destinatário nem o conteúdo.
 */
export type MensagemDeEmail = { para: string; assunto: string; texto: string };

export function envioDeEmailConfigurado(): boolean {
  const { RESEND_API_KEY, EMAIL_REMETENTE } = ambiente();
  return Boolean(RESEND_API_KEY && EMAIL_REMETENTE);
}

export async function enviarEmail({ para, assunto, texto }: MensagemDeEmail, origemDoLog: string): Promise<boolean> {
  const { RESEND_API_KEY, EMAIL_REMETENTE } = ambiente();
  if (!RESEND_API_KEY || !EMAIL_REMETENTE) return false;
  try {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_REMETENTE, to: [para], subject: assunto, text: texto }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!resposta.ok) console.error(`[${origemDoLog}] falha ao enviar e-mail:`, resposta.status);
    return resposta.ok;
  } catch (e) {
    console.error(`[${origemDoLog}] falha ao enviar e-mail:`, e instanceof Error ? e.name : "erro");
    return false;
  }
}
