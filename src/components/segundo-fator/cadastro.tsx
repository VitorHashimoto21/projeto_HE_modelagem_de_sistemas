"use client";

import { useActionState } from "react";
import { Aviso, BotaoEnviar, Campo } from "@/components/acesso/campos";
import { acaoCadastrarAutenticador } from "@/lib/auth/segundo-fator-acoes";
import type { EstadoDoCadastroDoFator } from "@/lib/auth/segundo-fator";
import { MAX_NOME_DO_AUTENTICADOR } from "@/lib/dominio/segundo-fator";

const INICIAL: EstadoDoCadastroDoFator = { status: "ocioso" };

/** "ABCD EFGH IJKL…": o segredo em grupos de 4, mais fácil de digitar no aplicativo. */
const emGrupos = (segredo: string) => segredo.replace(/(.{4})(?=.)/g, "$1 ");

/**
 * Cadastro de um autenticador (SPEC-019, 5.1; CA-01): o nome gera o QR code; o código do aplicativo
 * o ativa. O segredo aparece em texto para quem não consegue ler o QR code; o HE não o guarda.
 */
export function CadastroDoAutenticador({ sugestao }: { sugestao: string }) {
  const [estado, executar] = useActionState(acaoCadastrarAutenticador, INICIAL);

  if (estado.status === "qr") {
    return (
      <div className="space-y-5">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>No aplicativo autenticador (Google Authenticator, Microsoft Authenticator, 1Password…), toque em adicionar e leia o QR code.</li>
          <li>Digite abaixo o código de 6 números que o aplicativo mostrar para o Health Enterprise.</li>
        </ol>
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted p-4">
          {/* O QR code vem do Supabase Auth como SVG; o fundo branco garante a leitura também no tema escuro. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={estado.qrCode} alt={`QR code do autenticador "${estado.nome}"`} width={192} height={192} className="rounded-xl bg-white p-2" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Não consegue ler? Digite este código no aplicativo:</p>
            <p className="mt-1 font-mono text-sm font-semibold tracking-wider break-words text-foreground" aria-label={`Código para digitar: ${estado.segredo}`}>
              {emGrupos(estado.segredo)}
            </p>
          </div>
        </div>
        <form action={executar} noValidate className="space-y-5">
          <input type="hidden" name="fator" value={estado.fatorId} />
          <Campo
            nome="codigo"
            rotulo="Código do aplicativo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="6 números"
            autoFocus
            erro={estado.erros?.codigo}
          />
          <BotaoEnviar enviando="Conferindo…">Ativar</BotaoEnviar>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <form action={executar} noValidate className="space-y-5">
        <Campo
          nome="nome"
          rotulo="Nome do aparelho ou aplicativo"
          maxLength={MAX_NOME_DO_AUTENTICADOR}
          defaultValue={estado.status === "erro" ? (estado.nome ?? sugestao) : sugestao}
          autoComplete="off"
          erro={estado.status === "erro" ? estado.erros?.nome : undefined}
        />
        <BotaoEnviar enviando="Gerando…">Gerar QR code</BotaoEnviar>
      </form>
    </div>
  );
}
