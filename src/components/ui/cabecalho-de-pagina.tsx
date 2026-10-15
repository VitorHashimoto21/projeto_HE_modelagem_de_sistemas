import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// Cabeçalho de página (SPEC-016, 5.4): título, apoio opcional, ações e o "voltar". Sem
// rótulo decorativo em maiúsculas acima do título (5.8) — o menu já mostra onde se está.

export function CabecalhoDePagina({
  titulo,
  descricao,
  acoes,
  voltar,
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
  voltar?: { href: string; rotulo: string };
}) {
  return (
    <header className="space-y-2">
      {voltar && (
        <Link
          href={voltar.href}
          className="-ml-1 inline-flex items-center gap-1 rounded-full px-1 py-0.5 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {voltar.rotulo}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-extrabold break-words text-foreground">{titulo}</h1>
          {descricao && <div className="mt-1 text-sm text-muted-foreground">{descricao}</div>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
    </header>
  );
}
