import type { Metadata } from "next";
import Link from "next/link";
import { AceitarConvite } from "@/components/equipe/aceitar-convite";
import { SairDoNegocio } from "@/components/equipe/sair-do-negocio";
import { ROTULO_PAPEL, ROTULO_REGIME } from "@/components/negocio/rotulos";
import { exigirSessao } from "@/lib/auth/servidor";
import { negocios } from "@/lib/db";
import { dataBrasileira } from "@/lib/dominio/datas";
import { convitesParaVoce } from "@/lib/equipe/servicos";
import { dependenciasDaEquipe } from "@/lib/equipe/servidor";
import { acaoTrocarNegocio } from "@/lib/negocio/acoes";

export const metadata: Metadata = { title: "Meus negócios" };

const botaoPrincipal =
  "inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover";

// "Meus negócios" (SPEC-004, escopo 1): negócios em que o usuário é membro; escolher um
// o torna o negócio ativo (UC2). SPEC-005: "Convites para você" (OPEN-006) e "Sair deste
// negócio" para quem não é Dono (OPEN-007).
export default async function MeusNegocios({ searchParams }: PageProps<"/negocios">) {
  const contexto = await exigirSessao();
  const [lista, convites, { saiu }] = await Promise.all([
    negocios().listarDoUsuario(contexto.usuarioId),
    dependenciasDaEquipe().then(convitesParaVoce),
    searchParams,
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold text-foreground">Meus negócios</h1>
        {lista.length > 0 && (
          <Link href="/negocios/novo" className={botaoPrincipal}>
            Cadastrar negócio
          </Link>
        )}
      </div>

      {contexto.negocioRecusado && (
        <p role="status" className="rounded-xl border border-status-warn/30 bg-status-warn-bg px-4 py-3 text-sm text-status-warn">
          O negócio que estava aberto não está disponível para a sua conta. Escolha um negócio abaixo.
        </p>
      )}

      {saiu && (
        <p role="status" className="rounded-xl border border-status-ok/30 bg-status-ok-bg px-4 py-3 text-sm text-status-ok">
          Você saiu do negócio.
        </p>
      )}

      {convites.length > 0 && (
        <section aria-labelledby="titulo-convites" className="space-y-3">
          <h2 id="titulo-convites" className="font-display text-xl font-semibold text-foreground">
            Convites para você
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {convites.map((c) => (
              <li key={c.id} className="space-y-3 rounded-2xl border border-primary/40 bg-card p-5 shadow-sm">
                <div>
                  <p className="truncate font-display text-lg font-semibold text-card-foreground">{c.negocio}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.convidadoPor} convidou você como {ROTULO_PAPEL[c.papel]} · vale até {dataBrasileira(c.expiraEm)}
                  </p>
                </div>
                <AceitarConvite conviteId={c.id} compacto />
              </li>
            ))}
          </ul>
        </section>
      )}

      {lista.length === 0 ? (
        <section className="rounded-2xl border bg-card px-6 py-12 text-center shadow-sm" aria-labelledby="titulo-vazio">
          <h2 id="titulo-vazio" className="mb-2 font-display text-2xl font-semibold text-card-foreground">
            Você ainda não tem um negócio
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
            Cadastre seu negócio para controlar o estoque, precificar e acompanhar o caixa. Se alguém convidou você para uma
            equipe, use o link do convite recebido ou aguarde o convite aparecer aqui.
          </p>
          <Link href="/negocios/novo" className={botaoPrincipal}>
            Cadastrar meu negócio
          </Link>
        </section>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2" aria-label="Seus negócios">
          {lista.map((n) => {
            const ativo = n.id === contexto.negocioId;
            return (
              <li key={n.id}>
                <form action={acaoTrocarNegocio}>
                  <input type="hidden" name="negocioId" value={n.id} />
                  <button
                    type="submit"
                    aria-current={ativo ? "true" : undefined}
                    className={`w-full rounded-2xl border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary ${
                      ativo ? "border-primary ring-4 ring-ring/15" : ""
                    }`}
                  >
                    <span className="block truncate font-display text-lg font-semibold text-card-foreground">{n.nome}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {ROTULO_REGIME[n.regime]} · {ROTULO_PAPEL[n.papel]}
                      {ativo && " · aberto agora"}
                    </span>
                  </button>
                </form>
                {n.papel !== "DONO" && (
                  <div className="mt-2 px-1">
                    <SairDoNegocio negocioId={n.id} nome={n.nome} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
