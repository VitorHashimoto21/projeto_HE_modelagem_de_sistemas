"use client";

import { DialogoDeConfirmacao, useConfirmacaoDoEnvio } from "@/components/ui/confirmacao";
import { classeDoBotao } from "@/components/ui/estilos";
import { acaoRevogarSuporte } from "@/lib/suporte/acoes";

/** Revogar a liberação ativa (SPEC-018, 5.4): confirmação pelo diálogo da SPEC-016. */
export function RevogarAcesso({ acessoId }: { acessoId: string }) {
  const confirmacao = useConfirmacaoDoEnvio();
  return (
    <form action={acaoRevogarSuporte} onSubmit={confirmacao.aoEnviar}>
      <input type="hidden" name="acessoId" value={acessoId} />
      <button type="submit" className={classeDoBotao("perigo", "sm")}>
        Revogar
      </button>
      <DialogoDeConfirmacao
        aberto={confirmacao.aberto}
        aoMudar={confirmacao.setAberto}
        titulo="Revogar o acesso do suporte?"
        descricao="O suporte deixa de ver o negócio na hora, mesmo que esteja com uma tela aberta. O registro do que foi visto continua aqui."
        confirmar="Revogar"
        aoConfirmar={confirmacao.confirmar}
      />
    </form>
  );
}
