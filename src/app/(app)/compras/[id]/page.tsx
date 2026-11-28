import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { rotuloUnidade } from "@/components/catalogo/rotulos";
import { reais, SeloDaConta } from "@/components/financeiro/exibicao";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoLink } from "@/components/ui/estilos";
import { Selo, type TomDoSelo } from "@/components/ui/selo";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { CorrigirCompra } from "@/components/compras/corrigir-compra";
import { qtd } from "@/components/vendas/rotulos";
import { ROTA_SEM_ACESSO } from "@/lib/auth/rotas";
import { exigirPermissao } from "@/lib/auth/servidor";
import { compras, fornecedores } from "@/lib/db";
import { CompraNaoEncontrada } from "@/lib/db/compras";
import { CONDICOES_DE_COMPRA, ESCOLHAS_DE_CUSTO, podeCorrigirCompra, podeVerCompras } from "@/lib/dominio/compras";
import { rotuloDaForma } from "@/lib/dominio/contas";
import { hoje } from "@/lib/dominio/datas";
import { PAGAMENTOS_DA_COMPRA, type PagamentoDaCompra } from "@/lib/dominio/lista-de-compras";
import { pode } from "@/lib/dominio/permissoes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Compra" };

const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const diaDoPagamento = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
const dataBr = (dia: string) => dia.split("-").reverse().join("/");
const TOM_DO_PAGAMENTO: Record<PagamentoDaCompra, TomDoSelo> = { A_PAGAR: "atencao", PARCIAL: "info", PAGA: "ok" };

function Linha({ rotulo, children, destaque }: { rotulo: string; children: React.ReactNode; destaque?: boolean }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className={cn("text-right break-words tabular-nums", destaque ? "font-bold text-foreground" : "font-medium text-foreground")}>{children}</dd>
    </div>
  );
}

