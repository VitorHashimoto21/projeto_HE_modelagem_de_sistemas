"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { cn } from "@/lib/utils";

// Gaveta (SPEC-016, OPEN-002/OPEN-003): diálogo acessível do Radix — foco preso dentro,
// Esc fecha, foco devolvido a quem abriu. Entra pela direita no computador e por baixo no
// celular; o movimento respeita prefers-reduced-motion (globals.css).

export function Gaveta({
  aberta,
  aoMudar,
  titulo,
  descricao,
  children,
  gatilho,
  focoAoFechar,
  className,
}: {
  aberta?: boolean;
  aoMudar?: (aberta: boolean) => void;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
  gatilho?: React.ReactNode;
  /** Quem recebe o foco ao fechar, quando a gaveta é aberta sem gatilho (carregada sob demanda). */
  focoAoFechar?: React.RefObject<HTMLElement | null>;
  className?: string;
}) {
  return (
    <Dialog.Root open={aberta} onOpenChange={aoMudar}>
      {gatilho && <Dialog.Trigger asChild>{gatilho}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-estrutura/45 data-[state=open]:animate-[gaveta-fundo_var(--duracao-layout)_var(--ease-saida)]" />
        <Dialog.Content
          onCloseAutoFocus={(e) => {
            if (focoAoFechar?.current) {
              e.preventDefault();
              focoAoFechar.current.focus();
            }
          }}
          onOpenAutoFocus={(e) => {
            // No computador, o foco vai direto ao primeiro campo; no celular fica no título,
            // para o teclado não cobrir a gaveta antes de a pessoa escolher onde tocar.
            if (!window.matchMedia("(min-width: 640px)").matches) return;
            const campo = (e.currentTarget as HTMLElement).querySelector<HTMLElement>("input:not([type=hidden]), select, textarea");
            if (campo) {
              e.preventDefault();
              campo.focus();
            }
          }}
          className={cn(
            "fixed z-50 flex flex-col bg-card text-card-foreground shadow-2xl outline-none",
            "inset-x-0 bottom-0 max-h-[88vh] rounded-t-3xl data-[state=open]:animate-[gaveta-baixo_var(--duracao-layout)_var(--ease-saida)]",
            "sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-l-3xl sm:data-[state=open]:animate-[gaveta-lado_var(--duracao-layout)_var(--ease-saida)]",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-bold">{titulo}</Dialog.Title>
              {descricao ? <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">{descricao}</Dialog.Description> : <Dialog.Description className="sr-only">{titulo}</Dialog.Description>}
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Gaveta de uma rota interceptada (OPEN-003): abre por cima da tela de origem e fechar volta
 * no histórico — a URL do formulário continua valendo para o link direto e o recarregar.
 */
export function GavetaDaRota({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Gaveta aberta aoMudar={(aberta) => !aberta && router.back()} titulo={titulo} descricao={descricao}>
      {children}
    </Gaveta>
  );
}
