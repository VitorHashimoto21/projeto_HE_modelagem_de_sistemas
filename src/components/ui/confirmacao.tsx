"use client";

import { AlertDialog } from "radix-ui";
import { useRef, useState, type FormEvent } from "react";
import { classeDoBotao } from "./estilos";

// Diálogo de confirmação (SPEC-016, escopo 2; nota N3): substitui o window.confirm do
// navegador nas ações que não se desfazem (cancelar venda, cancelar conta a pagar ou a
// receber, estornar lançamento). AlertDialog do Radix: foco preso dentro, começa em "Voltar",
// Esc cancela e o foco volta ao botão que abriu. Segue o tema e prefers-reduced-motion.

export function DialogoDeConfirmacao({
  aberto,
  aoMudar,
  titulo,
  descricao,
  confirmar,
  voltar = "Voltar",
  aoConfirmar,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  titulo: string;
  descricao: string;
  /** Rótulo do botão que confirma: o mesmo verbo do botão que abriu o diálogo (5.8). */
  confirmar: string;
  voltar?: string;
  aoConfirmar: () => void;
}) {
  return (
    <AlertDialog.Root open={aberto} onOpenChange={aoMudar}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-estrutura/45 dark:bg-black/65 data-[state=open]:animate-[gaveta-fundo_var(--duracao-layout)_var(--ease-saida)]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card p-6 text-card-foreground shadow-2xl ring-1 ring-border outline-none data-[state=open]:animate-[gaveta-fundo_var(--duracao-estado)_var(--ease-saida)]">
          <AlertDialog.Title className="text-lg font-bold">{titulo}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">{descricao}</AlertDialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel className={classeDoBotao("secundario")}>{voltar}</AlertDialog.Cancel>
            <AlertDialog.Action className={classeDoBotao("perigo")} onClick={aoConfirmar}>
              {confirmar}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/**
 * Confirmação antes de enviar um formulário: o primeiro envio abre o diálogo; confirmar
 * reenvia o mesmo formulário (com a validação do navegador e a Server Action dele).
 */
export function useConfirmacaoDoEnvio() {
  const [aberto, setAberto] = useState(false);
  const formulario = useRef<HTMLFormElement | null>(null);
  const confirmado = useRef(false);
  return {
    aberto,
    setAberto,
    aoEnviar(e: FormEvent<HTMLFormElement>) {
      if (confirmado.current) {
        confirmado.current = false;
        return;
      }
      e.preventDefault();
      formulario.current = e.currentTarget;
      setAberto(true);
    },
    confirmar() {
      confirmado.current = true;
      setAberto(false);
      formulario.current?.requestSubmit();
    },
  };
}
