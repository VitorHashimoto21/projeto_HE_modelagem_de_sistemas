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
  // Supabase Auth (SPEC-002). Ambas são públicas: vão para o navegador.
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ error: "obrigatória" })
    .min(1, "obrigatória")
    .refine((v) => v.startsWith("https://") || v.startsWith("http://localhost") || v.startsWith("http://127.0.0.1"), "deve ser a URL do projeto Supabase"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string({ error: "obrigatória" }).min(1, "obrigatória"),
  // Aviso "você já tem conta" (SPEC-002, 5.1). Opcionais: sem elas, o aviso não é enviado.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_REMETENTE: z.string().optional(),
  // Segredo da rotina diária da Vercel Cron (SPEC-009). Opcional: sem ele (ou com menos de 16
  // caracteres), a rotina recusa toda chamada e as contas são geradas só pela conferência ao
  // abrir o Financeiro e o Painel.
  CRON_SECRET: z.string().optional(),
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
