import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { reais, ROTULO_CATEGORIA, SeloDaConta } from "@/components/financeiro/exibicao";
import { BotaoCancelarConta, BotaoEstornar, FormularioConta, FormularioPagamento, FormularioVinculo } from "@/components/financeiro/formularios";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoLink } from "@/components/ui/estilos";
import { Numero } from "@/components/ui/numero";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { financeiro } from "@/lib/db";
import { ContaNaoEncontrada } from "@/lib/db/financeiro";
import { podeVerCompras } from "@/lib/dominio/compras";
import { ROTULO_MOTIVO_DO_ACRESCIMO, ROTULO_MOTIVO_DO_DESCONTO, rotuloDaForma, SEM_OPCOES } from "@/lib/dominio/contas";
import { dataBrasileira, hoje } from "@/lib/dominio/datas";
import { corrige } from "@/lib/dominio/correcoes";
import { pode } from "@/lib/dominio/permissoes";
import { conferirFinanceiro } from "@/lib/financeiro/conferencia";
import { opcoesDoVinculo } from "@/lib/financeiro/opcoes";

export const metadata: Metadata = { title: "Conta" };

const dataBr = (dia: string) => dia.split("-").reverse().join("/");

/** SPEC-028 (5.5, item 2): o que o estorno desfaz e o restante da conta depois dele. */
function textoDoEstorno(l: { valorCentavos: number; descontoCentavos: number; acrescimoCentavos: number }, restanteCentavos: number): string {
  const desfeitos = [`o valor de ${reais(l.valorCentavos)}`];
  if (l.descontoCentavos > 0) desfeitos.push(`o desconto de ${reais(l.descontoCentavos)}`);
  if (l.acrescimoCentavos > 0) desfeitos.push(`o acréscimo de ${reais(l.acrescimoCentavos)}`);
  const restante = restanteCentavos + l.valorCentavos + l.descontoCentavos - l.acrescimoCentavos;
  const lista = desfeitos.length > 1 ? `${desfeitos.slice(0, -1).join(", ")} e ${desfeitos.at(-1)}` : desfeitos[0];
  return `Será gravado no caixa um lançamento contrário, e a conta perde ${lista} deste pagamento. O restante passa a ${reais(restante)}.`;
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b py-3 last:border-b-0 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm font-medium break-words text-foreground sm:text-right">{children}</dd>
    </div>
  );
}

