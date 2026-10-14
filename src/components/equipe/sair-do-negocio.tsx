"use client";

import { useState } from "react";
import { acaoSairDoNegocio } from "@/lib/equipe/acoes";

/** "Sair deste negócio" (OPEN-007), com confirmação. O Dono não tem esta opção. */
export function SairDoNegocio({ negocioId, nome }: { negocioId: string; nome: string }) {
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando) {
    return (
      <button type="button" onClick={() => setConfirmando(true)} className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-destructive hover:underline">
        Sair deste negócio
      </button>
    );
  }
  return (
    <form action={acaoSairDoNegocio} className="space-y-2 rounded-lg bg-status-danger-bg p-3">
      <input type="hidden" name="negocioId" value={negocioId} />
      <p className="text-xs text-status-danger">
        Você perderá o acesso a {nome}. Para voltar, precisará de um novo convite.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="rounded-full bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground active:scale-[0.96] transition-[background-color,transform] duration-(--duracao-estado)">
          Sair
        </button>
        <button type="button" onClick={() => setConfirmando(false)} className="rounded-lg border px-3 py-1.5 text-xs font-medium text-foreground">
          Cancelar
        </button>
      </div>
    </form>
  );
}
