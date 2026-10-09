import type { MotivoSaidaManual, TipoMovimentacao } from "@/generated/prisma/enums";
import type { Situacao } from "@/lib/dominio/estoque";
import { cn } from "@/lib/utils";

// Exibição do estoque (SPEC-007). Sem "use client": usado por páginas do servidor.

export const ROTULO_MOVIMENTACAO: Record<TipoMovimentacao, string> = {
  ENTRADA: "Entrada",
  SAIDA_MANUAL: "Saída manual",
  SAIDA_VENDA: "Venda",
  ENTRADA_ESTORNO: "Estorno de venda",
};

export const ROTULO_MOTIVO: Record<MotivoSaidaManual, string> = {
  PERDA: "Perda",
  QUEBRA: "Quebra",
  USO_INTERNO: "Uso interno",
  DOACAO: "Doação",
  OUTRO: "Outro",
};

const SITUACOES: Record<Situacao, { texto: string; icone: string; classes: string }> = {
  SEM_ESTOQUE: { texto: "Sem estoque", icone: "■", classes: "bg-status-danger-bg text-status-danger" },
  BAIXO: { texto: "Estoque baixo", icone: "▲", classes: "bg-status-warn-bg text-status-warn" },
  NORMAL: { texto: "Normal", icone: "●", classes: "bg-status-ok-bg text-status-ok" },
  SEM_MINIMO: { texto: "Sem mínimo", icone: "○", classes: "bg-muted text-muted-foreground" },
};

/** Selo de situação: nunca só cor — sempre ícone e texto (RNF01, 5.4). */
export function SeloDeSituacao({ situacao, className }: { situacao: Situacao; className?: string }) {
  const s = SITUACOES[situacao];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", s.classes, className)}>
      <span aria-hidden="true">{s.icone}</span>
      {s.texto}
    </span>
  );
}

/** "1,5" — até 3 casas, sem zeros à direita (OPEN-008). */
export const quantidade = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
