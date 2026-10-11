"use client";

import { useActionState, useState } from "react";
import { Aviso, MensagemDeCampo } from "@/components/acesso/campos";
import { classeDoCampo } from "@/components/ui/classes";
import { FORMAS_DE_REEMBOLSO, MOTIVOS_CANCELAMENTO, reaisDeCentavos } from "@/lib/dominio/venda";
import { acaoCancelarVenda } from "@/lib/vendas/acoes";
import { CANCELAMENTO_INICIAL } from "@/lib/vendas/servicos";

/** Cancelar a venda (SPEC-011, 5.1): motivo da lista (OPEN-002) e forma do reembolso (OPEN-003). */
export function FormularioCancelamento({ vendaId, numero, reembolsoCentavos }: { vendaId: string; numero: number; reembolsoCentavos: number }) {
  const [estado, executar, enviando] = useActionState(acaoCancelarVenda, CANCELAMENTO_INICIAL);
  const [motivo, setMotivo] = useState("");
  const erros = estado.status === "erro" ? (estado.erros ?? {}) : {};

  return (
    <form
      action={executar}
      onSubmit={(e) => {
        if (!window.confirm(`Cancelar a venda nº ${numero}? Esta ação não pode ser desfeita.`)) e.preventDefault();
      }}
      className="space-y-4"
    >
      <input type="hidden" name="vendaId" value={vendaId} />
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="motivo" className="mb-1.5 block text-sm font-medium text-foreground">
            Motivo
          </label>
          <select
            id="motivo"
            name="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            aria-invalid={erros.motivo ? true : undefined}
            aria-describedby={erros.motivo ? "motivo-erro" : undefined}
            className={classeDoCampo(erros.motivo)}
          >
            <option value="">Selecione…</option>
            {Object.entries(MOTIVOS_CANCELAMENTO)
              .filter(([v]) => v !== "TROCA")
              .map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
          </select>
          <MensagemDeCampo id="motivo-erro" erro={erros.motivo} />
        </div>
        {reembolsoCentavos > 0 && (
          <div>
            <label htmlFor="formaReembolso" className="mb-1.5 block text-sm font-medium text-foreground">
              Devolver {reaisDeCentavos(reembolsoCentavos)} em
            </label>
            <select
              id="formaReembolso"
              name="formaReembolso"
              defaultValue=""
              aria-invalid={erros.formaReembolso ? true : undefined}
              aria-describedby={erros.formaReembolso ? "formaReembolso-erro" : undefined}
              className={classeDoCampo(erros.formaReembolso)}
            >
              <option value="">Selecione…</option>
              {Object.entries(FORMAS_DE_REEMBOLSO).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
            <MensagemDeCampo id="formaReembolso-erro" erro={erros.formaReembolso} />
          </div>
        )}
      </div>
      <div>
        <label htmlFor="detalhe" className="mb-1.5 block text-sm font-medium text-foreground">
          Detalhe {motivo === "OUTRO" ? "(obrigatório)" : "(opcional)"}
        </label>
        <input
          id="detalhe"
          name="detalhe"
          maxLength={200}
          placeholder="Ex.: cliente desistiu na hora"
          aria-invalid={erros.detalhe ? true : undefined}
          aria-describedby={erros.detalhe ? "detalhe-erro" : undefined}
          className={classeDoCampo(erros.detalhe)}
        />
        <MensagemDeCampo id="detalhe-erro" erro={erros.detalhe} />
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="rounded-xl bg-destructive px-5 py-3 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {enviando ? "Cancelando…" : `Cancelar a venda nº ${numero}`}
      </button>
    </form>
  );
}
