import type { Metadata } from "next";
import Link from "next/link";
import { AcoesDoConvite } from "@/components/equipe/acoes-do-convite";
import { exigirDono } from "@/lib/auth/servidor";
import { equipe, LIMITE_DO_PLANO_GRATUITO } from "@/lib/db";
import { dataBrasileira } from "@/lib/dominio/datas";
import { ROTULO_PAPEL } from "@/lib/dominio/permissoes";

export const metadata: Metadata = { title: "Equipe" };

const botaoPrincipal =
  "inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover";

// Equipe (SPEC-005, escopo 4): só o Dono (Configurações — OPEN-002).
export default async function Equipe({ searchParams }: PageProps<"/negocio/equipe">) {
  const { negocioId } = await exigirDono();
  const doNegocio = equipe().doNegocio(negocioId);
  const [resumo, { membros, convites }, { removido, erro }] = await Promise.all([doNegocio.resumo(), doNegocio.listar(new Date()), searchParams]);
  const ocupadas = membros.filter((m) => m.papel !== "DONO").length + convites.length;
  const noLimite = resumo?.plano === "GRATUITO" && ocupadas >= LIMITE_DO_PLANO_GRATUITO;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Configurações</p>
          <h1 className="font-display text-3xl font-semibold text-foreground">Equipe</h1>
        </div>
        {!noLimite && (
          <Link href="/negocio/equipe/convidar" className={botaoPrincipal}>
            Convidar pessoa
          </Link>
        )}
      </div>

      {removido && (
        <p role="status" className="rounded-xl border border-status-ok/30 bg-status-ok-bg px-4 py-3 text-sm text-status-ok">
          Pessoa removida da equipe.
        </p>
      )}
      {erro && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-status-danger-bg px-4 py-3 text-sm text-status-danger">
          Não foi possível concluir. Atualize a página e tente de novo.
        </p>
      )}
      {noLimite && (
        <p role="note" className="rounded-xl border border-status-warn/30 bg-status-warn-bg px-4 py-3 text-sm text-status-warn">
          No plano gratuito, o negócio pode ter 1 colaborador (membro ou convite pendente). Para convidar mais pessoas, é
          preciso o plano pago. Cancelar um convite pendente ou remover alguém libera a vaga.
        </p>
      )}

      <section aria-labelledby="titulo-membros" className="space-y-3">
        <h2 id="titulo-membros" className="font-display text-xl font-semibold text-foreground">
          Membros
        </h2>
        <ul className="divide-y rounded-2xl border bg-card shadow-sm">
          {membros.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-card-foreground">{m.nome}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-full border px-3 py-1 text-xs font-medium text-foreground">
                  {ROTULO_PAPEL[m.papel]}
                  {m.permissoesCustom ? " · personalizado" : ""}
                </span>
                {m.papel !== "DONO" && (
                  <Link href={`/negocio/equipe/${m.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                    Gerenciar
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-convites" className="space-y-3">
        <h2 id="titulo-convites" className="font-display text-xl font-semibold text-foreground">
          Convites pendentes
        </h2>
        {convites.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum convite pendente.</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card shadow-sm">
            {convites.map((c) => (
              <li key={c.id} className="space-y-3 px-5 py-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="truncate text-sm font-semibold text-card-foreground">{c.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROTULO_PAPEL[c.papel]}
                    {c.permissoesCustom ? " · personalizado" : ""} · vale até {dataBrasileira(c.expiraEm)}
                  </p>
                </div>
                <AcoesDoConvite conviteId={c.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
