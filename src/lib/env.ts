import { z } from "zod";

/**
 * Variáveis de ambiente obrigatórias (SPEC-001, CA-11).
 * Se faltar alguma, a aplicação não sobe e informa o nome — nunca o valor.
 */
const esquema = z.object({
  DATABASE_URL: z
    .string({ error: "obrigatória" })
    .min(1, "obrigatória")
    .refine((v) => v.startsWith("postgres://") || v.startsWith("postgresql://"), "deve ser uma URL do PostgreSQL"),
  DIRECT_URL: z
    .string()
    .optional()
    .refine((v) => !v || v.startsWith("postgres://") || v.startsWith("postgresql://"), "deve ser uma URL do PostgreSQL"),
});

export type Ambiente = z.infer<typeof esquema>;

export class AmbienteInvalido extends Error {
  constructor(public readonly variaveis: string[], detalhes: string[]) {
    super(`Variáveis de ambiente inválidas ou ausentes: ${detalhes.join("; ")}. Veja o .env.example.`);
    this.name = "AmbienteInvalido";
  }
}

export function carregarAmbiente(fonte: Record<string, string | undefined> = process.env): Ambiente {
  const resultado = esquema.safeParse(fonte);
  if (!resultado.success) {
    const variaveis = [...new Set(resultado.error.issues.map((i) => String(i.path[0])))];
    const detalhes = resultado.error.issues.map((i) => `${String(i.path[0])} (${i.message})`);
    throw new AmbienteInvalido(variaveis, detalhes);
  }
  return resultado.data;
}

let cache: Ambiente | undefined;

export function ambiente(): Ambiente {
  cache ??= carregarAmbiente();
  return cache;
}
