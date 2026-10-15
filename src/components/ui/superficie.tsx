import { cn } from "@/lib/utils";
import { classeDaSuperficie, type TomDaSuperficie } from "./estilos";

// Superfície (cartão) do design system (SPEC-016, 5.4). Substitui os cartões escritos à
// mão nas telas; a hierarquia vem do tom, não de bordas e sombras repetidas.

type PropsDaSuperficie = {
  tom?: TomDaSuperficie;
  /** Espaçamento interno: "normal" (24 px), "compacto" (16 px) ou "nenhum" (listas que encostam na borda). */
  espaco?: "normal" | "compacto" | "nenhum";
  as?: "section" | "div" | "article" | "aside";
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">;

const espacos = { normal: "p-5 sm:p-6", compacto: "p-4", nenhum: "" } as const;

export function Superficie({ tom = "cartao", espaco = "normal", as: Tag = "section", className, children, ...resto }: PropsDaSuperficie) {
  return (
    <Tag className={classeDaSuperficie(tom, cn(espacos[espaco], className))} {...resto}>
      {children}
    </Tag>
  );
}

/** Título de uma superfície, com descrição e ações à direita (quebram no celular). */
export function TituloDaSuperficie({
  id,
  titulo,
  descricao,
  acoes,
  className,
}: {
  id?: string;
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-[17px] leading-snug font-bold text-current">
          {titulo}
        </h2>
        {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}
