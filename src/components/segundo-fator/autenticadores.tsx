"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { startTransition, useActionState, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Aviso } from "@/components/acesso/campos";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { useConfirmacaoDoEnvio } from "@/components/ui/confirmacao-do-envio";
import { classeDoBotao } from "@/components/ui/estilos";
import { acaoRemoverAutenticador } from "@/lib/auth/segundo-fator-acoes";
import { dataBrasileira } from "@/lib/dominio/datas";
import type { Autenticador } from "./codigo";

// Os diálogos (Radix) só são baixados quando a pessoa clica em "Remover".
const DialogoDeConfirmacao = dynamic(() => import("@/components/ui/confirmacao").then((m) => m.DialogoDeConfirmacao), { ssr: false });
const DialogoDeReconfirmacao = dynamic(() => import("./reconfirmacao").then((m) => m.DialogoDeReconfirmacao), { ssr: false });

export type AutenticadorNaLista = Autenticador & { criadoEm: string };

/** Remover um autenticador (SPEC-019, 5.1): confirmação, e o código de novo se passaram 10 min. */
function RemoverAutenticador({ autenticador, todos }: { autenticador: AutenticadorNaLista; todos: Autenticador[] }) {
  const [estado, executar, enviando] = useActionState(acaoRemoverAutenticador, undefined);
  const confirmacao = useConfirmacaoDoEnvio();
  const formulario = useRef<HTMLFormElement>(null);
  // O diálogo do código abre a cada resposta "reconfirmar" do servidor, até ser respondido ou fechado.
  const [respondida, setRespondida] = useState<unknown>(null);
  const pedirCodigo = estado?.status === "reconfirmar" && respondida !== estado;

  // O diálogo do código fica fora do formulário: o envio dele (num portal) subiria pela árvore do React
  // até o onSubmit da remoção, que o confundiria com o primeiro clique.
  return (
    <>
      <form ref={formulario} action={executar} onSubmit={confirmacao.aoEnviar} className="space-y-2">
        <input type="hidden" name="fator" value={autenticador.id} />
        {estado?.status === "erro" && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
        <button type="submit" disabled={enviando} className={classeDoBotao("fantasma", "sm", "text-status-danger hover:bg-status-danger-bg")}>
          <Trash2 aria-hidden="true" />
          Remover
        </button>
        {confirmacao.aberto && (
          <DialogoDeConfirmacao
            aberto
            aoMudar={confirmacao.setAberto}
            titulo="Remover o autenticador?"
            descricao={`"${autenticador.nome}" deixa de gerar códigos para a sua conta. Você continua entrando com o outro autenticador.`}
            confirmar="Remover"
            aoConfirmar={confirmacao.confirmar}
          />
        )}
      </form>
      {pedirCodigo && (
        <DialogoDeReconfirmacao
          aberto
          aoMudar={(aberto) => !aberto && setRespondida(estado)}
          autenticadores={todos}
          aoVerificar={() => {
            setRespondida(estado);
            // O código renovou os 10 min: repete a remoção, sem perguntar de novo.
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

/**
 * Autenticadores da conta de Administrador em Minha conta (SPEC-019, 5.1): nome e data, cadastrar
 * outro e remover. O último não pode ser removido; com um só, o aviso pede o segundo.
 */
export function ListaDeAutenticadores({ autenticadores }: { autenticadores: AutenticadorNaLista[] }) {
  const so = autenticadores.length === 1;
  return (
    <div className="space-y-4">
      {so && (
        <AvisoDaPagina tom="atencao">
          Você tem só um autenticador. Cadastre um segundo, em outro aparelho ou num gerenciador de senhas, para não perder o acesso se o primeiro sumir.
        </AvisoDaPagina>
      )}
      <ul className="divide-y">
        {autenticadores.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{a.nome}</p>
              <p className="text-xs text-muted-foreground">Cadastrado em {dataBrasileira(new Date(a.criadoEm))}</p>
            </div>
            {!so && <RemoverAutenticador autenticador={a} todos={autenticadores} />}
          </li>
        ))}
      </ul>
      <Link href="/segundo-fator?outro=1" className={classeDoBotao("secundario", "md")}>
        <Plus aria-hidden="true" />
        Cadastrar outro autenticador
      </Link>
    </div>
  );
}
