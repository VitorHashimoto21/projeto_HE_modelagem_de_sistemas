"use client";

import { useRef } from "react";
import { acaoTrocarNegocio } from "@/lib/negocio/acoes";

/** Seletor do negócio ativo no cabeçalho (SPEC-004, 5.4 — UC2). Trocar não pede novo login. */
export function SeletorDeNegocio({ negocios, ativo }: { negocios: { id: string; nome: string }[]; ativo: string | null }) {
  const form = useRef<HTMLFormElement>(null);
  if (negocios.length === 0) return null;
  return (
    <form ref={form} action={acaoTrocarNegocio} className="min-w-0">
      <label htmlFor="seletor-negocio" className="sr-only">
        Negócio ativo
      </label>
      <select
        id="seletor-negocio"
        name="negocioId"
        defaultValue={ativo ?? ""}
        onChange={() => form.current?.requestSubmit()}
        className="max-w-[11rem] truncate rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium text-foreground sm:max-w-xs"
      >
        {!ativo && (
          <option value="" disabled>
            Escolha um negócio
          </option>
        )}
        {negocios.map((n) => (
          <option key={n.id} value={n.id}>
            {n.nome}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="ml-2 text-sm underline">
          Trocar
        </button>
      </noscript>
    </form>
  );
}
