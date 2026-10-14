"use client";

import { useState } from "react";
import { escalaAmigavel } from "@/lib/dominio/graficos";
import { reaisDeCentavos as reais } from "@/lib/dominio/venda";

// Projeção de caixa (SPEC-016, 5.5; RF68): entradas acima e saídas abaixo do zero (a posição
// separa as duas; a cor só reforça), saldo previsto em linha no mesmo eixo, rótulo só no
// menor saldo. Ao apontar ou focar um mês, o quadro acima mostra os três valores.

export type MesProjetado = { chave: string; nome: string; curto: string; entradasCentavos: number; saidasCentavos: number; saldoCentavos: number };

const W = 600;
const H = 250;
const ZERO = 130;
const META_ALTURA = 110;

export function GraficoDeProjecao({ meses, descricao }: { meses: MesProjetado[]; descricao: string }) {
  const [sel, setSel] = useState(0);
  const maior = Math.max(1, ...meses.flatMap((m) => [m.entradasCentavos, m.saidasCentavos, Math.abs(m.saldoCentavos)]));
  const { teto } = escalaAmigavel(maior, 2);
  const k = META_ALTURA / teto;
  const larg = W / meses.length;
  const ys = meses.map((m) => Math.max(8, Math.min(H - 20, Math.round(ZERO - m.saldoCentavos * k))));
  const menor = meses.reduce((mi, m, i) => (m.saldoCentavos < meses[mi].saldoCentavos ? i : mi), 0);
  const atual = meses[sel];

  return (
    <figure className="m-0">
      <div role="status" aria-live="polite" className="flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-lg bg-muted px-4 py-2.5 text-sm">
        <strong className="text-[15px]">{atual.nome}</strong>
        <span>
          Entra <strong className="tabular-nums">{reais(atual.entradasCentavos)}</strong>
        </span>
        <span>
          Sai <strong className="tabular-nums">{reais(atual.saidasCentavos)}</strong>
        </span>
        <span>
          Saldo previsto <strong className={atual.saldoCentavos < 0 ? "text-status-danger tabular-nums" : "tabular-nums"}>{reais(atual.saldoCentavos)}</strong>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block h-auto w-full" aria-hidden="true">
        <line x1="0" y1={ZERO} x2={W} y2={ZERO} className="stroke-input" strokeWidth="1" />
        {meses.map((m, i) => {
          const he = Math.round(m.entradasCentavos * k);
          const hs = Math.round(m.saidasCentavos * k);
          return (
            <g key={m.chave}>
              <rect x={i * larg} y="0" width={larg} height={H} rx="10" className={i === sel ? "fill-foreground/[0.05]" : "fill-transparent"} onPointerEnter={() => setSel(i)} onClick={() => setSel(i)} />
              <rect x={i * larg + larg / 2 - 25} y={ZERO - 2 - he} width="22" height={he} rx="4" className="pointer-events-none fill-chart-1" />
              <rect x={i * larg + larg / 2 + 3} y={ZERO + 2} width="22" height={hs} rx="4" className="pointer-events-none fill-chart-2" />
              <text x={i * larg + larg / 2} y={H - 4} textAnchor="middle" className="pointer-events-none fill-muted-foreground text-[13px]">
                {m.curto}
              </text>
            </g>
          );
        })}
        <polyline points={meses.map((_, i) => `${i * larg + larg / 2},${ys[i]}`).join(" ")} fill="none" className="pointer-events-none stroke-foreground" strokeWidth="2" strokeLinejoin="round" />
        {meses.map((m, i) => (
          <circle key={m.chave} cx={i * larg + larg / 2} cy={ys[i]} r="5" className="pointer-events-none fill-foreground stroke-card" strokeWidth="2" />
        ))}
        <text
          x={menor === meses.length - 1 ? W - 4 : menor === 0 ? 4 : menor * larg + larg / 2}
          y={Math.max(14, ys[menor] - 12)}
          textAnchor={menor === meses.length - 1 ? "end" : menor === 0 ? "start" : "middle"}
          className="pointer-events-none fill-foreground text-[12px] font-bold"
        >
          menor saldo {reais(meses[menor].saldoCentavos)}
        </text>
      </svg>
      <div className="mt-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` }}>
        {meses.map((m, i) => (
          <button
            key={m.chave}
            type="button"
            onFocus={() => setSel(i)}
            onClick={() => setSel(i)}
            aria-label={`${m.nome}: entra ${reais(m.entradasCentavos)}, sai ${reais(m.saidasCentavos)}, saldo previsto ${reais(m.saldoCentavos)}`}
            className="h-2 rounded-full focus-visible:outline-2 focus-visible:outline-ring"
          />
        ))}
      </div>
      <figcaption className="sr-only">{descricao}</figcaption>
    </figure>
  );
}
