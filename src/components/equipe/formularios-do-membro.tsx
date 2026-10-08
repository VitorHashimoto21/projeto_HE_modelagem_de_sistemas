"use client";

import { useActionState, useState } from "react";
import { Aviso, BotaoEnviar } from "@/components/acesso/campos";
import type { Matriz } from "@/lib/dominio/permissoes";
import { acaoAlterarPapel, acaoAlterarPermissoes, acaoRemoverMembro } from "@/lib/equipe/acoes";
import { ACAO_INICIAL } from "@/lib/equipe/servicos";
import { classeDoCampo } from "@/components/ui/classes";
import { MatrizDePermissoes } from "./matriz-de-permissoes";

/** Trocar o papel (5.4): a matriz customizada é limpa e vale a predefinição do novo papel. */
export function FormularioPapel({ membroId, papel }: { membroId: string; papel: "GERENTE" | "COLABORADOR" }) {
  const [estado, executar] = useActionState(acaoAlterarPapel, ACAO_INICIAL);
  return (
    <form action={executar} className="space-y-4">
      <input type="hidden" name="membroId" value={membroId} />
      {estado.status !== "ocioso" && <Aviso tipo={estado.status === "ok" ? "sucesso" : "erro"}>{estado.mensagem}</Aviso>}
      <div>
        <label htmlFor="papel" className="mb-1.5 block text-sm font-medium text-foreground">
          Papel
        </label>
        <select id="papel" name="papel" defaultValue={papel} className={classeDoCampo()}>
          <option value="COLABORADOR">Colaborador</option>
          <option value="GERENTE">Gerente</option>
        </select>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Ao trocar o papel, as permissões personalizadas são apagadas e passam a valer as permissões padrão do novo papel.
        </p>
      </div>
      <BotaoEnviar enviando="Salvando…">Salvar papel</BotaoEnviar>
    </form>
  );
}

/** Editar permissões (5.4 — UC4), com a opção de voltar ao padrão do papel. */
export function FormularioPermissoes({ membroId, matriz, customizado }: { membroId: string; matriz: Matriz; customizado: boolean }) {
  const [estado, executar] = useActionState(acaoAlterarPermissoes, ACAO_INICIAL);
  return (
    <form action={executar} className="space-y-4">
      <input type="hidden" name="membroId" value={membroId} />
      {estado.status !== "ocioso" && <Aviso tipo={estado.status === "ok" ? "sucesso" : "erro"}>{estado.mensagem}</Aviso>}
      <MatrizDePermissoes inicial={matriz} editavel rotulo={customizado ? "Permissões personalizadas" : "Permissões (padrão do papel)"} />
      <BotaoEnviar enviando="Salvando…">Salvar permissões</BotaoEnviar>
      {customizado && (
        <button
          type="submit"
          name="padrao"
          value="on"
          className="w-full text-center text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          Voltar às permissões padrão do papel
        </button>
      )}
    </form>
  );
}

/** Remover da equipe, com confirmação em duas etapas. */
export function RemoverMembro({ membroId, nome }: { membroId: string; nome: string }) {
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando) {
    return (
      <button type="button" onClick={() => setConfirmando(true)} className="text-sm font-medium text-destructive underline-offset-2 hover:underline">
        Remover da equipe
      </button>
    );
  }
  return (
    <form action={acaoRemoverMembro} className="space-y-3 rounded-xl border border-destructive/30 bg-status-danger-bg p-4">
      <input type="hidden" name="membroId" value={membroId} />
      <p className="text-sm text-status-danger">
        {nome} perde o acesso a este negócio. O que essa pessoa registrou (vendas, movimentações) continua no sistema.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground">
          Remover
        </button>
        <button type="button" onClick={() => setConfirmando(false)} className="rounded-xl border px-4 py-2 text-sm font-medium text-foreground">
          Cancelar
        </button>
      </div>
    </form>
  );
}