// Detalhe da conta (SPEC-009, 5.3): Financeiro — ver; pagamento com "criar"; edição da conta
// manual sem pagamento com "editar"; cancelamento com "excluir" (OPEN-003, OPEN-006). SPEC-026:
// fornecedor ou cliente, nº do documento, forma de cada pagamento e a correção do vínculo (5.4).
export default async function Conta({ params, searchParams }: PageProps<"/financeiro/contas/[id]">) {
  const membro = await exigirPermissao("financeiro", "ver");
  const [{ id }, { nova }] = await Promise.all([params, searchParams]);
  const dia = hoje();
  await conferirFinanceiro(membro);
  const c = await financeiro(membro)
    .detalharConta(id, dia)
    .catch((e) => {
      if (e instanceof ContaNaoEncontrada) notFound();
      throw e;
    });
  const aberta = c.status === "ABERTA" || c.status === "PARCIAL";
  const alteravel = c.origem === "manual" && c.status === "ABERTA" && c.pagoCentavos === 0;
  const receber = c.tipo === "RECEBER";

  const podeRegistrar = aberta && pode(membro.permissoes, "financeiro", "criar");
  // SPEC-028 (5.5): estornar um pagamento exige Financeiro — excluir; o suporte nunca estorna (fora da lista de correções).
  const podeEstornar = c.estornavel && !membro.modoSuporte && pode(membro.permissoes, "financeiro", "excluir");
  const podeEditar = !membro.modoSuporte && pode(membro.permissoes, "financeiro", "editar");
  // SPEC-019 (5.4): o suporte com o Financeiro em "ver e corrigir" edita a conta manual, com o vínculo como está.
  const editaConta = pode(membro.permissoes, "financeiro", "editar") || corrige(membro, "financeiro.editarConta");
  const opcoes = podeEditar ? await opcoesDoVinculo(membro) : SEM_OPCOES;
  const pessoa = c.pessoa;
  // O link para o cadastro: fornecedor com Financeiro — ver (já exigido aqui); cliente só com Vendas — ver (5.2, item 3).
  const linkDaPessoa =
    pessoa && !membro.modoSuporte && (pessoa.papel === "fornecedor" ? `/financeiro/fornecedores/${pessoa.id}` : pode(membro.permissoes, "vendas", "ver") ? `/vendas/clientes/${pessoa.id}` : null);
  // SPEC-028: a barra mostra o que já foi abatido (pago + descontos − acréscimos).
  const abatido = c.status === "CANCELADA" ? 0 : c.totalCentavos - c.restanteCentavos;
  const comAjuste = c.descontoCentavos > 0 || c.acrescimoCentavos > 0;
  const quitado = c.totalCentavos > 0 ? Math.min(100, Math.max(0, Math.round((abatido / c.totalCentavos) * 100))) : 0;

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        voltar={{ href: `/financeiro/contas?tipo=${c.tipo}`, rotulo: `Contas ${receber ? "a receber" : "a pagar"}` }}
        titulo={<span className="break-words">{c.descricao ?? "Conta"}</span>}
        descricao={<SeloDaConta tipo={c.tipo} status={c.status} atrasada={c.atrasada} />}
      />

      {nova && <AvisoDaPagina tom="sucesso">Conta cadastrada.</AvisoDaPagina>}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Superficie tom="estrutura" aria-label="Valores">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
              <Numero rotulo="Restante" tamanho="xl" valor={<span className={c.atrasada ? "text-ambar" : undefined}>{reais(c.restanteCentavos)}</span>} />
              <dl className="grid grid-cols-2 gap-x-8 gap-y-2">
                <div>
                  <dt className="text-sm text-estrutura-suave">Valor total</dt>
                  <dd className="mt-0.5 text-lg font-extrabold tabular-nums">{reais(c.totalCentavos)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-estrutura-suave">{receber ? "Recebido" : "Pago"}</dt>
                  <dd className="mt-0.5 text-lg font-extrabold tabular-nums">{reais(c.pagoCentavos)}</dd>
                </div>
                {c.descontoCentavos > 0 && (
                  <div>
                    <dt className="text-sm text-estrutura-suave">Descontos</dt>
                    <dd className="mt-0.5 text-lg font-extrabold tabular-nums">{reais(c.descontoCentavos)}</dd>
                  </div>
                )}
                {c.acrescimoCentavos > 0 && (
                  <div>
                    <dt className="text-sm text-estrutura-suave">Acréscimos</dt>
                    <dd className="mt-0.5 text-lg font-extrabold tabular-nums">{reais(c.acrescimoCentavos)}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="mt-5" aria-hidden="true">
              <div className="h-2.5 rounded-full bg-estrutura-foreground/15">
                <div className="h-full rounded-full bg-estrutura-foreground" style={{ width: `${quitado}%` }} />
              </div>
            </div>
            <p className="mt-2 text-xs text-estrutura-suave">
              {quitado}% {comAjuste ? "abatido" : receber ? "recebido" : "pago"}, vence em {dataBr(c.vencimento)}
            </p>
          </Superficie>

          <Superficie aria-labelledby="titulo-dados">
            <TituloDaSuperficie id="titulo-dados" titulo="Dados da conta" />
            <dl>
              <Linha rotulo="Tipo">{receber ? "A receber" : "A pagar"}</Linha>
              <Linha rotulo={receber ? "Cliente" : "Fornecedor"}>
                {pessoa ? (
                  linkDaPessoa ? (
                    <Link href={linkDaPessoa} className={classeDoLink()}>
                      {pessoa.nome}
                    </Link>
                  ) : (
                    pessoa.nome
                  )
                ) : (
                  "—"
                )}
                {pessoa?.daVenda && <span className="block text-xs font-normal text-muted-foreground">Cliente da venda</span>}
              </Linha>
              <Linha rotulo="Nº do documento">{c.numeroDocumento ?? "—"}</Linha>
              <Linha rotulo="Vencimento">{dataBr(c.vencimento)}</Linha>
              <Linha rotulo="Categoria">{ROTULO_CATEGORIA[c.categoria]}</Linha>
              <Linha rotulo="Origem">
                {c.venda ? (
                  <Link href={`/vendas/${c.venda.id}`} className={classeDoLink()}>
                    Venda nº {c.venda.numero}
                  </Link>
                ) : c.compra ? (
                  // SPEC-027 (5.6): a conta da compra leva à compra, para quem pode vê-la.
                  podeVerCompras(membro) ? (
                    <Link href={`/compras/${c.compra.id}`} className={classeDoLink()}>
                      Compra nº {c.compra.numero}
                    </Link>
                  ) : (
                    `Compra nº ${c.compra.numero}`
                  )
                ) : c.despesa ? (
                  <Link href={`/financeiro/despesas-fixas/${c.despesa.id}`} className={classeDoLink()}>
                    Despesa fixa: {c.despesa.descricao}
                  </Link>
                ) : (
                  `Manual${c.criadaPor ? `, cadastrada por ${c.criadaPor}` : ""}`
                )}
              </Linha>
            </dl>
          </Superficie>

          <Superficie aria-labelledby="titulo-historico">
            <TituloDaSuperficie id="titulo-historico" titulo={receber ? "Recebimentos" : "Pagamentos"} />
            {c.lancamentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum registrado ainda.</p>
            ) : (
              <ol className="divide-y">
                {c.lancamentos.map((l) => (
                  <li key={l.id} className="py-3 text-sm">
                    <div className={`flex flex-wrap justify-between gap-2 ${l.estorno ? "text-muted-foreground line-through" : ""}`}>
                      <span className={l.estorno ? undefined : "text-foreground"}>
                        {dataBrasileira(l.data)} · {rotuloDaForma(l.forma)} · {l.registradoPor ?? "Recebido automaticamente"}
                      </span>
                      <span className={`font-bold tabular-nums ${l.estorno ? "" : "text-foreground"}`}>{reais(l.valorCentavos)}</span>
                    </div>
                    {/* SPEC-028 (5.4, 5.5): o pagamento estornado fica riscado, com quem estornou e quando. */}
                    {l.estorno && (
                      <p className="mt-1 text-muted-foreground">
                        Estornado em {dataBrasileira(l.estorno.data)}
                        {l.estorno.registradoPor && ` por ${l.estorno.registradoPor}`}
                      </p>
                    )}
                    {/* SPEC-028 (5.4): desconto e acréscimo do pagamento, com o motivo e a observação. */}
                    {(l.descontoCentavos > 0 || l.acrescimoCentavos > 0) && (
                      <p className="mt-1 text-muted-foreground">
                        {l.descontoCentavos > 0 && (
                          <span className="block">
                            Desconto de <span className="tabular-nums">{reais(l.descontoCentavos)}</span>
                            {l.motivoDesconto && ` · ${ROTULO_MOTIVO_DO_DESCONTO[l.motivoDesconto]}`}
                          </span>
                        )}
                        {l.acrescimoCentavos > 0 && (
                          <span className="block">
                            Acréscimo de <span className="tabular-nums">{reais(l.acrescimoCentavos)}</span>
                            {l.motivoAcrescimo && ` · ${ROTULO_MOTIVO_DO_ACRESCIMO[l.motivoAcrescimo]}`}
                          </span>
                        )}
                        {l.observacao && <span className="block break-words">{l.observacao}</span>}
                      </p>
                    )}
                    {podeEstornar && !l.estorno && (
                      <div className="mt-1">
                        <BotaoEstornar
                          lancamentoId={l.id}
                          descricao={`${receber ? "Recebimento" : "Pagamento"} de ${reais(l.valorCentavos)} em ${dataBrasileira(l.data)}`}
                          detalhe={textoDoEstorno(l, c.restanteCentavos)}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Superficie>

          {alteravel && (editaConta || pode(membro.permissoes, "financeiro", "excluir")) && (
            <Superficie aria-labelledby="titulo-editar">
              <TituloDaSuperficie
                id="titulo-editar"
                titulo="Corrigir a conta"
                descricao={`Enquanto não houver pagamento, a conta pode ser alterada${pode(membro.permissoes, "financeiro", "excluir") ? " ou cancelada" : ""}.`}
              />
              <div className="space-y-6">
                {editaConta && (
                  <FormularioConta
                    hoje={dia}
                    opcoes={opcoes}
                    vinculoComoEsta={membro.modoSuporte === true}
                    conta={{
                      id: c.id,
                      tipo: c.tipo,
                      descricao: c.descricao ?? "",
                      categoria: c.categoria,
                      totalCentavos: c.totalCentavos,
                      vencimento: c.vencimento,
                      pessoa: pessoa && { id: pessoa.id, nome: pessoa.nome },
                      numeroDocumento: c.numeroDocumento,
                    }}
                  />
                )}
                {pode(membro.permissoes, "financeiro", "excluir") && <BotaoCancelarConta contaId={c.id} />}
              </div>
            </Superficie>
          )}

          {/* SPEC-027 (5.7): a conta da compra é corrigida pela compra. */}
          {!alteravel && podeEditar && c.origem !== "compra" && (
            <Superficie aria-labelledby="titulo-vinculo">
              <TituloDaSuperficie
                id="titulo-vinculo"
                titulo={c.origem === "venda" ? "Corrigir o documento" : `Corrigir o ${receber ? "cliente" : "fornecedor"} e o documento`}
                descricao="Não muda valores, vencimento nem pagamentos."
              />
              <FormularioVinculo
                conta={{ id: c.id, tipo: c.tipo, pessoa: pessoa && { id: pessoa.id, nome: pessoa.nome }, daVenda: c.origem === "venda", numeroDocumento: c.numeroDocumento }}
                opcoes={opcoes}
              />
            </Superficie>
          )}
        </div>

        {podeRegistrar && (
          <aside className="w-full lg:sticky lg:top-6 lg:w-96">
            <Superficie aria-labelledby="titulo-pagamento">
              <TituloDaSuperficie
                id="titulo-pagamento"
                titulo={receber ? "Registrar recebimento" : "Registrar pagamento"}
                descricao={`Pode ser parcial: o restante continua em aberto. Use o desconto para a taxa da maquininha ou um abatimento, e o acréscimo para juros ou multa.${c.origem === "venda" ? " Parcelas do cartão são recebidas sozinhas no vencimento, já com a taxa da maquininha; registre aqui para informar o valor exato ou se a maquininha antecipou." : ""}`}
              />
              <FormularioPagamento contaId={c.id} tipo={c.tipo} restanteCentavos={c.restanteCentavos} hoje={dia} taxaSugerida={c.taxaSugerida} />
            </Superficie>
          </aside>
        )}
      </div>
    </div>
  );
}
