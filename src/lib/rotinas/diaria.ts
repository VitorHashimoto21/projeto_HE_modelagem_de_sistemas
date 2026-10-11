import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Rotina diária (SPEC-009, 5.5; OPEN-08 do Mapa). Sem framework: a rota da Vercel Cron só
 * confere o segredo e chama estas funções, que os testes exercitam direto.
 */

/** Tamanho mínimo do CRON_SECRET: segredo curto demais equivale a nenhum. */
export const TAMANHO_MINIMO_DO_SEGREDO = 16;

/**
 * Confere o cabeçalho "Authorization: Bearer <CRON_SECRET>" (INV-007, CA-12). Sem segredo
 * configurado, nada passa (falha fechada). A comparação leva o mesmo tempo para qualquer valor.
 */
export function autorizacaoConfere(cabecalho: string | null, segredo: string | undefined): boolean {
  if (!segredo || segredo.length < TAMANHO_MINIMO_DO_SEGREDO || !cabecalho) return false;
  const resumo = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(resumo(cabecalho), resumo(`Bearer ${segredo}`));
}

export type ResultadoDaConferencia = { contasCriadas: number; parcelasRecebidas: number };
export type ResultadoDaRotina = ResultadoDaConferencia & { negocios: number; falhas: number };

/**
 * Confere cada negócio, alguns por vez. A falha de um negócio não impede os demais; ela é
 * registrada (sem dados do negócio) e a próxima execução, ou a conferência ao acessar, completa.
 */
export async function executarRotinaDiaria(
  negocios: string[],
  conferir: (negocioId: string) => Promise<ResultadoDaConferencia>,
  simultaneos = 5,
): Promise<ResultadoDaRotina> {
  const total: ResultadoDaRotina = { negocios: negocios.length, contasCriadas: 0, parcelasRecebidas: 0, falhas: 0 };
  let proximo = 0;
  async function trabalhador() {
    while (proximo < negocios.length) {
      const negocioId = negocios[proximo++];
      try {
        const r = await conferir(negocioId);
        total.contasCriadas += r.contasCriadas;
        total.parcelasRecebidas += r.parcelasRecebidas;
      } catch (e) {
        total.falhas++;
        console.error("[rotina diária] falha ao conferir um negócio:", e instanceof Error ? e.name : "erro");
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(simultaneos, negocios.length)) }, trabalhador));
  return total;
}
