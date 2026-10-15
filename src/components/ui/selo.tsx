import { AlertTriangle, ArrowDown, Check, Circle, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Selo de status (SPEC-016, 5.4; RF57): sempre ícone + texto, nunca só cor (INV-008).
// As cores de status são reservadas: não servem de decoração nem de série de gráfico.

export type TomDoSelo = "ok" | "atencao" | "perigo" | "neutro" | "info";

const tons: Record<TomDoSelo, { classe: string; Icone: LucideIcon }> = {
  ok: { classe: "bg-status-ok-bg text-status-ok", Icone: Check },
  atencao: { classe: "bg-status-warn-bg text-status-warn", Icone: AlertTriangle },
  perigo: { classe: "bg-status-danger-bg text-status-danger", Icone: ArrowDown },
  neutro: { classe: "bg-muted text-muted-foreground", Icone: Circle },
  info: { classe: "bg-accent text-foreground", Icone: Info },
};

export function Selo({ tom, children, semIcone, className }: { tom: TomDoSelo; children: React.ReactNode; semIcone?: boolean; className?: string }) {
  const { classe, Icone } = tons[tom];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap", classe, className)}>
      {!semIcone && <Icone className="size-3.5" strokeWidth={2.6} aria-hidden="true" />}
      {children}
    </span>
  );
}
