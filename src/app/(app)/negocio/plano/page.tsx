import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Aviso } from "@/components/acesso/campos";
import { exigirDono } from "@/lib/auth/servidor";
import { planos } from "@/lib/db";
import { dataBrasileira } from "@/lib/dominio/datas";
import { ROTULO_PAPEL } from "@/lib/dominio/permissoes";
import { FUNCIONALIDADES_DO_PAGO, INCLUIDO_NOS_DOIS, ROTULO_FUNCIONALIDADE, ROTULO_PLANO } from "@/lib/dominio/planos";
import { acaoAlterarPlano } from "@/lib/planos/acoes";

export const metadata: Metadata = { title: "Plano" };

const botao = "inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover";
const botaoSecundario = "inline-flex items-center justify-center rounded-xl border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent";
const cartao = "rounded-2xl border bg-card p-6 shadow-sm";

// Plano do negócio (SPEC-013, UC15): só o Dono (RN02). A troca é simulada (RF73) e passa
// sempre por alterarPlano; a SPEC-015 troca só esse ponto pelo gateway de pagamento.
export default async function Plano({ searchParams }: PageProps<"/negocio/plano">) {
  const { negocioId } = await exigirDono();
  const [s, busca] = await Promise.all([planos().doNegocio(negocioId).situacao(new Date()), searchParams]);
  if (!s) redirect("/painel");
  const confirmar = busca.confirmar === "PAGO" || busca.confirmar === "GRATUITO" ? busca.confirmar : null;
  const ativos = s.colaboradores.filter((c) => c.suspensoEm === null);
  const suspensos = s.colaboradores.length - ativos.length;
  const pago = s.plano === "PAGO";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Configurações</p>
        <h1 className="font-display text-3xl font-semibold text-foreground">Plano</h1>
      </div>

      {typeof busca.aviso === "string" && <Aviso tipo="sucesso">{busca.aviso}</Aviso>}
      {typeof busca.erro === "string" && <Aviso tipo="erro">{busca.erro}</Aviso>}

      <section aria-labelledby="titulo-atual" className={`${cartao} ${pago ? "ring-1 ring-primary/30" : ""}`}>
        <p className="text-sm text-muted-foreground">Plano atual</p>
        <h2 id="titulo-atual" className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold text-card-foreground">
          {pago && <span aria-hidden="true">★</span>}
          {ROTULO_PLANO[s.plano]}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {s.alteradoEm ? `Desde ${dataBrasileira(s.alteradoEm)}${s.alteradoPor ? `, por ${s.alteradoPor}` : ""}.` : "Desde o cadastro do negócio."}
          {suspensos > 0 && ` ${suspensos} ${suspensos === 1 ? "colaborador está" : "colaboradores estão"} sem acesso pelo limite do plano gratuito.`}
        </p>
      </section>

      <section aria-label="O que cada plano inclui" className="grid gap-4 sm:grid-cols-2">
        <div className={cartao}>
          <h2 className="font-display text-xl font-semibold text-card-foreground">Gratuito</h2>
          <ul className="mt-3 space-y-2 text-sm text-foreground">
            {INCLUIDO_NOS_DOIS.map((t) => (
              <li key={t} className="flex gap-2">
                <span aria-hidden="true" className="text-status-ok">
                  ✓
                </span>
                {t}
              </li>
            ))}
            <li className="flex gap-2 text-muted-foreground">
              <span aria-hidden="true">–</span>Listas e filtros com os últimos 12 meses
            </li>
          </ul>
        </div>
        <div className={`${cartao} ring-1 ring-primary/20`}>
          <h2 className="font-display text-xl font-semibold text-card-foreground">
            <span aria-hidden="true">★ </span>Pago
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-foreground">
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-status-ok">
                ✓
              </span>
              Tudo do gratuito
            </li>
            {FUNCIONALIDADES_DO_PAGO.map((f) => (
              <li key={f} className="flex gap-2">
                <span aria-hidden="true" className="text-status-ok">
                  ✓
                </span>
                {ROTULO_FUNCIONALIDADE[f]}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {!confirmar && (
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/negocio/plano?confirmar=${pago ? "GRATUITO" : "PAGO"}`} className={pago ? botaoSecundario : botao}>
            {pago ? "Voltar ao plano gratuito" : "Mudar para o plano pago"}
          </Link>
          <p className="text-xs text-muted-foreground">Simulação: nesta versão, nenhuma cobrança é feita.</p>
        </div>
      )}

      {confirmar === "PAGO" && !pago && (
        <section aria-labelledby="titulo-confirmar" className={`${cartao} border-primary/40`}>
          <h2 id="titulo-confirmar" className="font-display text-xl font-semibold text-card-foreground">
            Confirmar o plano pago
          </h2>
          <p className="mt-2 text-sm text-foreground">
            Os relatórios avançados, o histórico completo e a equipe sem limite ficam disponíveis na hora
            {suspensos > 0 && `, e ${suspensos === 1 ? "o colaborador sem acesso volta" : `os ${suspensos} colaboradores sem acesso voltam`} a ter acesso`}.
          </p>
          <p className="mt-2 rounded-xl border border-status-warn/40 bg-status-warn-bg px-4 py-2 text-sm text-status-warn">
            <span aria-hidden="true">▲ </span>Simulação: nenhuma cobrança é feita nesta versão.
          </p>
          <form action={acaoAlterarPlano} className="mt-4 flex flex-wrap gap-3">
            <input type="hidden" name="para" value="PAGO" />
            <button type="submit" className={botao}>
              Confirmar o plano pago
            </button>
            <Link href="/negocio/plano" className={botaoSecundario}>
              Cancelar
            </Link>
          </form>
        </section>
      )}

      {confirmar === "GRATUITO" && pago && (
        <section aria-labelledby="titulo-confirmar" className={`${cartao} border-status-warn/40`}>
          <h2 id="titulo-confirmar" className="font-display text-xl font-semibold text-card-foreground">
            Voltar ao plano gratuito
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
            <li>Os relatórios avançados deixam de estar disponíveis.</li>
            <li>As listas e os filtros passam a mostrar os últimos 12 meses.</li>
            <li>Nenhum dado é apagado: tudo volta a aparecer num novo upgrade.</li>
          </ul>
          <form action={acaoAlterarPlano} className="mt-4 space-y-4">
            <input type="hidden" name="para" value="GRATUITO" />
            {ativos.length > 1 ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">No gratuito, só 1 colaborador tem acesso. Quem continua?</legend>
                {ativos.map((c, i) => (
                  <label key={c.id} className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm has-[:checked]:border-primary">
                    <input type="radio" name="manter" value={c.id} defaultChecked={i === 0} className="mt-1" />
                    <span className="min-w-0">
                      <span className="block font-medium break-words text-foreground">{c.nome}</span>
                      <span className="block text-xs break-words text-muted-foreground">
                        {ROTULO_PAPEL[c.papel]} · {c.email}
                      </span>
                    </span>
                  </label>
                ))}
                <p className="text-xs text-muted-foreground">Os outros ficam sem acesso até um novo upgrade, com o mesmo papel e as mesmas permissões.</p>
              </fieldset>
            ) : (
              ativos.length === 1 && <input type="hidden" name="manter" value={ativos[0].id} />
            )}
            {s.convitesPendentes > 0 && (
              <p className="text-sm text-status-warn">
                <span aria-hidden="true">▲ </span>
                {s.convitesPendentes === 1 ? "O convite pendente será cancelado" : `Os ${s.convitesPendentes} convites pendentes serão cancelados`} (pode ser reenviado depois).
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="submit" className={botao}>
                Confirmar a volta ao gratuito
              </button>
              <Link href="/negocio/plano" className={botaoSecundario}>
                Cancelar
              </Link>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
