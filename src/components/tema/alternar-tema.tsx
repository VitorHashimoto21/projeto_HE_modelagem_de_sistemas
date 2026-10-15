"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { classeDoBotao } from "@/components/ui/estilos";

/**
 * Tema claro ou escuro (SPEC-016, OPEN-004). O tema vive na classe .dark do <html>, aplicada
 * antes da pintura pelo layout raiz a partir de `he-tema`; todos os botões observam a classe
 * para ficarem coerentes entre si.
 */
export function useTema() {
  const [escuro, setEscuro] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const ler = () => setEscuro(html.classList.contains("dark"));
    ler();
    const observador = new MutationObserver(ler);
    observador.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observador.disconnect();
  }, []);
  const alternar = () => {
    const proximo = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", proximo);
    try {
      localStorage.setItem("he-tema", proximo ? "escuro" : "claro");
    } catch {}
  };
  return { escuro, alternar };
}

/** Botão de tema das telas públicas (acesso, termos e privacidade). */
export function AlternarTema() {
  const { escuro, alternar } = useTema();
  const Icone = escuro ? Sun : Moon;
  return (
    <button type="button" onClick={alternar} aria-pressed={escuro} className={classeDoBotao("secundario", "sm")}>
      <Icone aria-hidden="true" />
      {escuro ? "Tema claro" : "Tema escuro"}
    </button>
  );
}
