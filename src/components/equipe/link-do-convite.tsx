"use client";

import { useState } from "react";

/** Link do convite para copiar (OPEN-004): aparece uma única vez, logo depois de criar ou reenviar. */
export function LinkDoConvite({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }
  return (
    <div className="space-y-2">
      <label htmlFor="link-do-convite" className="text-sm font-medium text-foreground">
        Link do convite
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="link-do-convite"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-xl border border-input bg-card px-4 py-3 font-mono text-xs text-foreground"
        />
        <button
          type="button"
          onClick={copiar}
          className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {copiado ? "Copiado" : "Copiar link"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        O link vale por 7 dias e só funciona para a conta com o e-mail convidado. Por segurança, ele não aparece de novo:
        se precisar, use “Reenviar” na lista de convites.
      </p>
    </div>
  );
}

/** Resultado do envio: sucesso em verde; sem e-mail, atenção em âmbar (o convite foi criado — OPEN-004). */
export function AvisoDoEnvio({ enviado, children }: { enviado: boolean; children: React.ReactNode }) {
  return (
    <p
      role="status"
      className={
        enviado
          ? "rounded-xl border border-status-ok/30 bg-status-ok-bg px-4 py-3 text-sm text-status-ok"
          : "rounded-xl border border-status-warn/30 bg-status-warn-bg px-4 py-3 text-sm text-status-warn"
      }
    >
      {children}
    </p>
  );
}
