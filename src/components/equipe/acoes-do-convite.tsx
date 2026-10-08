"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/acesso/campos";
import { acaoCancelarConvite, acaoReenviarConvite } from "@/lib/equipe/acoes";
import { ACAO_INICIAL, CONVITE_INICIAL } from "@/lib/equipe/servicos";
import { AvisoDoEnvio, LinkDoConvite } from "./link-do-convite";

const linkBotao = "text-sm font-medium text-primary underline-offset-2 hover:underline disabled:opacity-60";

/** Reenviar (novo link, 7 dias) e cancelar um convite pendente (SPEC-005, 5.4). */
export function AcoesDoConvite({ conviteId }: { conviteId: string }) {
  const [reenvio, reenviar, reenviando] = useActionState(acaoReenviarConvite, CONVITE_INICIAL);
  const [cancelamento, cancelar, cancelando] = useActionState(acaoCancelarConvite, ACAO_INICIAL);

  if (cancelamento.status === "ok") return <p className="text-sm text-muted-foreground">{cancelamento.mensagem}</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4">
        <form action={reenviar}>
          <input type="hidden" name="conviteId" value={conviteId} />
          <button type="submit" disabled={reenviando} className={linkBotao}>
            {reenviando ? "Reenviando…" : "Reenviar"}
          </button>
        </form>
        <form action={cancelar}>
          <input type="hidden" name="conviteId" value={conviteId} />
          <button type="submit" disabled={cancelando} className="text-sm font-medium text-destructive underline-offset-2 hover:underline disabled:opacity-60">
            {cancelando ? "Cancelando…" : "Cancelar convite"}
          </button>
        </form>
      </div>
      {reenvio.status === "criado" && (
        <div className="space-y-3">
          <AvisoDoEnvio enviado={reenvio.emailEnviado}>{reenvio.mensagem}</AvisoDoEnvio>
          <LinkDoConvite link={reenvio.link} />
        </div>
      )}
      {reenvio.status === "erro" && reenvio.mensagem && <Aviso tipo="erro">{reenvio.mensagem}</Aviso>}
      {cancelamento.status === "erro" && <Aviso tipo="erro">{cancelamento.mensagem}</Aviso>}
    </div>
  );
}
