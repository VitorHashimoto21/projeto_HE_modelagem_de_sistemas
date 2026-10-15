import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Estado vazio (SPEC-016, 5.4): convida à ação em vez de só dizer "nada aqui" (5.8).

export function EstadoVazio({
  Icone,
  titulo,
  children,
  acao,
  className,
}: {
  Icone: LucideIcon;
  titulo: React.ReactNode;
  children?: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-primary" aria-hidden="true">
        <Icone className="size-6" />
      </span>
      <h2 className="mt-4 text-lg font-bold text-foreground">{titulo}</h2>
      {children && <div className="mt-1 max-w-md text-sm text-muted-foreground">{children}</div>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}

/** Bloco de esqueleto para o carregamento (5.4). */
export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}
