"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { MensagemDeCampo } from "@/components/acesso/campos";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao } from "@/components/ui/estilos";
import { MAX_RESULTADO, validarResultado } from "@/lib/dominio/emergencia";
import { acaoRegistrarResultado } from "@/lib/plataforma/acoes";
import { DECISAO_INICIAL } from "@/lib/plataforma/servicos";
import { useAvisoDoSucesso } from "./use-acao-critica";

/**
 * Resultado do acesso de emergência (SPEC-019, 5.6, "Depois"): quem pediu registra, depois do fim, uma vez,
 * até 1000 caracteres. Visível ao Dono e às contas de Administrador; sem ele, a conta não faz novo pedido.
 */
export function RegistrarResultado({ acessoId }: { acessoId: string }) {
  const [estado, executar, enviando] = useActionState(useAvisoDoSucesso(acaoRegistrarResultado), DECISAO_INICIAL);
  const [local, setLocal] = useState<string | null>(null);
  const erro = local ?? (estado.status === "erro" ? estado.mensagem : null);

  // Envio pela transição: se o servidor recusar, o texto não se perde.
  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const v = validarResultado({ resultado: String(dados.get("resultado") ?? "") });
    setLocal(v.ok ? null : v.erro);
    if (v.ok) startTransition(() => executar(dados));
  }

  return (
    <form onSubmit={aoEnviar} noValidate className="space-y-3">
      <input type="hidden" name="acessoId" value={acessoId} />
      <div>
        <label htmlFor={`resultado-${acessoId}`} className="mb-1.5 block text-sm font-medium text-foreground">
          Resultado do acesso
        </label>
        <textarea
          id={`resultado-${acessoId}`}
          name="resultado"
          rows={4}
          maxLength={MAX_RESULTADO}
          placeholder="O que foi visto, o que foi encontrado e o que foi feito depois"
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `resultado-${acessoId}-dica resultado-${acessoId}-erro` : `resultado-${acessoId}-dica`}
          className={classeDoCampo(erro ?? undefined)}
        />
        <p id={`resultado-${acessoId}-dica`} className="mt-1 text-xs text-muted-foreground">
          Até {MAX_RESULTADO} caracteres. O Dono e as contas de Administrador leem o resultado.
        </p>
        <MensagemDeCampo id={`resultado-${acessoId}-erro`} erro={erro ?? undefined} />
      </div>
      <button type="submit" disabled={enviando} className={classeDoBotao("principal", "sm")}>
        {enviando ? "Registrando…" : "Registrar o resultado"}
      </button>
    </form>
  );
}
