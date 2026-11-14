"use client";

import { useActionState } from "react";
import { ShieldOff } from "lucide-react";
import { useAvisoDoSucesso } from "@/components/plataforma/use-acao-critica";
import { DialogoDeConfirmacao, useConfirmacaoDoEnvio } from "@/components/ui/confirmacao";
import { classeDoBotao, type VarianteDoBotao } from "@/components/ui/estilos";
import { acaoEncerrarEmergencia } from "@/lib/suporte/acoes";
import type { EstadoDoEncerramento } from "@/lib/suporte/servicos";

const INICIAL: EstadoDoEncerramento = { status: "ocioso" };

/**
 * "Encerrar acesso" do Dono (SPEC-019, 5.6): o acesso de emergência termina na hora, com o diálogo de
 * confirmação. Na faixa e em "Acessos do suporte".
 */
export function EncerrarEmergencia({ acessoId, variante = "perigo", className }: { acessoId: string; variante?: VarianteDoBotao; className?: string }) {
  const [estado, executar, enviando] = useActionState(useAvisoDoSucesso(acaoEncerrarEmergencia), INICIAL);
  const confirmacao = useConfirmacaoDoEnvio();
  return (
    <form action={executar} onSubmit={confirmacao.aoEnviar} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="acessoId" value={acessoId} />
      <button type="submit" disabled={enviando} className={classeDoBotao(variante, "sm", className)}>
        <ShieldOff aria-hidden="true" />
        {enviando ? "Encerrando…" : "Encerrar acesso"}
      </button>
      {estado.status === "erro" && <span className="text-sm font-semibold">{estado.mensagem}</span>}
      <DialogoDeConfirmacao
        aberto={confirmacao.aberto}
        aoMudar={confirmacao.setAberto}
        titulo="Encerrar o acesso de emergência?"
        descricao="O suporte deixa de ver o negócio na hora, mesmo com uma tela aberta, e não há renovação. O registro do que foi visto continua em Acessos do suporte."
        confirmar="Encerrar acesso"
        aoConfirmar={confirmacao.confirmar}
      />
    </form>
  );
}
