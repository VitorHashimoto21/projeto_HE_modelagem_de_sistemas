import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Aviso na página (SPEC-016, 5.4): ícone + texto; erros dizem o que aconteceu e como
// resolver (5.8). Para confirmações rápidas depois de uma ação, use o aviso flutuante.

export type TomDoAviso = "sucesso" | "erro" | "atencao" | "info";

const tons: Record<TomDoAviso, { classe: string; Icone: LucideIcon; papel: "status" | "alert" }> = {
  sucesso: { classe: "bg-status-ok-bg text-status-ok", Icone: CheckCircle2, papel: "status" },
  erro: { classe: "bg-status-danger-bg text-status-danger", Icone: XCircle, papel: "alert" },
  atencao: { classe: "bg-status-warn-bg text-status-warn", Icone: AlertTriangle, papel: "status" },
  info: { classe: "bg-muted text-foreground", Icone: Info, papel: "status" },
};

export function AvisoDaPagina({ tom, children, acao, className }: { tom: TomDoAviso; children: React.ReactNode; acao?: React.ReactNode; className?: string }) {
  const { classe, Icone, papel } = tons[tom];
  return (
    <div role={papel} className={cn("flex items-start gap-3 rounded-lg px-4 py-3 text-sm", classe, className)}>
      <Icone className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
      <div className="min-w-0 flex-1 [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2">{children}</div>
      {acao}
    </div>
  );
}
