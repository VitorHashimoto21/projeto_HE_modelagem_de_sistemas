"use client";

import { useState } from "react";
import { ACOES, campoDaPermissao, MODULOS, ROTULO_ACAO, ROTULO_MODULO, type Acao, type Matriz, type Modulo } from "@/lib/dominio/permissoes";

/**
 * Matriz módulo × ação (SPEC-005, 5.1). Um bloco por módulo com as 4 ações, que quebra
 * linha no celular (sem rolagem horizontal). A coerência é aplicada na hora: desmarcar
 * "Ver" desmarca editar e excluir; marcar editar ou excluir marca "Ver".
 */
export function MatrizDePermissoes({
  inicial,
  editavel,
  rotulo = "Permissões",
}: {
  inicial: Matriz;
  editavel: boolean;
  rotulo?: string;
}) {
  const [matriz, setMatriz] = useState(inicial);
  const [base, setBase] = useState(inicial);
  // Uma nova matriz inicial (outro papel escolhido) substitui a atual.
  if (base !== inicial) {
    setBase(inicial);
    setMatriz(inicial);
  }

  function alternar(modulo: Modulo, acao: Acao, marcado: boolean) {
    const linha = { ...matriz[modulo], [acao]: marcado };
    if (acao === "ver" && !marcado) {
      linha.editar = false;
      linha.excluir = false;
    }
    if ((acao === "editar" || acao === "excluir") && marcado) linha.ver = true;
    setMatriz({ ...matriz, [modulo]: linha });
  }

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-medium text-foreground">{rotulo}</legend>
      {MODULOS.map((m) => (
        <fieldset key={m} className="rounded-xl border bg-card px-4 py-3">
          <legend className="sr-only">{ROTULO_MODULO[m]}</legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span aria-hidden="true" className="text-sm font-semibold text-card-foreground">
              {ROTULO_MODULO[m]}
            </span>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {ACOES.map((a) => {
                const id = `${m}-${a}`;
                return (
                  <label key={a} htmlFor={id} className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input
                      id={id}
                      type="checkbox"
                      name={editavel ? campoDaPermissao(m, a) : undefined}
                      checked={matriz[m][a]}
                      disabled={!editavel}
                      onChange={(e) => alternar(m, a, e.target.checked)}
                      aria-label={`${ROTULO_MODULO[m]}: ${ROTULO_ACAO[a]}`}
                      className="size-4 accent-primary disabled:opacity-60"
                    />
                    {ROTULO_ACAO[a]}
                  </label>
                );
              })}
            </div>
          </div>
        </fieldset>
      ))}
      <p className="text-xs text-muted-foreground">
        Editar e excluir/cancelar exigem também “Ver”. O Dashboard completo (saldo, semáforo, ponto de equilíbrio e
        gráficos) aparece só para quem também pode ver o Financeiro. No Estoque, “Excluir/cancelar” não tem uso:
        movimentações nunca são apagadas, e um lançamento errado é corrigido com uma entrada ou saída.
      </p>
    </fieldset>
  );
}
