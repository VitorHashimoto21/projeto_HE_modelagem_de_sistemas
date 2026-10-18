"use client";

import { useActionState } from "react";
import { acaoAceitarTermos } from "@/lib/suporte/acoes";
import { Aviso, BotaoEnviar } from "./campos";

/** Novo aceite da política e dos termos (SPEC-018, RF78): a caixa marcada é o aceite. */
export function FormularioAceiteDosTermos({ versao, proximo }: { versao: string; proximo?: string }) {
  const [estado, executar] = useActionState(acaoAceitarTermos, {});
  return (
    <form action={executar} className="space-y-5">
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {proximo && <input type="hidden" name="proximo" value={proximo} />}
      <label className="flex items-start gap-3 rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
        <input type="checkbox" name="aceite" required className="mt-0.5 size-4 shrink-0 accent-primary" />
        <span>Li e aceito a Política de Privacidade e os Termos de Uso (versão {versao}).</span>
      </label>
      <BotaoEnviar enviando="Registrando…">Aceitar e continuar</BotaoEnviar>
    </form>
  );
}
