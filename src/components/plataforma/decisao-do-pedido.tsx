"use client";

import dynamic from "next/dynamic";
import { Check, Hourglass, X } from "lucide-react";
import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { Dialog } from "radix-ui";
import { MensagemDeCampo } from "@/components/acesso/campos";
import type { Autenticador } from "@/components/segundo-fator/codigo";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao } from "@/components/ui/estilos";
import { Selo } from "@/components/ui/selo";
import { MAX_MOTIVO_DA_RECUSA, validarRecusa } from "@/lib/dominio/plataforma";
import { acaoAprovarPedido, acaoCancelarPedido, acaoRecusarPedido } from "@/lib/plataforma/acoes";
import { DECISAO_INICIAL, type EstadoDaDecisao } from "@/lib/plataforma/servicos";
import { useAcaoCritica, useAvisoDoSucesso } from "./use-acao-critica";

// O diálogo de confirmação (Radix) só é baixado no primeiro clique.
const DialogoDeConfirmacao = dynamic(() => import("@/components/ui/confirmacao").then((m) => m.DialogoDeConfirmacao), { ssr: false });

/** A recusa do servidor aparece junto dos botões (o sucesso vai no aviso flutuante). */
function useResultado(estado: EstadoDaDecisao) {
  return estado.status === "erro" ? (
    <p role="alert" className="w-full rounded-lg bg-status-danger-bg px-3 py-2 text-sm text-status-danger">
      {estado.mensagem}
    </p>
  ) : null;
}

/** Aprovar o pedido de outra conta (INV-006): confirmação, e o código de novo se passaram 10 min. */
function Aprovar({ pedidoId, titulo, descricao, autenticadores }: { pedidoId: string; titulo: string; descricao: string; autenticadores: Autenticador[] }) {
  const { estado, enviar, enviando, dialogo } = useAcaoCritica(acaoAprovarPedido, DECISAO_INICIAL, autenticadores);
  const [confirmar, setConfirmar] = useState(false);
  const erro = useResultado(estado);
  const dados = () => {
    const d = new FormData();
    d.set("pedidoId", pedidoId);
    return d;
  };
  return (
    <>
      <button type="button" disabled={enviando} onClick={() => setConfirmar(true)} className={classeDoBotao("principal", "sm")}>
        <Check aria-hidden="true" />
        {enviando ? "Aprovando…" : "Aprovar"}
      </button>
      {confirmar && <DialogoDeConfirmacao aberto aoMudar={setConfirmar} titulo={titulo} descricao={descricao} confirmar="Aprovar" aoConfirmar={() => enviar(dados())} />}
      {dialogo}
      {erro}
    </>
  );
}

