"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { classeDoBotao } from "@/components/ui/estilos";
import { cn } from "@/lib/utils";

/**
 * Filtros da lista de contas (SPEC-026, 5.6, item 5): no celular ficam recolhidos num botão
 * "Filtros", com a quantidade de filtros ativos; no computador, sempre abertos.
 */
export function PainelDeFiltros({ ativos, children }: { ativos: number; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls="painel-de-filtros"
        className={classeDoBotao("secundario", "md", "md:hidden")}
      >
        <SlidersHorizontal aria-hidden="true" />
        {ativos > 0 ? `Filtros (${ativos})` : "Filtros"}
        <ChevronDown aria-hidden="true" className={cn("transition-transform", aberto && "rotate-180")} />
      </button>
      <div id="painel-de-filtros" className={cn(aberto ? "block" : "hidden", "md:block")}>
        {children}
      </div>
    </div>
  );
}
