"use client";

import { useState } from "react";
import { escalaAmigavel } from "@/lib/dominio/graficos";
import { reaisDeCentavos as reais } from "@/lib/dominio/venda";

// Fluxo do mês (SPEC-016, 5.5): por dia, entradas acima e saídas abaixo do zero — a posição
// separa as duas, a cor só reforça. Um único eixo, com a grade nos dois valores redondos.
// Ao apontar, tocar ou focar um dia, o quadro acima mostra entrou, saiu e o resultado.

export type DiaDoFluxo = { dia: string; entradasCentavos: number; saidasCentavos: number };

const W = 600;
const H = 210;
const ZERO = 100;
const META_ALTURA = 82;
const NOMES_DOS_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const porExtenso = (dia: string) => `${Number(dia.slice(8, 10))} de ${NOMES_DOS_MESES[Number(dia.slice(5, 7)) - 1]}`;

/** `ate`: último dia que já aconteceu (no mês atual, hoje); os seguintes aparecem apagados. */
export function GraficoDeFluxo({ dias, ate, descricao }: { dias: DiaDoFluxo[]; ate: string; descricao: string }) {
  const passados = dias.filter((d) => d.dia <= ate);
  const ultimoComMovimento = [...passados].reverse().find((d) => d.entradasCentavos || d.saidasCentavos);
  const [sel, setSel] = useState(() => Math.max(0, dias.indexOf(ultimoComMovimento ?? passados[passados.length - 1] ?? dias[0])));
  const maior = Math.max(1, ...dias.flatMap((d) => [d.entradasCentavos, d.saidasCentavos]));
  const { teto } = escalaAmigavel(maior, 2);
  const k = META_ALTURA / teto;
  const larg = W / dias.length;
  const barra = Math.min(14, Math.max(4, larg * 0.62));
  const atual = dias[sel];
  const resultado = atual.entradasCentavos - atual.saidasCentavos;
  const rotulados = new Set([0, 4, 9, 14, 19, 24, dias.length - 1]);

  return (
    <figure className="m-0">
      <div role="status" aria-live="polite" className="flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-lg bg-muted px-4 py-2.5 text-sm">
        <strong className="text-[15px]">{porExtenso(atual.dia)}</strong>
        {atual.dia > ate ? (
          <span className="text-muted-foreground">Ainda não chegou</span>
        ) : (
          <>
            <span>
              Entrou <strong className="tabular-nums">{reais(atual.entradasCentavos)}</strong>
            </span>
            <span>
              Saiu <strong className="tabular-nums">{reais(atual.saidasCentavos)}</strong>
            </span>
            <span>
              Resultado <strong className={resultado < 0 ? "text-status-danger tabular-nums" : "tabular-nums"}>{reais(resultado)}</strong>
            </span>
          </>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block h-auto w-full" aria-hidden="true">
        {[ZERO - teto * k, ZERO + teto * k].map((y) => (
          <line key={y} x1="0" y1={y} x2={W} y2={y} className="stroke-input" strokeWidth="1" strokeDasharray="3 4" />
        ))}
        <text x="2" y={ZERO - teto * k - 5} className="fill-muted-foreground text-[11px]">
          {reais(teto)}
        </text>
        <text x="2" y={ZERO + teto * k - 5} className="fill-muted-foreground text-[11px]">
          −{reais(teto)}
        </text>
        <line x1="0" y1={ZERO} x2={W} y2={ZERO} className="stroke-muted-foreground/50" strokeWidth="1" />
        {dias.map((d, i) => {
          const he = Math.round(d.entradasCentavos * k);
          const hs = Math.round(d.saidasCentavos * k);
          const futuro = d.dia > ate;
          const x = i * larg + (larg - barra) / 2;
          return (
            <g key={d.dia} opacity={futuro ? 0.35 : 1}>
              <rect x={i * larg} y="0" width={larg} height={H} rx="6" className={i === sel ? "fill-foreground/[0.06]" : "fill-transparent"} onPointerEnter={() => setSel(i)} onClick={() => setSel(i)} />
              {he > 0 && <rect x={x} y={ZERO - 1 - he} width={barra} height={he} rx="3" className="pointer-events-none fill-chart-1" />}
              {hs > 0 && <rect x={x} y={ZERO + 1} width={barra} height={hs} rx="3" className="pointer-events-none fill-chart-2" />}
              {rotulados.has(i) && (
                <text x={i * larg + larg / 2} y={H - 4} textAnchor="middle" className="pointer-events-none fill-muted-foreground text-[12px]">
                  {Number(d.dia.slice(8, 10))}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 grid gap-px" style={{ gridTemplateColumns: `repeat(${dias.length}, minmax(0, 1fr))` }}>
        {dias.map((d, i) => (
          <button
            key={d.dia}
            type="button"
            onFocus={() => setSel(i)}
            onClick={() => setSel(i)}
            aria-label={d.dia > ate ? `${porExtenso(d.dia)}: ainda não chegou` : `${porExtenso(d.dia)}: entrou ${reais(d.entradasCentavos)}, saiu ${reais(d.saidasCentavos)}`}
            className="h-2 rounded-full focus-visible:outline-2 focus-visible:outline-ring"
          />
        ))}
      </div>
      <figcaption className="sr-only">{descricao}</figcaption>
    </figure>
  );
}
