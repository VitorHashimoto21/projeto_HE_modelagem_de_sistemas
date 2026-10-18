import type { MotivoSaidaManual, TipoMovimentacao } from "@/generated/prisma/enums";
import { Selo, type TomDoSelo } from "@/components/ui/selo";
import type { Situacao } from "@/lib/dominio/estoque";

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

const SITUACOES: Record<Situacao, { texto: string; tom: TomDoSelo }> = {
  SEM_ESTOQUE: { texto: "Sem estoque", tom: "perigo" },
  BAIXO: { texto: "Estoque baixo", tom: "atencao" },
  NORMAL: { texto: "Normal", tom: "ok" },
  SEM_MINIMO: { texto: "Sem mínimo", tom: "neutro" },
};

/** Selo de situação: nunca só cor — sempre ícone e texto (RNF01, 5.4). */
export function SeloDeSituacao({ situacao, className }: { situacao: Situacao; className?: string }) {
  const s = SITUACOES[situacao];
  return (
    <Selo tom={s.tom} className={className}>
      {s.texto}
    </Selo>
  );
}

/** "1,5" — até 3 casas, sem zeros à direita (OPEN-008). */
export const quantidade = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
