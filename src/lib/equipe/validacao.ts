import { z } from "zod";
import { validar, type ErrosDeCampo } from "@/lib/auth/validacao";
import { matrizDoFormulario, matrizParaGravar, validarMatriz, type Matriz } from "@/lib/dominio/permissoes";

/**
 * Validação dos formulários da equipe (SPEC-005, 5.2 e 5.4). Roda no navegador e no
 * servidor, como nas telas de acesso e do negócio.
 */

export const MENSAGENS_EQUIPE = {
  emailObrigatorio: "Informe o e-mail da pessoa",
  emailInvalido: "E-mail inválido",
  papelInvalido: "Escolha Gerente ou Colaborador",
} as const;

export const esquemaConvite = z.object({
  email: z
    .string()
    .trim()
    .min(1, MENSAGENS_EQUIPE.emailObrigatorio)
    .pipe(z.email(MENSAGENS_EQUIPE.emailInvalido))
    .transform((v) => v.toLowerCase()),
  // O Dono nunca é convidado nem atribuído (INV-002).
  papel: z.enum(["GERENTE", "COLABORADOR"], { error: MENSAGENS_EQUIPE.papelInvalido }),
});

export type PapelDoConvite = z.output<typeof esquemaConvite>["papel"];

export type DadosDoConvite = { email: string; papel: PapelDoConvite; permissoesCustom: Matriz | null };

/**
 * Matriz customizada do formulário, quando "Personalizar permissões" está marcado.
 * Igual à predefinição do papel vira null (vale a predefinição). Incoerente → erro.
 */
export function matrizDoPedido(
  papel: PapelDoConvite,
  campos: Record<string, string>,
): { ok: true; matriz: Matriz | null } | { ok: false; erro: string } {
  if (campos.personalizar !== "on") return { ok: true, matriz: null };
  const v = validarMatriz(matrizDoFormulario(campos));
  return v.ok ? { ok: true, matriz: matrizParaGravar(papel, v.matriz) } : v;
}

export function validarConvite(campos: Record<string, string>): { ok: true; dados: DadosDoConvite } | { ok: false; erros: ErrosDeCampo } {
  const v = validar(esquemaConvite, campos);
  if (!v.ok) return v;
  const m = matrizDoPedido(v.dados.papel, campos);
  if (!m.ok) return { ok: false, erros: { permissoes: m.erro } };
  return { ok: true, dados: { ...v.dados, permissoesCustom: m.matriz } };
}

/** E-mail mascarado para quem não é o dono dele (5.3): "j•••@exemplo.com". */
export function mascararEmail(email: string): string {
  const [local, dominio] = email.split("@");
  if (!dominio) return "•••";
  return `${local.slice(0, 1)}•••@${dominio}`;
}
