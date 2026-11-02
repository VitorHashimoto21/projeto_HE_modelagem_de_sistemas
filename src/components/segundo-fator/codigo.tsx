"use client";

import { useActionState } from "react";
import { Aviso, BotaoEnviar, Campo } from "@/components/acesso/campos";
import { classeDoCampo } from "@/components/ui/classes";
import type { EstadoDoCodigo } from "@/lib/auth/segundo-fator";

export type Autenticador = { id: string; nome: string };

const INICIAL: EstadoDoCodigo = { status: "ocioso" };

/** Campos do código: a escolha do autenticador (com mais de um) e os 6 números. */
export function CamposDoCodigo({ autenticadores, erro, foco = true }: { autenticadores: Autenticador[]; erro?: string; foco?: boolean }) {
  return (
    <>
      {autenticadores.length > 1 && (
        <div>
          <label htmlFor="fator" className="mb-1.5 block text-sm font-medium text-foreground">
            Autenticador
          </label>
          <select id="fator" name="fator" defaultValue={autenticadores[0].id} className={classeDoCampo()}>
            {autenticadores.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
      )}
      {autenticadores.length === 1 && <input type="hidden" name="fator" value={autenticadores[0].id} />}
      <Campo nome="codigo" rotulo="Código do aplicativo" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="6 números" autoFocus={foco} erro={erro} />
    </>
  );
}

/** "Digite o código do autenticador" (SPEC-019, 5.1): o login seguinte de uma conta de Administrador. */
export function FormularioDoCodigo({ autenticadores, acao }: { autenticadores: Autenticador[]; acao: (estado: EstadoDoCodigo, form: FormData) => Promise<EstadoDoCodigo> }) {
  const [estado, executar] = useActionState(acao, INICIAL);
  return (
    <div className="space-y-5">
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <form action={executar} noValidate className="space-y-5">
        <CamposDoCodigo autenticadores={autenticadores} erro={estado.status === "erro" ? estado.erros?.codigo : undefined} />
        <BotaoEnviar enviando="Conferindo…">Entrar</BotaoEnviar>
      </form>
    </div>
  );
}
