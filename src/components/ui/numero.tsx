import { cn } from "@/lib/utils";

// Número de destaque (SPEC-016, 5.4): o valor é o protagonista, o rótulo vem antes em
// texto de apoio e o detalhe depois. Algarismos tabulares para comparar de relance.

const tamanhos = { md: "text-2xl", lg: "text-[32px]", xl: "text-[40px] sm:text-[46px]" } as const;

export function Numero({
  rotulo,
  valor,
  detalhe,
  tamanho = "lg",
  className,
}: {
  rotulo: React.ReactNode;
  valor: React.ReactNode;
  detalhe?: React.ReactNode;
  tamanho?: keyof typeof tamanhos;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-sm opacity-80">{rotulo}</p>
      {/* leading-none depois do tamanho: o tailwind-merge descarta a altura de linha que vem antes do tamanho do texto. */}
      <p className={cn("mt-1 font-extrabold tracking-tight tabular-nums", tamanhos[tamanho], "leading-none")}>{valor}</p>
      {detalhe && <div className="mt-2 text-sm opacity-80">{detalhe}</div>}
    </div>
  );
}
