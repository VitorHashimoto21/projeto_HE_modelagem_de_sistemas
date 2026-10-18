"use client";

import { useRouter } from "next/navigation";
import { FormularioConta, FormularioLancamento } from "@/components/financeiro/formularios";
import { avisar } from "@/components/ui/avisar";
import { GavetaDaRota } from "@/components/ui/gaveta";

// Formulários curtos do Financeiro na gaveta (SPEC-016, OPEN-003). Em arquivo próprio para que o
// Caixa, as contas e as despesas não baixem a gaveta junto com os formulários comuns.

/** Lançamento avulso: ao salvar, fecha e confirma no aviso flutuante. */
export function LancamentoNaGaveta({ titulo, descricao, hoje }: { titulo: string; descricao: string; hoje: string }) {
  const router = useRouter();
  return (
    <GavetaDaRota titulo={titulo} descricao={descricao}>
      <FormularioLancamento
        hoje={hoje}
        aoSalvar={(mensagem) => {
          avisar(mensagem);
          router.back();
        }}
      />
    </GavetaDaRota>
  );
}

/** Nova conta: ao salvar, a ação leva ao detalhe da conta (a gaveta fecha na navegação). */
export function ContaNaGaveta({ descricao, hoje, tipoPadrao }: { descricao: string; hoje: string; tipoPadrao: "PAGAR" | "RECEBER" }) {
  return (
    <GavetaDaRota titulo="Nova conta" descricao={descricao}>
      <FormularioConta hoje={hoje} tipoPadrao={tipoPadrao} />
    </GavetaDaRota>
  );
}
