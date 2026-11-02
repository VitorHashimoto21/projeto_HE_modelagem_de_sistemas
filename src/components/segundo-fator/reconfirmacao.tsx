"use client";

import { useActionState } from "react";
import { Dialog } from "radix-ui";
import { Aviso, BotaoEnviar } from "@/components/acesso/campos";
import { classeDoBotao } from "@/components/ui/estilos";
import { acaoReconfirmarCodigo } from "@/lib/auth/segundo-fator-acoes";
import type { EstadoDoCodigo } from "@/lib/auth/segundo-fator";
import { MENSAGENS_DO_SEGUNDO_FATOR } from "@/lib/dominio/segundo-fator";
import { CamposDoCodigo, type Autenticador } from "./codigo";

/**
 * Reconfirmação das ações críticas (SPEC-019, OPEN-003): quando o servidor responde "reconfirmar", o
 * diálogo pede o código; verificado, a tela repete a ação (`aoVerificar`). Vale por 10 min.
 */
export function DialogoDeReconfirmacao({
  aberto,
  aoMudar,
  autenticadores,
  aoVerificar,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  autenticadores: Autenticador[];
  aoVerificar: () => void;
}) {
  const [estado, executar] = useActionState(async (anterior: EstadoDoCodigo, form: FormData) => {
    const r = await acaoReconfirmarCodigo(anterior, form);
    if (r.status === "verificado") aoVerificar();
    return r;
  }, { status: "ocioso" } as EstadoDoCodigo);

  return (
    <Dialog.Root open={aberto} onOpenChange={aoMudar}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-estrutura/45 dark:bg-black/65" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card p-6 text-card-foreground shadow-2xl ring-1 ring-border outline-none">
          <Dialog.Title className="text-lg font-bold">Digite o código do autenticador</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">{MENSAGENS_DO_SEGUNDO_FATOR.reconfirmar}</Dialog.Description>
          <form action={executar} noValidate className="mt-5 space-y-4">
            {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
            <CamposDoCodigo autenticadores={autenticadores} erro={estado.status === "erro" ? estado.erros?.codigo : undefined} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close className={classeDoBotao("secundario", "lg")}>Voltar</Dialog.Close>
              <BotaoEnviar enviando="Conferindo…" largura="automatica">
                Continuar
              </BotaoEnviar>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
