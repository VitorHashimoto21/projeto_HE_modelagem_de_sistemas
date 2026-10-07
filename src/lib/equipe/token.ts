import { createHash, randomBytes } from "node:crypto";

/**
 * Token do link do convite (SPEC-005, 5.3; INV-007): 32 bytes aleatórios em base64url.
 * Só o SHA-256 vai para o banco; o token nunca é guardado nem registrado em log.
 */
export function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashDoToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Formato do token aceito no link (evita consultar o banco com lixo). */
export function formatoDeTokenValido(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** Validade do convite (OPEN-004): 7 dias a partir do envio ou do último reenvio. */
export const VALIDADE_DO_CONVITE_DIAS = 7;

export function validadeDoConvite(agora: Date): Date {
  return new Date(agora.getTime() + VALIDADE_DO_CONVITE_DIAS * 24 * 60 * 60 * 1000);
}
