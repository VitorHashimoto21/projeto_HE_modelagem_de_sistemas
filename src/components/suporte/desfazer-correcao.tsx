"use client";

import { useActionState, useEffect } from "react";
import { Undo2 } from "lucide-react";
import { Aviso } from "@/components/acesso/campos";
import { avisar } from "@/components/ui/avisar";
import { DialogoDeConfirmacao, useConfirmacaoDoEnvio } from "@/components/ui/confirmacao";
import { classeDoBotao } from "@/components/ui/estilos";
import { acaoDesfazerCorrecao } from "@/lib/suporte/acoes";
import type { EstadoDoDesfazer } from "@/lib/suporte/servicos";

const INICIAL: EstadoDoDesfazer = { status: "ocioso" };

/**
 * "Desfazer" de uma correção do suporte (SPEC-019, 5.5): diálogo de confirmação com o que vai
 * acontecer; a recusa do servidor aparece logo abaixo, com a explicação.
 */
export function DesfazerCorrecao({ correcaoId, registro, comoDesfaz }: { correcaoId: string; registro: string; comoDesfaz: string }) {
  const [estado, executar, enviando] = useActionState(acaoDesfazerCorrecao, INICIAL);
  const confirmacao = useConfirmacaoDoEnvio();

  useEffect(() => {
    if (estado.status === "ok") avisar(estado.mensagem);
  }, [estado]);

  return (
    <form action={executar} onSubmit={confirmacao.aoEnviar} className="space-y-2">
      <input type="hidden" name="correcaoId" value={correcaoId} />
      {estado.status === "erro" && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <button type="submit" disabled={enviando} className={classeDoBotao("secundario", "sm")}>
        <Undo2 aria-hidden="true" />
        {enviando ? "Desfazendo…" : "Desfazer"}
      </button>
      <DialogoDeConfirmacao
        aberto={confirmacao.aberto}
        aoMudar={confirmacao.setAberto}
        titulo="Desfazer a correção?"
        descricao={`${registro}: ${comoDesfaz.charAt(0).toLowerCase()}${comoDesfaz.slice(1)}. A correção e o desfazer continuam no registro, em seu nome.`}
        confirmar="Desfazer"
        aoConfirmar={confirmacao.confirmar}
      />
    </form>
  );
}
