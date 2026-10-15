import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { reais, ROTULO_CATEGORIA, SeloDaConta } from "@/components/financeiro/exibicao";
import { BotaoCancelarConta, FormularioConta, FormularioPagamento } from "@/components/financeiro/formularios";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoLink } from "@/components/ui/estilos";
import { Numero } from "@/components/ui/numero";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { financeiro } from "@/lib/db";
import { ContaNaoEncontrada } from "@/lib/db/financeiro";
import { dataBrasileira, hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";
import { conferirFinanceiro } from "@/lib/financeiro/conferencia";

export const metadata: Metadata = { title: "Conta" };

const dataBr = (dia: string) => dia.split("-").reverse().join("/");

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b py-3 last:border-b-0 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm font-medium break-words text-foreground sm:text-right">{children}</dd>
    </div>
  );
}

// Detalhe da conta (SPEC-009, 5.3): Financeiro — ver; pagamento com "criar"; edição da conta
// manual sem pagamento com "editar"; cancelamento com "excluir" (OPEN-003, OPEN-006).
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
  const quitado = c.totalCentavos > 0 ? Math.min(100, Math.round((c.pagoCentavos / c.totalCentavos) * 100)) : 0;

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
              </dl>
            </div>
            <div className="mt-5" aria-hidden="true">
              <div className="h-2.5 rounded-full bg-estrutura-foreground/15">
                <div className="h-full rounded-full bg-estrutura-foreground" style={{ width: `${quitado}%` }} />
              </div>
            </div>
            <p className="mt-2 text-xs text-estrutura-suave">
              {quitado}% {receber ? "recebido" : "pago"}, vence em {dataBr(c.vencimento)}
            </p>
          </Superficie>

          <Superficie aria-labelledby="titulo-dados">
            <TituloDaSuperficie id="titulo-dados" titulo="Dados da conta" />
            <dl>
              <Linha rotulo="Tipo">{receber ? "A receber" : "A pagar"}</Linha>
              <Linha rotulo="Vencimento">{dataBr(c.vencimento)}</Linha>
              <Linha rotulo="Categoria">{ROTULO_CATEGORIA[c.categoria]}</Linha>
              <Linha rotulo="Origem">
                {c.venda ? (
                  <Link href={`/vendas/${c.venda.id}`} className={classeDoLink()}>
                    Venda nº {c.venda.numero}
                  </Link>
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
                  <li key={l.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                    <span className="text-foreground">
                      {dataBrasileira(l.data)}, {l.registradoPor ?? "automático no vencimento"}
                    </span>
                    <span className="font-bold text-foreground tabular-nums">{reais(l.valorCentavos)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Superficie>

          {alteravel && (pode(membro.permissoes, "financeiro", "editar") || pode(membro.permissoes, "financeiro", "excluir")) && (
            <Superficie aria-labelledby="titulo-editar">
              <TituloDaSuperficie id="titulo-editar" titulo="Corrigir a conta" descricao="Enquanto não houver pagamento, a conta pode ser alterada ou cancelada." />
              <div className="space-y-6">
                {pode(membro.permissoes, "financeiro", "editar") && (
                  <FormularioConta
                    hoje={dia}
                    conta={{ id: c.id, tipo: c.tipo, descricao: c.descricao ?? "", categoria: c.categoria, totalCentavos: c.totalCentavos, vencimento: c.vencimento }}
                  />
                )}
                {pode(membro.permissoes, "financeiro", "excluir") && <BotaoCancelarConta contaId={c.id} />}
              </div>
            </Superficie>
          )}
        </div>

        {podeRegistrar && (
          <aside className="w-full lg:sticky lg:top-6 lg:w-96">
            <Superficie aria-labelledby="titulo-pagamento">
              <TituloDaSuperficie
                id="titulo-pagamento"
                titulo={receber ? "Registrar recebimento" : "Registrar pagamento"}
                descricao={`Pode ser parcial: o restante continua em aberto.${c.origem === "venda" ? " Parcelas do cartão são recebidas sozinhas no vencimento; registre aqui só se a maquininha antecipou." : ""}`}
              />
              <FormularioPagamento contaId={c.id} tipo={c.tipo} restanteCentavos={c.restanteCentavos} hoje={dia} />
            </Superficie>
          </aside>
        )}
      </div>
    </div>
  );
}
