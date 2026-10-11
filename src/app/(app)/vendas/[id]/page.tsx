import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { rotuloUnidade } from "@/components/catalogo/rotulos";
import { brl, qtd, ROTULO_CONTA, ROTULO_FORMA } from "@/components/vendas/rotulos";
import { exigirPermissao } from "@/lib/auth/servidor";
import { vendas } from "@/lib/db";
import { VendaNaoEncontrada } from "@/lib/db/vendas";
import { dataBrasileira } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";

export const metadata: Metadata = { title: "Venda" };

const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const cartao = "rounded-2xl border bg-card p-6 shadow-sm";

// Detalhe da venda (SPEC-008, 5.4) e confirmação depois de registrar: Vendas — ver.
// SPEC-011: auditoria do cancelamento, ligação com a troca e o botão de cancelar (Vendas — excluir).
export default async function DetalheDaVenda({ params, searchParams }: PageProps<"/vendas/[id]">) {
  const membro = await exigirPermissao("vendas", "ver");
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  const v = await vendas(membro)
    .detalhar(id)
    .catch((e) => {
      if (e instanceof VendaNaoEncontrada) notFound();
      throw e;
    });
  const podeVender = pode(membro.permissoes, "vendas", "criar");
  const podeCancelar = pode(membro.permissoes, "vendas", "excluir") && v.status === "CONCLUIDA";

  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link href="/vendas" className="font-medium text-primary underline-offset-2 hover:underline">
          ← Vendas
        </Link>
      </p>

      {(busca.nova || busca.jaRegistrada) && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-status-ok/30 bg-status-ok-bg px-5 py-4 text-status-ok">
          <p className="font-medium">{busca.jaRegistrada ? `Esta venda já tinha sido registrada (nº ${v.numero}).` : `Venda nº ${v.numero} registrada.`}</p>
          {podeVender && (
            <Link href="/vendas/nova" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
              Nova venda
            </Link>
          )}
        </div>
      )}

      {busca.cancelada && v.cancelamento && (
        <p role="status" className="rounded-2xl border border-status-ok/30 bg-status-ok-bg px-5 py-4 font-medium text-status-ok">
          Venda nº {v.numero} cancelada.{v.cancelamento.reembolso ? ` Reembolso de ${brl(v.cancelamento.reembolso.valor)} registrado no caixa.` : ""}
        </p>
      )}
      {busca.troca && v.trocaDe && (
        <p role="status" className="rounded-2xl border border-status-ok/30 bg-status-ok-bg px-5 py-4 font-medium text-status-ok">
          Troca registrada: a venda nº {v.trocaDe.numero} foi cancelada e esta é a venda nº {v.numero}.
        </p>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 font-display text-3xl font-semibold text-foreground">
            Venda nº {v.numero}
            {v.status === "CANCELADA" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-status-danger-bg px-3 py-1 font-sans text-sm font-medium text-status-danger">
                <span aria-hidden="true">✕</span>
                Cancelada
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {quando.format(v.data)} · por {v.registradaPor}
            {v.cliente && ` · cliente ${v.cliente}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className={`text-3xl font-semibold ${v.status === "CANCELADA" ? "text-muted-foreground line-through" : "text-foreground"}`}>{brl(v.valorTotal)}</p>
          {podeCancelar && (
            <Link href={`/vendas/${v.id}/cancelar`} className="rounded-xl border border-input px-4 py-2 text-sm font-semibold text-status-danger hover:bg-muted">
              Cancelar venda
            </Link>
          )}
        </div>
      </div>

      {v.trocaDe && (
        <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-foreground">
          Troca da{" "}
          <Link href={`/vendas/${v.trocaDe.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
            venda nº {v.trocaDe.numero}
          </Link>
          , cancelada.
        </p>
      )}

      {v.cancelamento && (
        <section className="rounded-2xl border border-status-danger/30 bg-card p-6 shadow-sm" aria-labelledby="titulo-cancelamento">
          <h2 id="titulo-cancelamento" className="mb-2 font-display text-xl font-semibold text-card-foreground">
            Cancelamento
          </h2>
          <dl className="space-y-1 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">Quando e por quem</dt>
              <dd className="font-medium text-foreground">
                {quando.format(v.cancelamento.em)} · {v.cancelamento.por}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">Motivo</dt>
              <dd className="font-medium break-words text-foreground">{v.cancelamento.motivo}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">Reembolso</dt>
              <dd className="font-medium text-foreground">
                {v.cancelamento.reembolso ? (
                  <>
                    <span className="text-status-danger">− {brl(v.cancelamento.reembolso.valor)}</span> · {v.cancelamento.reembolso.descricao.split(" — ").pop()}
                  </>
                ) : (
                  "Nenhum"
                )}
              </dd>
            </div>
            {v.trocadaPor && (
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">Trocada pela</dt>
                <dd>
                  <Link href={`/vendas/${v.trocadaPor.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                    venda nº {v.trocadaPor.numero}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">O estoque voltou, as parcelas em aberto foram canceladas e a venda saiu do faturamento.</p>
        </section>
      )}

      <section className={cartao} aria-labelledby="titulo-itens">
        <h2 id="titulo-itens" className="mb-2 font-display text-xl font-semibold text-card-foreground">
          Itens
        </h2>
        <ul className="divide-y">
          {v.itensVenda.map((i) => (
            <li key={i.itemId} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
              <span className="min-w-0 font-medium text-foreground">{i.nome}</span>
              <span className="text-muted-foreground">
                {qtd(i.quantidade)} {rotuloUnidade(i.unidadeMedida)} × {brl(i.precoUnitario)} = <span className="font-semibold text-foreground">{brl(i.subtotal)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={cartao} aria-labelledby="titulo-pagamentos">
        <h2 id="titulo-pagamentos" className="mb-2 font-display text-xl font-semibold text-card-foreground">
          Pagamento
        </h2>
        <ul className="divide-y">
          {v.pagamentos.map((p, idx) => (
            <li key={idx} className="py-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium text-foreground">
                  {ROTULO_FORMA[p.forma]}
                  {p.parcelas.length > 1 && ` em ${p.parcelas.length}x`}
                </span>
                <span className="font-semibold text-foreground">{brl(p.valor)}</span>
              </div>
              {p.forma === "CREDITO_TROCA" ? (
                <p className="mt-1 text-xs text-muted-foreground">Abatido do valor já pago na venda original (não entra de novo no caixa).</p>
              ) : p.parcelas.length > 0 ? (
                <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {p.parcelas.map((pa) => (
                    <li key={pa.numero} className="flex flex-wrap justify-between gap-2">
                      <span>
                        Parcela {pa.numero}/{p.parcelas.length} · vence {dataBrasileira(pa.vencimento)}
                      </span>
                      <span>
                        {brl(pa.valor)} · {pa.status ? ROTULO_CONTA[pa.status] : "—"}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Entrou no caixa na data da venda.</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {v.movimentacoes.length > 0 && (
        <section className={cartao} aria-labelledby="titulo-estoque">
          <h2 id="titulo-estoque" className="mb-2 font-display text-xl font-semibold text-card-foreground">
            Movimentações de estoque
          </h2>
          <ul className="divide-y">
            {v.movimentacoes.map((m, idx) => (
              <li key={idx} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <Link href={`/estoque/${m.itemId}`} className="font-medium text-foreground underline-offset-2 hover:underline">
                  {m.nome}
                </Link>
                <span className="text-muted-foreground">
                  {m.tipo === "ENTRADA_ESTORNO" ? `+${qtd(m.quantidade)} (estorno)` : `−${qtd(m.quantidade)}`} · {qtd(m.saldoAnterior)} → {qtd(m.saldoPosterior)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
