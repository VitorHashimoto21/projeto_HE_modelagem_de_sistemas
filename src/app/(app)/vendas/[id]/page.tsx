import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, RotateCcw } from "lucide-react";
import { rotuloUnidade } from "@/components/catalogo/rotulos";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoBotao, classeDoLink } from "@/components/ui/estilos";
import { Selo } from "@/components/ui/selo";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { brl, qtd, ROTULO_CONTA, ROTULO_FORMA } from "@/components/vendas/rotulos";
import { exigirPermissao } from "@/lib/auth/servidor";
import { vendas } from "@/lib/db";
import { VendaNaoEncontrada } from "@/lib/db/vendas";
import { dataBrasileira } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Venda" };

const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2.5 text-sm">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="text-right font-medium break-words text-foreground">{children}</dd>
    </div>
  );
}

// Detalhe da venda (SPEC-008, 5.4) e confirmação depois de registrar: Vendas — ver.
// SPEC-011: auditoria do cancelamento, ligação com a troca e o botão de cancelar (Vendas — excluir).
// Redesenhado na SPEC-016: resumo e ações à direita no computador, acima no celular.
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
  const cancelada = v.status === "CANCELADA";

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        voltar={{ href: "/vendas", rotulo: "Vendas" }}
        titulo={
          <span className="inline-flex flex-wrap items-center gap-3">
            Venda nº {v.numero}
            {cancelada && <Selo tom="perigo">Cancelada</Selo>}
          </span>
        }
        descricao={`${quando.format(v.data)}, por ${v.registradaPor}${v.cliente ? `, cliente ${v.cliente}` : ""}`}
      />

      {(busca.nova || busca.jaRegistrada) && (
        <AvisoDaPagina
          tom="sucesso"
          acao={
            podeVender && (
              <Link href="/vendas/nova" className={classeDoBotao("principal", "sm")}>
                <Plus aria-hidden="true" />
                Nova venda
              </Link>
            )
          }
        >
          <p className="font-semibold">{busca.jaRegistrada ? `Esta venda já tinha sido registrada (nº ${v.numero}).` : `Venda nº ${v.numero} registrada.`}</p>
        </AvisoDaPagina>
      )}
      {busca.cancelada && v.cancelamento && (
        <AvisoDaPagina tom="sucesso">
          Venda nº {v.numero} cancelada.{v.cancelamento.reembolso ? ` Reembolso de ${brl(v.cancelamento.reembolso.valor)} registrado no caixa.` : ""}
        </AvisoDaPagina>
      )}
      {busca.troca && v.trocaDe && (
        <AvisoDaPagina tom="sucesso">
          Troca registrada: a venda nº {v.trocaDe.numero} foi cancelada e esta é a venda nº {v.numero}.
        </AvisoDaPagina>
      )}

      <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {v.trocaDe && (
            <AvisoDaPagina tom="info">
              Troca da <Link href={`/vendas/${v.trocaDe.id}`}>venda nº {v.trocaDe.numero}</Link>, cancelada.
            </AvisoDaPagina>
          )}

          <Superficie aria-labelledby="titulo-itens">
            <TituloDaSuperficie id="titulo-itens" titulo="Itens" />
            <ul className="divide-y">
              {v.itensVenda.map((i, idx) => (
                <li key={`${i.itemId}-${idx}`} className="py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="min-w-0 font-semibold text-foreground">{i.nome}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {qtd(i.quantidade)} {rotuloUnidade(i.unidadeMedida).toLowerCase()} × {brl(i.precoUnitario)} = <span className="font-bold text-foreground">{brl(i.subtotal)}</span>
                    </span>
                  </div>
                  {/* SPEC-017: ajustes registrados na linha (INV-002) */}
                  {i.precoOficial !== null && (
                    <p className="mt-1 text-xs text-status-warn">
                      Preço ajustado (catálogo: {brl(i.precoOficial)}). Motivo: {i.motivoAjustePreco}.
                    </p>
                  )}
                  {i.materiaisAjustados && <p className="mt-1 text-xs text-status-warn">Materiais ajustados nesta venda (ver as movimentações de estoque).</p>}
                </li>
              ))}
            </ul>
          </Superficie>

          <Superficie aria-labelledby="titulo-pagamentos">
            <TituloDaSuperficie id="titulo-pagamentos" titulo="Pagamento" />
            <ul className="divide-y">
              {v.pagamentos.map((p, idx) => (
                <li key={idx} className="py-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      {ROTULO_FORMA[p.forma]}
                      {p.parcelas.length > 1 && ` em ${p.parcelas.length}x`}
                    </span>
                    <span className="font-bold text-foreground tabular-nums">{brl(p.valor)}</span>
                  </div>
                  {p.forma === "CREDITO_TROCA" ? (
                    <p className="mt-1 text-xs text-muted-foreground">Abatido do valor já pago na venda original (não entra de novo no caixa).</p>
                  ) : p.parcelas.length > 0 ? (
                    <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                      {p.parcelas.map((pa) => (
                        <li key={pa.numero} className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            Parcela {pa.numero}/{p.parcelas.length}, vence {dataBrasileira(pa.vencimento)}
                          </span>
                          <span className="inline-flex items-center gap-2 tabular-nums">
                            {brl(pa.valor)}
                            <Selo tom={pa.status === "QUITADA" ? "ok" : pa.status === "CANCELADA" ? "neutro" : "info"} semIcone>
                              {pa.status ? ROTULO_CONTA[pa.status] : "—"}
                            </Selo>
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
          </Superficie>

          {v.movimentacoes.length > 0 && (
            <Superficie aria-labelledby="titulo-estoque">
              <TituloDaSuperficie id="titulo-estoque" titulo="Movimentações de estoque" />
              <ul className="divide-y">
                {v.movimentacoes.map((m, idx) => (
                  <li key={idx} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                    <Link href={`/estoque/${m.itemId}`} className={classeDoLink("font-medium")}>
                      {m.nome}
                    </Link>
                    <span className="text-muted-foreground tabular-nums">
                      {m.tipo === "ENTRADA_ESTORNO" ? `+${qtd(m.quantidade)} (estorno)` : `−${qtd(m.quantidade)}`}, {qtd(m.saldoAnterior)} → {qtd(m.saldoPosterior)}
                    </span>
                  </li>
                ))}
              </ul>
            </Superficie>
          )}
        </div>

        <aside className="flex w-full flex-col gap-6 lg:sticky lg:top-6 lg:w-80">
          <Superficie tom={cancelada ? "cartao" : "estrutura"} aria-label="Resumo da venda">
            <p className={cn("text-sm", cancelada ? "text-muted-foreground" : "text-estrutura-suave")}>Total</p>
            <p className={cn("mt-1 text-[34px] leading-none font-extrabold tracking-tight tabular-nums", cancelada && "text-muted-foreground line-through")}>{brl(v.valorTotal)}</p>
            <p className={cn("mt-2 text-sm", cancelada ? "text-muted-foreground" : "text-estrutura-suave")}>
              {v.itensVenda.length} {v.itensVenda.length === 1 ? "item" : "itens"}, {v.pagamentos.map((p) => ROTULO_FORMA[p.forma]).join(" + ")}
            </p>
            {podeCancelar && (
              <Link href={`/vendas/${v.id}/cancelar`} className={classeDoBotao("na-estrutura", "md", "mt-5 w-full")}>
                <RotateCcw aria-hidden="true" />
                Cancelar venda
              </Link>
            )}
          </Superficie>

          {v.cancelamento && (
            <Superficie tom="perigo" aria-labelledby="titulo-cancelamento">
              <TituloDaSuperficie id="titulo-cancelamento" titulo="Cancelamento" />
              <dl className="divide-y divide-status-danger/15">
                <Linha rotulo="Quando e por quem">
                  {quando.format(v.cancelamento.em)}, {v.cancelamento.por}
                </Linha>
                <Linha rotulo="Motivo">{v.cancelamento.motivo}</Linha>
                <Linha rotulo="Reembolso">
                  {v.cancelamento.reembolso ? (
                    <>
                      <span className="text-status-danger">− {brl(v.cancelamento.reembolso.valor)}</span>, {v.cancelamento.reembolso.descricao.split(" — ").pop()}
                    </>
                  ) : (
                    "Nenhum"
                  )}
                </Linha>
                {v.trocadaPor && (
                  <Linha rotulo="Trocada pela">
                    <Link href={`/vendas/${v.trocadaPor.id}`} className={classeDoLink()}>
                      venda nº {v.trocadaPor.numero}
                    </Link>
                  </Linha>
                )}
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">O estoque voltou, as parcelas em aberto foram canceladas e a venda saiu do faturamento.</p>
            </Superficie>
          )}
        </aside>
      </div>
    </div>
  );
}
