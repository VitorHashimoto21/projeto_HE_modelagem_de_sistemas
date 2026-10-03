"use client";

import { useState } from "react";

/** Alterna o tema escuro pela classe `.dark` no <html> (tokens da identidade visual). */
export function AlternarTema() {
  const [escuro, setEscuro] = useState(false);

  function alternar() {
    const proximo = !escuro;
    document.documentElement.classList.toggle("dark", proximo);
    setEscuro(proximo);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={escuro}
      className="rounded-lg border border-input px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
    >
      {escuro ? "Tema claro" : "Tema escuro"}
    </button>
  );
}
