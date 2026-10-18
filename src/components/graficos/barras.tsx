"use client";

import { useState } from "react";
import { escalaAmigavel, proporcao } from "@/lib/dominio/graficos";
import { reaisDeCentavos as reais } from "@/lib/dominio/venda";
import { cn } from "@/lib/utils";

// Barras de vendas (SPEC-016, 5.5): grade com 3 valores, média tracejada, o período em curso
// hachurado e, quando houver, a marca do mesmo período do ano anterior. O balão aparece no
// mouse, no toque e no foco do teclado (a barra é o alvo, maior que a parte pintada).

export type PontoDeBarra = {
  chave: string;
  /** Rótulo curto (eixo e balão), ex.: "13/10" ou "out". */
  rotulo: string;
  valorCentavos: number;
  /** Período ainda em curso ("até agora"). */
  parcial?: boolean;
  /** Mesmo período do ano anterior, quando disponível. */
  anteriorCentavos?: number | null;
};

const ALTURA = 200;

const reaisCurtos = (centavos: number) => `R$ ${Math.round(centavos / 100).toLocaleString("pt-BR")}`;

export function GraficoDeBarras({ pontos, descricao, rotuloParcial = "até agora" }: { pontos: PontoDeBarra[]; descricao: string; rotuloParcial?: string }) {
  const [sel, setSel] = useState(pontos.length - 1);
  const valores = pontos.flatMap((p) => [p.valorCentavos, p.anteriorCentavos ?? 0]);
  // Escala mínima de R$ 3: sem vendas (ou com valores de centavos), a grade não repete "R$ 0",
  // já que os rótulos são arredondados para reais inteiros.
  const { teto, grade } = escalaAmigavel(Math.max(...valores, 300));
  const media = pontos.reduce((s, p) => s + p.valorCentavos, 0) / Math.max(1, pontos.length);
  const altura = (v: number) => Math.round(proporcao(v, teto) * ALTURA);
  const atual = pontos[Math.min(sel, pontos.length - 1)];
  const meio = Math.floor(pontos.length / 2);

  return (
    <figure className="m-0">
      <div className="relative pl-14" style={{ height: ALTURA + 64 }}>
        {grade.map((g) => (
          <div key={g} className="pointer-events-none absolute right-0 left-14 border-t border-muted" style={{ bottom: altura(g) }} aria-hidden="true">
            <span className="absolute -left-14 -translate-y-1/2 text-xs text-muted-foreground tabular-nums">{reaisCurtos(g)}</span>
          </div>
        ))}
        <div className="pointer-events-none absolute right-0 left-14 z-[2] border-t-2 border-dashed border-estrutura dark:border-estrutura-suave" style={{ bottom: altura(media) }} aria-hidden="true">
          <span className="absolute right-0 -translate-y-[calc(100%+2px)] rounded bg-card px-1.5 text-xs font-bold">média {reaisCurtos(media)}</span>
        </div>

        <div className="absolute right-0 bottom-0 left-14 flex items-end gap-[3px] border-b border-input sm:gap-1" style={{ height: ALTURA }}>
          {pontos.map((p, i) => (
            <button
              key={p.chave}
              type="button"
              aria-label={`${p.rotulo}${p.parcial ? ` (${rotuloParcial})` : ""}: ${reais(p.valorCentavos)}${p.anteriorCentavos != null ? `; ano anterior ${reais(p.anteriorCentavos)}` : ""}`}
              onPointerEnter={() => setSel(i)}
              onFocus={() => setSel(i)}
              onClick={() => setSel(i)}
              className="group relative flex h-full flex-1 cursor-pointer items-end justify-center rounded-t-[4px] focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span
                className={cn(
                  "block w-full rounded-t-[4px] transition-[filter] duration-(--duracao-toque)",
                  p.parcial ? "hachurado" : p.valorCentavos === 0 ? "bg-muted" : i === sel ? "bg-estrutura dark:bg-primary" : "bg-chart-1 group-hover:brightness-110",
                  i === sel && p.parcial && "outline-2 outline-estrutura dark:outline-primary",
                )}
                style={{ height: p.valorCentavos === 0 ? 3 : Math.max(6, altura(p.valorCentavos)) }}
              />
              {p.anteriorCentavos != null && (
                <span className="pointer-events-none absolute -inset-x-0.5 h-0 rounded border-t-[3px] border-foreground" style={{ bottom: altura(p.anteriorCentavos) }} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>

        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute top-0 z-[3] rounded-xl bg-foreground px-3 py-2 whitespace-nowrap text-background shadow-lg"
          style={{
            // No topo do gráfico (nunca cobre a média) e preso dentro da largura nas pontas.
            left: `calc(3.5rem + (100% - 3.5rem) * ${((sel + 0.5) / pontos.length).toFixed(4)})`,
            transform: `translateX(${sel < pontos.length * 0.2 ? "-15%" : sel > pontos.length * 0.8 ? "-85%" : "-50%"})`,
          }}
        >
          <span className="block text-base font-extrabold tabular-nums">{reais(atual.valorCentavos)}</span>
          <span className="block text-xs opacity-80">
            {atual.rotulo}
            {atual.parcial ? ` (${rotuloParcial})` : ""}
          </span>
          {atual.anteriorCentavos != null && <span className="block text-xs opacity-80">Ano anterior: {reais(atual.anteriorCentavos)}</span>}
        </div>
      </div>
      <figcaption className="sr-only">{descricao}</figcaption>
      <div className="mt-2 flex justify-between pl-14 text-[13px] text-muted-foreground" aria-hidden="true">
        <span>{pontos[0]?.rotulo}</span>
        <span>{pontos[meio]?.rotulo}</span>
        <span>{pontos[pontos.length - 1]?.rotulo}</span>
      </div>
    </figure>
  );
}