/** Recusar o pedido de outra conta, com o motivo (5.8, item 3). */
function Recusar({ pedidoId, resumo, autenticadores }: { pedidoId: string; resumo: string; autenticadores: Autenticador[] }) {
  const { estado, enviar, enviando, dialogo } = useAcaoCritica(acaoRecusarPedido, DECISAO_INICIAL, autenticadores);
  const [aberto, setAberto] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    if (estado.status === "ok") setAberto(false);
  }
  const erro = local ?? (estado.status === "erro" ? estado.mensagem : null);

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const v = validarRecusa({ motivoDaRecusa: String(dados.get("motivoDaRecusa") ?? "") });
    setLocal(v.ok ? null : v.erro);
    if (v.ok) enviar(dados);
  }

  return (
    <>
      <Dialog.Root
        open={aberto}
        onOpenChange={(a) => {
          setAberto(a);
          setLocal(null);
        }}
      >
        <Dialog.Trigger className={classeDoBotao("secundario", "sm")}>
          <X aria-hidden="true" />
          Recusar
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-estrutura/45 dark:bg-black/65" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card p-6 text-card-foreground shadow-2xl ring-1 ring-border outline-none">
            <Dialog.Title className="text-lg font-bold">Recusar o pedido?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">{resumo} Quem pediu vê o motivo no painel.</Dialog.Description>
            <form onSubmit={aoEnviar} noValidate className="mt-5 space-y-4">
              <input type="hidden" name="pedidoId" value={pedidoId} />
              <div>
                <label htmlFor={`recusa-${pedidoId}`} className="mb-1.5 block text-sm font-medium text-foreground">
                  Motivo da recusa
                </label>
                <textarea
                  id={`recusa-${pedidoId}`}
                  name="motivoDaRecusa"
                  rows={3}
                  maxLength={MAX_MOTIVO_DA_RECUSA}
                  aria-invalid={erro ? true : undefined}
                  aria-describedby={erro ? `recusa-${pedidoId}-erro` : undefined}
                  className={classeDoCampo(erro ?? undefined)}
                />
                <MensagemDeCampo id={`recusa-${pedidoId}-erro`} erro={erro ?? undefined} />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Dialog.Close className={classeDoBotao("secundario")}>Voltar</Dialog.Close>
                <button type="submit" disabled={enviando} className={classeDoBotao("perigo")}>
                  {enviando ? "Recusando…" : "Recusar"}
                </button>
              </div>
            </form>
            {/* Fora do formulário (o envio do código subiria até ele), mas dentro do diálogo: fica por cima dele. */}
            {dialogo}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

/** Cancelar o próprio pedido pendente: confirmação, sem o código (só reduz o que pode acontecer). */
function Cancelar({ pedidoId }: { pedidoId: string }) {
  const [estado, executar, enviando] = useActionState(useAvisoDoSucesso(acaoCancelarPedido), DECISAO_INICIAL);
  const [confirmar, setConfirmar] = useState(false);
  const erro = useResultado(estado);
  const formulario = useRef<HTMLFormElement>(null);
  return (
    <>
      <form ref={formulario} action={executar} className="contents">
        <input type="hidden" name="pedidoId" value={pedidoId} />
        <button type="button" disabled={enviando} onClick={() => setConfirmar(true)} className={classeDoBotao("fantasma", "sm", "text-status-danger hover:bg-status-danger-bg")}>
          {enviando ? "Cancelando…" : "Cancelar pedido"}
        </button>
      </form>
      {confirmar && (
        <DialogoDeConfirmacao
          aberto
          aoMudar={setConfirmar}
          titulo="Cancelar o pedido?"
          descricao="O pedido sai da lista de pendentes e não pode mais ser aprovado. Se ainda for preciso, faça um novo pedido."
          confirmar="Cancelar pedido"
          voltar="Manter"
          aoConfirmar={() => {
            if (formulario.current) {
              const dados = new FormData(formulario.current);
              startTransition(() => executar(dados));
            }
          }}
        />
      )}
      {erro}
    </>
  );
}

/**
 * Botões de um pedido pendente (SPEC-019, 5.9, item 2): nos pedidos de outras contas, "Aprovar" e
 * "Recusar"; nos próprios, "Aguardando outra pessoa" e "Cancelar". O servidor confere tudo de novo.
 */
export function DecisaoDoPedido({
  pedidoId,
  proprio,
  confirmacao,
  autenticadores,
}: {
  pedidoId: string;
  proprio: boolean;
  /** Título e texto do diálogo de aprovação: o que muda e para quem. */
  confirmacao: { titulo: string; descricao: string; resumo: string };
  autenticadores: Autenticador[];
}) {
  if (proprio) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Selo tom="neutro" semIcone>
          <Hourglass className="size-3.5" aria-hidden="true" />
          Aguardando outra pessoa
        </Selo>
        <Cancelar pedidoId={pedidoId} />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Aprovar pedidoId={pedidoId} titulo={confirmacao.titulo} descricao={confirmacao.descricao} autenticadores={autenticadores} />
      <Recusar pedidoId={pedidoId} resumo={confirmacao.resumo} autenticadores={autenticadores} />
    </div>
  );
}
