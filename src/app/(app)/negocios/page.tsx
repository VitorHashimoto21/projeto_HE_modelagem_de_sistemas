import type { Metadata } from "next";
import { exigirSessao } from "@/lib/auth/servidor";

export const metadata: Metadata = { title: "Meus negócios" };

// "Meus negócios" (SPEC-002, escopo 9): nesta etapa só o estado vazio. A lista, o
// cadastro e a troca do negócio ativo chegam na SPEC-004.
export default async function MeusNegocios() {
  const contexto = await exigirSessao();

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-semibold text-foreground">Meus negócios</h1>

      {contexto.negocioRecusado && (
        <p role="status" className="rounded-xl border border-status-warn/30 bg-status-warn-bg px-4 py-3 text-sm text-status-warn">
          O negócio que estava aberto não está disponível para a sua conta. Escolha um negócio abaixo.
        </p>
      )}

      <section className="rounded-2xl border bg-card px-6 py-12 text-center shadow-sm" aria-labelledby="titulo-vazio">
        <h2 id="titulo-vazio" className="mb-2 font-display text-2xl font-semibold text-card-foreground">
          Você ainda não tem um negócio
        </h2>
        <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
          Cadastre seu negócio para controlar o estoque, precificar e acompanhar o caixa. Se alguém convidou você para uma
          equipe, use o link do convite recebido por e-mail.
        </p>
        <button
          type="button"
          disabled
          aria-describedby="aviso-em-breve"
          className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cadastrar meu negócio
        </button>
        <p id="aviso-em-breve" className="mt-3 text-xs text-muted-foreground">
          O cadastro de negócio chega na próxima etapa do sistema.
        </p>
      </section>
    </div>
  );
}
