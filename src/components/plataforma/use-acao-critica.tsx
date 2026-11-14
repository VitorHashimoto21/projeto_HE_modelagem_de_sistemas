"use client";

import dynamic from "next/dynamic";
import { startTransition, useActionState, useRef, useState } from "react";
import type { Autenticador } from "@/components/segundo-fator/codigo";
import { avisar } from "@/components/ui/avisar";

// O diálogo do código (Radix) só é baixado quando o servidor pede o código.
const DialogoDeReconfirmacao = dynamic(() => import("@/components/segundo-fator/reconfirmacao").then((m) => m.DialogoDeReconfirmacao), { ssr: false });

type Reconfirmar = { status: "reconfirmar"; mensagem: string };
const ehReconfirmar = (e: unknown): e is Reconfirmar => typeof e === "object" && e !== null && (e as { status?: unknown }).status === "reconfirmar";

/**
 * A ação com o aviso flutuante do sucesso disparado na resposta dela, e não num efeito da tela: o sucesso
 * costuma tirar o componente da página (o pedido sai da lista de pendentes), e o efeito não rodaria.
 */
export function useAvisoDoSucesso<A extends unknown[], E>(acao: (...args: A) => Promise<E>) {
  return async (...args: A): Promise<E> => {
    const r = await acao(...args);
    const e = r as { status?: unknown; mensagem?: unknown };
    if (e && e.status === "ok" && typeof e.mensagem === "string") avisar(e.mensagem);
    return r;
  };
}

/**
 * Ação crítica do Administrador (SPEC-019, OPEN-003) numa tela: envia os dados pela transição (os campos
 * não voltam ao início) e, se o servidor responder "reconfirmar", abre o diálogo do código e repete o
 * mesmo envio quando o código é aceito. O sucesso aparece no aviso flutuante. `dialogo` vai FORA de qualquer formulário: o envio do diálogo
 * (num portal) subiria pela árvore do React até o onSubmit do formulário de fora.
 */
export function useAcaoCritica<E extends object>(acao: (anterior: unknown, dados: FormData) => Promise<E | Reconfirmar>, inicial: E, autenticadores: Autenticador[]) {
  const [bruto, executar, enviando] = useActionState<E | Reconfirmar, FormData>(useAvisoDoSucesso(acao), inicial as Awaited<E | Reconfirmar>);
  const ultimo = useRef<FormData | null>(null);
  // O diálogo abre a cada resposta "reconfirmar", até ser respondido ou fechado.
  const [respondida, setRespondida] = useState<unknown>(null);

  function enviar(dados: FormData) {
    ultimo.current = dados;
    startTransition(() => executar(dados));
  }

  const dialogo =
    ehReconfirmar(bruto) && respondida !== bruto ? (
      <DialogoDeReconfirmacao
        aberto
        aoMudar={(aberto) => !aberto && setRespondida(bruto)}
        autenticadores={autenticadores}
        aoVerificar={() => {
          setRespondida(bruto);
          // O código renovou os 10 min: repete o envio, sem outro clique.
          const dados = ultimo.current;
          if (dados) startTransition(() => executar(dados));
        }}
      />
    ) : null;

  return { estado: ehReconfirmar(bruto) ? inicial : bruto, enviar, enviando, dialogo };
}
