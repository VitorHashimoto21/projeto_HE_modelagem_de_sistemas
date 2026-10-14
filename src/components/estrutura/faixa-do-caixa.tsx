"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Selo, type TomDoSelo } from "@/components/ui/selo";
import type { DadosDaFaixa } from "@/lib/dashboard/servicos";
import { reaisDeCentavos as reais } from "@/lib/dominio/venda";
import { cn } from "@/lib/utils";

// Faixa do caixa, versão compacta (SPEC-016, 5.3; OPEN-005): no topo de todas as telas para
// quem vê o Dashboard completo. No Painel quem aparece é o bloco grande, então ela some.
// O toque em "Ver o dia" abre os movimentos de hoje.

const TOM: Record<DadosDaFaixa["saude"]["tom"], TomDoSelo> = { ok: "ok", atencao: "atencao", perigo: "perigo", neutro: "neutro" };

export function FaixaDoCaixaCompacta({ dados, minigrafico }: { dados: DadosDaFaixa; minigrafico: React.ReactNode }) {
  const caminho = usePathname();
  const [aberta, setAberta] = useState(false);
  const id = useId();
  // Momento-assinatura (SPEC-016, 5.6): logo depois de registrar uma venda (?nova=1), o saldo
  // que acabou de receber o valor ganha um destaque curto.
  const destaque = useSearchParams().has("nova");
  if (caminho === "/painel") return null;
  return (
    <section aria-label="Faixa do caixa" className="bg-estrutura text-estrutura-foreground md:mx-6 md:mt-4 md:rounded-3xl lg:mx-10">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 md:px-5">
        <p className="flex items-baseline gap-2">
          <span className="text-sm text-estrutura-suave">Saldo</span>
          <span className={cn("rounded-lg px-1 text-lg font-extrabold tabular-nums", destaque && "animate-[saldo-entrou_1600ms_var(--ease-saida)]")}>{reais(dados.saldoCentavos)}</span>
        </p>
        <span className="hidden text-ambar sm:inline">{minigrafico}</span>
        <p className="text-sm text-estrutura-suave">
          Hoje <span className="font-bold text-estrutura-foreground">+ {reais(dados.entrouHojeCentavos)}</span> e{" "}
          <span className="font-bold text-estrutura-foreground">− {reais(dados.saiuHojeCentavos)}</span>
        </p>
        <Selo tom={TOM[dados.saude.tom]} className="hidden sm:inline-flex">
          {dados.saude.rotulo}
        </Selo>
        <button
          type="button"
          aria-expanded={aberta}
          aria-controls={id}
          onClick={() => setAberta(!aberta)}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-estrutura-foreground/35 px-3.5 text-sm font-semibold hover:bg-estrutura-foreground/10 focus-visible:outline-2 focus-visible:outline-ambar"
        >
          {aberta ? "Fechar o dia" : "Ver o dia"}
          <ChevronDown className={cn("size-4 transition-transform duration-(--duracao-estado) ease-(--ease-saida)", aberta && "rotate-180")} aria-hidden="true" />
        </button>
      </div>
      {aberta && (
        <div id={id} className="mx-auto max-w-[1280px] animate-[gaveta-baixo_var(--duracao-estado)_var(--ease-saida)] px-4 pb-4 md:px-5">
          {dados.movimentos.length === 0 ? (
            <p className="text-sm text-estrutura-suave">Nenhum movimento no caixa hoje.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {dados.movimentos.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-2xl bg-estrutura-foreground/[0.07] px-3.5 py-2.5 text-sm">
                  <span className="text-estrutura-suave tabular-nums">{m.hora}</span>
                  <span className="min-w-0 flex-1 truncate">{m.descricao}</span>
                  <span className="font-bold whitespace-nowrap tabular-nums">
                    {m.tipo === "ENTRADA" ? "+ " : "− "}
                    {reais(m.valorCentavos)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** Faixa do caixa no Painel (SPEC-016, 5.3): o bloco grande, com o saldo em destaque e a tendência. */
export function FaixaDoCaixaGrande({ dados, nomeDoNegocio, minigrafico }: { dados: DadosDaFaixa; nomeDoNegocio: string; minigrafico: React.ReactNode }) {
  const [aberta, setAberta] = useState(false);
  const id = useId();
  return (
    <section aria-label="Faixa do caixa" className="rounded-3xl bg-estrutura p-5 text-estrutura-foreground sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 flex-[1_1_16rem]">
          <p className="text-sm text-estrutura-suave">Saldo em caixa no {nomeDoNegocio}</p>
          <p className="mt-1.5 text-[40px] leading-none font-extrabold tracking-tight tabular-nums sm:text-[46px]">{reais(dados.saldoCentavos)}</p>
          <p className="mt-2 text-sm text-estrutura-suave">
            Hoje entrou <strong className="text-estrutura-foreground">{reais(dados.entrouHojeCentavos)}</strong> e saiu{" "}
            <strong className="text-estrutura-foreground">{reais(dados.saiuHojeCentavos)}</strong>
          </p>
        </div>
        <div className="max-w-full flex-[0_1_260px] text-ambar">{minigrafico}</div>
        <div className="flex flex-col items-start gap-2.5">
          <Selo tom={TOM[dados.saude.tom]} className="text-sm">
            {dados.saude.rotulo}
          </Selo>
          <button
            type="button"
            aria-expanded={aberta}
            aria-controls={id}
            onClick={() => setAberta(!aberta)}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-estrutura-foreground/35 px-4 text-sm font-semibold hover:bg-estrutura-foreground/10 focus-visible:outline-2 focus-visible:outline-ambar"
          >
            {aberta ? "Fechar o dia" : "Ver o dia"}
            <ChevronDown className={cn("size-4 transition-transform duration-(--duracao-estado) ease-(--ease-saida)", aberta && "rotate-180")} aria-hidden="true" />
          </button>
        </div>
      </div>
      {aberta && (
        <div id={id} className="mt-5 animate-[gaveta-baixo_var(--duracao-estado)_var(--ease-saida)]">
          {dados.movimentos.length === 0 ? (
            <p className="text-sm text-estrutura-suave">Nenhum movimento no caixa hoje.</p>
          ) : (
            <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {dados.movimentos.map((m) => (
                <li key={m.id} className="rounded-2xl bg-estrutura-foreground/[0.07] px-4 py-3">
                  <p className="text-[13px] text-estrutura-suave tabular-nums">{m.hora}</p>
                  <p className="mt-0.5 truncate text-sm">{m.descricao}</p>
                  <p className="mt-1 text-base font-bold tabular-nums">
                    {m.tipo === "ENTRADA" ? "+ " : "− "}
                    {reais(m.valorCentavos)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
