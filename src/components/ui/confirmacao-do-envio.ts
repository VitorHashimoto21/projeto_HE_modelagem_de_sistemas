"use client";

import { useRef, useState, type FormEvent } from "react";

/**
 * Confirmação antes de enviar um formulário: o primeiro envio abre o diálogo; confirmar
 * reenvia o mesmo formulário (com a validação do navegador e a Server Action dele).
 */
export function useConfirmacaoDoEnvio() {
  const [aberto, setAberto] = useState(false);
  const formulario = useRef<HTMLFormElement | null>(null);
  const confirmado = useRef(false);
  return {
    aberto,
    setAberto,
    aoEnviar(e: FormEvent<HTMLFormElement>) {
      if (confirmado.current) {
        confirmado.current = false;
        return;
      }
      e.preventDefault();
      formulario.current = e.currentTarget;
      setAberto(true);
    },
    confirmar() {
      confirmado.current = true;
      setAberto(false);
      formulario.current?.requestSubmit();
    },
  };
}
