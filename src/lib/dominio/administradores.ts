import { mascararEmail } from "./suporte";

/**
 * Mensagens do script do papel de Administrador (`scripts/admin.ts`; SPEC-018, 5.1; SPEC-019, 5.11).
 *
 * No GitHub Actions, o log fica público (o repositório é público): nenhuma parte do e-mail aparece, nem
 * mascarada — a homologação da SPEC-019 (T17) mostrou que a forma das telas do suporte ("r***@dominio")
 * ainda revelava a primeira letra e o domínio. No terminal da equipe, o e-mail mascarado ajuda a conferir
 * a conta.
 */
export type ContaNasMensagens = { a: string; da: string };

export function contaNasMensagens(email: string, noActions: boolean): ContaNasMensagens {
  if (noActions) return { a: "a conta informada", da: "da conta informada" };
  const mascarado = mascararEmail(email.trim().toLowerCase());
  return { a: `a conta ${mascarado}`, da: `da conta ${mascarado}` };
}

const inicial = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

export const MENSAGENS_DO_ADMINISTRADOR = {
  jaEra: (c: ContaNasMensagens, desde: string) => `${inicial(c.a)} já é administradora desde ${desde}. Nada mudou.`,
  concedido: (c: ContaNasMensagens, responsavel: string) => `Pronto: ${c.a} agora é administradora (concedido por ${responsavel}).`,
  redefinido: (c: ContaNasMensagens, responsavel: string, removidos: number) =>
    `Pronto: 2º fator ${c.da} redefinido por ${responsavel} (${removidos} autenticador(es) removido(s)). As sessões abertas antes disso deixaram de valer, e o próximo login pede o cadastro de novo.`,
  naoEra: (c: ContaNasMensagens) => `${inicial(c.a)} não era administradora. Nada mudou.`,
  retirado: (c: ContaNasMensagens, responsavel: string) => `Pronto: ${c.a} não é mais administradora (retirado por ${responsavel}).`,
};

/**
 * Quais segredos faltam para `redefinir-2fator` (a mesma regra do workflow): diz qual, para a equipe não
 * procurar os dois quando falta um — na homologação, só o `SUPABASE_URL` faltava.
 */
export function segredosQueFaltam(supabaseUrl: string, chaveSecreta: string): string | null {
  const faltam = [!supabaseUrl.trim() && "SUPABASE_URL", !chaveSecreta.trim() && "SUPABASE_SECRET_KEY"].filter(Boolean) as string[];
  if (faltam.length === 0) return null;
  return faltam.length === 1 ? `Falta o segredo ${faltam[0]}` : `Faltam os segredos ${faltam.join(" e ")}`;
}
