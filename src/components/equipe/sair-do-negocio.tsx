"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { acaoSairDoNegocio } from "@/lib/equipe/acoes";
import { classeDoBotao } from "@/components/ui/estilos";

/** "Sair deste negócio" (OPEN-007), com confirmação. O Dono não tem esta opção. */
export function SairDoNegocio({ negocioId, nome }: { negocioId: string; nome: string }) {
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando) {
    return (
      <button type="button" onClick={() => setConfirmando(true)} className={classeDoBotao("fantasma", "sm", "-ml-3 text-muted-foreground hover:bg-status-danger-bg hover:text-status-danger")}>
        <LogOut aria-hidden="true" />
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
        <button type="submit" className={classeDoBotao("perigo", "sm")}>
          Sair
        </button>
        <button type="button" onClick={() => setConfirmando(false)} className={classeDoBotao("secundario", "sm")}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
