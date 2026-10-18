"use client";

import { useRouter } from "next/navigation";
import { FormularioMovimentacao } from "@/components/estoque/formularios";
import { avisar } from "@/components/ui/avisar";
import { GavetaDaRota } from "@/components/ui/gaveta";

/**
 * Entrada ou saída na gaveta (SPEC-016, OPEN-003): ao salvar, fecha e confirma no aviso
 * flutuante. Em arquivo próprio para que as telas que usam só os formulários não baixem a gaveta.
 */
export function MovimentacaoNaGaveta({
  titulo,
  descricao,
  ...props
}: {
  titulo: string;
  descricao: string;
  itemId: string;
  tipo: "entrada" | "saida";
  hoje: string;
  unidade: string;
}) {
  const router = useRouter();
  return (
    <GavetaDaRota titulo={titulo} descricao={descricao}>
      <FormularioMovimentacao
        {...props}
        aoSalvar={(mensagem) => {
          avisar(mensagem);
          router.back();
        }}
      />
    </GavetaDaRota>
  );
}
