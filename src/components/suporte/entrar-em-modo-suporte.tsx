"use client";

import dynamic from "next/dynamic";
import { startTransition, useActionState, useRef, useState } from "react";
import { Eye } from "lucide-react";
import type { Autenticador } from "@/components/segundo-fator/codigo";
import { classeDoBotao } from "@/components/ui/estilos";
import { acaoEntrarEmModoSuporte } from "@/lib/suporte/acoes";

// O diálogo do código (Radix) só é baixado quando o servidor pede o código.
const DialogoDeReconfirmacao = dynamic(() => import("@/components/segundo-fator/reconfirmacao").then((m) => m.DialogoDeReconfirmacao), { ssr: false });

/**
 * "Entrar em modo suporte" (SPEC-018, 5.5). Na liberação com correção (SPEC-019, 5.3), o servidor pede
 * o código de novo se passaram 10 min; verificado, a entrada é repetida, sem outro clique.
 */
export function EntrarEmModoSuporte({ negocioId, autenticadores }: { negocioId: string; autenticadores: Autenticador[] }) {
  const [estado, executar, enviando] = useActionState(acaoEntrarEmModoSuporte, undefined);
  const formulario = useRef<HTMLFormElement>(null);
  // O diálogo abre a cada resposta "reconfirmar", até ser respondido ou fechado.
  const [respondida, setRespondida] = useState<unknown>(null);
  const pedirCodigo = estado?.status === "reconfirmar" && respondida !== estado;

  return (
    <>
      <form ref={formulario} action={executar}>
        <input type="hidden" name="negocioId" value={negocioId} />
        <button type="submit" disabled={enviando} className={classeDoBotao("principal")}>
          <Eye aria-hidden="true" />
          Entrar em modo suporte
        </button>
      </form>
      {pedirCodigo && (
        <DialogoDeReconfirmacao
          aberto
          aoMudar={(aberto) => !aberto && setRespondida(estado)}
          autenticadores={autenticadores}
          aoVerificar={() => {
            setRespondida(estado);
            if (formulario.current) {
              const dados = new FormData(formulario.current);
              startTransition(() => executar(dados));
            }
          }}
        />
      )}
    </>
  );
}
