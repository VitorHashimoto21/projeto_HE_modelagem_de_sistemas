"use client";

import { useActionState, useState, type FormEvent } from "react";
import type { z } from "zod";
import { ESTADO_INICIAL, type EstadoDoFormulario } from "@/lib/auth/servicos";
import { camposDoFormulario, validar, type ErrosDeCampo } from "@/lib/auth/validacao";

type Acao = (anterior: EstadoDoFormulario, form: FormData) => Promise<EstadoDoFormulario>;

/**
 * Formulário de acesso com validação dupla (SPEC-002, CA-03): o esquema roda no
 * navegador antes do envio e, se houver erro, nada é enviado; o servidor valida de novo.
 */
export function useFormulario<T>(acao: Acao, esquema: z.ZodType<T>) {
  const [estado, executar] = useActionState(acao, ESTADO_INICIAL);
  const [errosLocais, setErrosLocais] = useState<ErrosDeCampo | null>(null);
  const [estadoVisto, setEstadoVisto] = useState(estado);

  // Uma nova resposta do servidor substitui os erros locais.
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    setErrosLocais(null);
  }

  const erros: ErrosDeCampo = errosLocais ?? (estado.status === "erro" ? (estado.erros ?? {}) : {});

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    const v = validar(esquema, camposDoFormulario(new FormData(evento.currentTarget)));
    if (!v.ok) {
      evento.preventDefault();
      setErrosLocais(v.erros);
      const primeiro = Object.keys(v.erros)[0];
      if (primeiro) evento.currentTarget.querySelector<HTMLElement>(`[name="${primeiro}"]`)?.focus();
    } else {
      setErrosLocais({});
    }
  }

  function limparErro(campo: string) {
    if (erros[campo]) setErrosLocais({ ...erros, [campo]: undefined });
  }

  return { estado, executar, erros, aoEnviar, limparErro };
}
