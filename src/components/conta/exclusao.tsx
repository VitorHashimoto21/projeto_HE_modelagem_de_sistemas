"use client";

import { useActionState, useState } from "react";
import { Aviso, MensagemDeCampo } from "@/components/acesso/campos";
import { classeDoCampo } from "@/components/ui/classes";
import { acaoExcluirConta } from "@/lib/lgpd/acoes";
import { EXCLUSAO_INICIAL } from "@/lib/lgpd/servicos";

/** Excluir a conta (SPEC-014, OPEN-002): digitar o e-mail da conta e marcar a ciência. */
export function FormularioExclusao({ email }: { email: string }) {
  const [estado, executar, enviando] = useActionState(acaoExcluirConta, EXCLUSAO_INICIAL);
  const [digitado, setDigitado] = useState("");
  const [ciente, setCiente] = useState(false);
  const erros = estado.status === "erro" ? (estado.erros ?? {}) : {};
  const pronto = digitado.trim().toLowerCase() === email.toLowerCase() && ciente;

  return (
    <form action={executar} className="space-y-4">
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <div>
        <label htmlFor="email-confirmacao" className="mb-1.5 block text-sm font-medium text-foreground">
          Para confirmar, digite o e-mail desta conta: <strong className="break-all">{email}</strong>
        </label>
        <input
          id="email-confirmacao"
          name="email"
          type="email"
          autoComplete="off"
          value={digitado}
          onChange={(e) => setDigitado(e.target.value)}
          aria-invalid={erros.email ? true : undefined}
          aria-describedby={erros.email ? "email-confirmacao-erro" : undefined}
          className={classeDoCampo(erros.email)}
        />
        <MensagemDeCampo id="email-confirmacao-erro" erro={erros.email} />
      </div>
      <div>
        <label className="flex items-start gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            name="ciencia"
            checked={ciente}
            onChange={(e) => setCiente(e.target.checked)}
            className="mt-1"
            aria-describedby={erros.ciencia ? "ciencia-erro" : undefined}
          />
          Entendo que a exclusão é definitiva: não dá para desfazer nem recuperar a conta.
        </label>
        <MensagemDeCampo id="ciencia-erro" erro={erros.ciencia} />
      </div>
      <button
        type="submit"
        disabled={!pronto || enviando}
        className="inline-flex w-full items-center justify-center rounded-full bg-destructive px-5 py-3 text-sm font-semibold text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto active:scale-[0.96] transition-[background-color,transform] duration-(--duracao-estado)"
      >
        {enviando ? "Excluindo…" : "Excluir minha conta definitivamente"}
      </button>
    </form>
  );
}
