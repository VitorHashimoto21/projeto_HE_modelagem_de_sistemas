import { cn } from "@/lib/utils";

/**
 * Classes compartilhadas dos campos de formulário. Ficam fora de arquivos "use client"
 * para que páginas do servidor também possam usá-las: uma função exportada de um módulo
 * de cliente vira uma referência de cliente e não pode ser chamada no servidor.
 */
export const classeDoCampo = (erro?: string) =>
  cn(
    "w-full rounded-xl border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground",
    "outline-none transition-shadow focus:border-ring focus:ring-4 focus:ring-ring/15",
    erro ? "border-destructive ring-4 ring-destructive/10" : "border-input",
  );
