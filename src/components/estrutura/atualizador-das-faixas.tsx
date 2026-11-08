"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/** Com a aba visível e sem navegação, a conferência repete a cada minuto. */
export const INTERVALO_DAS_FAIXAS_MS = 60_000;

/**
 * Mantém as faixas e o menu da área do negócio em dia (correção da homologação da SPEC-019, T17).
 *
 * O layout não é recalculado na navegação (o Next.js troca só a página), e a emergência aprovada ou
 * encerrada, a suspensão e a troca de plano feitas por outra pessoa só apareciam depois de atualizar a
 * página. A cada navegação, ao voltar para a aba e a cada minuto com a aba visível, este componente
 * compara a assinatura do servidor com a da tela e, se ela mudou, atualiza o layout. Não desenha nada.
 */
export function AtualizadorDasFaixas({ assinatura }: { assinatura: string }) {
  const router = useRouter();
  const caminho = usePathname();
  const naTela = useRef(assinatura);
  const conferindo = useRef(false);
  const primeiroCaminho = useRef(caminho);

  useEffect(() => {
    naTela.current = assinatura;
  }, [assinatura]);

  const conferir = useCallback(async () => {
    if (conferindo.current || document.visibilityState !== "visible") return;
    conferindo.current = true;
    try {
      const resposta = await fetch("/api/faixas", { cache: "no-store", redirect: "manual", headers: { Accept: "application/json" } });
      if (!resposta.ok) return;
      const { assinatura: noServidor } = (await resposta.json()) as { assinatura?: unknown };
      if (typeof noServidor === "string" && noServidor !== naTela.current) router.refresh();
    } catch {
      // Sem rede ou resposta inesperada: a próxima conferência tenta de novo.
    } finally {
      conferindo.current = false;
    }
  }, [router]);

  // A cada navegação: o layout desta tela pode ter ficado para trás. Na primeira carga, já está em dia.
  useEffect(() => {
    if (caminho === primeiroCaminho.current) return;
    primeiroCaminho.current = "";
    void conferir();
  }, [caminho, conferir]);

  // Ao voltar para a aba e a cada minuto com ela visível: a mudança feita por outra pessoa aparece sem navegar.
  useEffect(() => {
    const aoVoltar = () => void conferir();
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    const relogio = window.setInterval(aoVoltar, INTERVALO_DAS_FAIXAS_MS);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
      window.clearInterval(relogio);
    };
  }, [conferir]);

  return null;
}
