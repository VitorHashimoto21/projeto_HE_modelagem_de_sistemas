import { participacoes } from "@/lib/dominio/graficos";
import { reaisDeCentavos as reais } from "@/lib/dominio/venda";
import { cn } from "@/lib/utils";

// Barra empilhada e barras horizontais (SPEC-016, 5.5). Desenhadas no servidor, com os
// rótulos escritos ao lado (obrigatórios a partir de 4 categorias) — sem depender de cor.

const CORES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

/** Partes de um todo (ex.: formas de pagamento), cores na ordem fixa da paleta. */
export function BarraEmpilhada({ itens, descricao }: { itens: { nome: string; valorCentavos: number }[]; descricao: string }) {
  const pcts = participacoes(itens.map((i) => i.valorCentavos));
  const visiveis = itens.map((i, n) => ({ ...i, pct: pcts[n], cor: CORES[n % CORES.length] })).filter((i) => i.valorCentavos > 0);
  if (visiveis.length === 0) return <p className="text-sm text-muted-foreground">Ainda sem vendas no período.</p>;
  return (
    <div>
      <div role="img" aria-label={descricao} className="flex h-[22px] gap-0.5 overflow-hidden rounded-md">
        {visiveis.map((i) => (
          <span key={i.nome} style={{ width: `${i.pct}%`, background: i.cor }} />
        ))}
      </div>
      <ul className="mt-3.5 flex flex-col gap-2">
        {visiveis.map((i) => (
          <li key={i.nome} className="flex items-center gap-2.5 text-sm">
            <span className="h-1 w-3.5 rounded-sm" style={{ background: i.cor }} aria-hidden="true" />
            <span className="flex-1">{i.nome}</span>
            <strong className="tabular-nums">{i.pct}%</strong>
            <span className="w-24 text-right text-muted-foreground tabular-nums">{reais(i.valorCentavos)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ranking em barras horizontais, com os primeiros em destaque e o resto em cinza. */
export function BarrasHorizontais({
  itens,
  destaque = 3,
}: {
  itens: { chave: string; nome: string; valorCentavos: number; detalhe?: string }[];
  destaque?: number;
}) {
  const maior = Math.max(1, ...itens.map((i) => Math.abs(i.valorCentavos)));
  return (
    <ul className="flex flex-col gap-3">
      {itens.map((i, n) => {
        const forte = n < destaque && i.valorCentavos > 0;
        const largura = `${Math.round((Math.abs(i.valorCentavos) / maior) * 100)}%`;
        return (
          <li key={i.chave}>
            <div className="flex justify-between gap-3 text-sm">
              <span className={cn("min-w-0 truncate", forte ? "font-bold" : "font-medium")}>{i.nome}</span>
              <span className="whitespace-nowrap tabular-nums">
                <strong className={i.valorCentavos < 0 ? "text-status-danger" : undefined}>{reais(i.valorCentavos)}</strong>
                {i.detalhe && <span className="text-muted-foreground"> ({i.detalhe})</span>}
              </span>
            </div>
            <div className="mt-1.5 h-2.5" aria-hidden="true">
              <div className={cn("h-2.5 rounded-r-[4px]", forte ? "bg-primary" : "bg-chart-neutro")} style={{ width: largura }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
