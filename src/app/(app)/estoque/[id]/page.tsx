import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { rotuloUnidade } from "@/components/catalogo/rotulos";
import { FormularioMinimo, FormularioMovimentacao } from "@/components/estoque/formularios";
import { quantidade, ROTULO_MOTIVO, ROTULO_MOVIMENTACAO, SeloDeSituacao } from "@/components/estoque/situacao";
import { exigirPermissao } from "@/lib/auth/servidor";
import { estoque } from "@/lib/db";
import { ItemNaoEncontrado } from "@/lib/db/catalogo";
import { dataBrasileira, hoje } from "@/lib/dominio/datas";
import { diasEntre, JANELA_DIAS } from "@/lib/dominio/estoque";
import { pode } from "@/lib/dominio/permissoes";

export const metadata: Metadata = { title: "Estoque do produto" };

const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

const DICA_SITUACAO = {
  SEM_ESTOQUE: "Sem estoque: reponha o quanto antes.",
  BAIXO: "Estoque baixo: o saldo chegou ao mínimo.",
  NORMAL: "Saldo acima do mínimo.",
  SEM_MINIMO: "Alerta ativado após a primeira entrada e saída, ou ao definir um mínimo manual.",
} as const;

// Detalhe do estoque (SPEC-007, 5.1–5.5): Estoque — ver; entrada/saída com "criar";
// mínimo manual com "editar".
export default async function EstoqueDoProduto({ params, searchParams }: PageProps<"/estoque/[id]">) {
  const membro = await exigirPermissao("estoque", "ver");
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  const dia = hoje();
  const pagina = Number(typeof busca.pagina === "string" ? busca.pagina : "1") || 1;
  const d = await estoque(membro)
    .detalhar(id, dia, pagina)
    .catch((e) => {
      if (e instanceof ItemNaoEncontrado) notFound();
      throw e;
    });
  const unidade = rotuloUnidade(d.unidadeMedida);
  const podeMovimentar = pode(membro.permissoes, "estoque", "criar");
  const podeEditarMinimo = pode(membro.permissoes, "estoque", "editar");
  const diasConsumo = d.consumoNaJanela.primeiroDia ? Math.min(JANELA_DIAS, diasEntre(d.consumoNaJanela.primeiroDia, dia) + 1) : 0;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href="/estoque" className="font-medium text-primary underline-offset-2 hover:underline">
            ← Estoque
          </Link>
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="min-w-0 font-display text-3xl font-semibold break-words text-foreground">{d.nome}</h1>
          <Link href={`/catalogo/${d.id}`} className="text-sm font-medium text-primary underline-offset-2 hover:underline">
            Ver no Catálogo
          </Link>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Resumo do estoque">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Saldo</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">
            {quantidade(d.saldo)} <span className="text-base font-normal text-muted-foreground">{unidade}</span>
          </p>
          <div className="mt-3 space-y-1">
            <SeloDeSituacao situacao={d.situacao} />
            <p className="text-xs text-muted-foreground">{DICA_SITUACAO[d.situacao]}</p>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Estoque mínimo em uso</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">
            {d.minimo ? quantidade(d.minimo.valor) : "—"}
            {d.minimo && <span className="ml-2 text-base font-normal text-muted-foreground">{d.minimo.origem}</span>}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {d.sugestao === null
              ? "Sugestão disponível após a primeira entrada e saída."
              : `Sugerido: ${d.sugestao} = consumo de ${quantidade(Math.max(0, d.consumoNaJanela.saidas - d.consumoNaJanela.estornos))} em ${diasConsumo} ${diasConsumo === 1 ? "dia" : "dias"} × ${d.diasCobertura} dias de cobertura, arredondado para cima.`}
            {d.minimoManual !== null && d.sugestao !== null && " O mínimo manual tem prioridade."}
          </p>
          {podeEditarMinimo && (
            <div className="mt-4">
              <p className="mb-1.5 text-sm font-medium text-foreground">Mínimo manual</p>
              <FormularioMinimo itemId={d.id} atual={d.minimoManual} />
            </div>
          )}
        </div>
      </section>

      {podeMovimentar && (
        <section className="grid gap-4 lg:grid-cols-2" aria-label="Registrar movimentação">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 font-display text-xl font-semibold text-card-foreground">Entrada</h2>
            <FormularioMovimentacao itemId={d.id} tipo="entrada" hoje={dia} unidade={unidade} />
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 font-display text-xl font-semibold text-card-foreground">Saída manual</h2>
            <FormularioMovimentacao itemId={d.id} tipo="saida" hoje={dia} unidade={unidade} />
          </div>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-6 shadow-sm" aria-labelledby="titulo-movimentacoes">
        <h2 id="titulo-movimentacoes" className="mb-2 font-display text-xl font-semibold text-card-foreground">
          Movimentações
        </h2>
        {d.movimentacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>
        ) : (
          <ol className="divide-y">
            {d.movimentacoes.map((m) => {
              const entrada = m.tipo === "ENTRADA" || m.tipo === "ENTRADA_ESTORNO";
              const registradoNoDia = dataBrasileira(m.registradoEm) === dataBrasileira(m.data);
              return (
                <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm">
                  <div className="min-w-0">
                    <span className={`font-semibold ${entrada ? "text-status-ok" : "text-foreground"}`}>
                      {entrada ? "+" : "−"}
                      {quantidade(m.quantidade)}
                    </span>
                    <span className="ml-2 text-foreground">
                      {ROTULO_MOVIMENTACAO[m.tipo]}
                      {m.motivo && ` · ${ROTULO_MOTIVO[m.motivo]}`}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {quantidade(m.saldoAnterior)} → {quantidade(m.saldoPosterior)}
                    </span>
                    {m.observacao && <p className="text-xs break-words text-muted-foreground">{m.observacao}</p>}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {m.usuario} · {registradoNoDia ? quando.format(m.registradoEm) : `ocorrida em ${dataBrasileira(m.data)} · registrada ${quando.format(m.registradoEm)}`}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {d.paginas > 1 && (
          <nav aria-label="Páginas das movimentações" className="mt-4 flex items-center justify-between text-sm">
            {d.pagina > 1 ? (
              <Link href={`/estoque/${d.id}?pagina=${d.pagina - 1}`} className="font-medium text-primary underline-offset-2 hover:underline">
                ← Mais novas
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">
              Página {d.pagina} de {d.paginas}
            </span>
            {d.pagina < d.paginas ? (
              <Link href={`/estoque/${d.id}?pagina=${d.pagina + 1}`} className="font-medium text-primary underline-offset-2 hover:underline">
                Mais antigas →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
