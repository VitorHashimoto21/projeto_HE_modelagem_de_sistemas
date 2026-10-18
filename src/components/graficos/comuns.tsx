import { cn } from "@/lib/utils";

// Peças comuns dos gráficos (SPEC-016, 5.5): legenda (a marca imita o gráfico: retângulo para
// barras, traço para linhas) e a tabela "Ver os valores" — todo gráfico tem uma, para que
// nenhum valor dependa de passar o mouse ou de distinguir cores.

export type ItemDaLegenda = { rotulo: React.ReactNode; marca: "barra" | "linha" | "tracejado" | "hachurado"; cor?: string };

export function Legenda({ itens, className }: { itens: ItemDaLegenda[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted-foreground", className)}>
      {itens.map((i, n) => (
        <li key={n} className="inline-flex items-center gap-2">
          {i.marca === "barra" && <span className="size-3 rounded-[3px]" style={{ background: i.cor }} aria-hidden="true" />}
          {i.marca === "hachurado" && <span className="hachurado size-3 rounded-[3px]" aria-hidden="true" />}
          {i.marca === "linha" && <span className="h-0 w-4 border-t-2" style={{ borderColor: i.cor ?? "currentColor" }} aria-hidden="true" />}
          {i.marca === "tracejado" && <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: i.cor ?? "currentColor" }} aria-hidden="true" />}
          <span className="text-foreground">{i.rotulo}</span>
        </li>
      ))}
    </ul>
  );
}

export function TabelaDeValores({
  legenda,
  colunas,
  linhas,
  className,
}: {
  legenda: string;
  colunas: string[];
  linhas: (string | number)[][];
  className?: string;
}) {
  return (
    <details className={cn("group text-sm", className)}>
      <summary className="cursor-pointer rounded-full font-semibold text-primary marker:text-primary focus-visible:outline-2 focus-visible:outline-ring">Ver os valores</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg">
        <table className="w-full text-left">
          <caption className="sr-only">{legenda}</caption>
          <thead>
            <tr className="border-b text-muted-foreground">
              {colunas.map((c, i) => (
                <th key={c} scope="col" className={cn("py-2 font-medium", i > 0 && "text-right")}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, n) => (
              <tr key={n} className="border-b last:border-b-0">
                {l.map((v, i) =>
                  i === 0 ? (
                    <th key={i} scope="row" className="py-2 font-normal">
                      {v}
                    </th>
                  ) : (
                    <td key={i} className="py-2 text-right tabular-nums">
                      {v}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
