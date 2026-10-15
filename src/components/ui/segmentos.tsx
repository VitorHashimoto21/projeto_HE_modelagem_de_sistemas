import Link from "next/link";
import { cn } from "@/lib/utils";
import { classeDoSegmento } from "./estilos";

// Grupo de segmentos (SPEC-016, 5.4): filtros e visões como links (funcionam sem
// JavaScript e mantêm a URL compartilhável). O ativo leva aria-current.

export function Segmentos({
  rotulo,
  itens,
  className,
}: {
  rotulo: string;
  itens: { href: string; rotulo: React.ReactNode; ativo: boolean }[];
  className?: string;
}) {
  return (
    <nav aria-label={rotulo} className={cn("inline-flex max-w-full flex-wrap gap-1 rounded-[22px] bg-muted p-1", className)}>
      {itens.map((i) => (
        <Link key={i.href} href={i.href} scroll={false} aria-current={i.ativo ? "page" : undefined} className={classeDoSegmento(i.ativo)}>
          {i.rotulo}
        </Link>
      ))}
    </nav>
  );
}