// Detalhe da compra (SPEC-027, 5.6): Estoque — ver e Financeiro — ver (OPEN-007). Os produtos com os
// custos, as contas com os pagamentos, as entradas no estoque, quem registrou e o cancelamento. A
// correção do fornecedor e do nº do documento (5.7), com Financeiro — editar; nunca no modo suporte.
export default async function DetalheDaCompra({ params }: PageProps<"/compras/[id]">) {
  const membro = await exigirPermissao("estoque", "ver");
  if (!podeVerCompras(membro)) redirect(ROTA_SEM_ACESSO);
  const { id } = await params;
  const c = await compras(membro)
    .detalhar(id, hoje())
    .catch((e) => {
      if (e instanceof CompraNaoEncontrada) notFound();
      throw e;
    });
  const cancelada = c.situacao === "CANCELADA";
  const corrige = podeCorrigirCompra(membro);
  const opcoesDeFornecedor = corrige ? await fornecedores(membro).opcoes() : [];
  // CA-04: o custo não muda o preço sozinho; o detalhe leva à Calculadora (só para quem a vê).
  const custosNovos = cancelada || !pode(membro.permissoes, "calculadora", "ver") ? [] : c.produtos.filter((p) => p.custoNovoCentavos !== p.custoAnteriorCentavos);
  const documento = c.semNotaFiscal ? "Sem nota fiscal" : `Doc. ${c.numeroDocumento}`;

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        voltar={{ href: "/compras", rotulo: "Compras" }}
        titulo={
          <span className="inline-flex flex-wrap items-center gap-3">
            Compra nº {c.numero}
            {cancelada && <Selo tom="perigo">Cancelada</Selo>}
          </span>
        }
        descricao={`${dataBr(c.data)}, ${c.fornecedor.nome}, ${documento}`}
      />

      {custosNovos.length > 0 && (
        <AvisoDaPagina tom="info">
          {custosNovos.length === 1 ? "O custo deste produto mudou com a compra" : "O custo destes produtos mudou com a compra"}. O preço não muda sozinho; revise o preço na Calculadora:{" "}
          {custosNovos.map((p, i) => (
            <span key={p.itemId}>
              {i > 0 && ", "}
              <Link href={`/calculadora?item=${p.itemId}`}>{p.nome}</Link>
            </span>
          ))}
          .
        </AvisoDaPagina>
      )}

      <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Superficie aria-labelledby="titulo-produtos">
            <TituloDaSuperficie id="titulo-produtos" titulo="Produtos" />
            <ul className="divide-y">
              {c.produtos.map((p) => (
                <li key={p.itemId} className="space-y-1 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="min-w-0 font-semibold text-foreground">
                      {p.codigo && `${p.codigo} · `}
                      {p.nome}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {qtd(p.quantidade)} {rotuloUnidade(p.unidadeMedida).toLowerCase()} × {reais(p.custoUnitarioCentavos)} = <span className="font-bold text-foreground">{reais(p.totalLinhaCentavos)}</span>
                    </span>
                  </div>
                  {p.custoComRateioCentavos !== p.custoUnitarioCentavos && (
                    <p className="text-xs text-muted-foreground tabular-nums">Com frete, outras despesas e desconto: {reais(p.custoComRateioCentavos)} por unidade</p>
                  )}
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {p.custoNovoCentavos === p.custoAnteriorCentavos
                      ? `Custo: ${reais(p.custoAnteriorCentavos)} (não mudou)`
                      : `Custo: ${reais(p.custoAnteriorCentavos)} → ${reais(p.custoNovoCentavos)} (${ESCOLHAS_DE_CUSTO[p.escolhaCusto].toLowerCase()})`}
                  </p>
                </li>
              ))}
            </ul>
          </Superficie>

          <Superficie aria-labelledby="titulo-contas">
            <TituloDaSuperficie id="titulo-contas" titulo="Contas a pagar" />
            <ul className="divide-y">
              {c.contas.map((k) => (
                <li key={k.id} className="space-y-1.5 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <Link href={`/financeiro/contas/${k.id}`} className={classeDoLink("font-semibold")}>
                      {k.descricao ?? "Conta"}
                    </Link>
                    <span className="font-bold text-foreground tabular-nums">{reais(k.totalCentavos)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      Vence em {dataBr(k.vencimento)}
                      {k.status === "PARCIAL" && <span className="tabular-nums">, restam {reais(k.restanteCentavos)}</span>}
                    </span>
                    <SeloDaConta tipo="PAGAR" status={k.status} atrasada={k.atrasada} />
                  </div>
                  {k.pagamentos.length > 0 && (
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {k.pagamentos.map((g, i) => (
                        <li key={i} className={cn("tabular-nums", g.estornado && "line-through")}>
                          Pago em {diaDoPagamento.format(g.data)}, {reais(g.valorCentavos)}, {rotuloDaForma(g.forma).toLowerCase()}
                          {g.estornado && <span className="no-underline"> (estornado)</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </Superficie>

          <Superficie aria-labelledby="titulo-entradas">
            <TituloDaSuperficie id="titulo-entradas" titulo="Entradas no estoque" />
            <ul className="divide-y">
              {c.entradas.map((m, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                  <Link href={`/estoque/${m.itemId}`} className={classeDoLink("font-medium")}>
                    {m.nome}
                  </Link>
                  <span className="text-muted-foreground tabular-nums">
                    {m.tipo === "ENTRADA" ? `+${qtd(m.quantidade)}` : `−${qtd(m.quantidade)} (estorno)`}, {qtd(m.saldoAnterior)} → {qtd(m.saldoPosterior)}
                  </span>
                </li>
              ))}
            </ul>
          </Superficie>

          {corrige && (
            <Superficie aria-labelledby="titulo-correcao">
              <TituloDaSuperficie id="titulo-correcao" titulo="Corrigir o fornecedor e o documento" descricao="Vale também para as contas da compra. Não muda valores, produtos nem pagamentos." />
              <CorrigirCompra
                compra={{ id: c.id, fornecedor: { id: c.fornecedorId, nome: c.fornecedor.nome }, numeroDocumento: c.numeroDocumento, semNotaFiscal: c.semNotaFiscal }}
                fornecedores={opcoesDeFornecedor}
              />
            </Superficie>
          )}
        </div>

        <aside className="flex w-full flex-col gap-6 lg:sticky lg:top-6 lg:w-80">
          <Superficie tom={cancelada ? "cartao" : "estrutura"} aria-label="Resumo da compra">
            <p className={cn("text-sm", cancelada ? "text-muted-foreground" : "text-estrutura-suave")}>Total</p>
            <p className={cn("mt-1 text-[34px] leading-none font-extrabold tracking-tight tabular-nums", cancelada && "text-muted-foreground line-through")}>{reais(c.totalCentavos)}</p>
            <p className={cn("mt-2 text-sm", cancelada ? "text-muted-foreground" : "text-estrutura-suave")}>
              {c.produtos.length} {c.produtos.length === 1 ? "produto" : "produtos"}, {CONDICOES_DE_COMPRA[c.condicao].toLowerCase()}
              {c.entradaCentavos !== null && ` com entrada de ${reais(c.entradaCentavos)}`}
            </p>
            {c.pagamento && (
              <div className="mt-3">
                <Selo tom={TOM_DO_PAGAMENTO[c.pagamento]}>{PAGAMENTOS_DA_COMPRA[c.pagamento]}</Selo>
              </div>
            )}
          </Superficie>

          <Superficie aria-labelledby="titulo-valores">
            <TituloDaSuperficie id="titulo-valores" titulo="Valores" />
            <dl className="divide-y">
              <Linha rotulo="Produtos">{reais(c.valorProdutosCentavos)}</Linha>
              {c.freteCentavos > 0 && <Linha rotulo="Frete">{reais(c.freteCentavos)}</Linha>}
              {c.outrasDespesasCentavos > 0 && <Linha rotulo="Outras despesas">{reais(c.outrasDespesasCentavos)}</Linha>}
              {c.descontoCentavos > 0 && <Linha rotulo="Desconto">− {reais(c.descontoCentavos)}</Linha>}
              <Linha rotulo="Total" destaque>
                {reais(c.totalCentavos)}
              </Linha>
              {!cancelada && (
                <>
                  <Linha rotulo="Pago">{reais(c.pagoCentavos)}</Linha>
                  <Linha rotulo="Em aberto">{reais(c.emAbertoCentavos)}</Linha>
                </>
              )}
            </dl>
          </Superficie>

          <Superficie aria-labelledby="titulo-registro">
            <TituloDaSuperficie id="titulo-registro" titulo="Registro" />
            <dl className="divide-y">
              <Linha rotulo="Fornecedor">
                {c.fornecedor.id ? (
                  <Link href={`/financeiro/fornecedores/${c.fornecedor.id}`} className={classeDoLink()}>
                    {c.fornecedor.nome}
                  </Link>
                ) : (
                  c.fornecedor.nome
                )}
              </Linha>
              <Linha rotulo="Documento">{c.semNotaFiscal ? "Sem nota fiscal" : c.numeroDocumento}</Linha>
              <Linha rotulo="Registrada">
                {quando.format(c.registradaEm)}, {c.registradaPor}
              </Linha>
              {c.observacao && <Linha rotulo="Observação">{c.observacao}</Linha>}
            </dl>
          </Superficie>

          {c.cancelamento && (
            <Superficie tom="perigo" aria-labelledby="titulo-cancelamento">
              <TituloDaSuperficie id="titulo-cancelamento" titulo="Cancelamento" />
              <dl className="divide-y divide-status-danger/15">
                <Linha rotulo="Quando e por quem">
                  {quando.format(c.cancelamento.em)}
                  {c.cancelamento.por && `, ${c.cancelamento.por}`}
                </Linha>
                <Linha rotulo="Motivo">{c.cancelamento.motivo}</Linha>
              </dl>
            </Superficie>
          )}
        </aside>
      </div>
    </div>
  );
}
