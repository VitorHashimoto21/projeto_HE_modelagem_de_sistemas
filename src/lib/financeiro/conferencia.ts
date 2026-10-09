import "server-only";
import { financeiro, type ContextoDeNegocio } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";

/**
 * Conferência ao acessar (SPEC-009, 5.5): contas das despesas fixas e parcelas vencidas do
 * negócio ativo, antes de mostrar o Financeiro e o Painel. É idempotente e não depende da
 * permissão de quem abriu a tela (é o sistema completando a rotina diária); uma falha aqui
 * nunca impede a página de abrir — a rotina ou a próxima conferência completam.
 */
export async function conferirFinanceiro(contexto: ContextoDeNegocio): Promise<void> {
  try {
    await financeiro({ negocioId: contexto.negocioId, usuarioId: contexto.usuarioId }).conferir(hoje());
  } catch (e) {
    console.error("[financeiro] conferência falhou:", e instanceof Error ? e.name : "erro");
  }
}
