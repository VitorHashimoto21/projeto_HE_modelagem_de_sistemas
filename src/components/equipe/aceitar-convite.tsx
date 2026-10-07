"use client";

import { useActionState } from "react";
import { Aviso, BotaoEnviar } from "@/components/acesso/campos";
import { acaoAceitarConvite } from "@/lib/equipe/acoes";
import { ACAO_INICIAL } from "@/lib/equipe/servicos";

/** Botão "Aceitar convite": pelo token do link ou pelo id em "Convites para você" (5.3). */
export function AceitarConvite({ token, conviteId, compacto = false }: { token?: string; conviteId?: string; compacto?: boolean }) {
  const [estado, executar, enviando] = useActionState(acaoAceitarConvite, ACAO_INICIAL);
  return (
    <form action={executar} className="space-y-3">
      {token && <input type="hidden" name="token" value={token} />}
      {conviteId && <input type="hidden" name="conviteId" value={conviteId} />}
      {estado.status === "erro" && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      {compacto ? (
        <button
          type="submit"
          disabled={enviando}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-70"
        >
          {enviando ? "Aceitando…" : "Aceitar"}
        </button>
      ) : (
        <BotaoEnviar enviando="Aceitando…">Aceitar convite</BotaoEnviar>
      )}
    </form>
  );
}
