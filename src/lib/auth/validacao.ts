import { z } from "zod";

/**
 * Validação dos formulários de acesso (SPEC-002, CA-03). O mesmo esquema roda no
 * navegador (resposta imediata) e no servidor (fonte da verdade).
 */

/** Versão vigente da política de privacidade e dos termos de uso (OPEN-005). */
export const VERSAO_TERMOS = "2026-10-03";

/** OPEN-004: mínimo de 8 caracteres, sem exigir símbolos. 72 é o limite do bcrypt do Supabase Auth. */
export const SENHA_MINIMA = 8;
export const SENHA_MAXIMA = 72;

export const MENSAGENS = {
  nomeObrigatorio: "Informe seu nome",
  nomeLongo: "Use no máximo 120 caracteres",
  emailObrigatorio: "Informe seu e-mail",
  emailInvalido: "E-mail inválido",
  senhaObrigatoria: "Informe sua senha",
  senhaCurta: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres`,
  senhaLonga: `A senha pode ter no máximo ${SENHA_MAXIMA} caracteres`,
  confirmacaoDiferente: "As senhas não conferem",
  aceiteObrigatorio: "É preciso aceitar a política de privacidade e os termos de uso",
} as const;

const email = z
  .string()
  .trim()
  .min(1, MENSAGENS.emailObrigatorio)
  .pipe(z.email(MENSAGENS.emailInvalido))
  .transform((v) => v.toLowerCase());

const novaSenha = z
  .string()
  .min(1, MENSAGENS.senhaObrigatoria)
  .min(SENHA_MINIMA, MENSAGENS.senhaCurta)
  .max(SENHA_MAXIMA, MENSAGENS.senhaLonga);

const confirmacao = z.string().min(1, "Confirme a senha");

const senhasIguais = (d: { senha: string; confirmacao: string }) => d.senha === d.confirmacao;

export const esquemaCadastro = z
  .object({
    nome: z.string().trim().min(1, MENSAGENS.nomeObrigatorio).max(120, MENSAGENS.nomeLongo),
    email,
    senha: novaSenha,
    confirmacao,
    // Caixa de seleção: só "on" (marcada) é aceite.
    aceite: z.literal("on", { error: MENSAGENS.aceiteObrigatorio }),
  })
  .refine(senhasIguais, { path: ["confirmacao"], error: MENSAGENS.confirmacaoDiferente });

export const esquemaEntrar = z.object({
  email,
  senha: z.string().min(1, MENSAGENS.senhaObrigatoria),
});

export const esquemaEmail = z.object({ email });

export const esquemaNovaSenha = z
  .object({ senha: novaSenha, confirmacao })
  .refine(senhasIguais, { path: ["confirmacao"], error: MENSAGENS.confirmacaoDiferente });

export type DadosCadastro = z.output<typeof esquemaCadastro>;
export type DadosEntrar = z.output<typeof esquemaEntrar>;

export type ErrosDeCampo = Partial<Record<string, string>>;

export type Validacao<T> = { ok: true; dados: T } | { ok: false; erros: ErrosDeCampo };

/** Valida um objeto e devolve a primeira mensagem de cada campo. */
export function validar<T>(esquema: z.ZodType<T>, entrada: unknown): Validacao<T> {
  const r = esquema.safeParse(entrada);
  if (r.success) return { ok: true, dados: r.data };
  const erros: ErrosDeCampo = {};
  for (const issue of r.error.issues) {
    const campo = String(issue.path[0] ?? "formulario");
    erros[campo] ??= issue.message;
  }
  return { ok: false, erros };
}

/** Converte um FormData em objeto de strings (campos ausentes ficam de fora). */
export function camposDoFormulario(form: FormData): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const [chave, valor] of form.entries()) {
    if (typeof valor === "string") campos[chave] = valor;
  }
  return campos;
}
