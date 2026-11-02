import { createHmac, randomBytes } from "node:crypto";

/**
 * Gerador de códigos TOTP para os testes (SPEC-019, T13): RFC 6238 sobre o HOTP da RFC 4226, com
 * `node:crypto`. Conferido com os vetores do apêndice B da RFC 6238 (test/unit/segundo-fator.test.ts).
 * Os aplicativos autenticadores usam SHA-1, 6 dígitos e passo de 30 s, o mesmo que o Supabase Auth.
 */

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function paraBase32(bytes: Buffer): string {
  let bits = 0;
  let valor = 0;
  let saida = "";
  for (const byte of bytes) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      saida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) saida += ALFABETO[(valor << (5 - bits)) & 31];
  return saida;
}

export function deBase32(texto: string): Buffer {
  const limpo = texto.toUpperCase().replace(/[\s=]/g, "");
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const letra of limpo) {
    const i = ALFABETO.indexOf(letra);
    if (i < 0) throw new Error(`caractere inválido em base32: ${letra}`);
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export type Algoritmo = "sha1" | "sha256" | "sha512";

/** HOTP (RFC 4226): HMAC do contador de 8 bytes, truncamento dinâmico e os últimos `digitos`. */
export function hotp(chave: Buffer, contador: number, digitos = 6, algoritmo: Algoritmo = "sha1"): string {
  const mensagem = Buffer.alloc(8);
  mensagem.writeBigUInt64BE(BigInt(contador));
  const hmac = createHmac(algoritmo, chave).update(mensagem).digest();
  const deslocamento = hmac[hmac.length - 1] & 0x0f;
  const binario = hmac.readUInt32BE(deslocamento) & 0x7fffffff;
  return String(binario % 10 ** digitos).padStart(digitos, "0");
}

/** TOTP (RFC 6238) no instante dado, em milissegundos. */
export function totp(chave: Buffer, instanteMs: number, opcoes: { passo?: number; digitos?: number; algoritmo?: Algoritmo } = {}): string {
  const { passo = 30, digitos = 6, algoritmo = "sha1" } = opcoes;
  return hotp(chave, Math.floor(instanteMs / 1000 / passo), digitos, algoritmo);
}

/** Código que o aplicativo mostraria agora para o segredo (base32) do QR code. */
export function codigoAtual(segredo: string, agoraMs = Date.now()): string {
  return totp(deBase32(segredo), agoraMs);
}

/** Segredo novo de 20 bytes, em base32, como o do Supabase. */
export function novoSegredo(): string {
  return paraBase32(randomBytes(20));
}
