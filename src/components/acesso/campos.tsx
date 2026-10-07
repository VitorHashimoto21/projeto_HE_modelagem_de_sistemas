"use client";

import { useState, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

// Campos das telas de acesso, conforme o protótipo revisado (docs/design/prototipo_revisado).

const classeDoCampo = (erro?: string) =>
  cn(
    "w-full rounded-xl border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground",
    "outline-none transition-shadow focus:border-ring focus:ring-4 focus:ring-ring/15",
    erro ? "border-destructive ring-4 ring-destructive/10" : "border-input",
  );

function IconeErro() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" className="shrink-0">
      <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1" fill="none" />
      <rect x="5.5" y="3" width="1" height="4" rx=".5" />
      <rect x="5.5" y="8.5" width="1" height="1" rx=".5" />
    </svg>
  );
}

export function MensagemDeCampo({ id, erro }: { id: string; erro?: string }) {
  if (!erro) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
      <IconeErro />
      {erro}
    </p>
  );
}

type PropsDoCampo = Omit<ComponentProps<"input">, "id" | "name"> & {
  nome: string;
  rotulo: string;
  erro?: string;
  /** Conteúdo à direita do rótulo (ex.: link "Esqueci a senha"). */
  extra?: React.ReactNode;
};

export function Campo({ nome, rotulo, erro, extra, className, ...props }: PropsDoCampo) {
  const idErro = `${nome}-erro`;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={nome} className="text-sm font-medium text-foreground">
          {rotulo}
        </label>
        {extra}
      </div>
      <input
        id={nome}
        name={nome}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        className={cn(classeDoCampo(erro), className)}
        {...props}
      />
      <MensagemDeCampo id={idErro} erro={erro} />
    </div>
  );
}

export function CampoSenha({ nome, rotulo, erro, extra, ...props }: PropsDoCampo) {
  const [visivel, setVisivel] = useState(false);
  const idErro = `${nome}-erro`;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={nome} className="text-sm font-medium text-foreground">
          {rotulo}
        </label>
        {extra}
      </div>
      <div className="relative">
        <input
          id={nome}
          name={nome}
          type={visivel ? "text" : "password"}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? idErro : undefined}
          className={cn(classeDoCampo(erro), "pr-11")}
          {...props}
        />
        <button
          type="button"
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-controls={nome}
          onClick={() => setVisivel((v) => !v)}
          className="absolute top-1/2 right-3.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {visivel ? (
              <>
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </>
            ) : (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
      <MensagemDeCampo id={idErro} erro={erro} />
    </div>
  );
}

export function BotaoEnviar({ children, enviando }: { children: React.ReactNode; enviando: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold tracking-wide text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? enviando : children}
    </button>
  );
}

/** Mensagem geral do formulário: erro (alerta) ou confirmação. */
export function Aviso({ tipo, children }: { tipo: "erro" | "sucesso"; children: React.ReactNode }) {
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        tipo === "erro"
          ? "border-destructive/30 bg-status-danger-bg text-status-danger"
          : "border-status-ok/30 bg-status-ok-bg text-status-ok",
      )}
    >
      {children}
    </div>
  );
}
