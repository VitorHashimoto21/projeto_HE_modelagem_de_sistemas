import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { reais, ROTULO_CATEGORIA, SeloDaConta } from "@/components/financeiro/exibicao";
import { BotaoCancelarConta, FormularioConta, FormularioPagamento } from "@/components/financeiro/formularios";
import { Aviso } from "@/components/acesso/campos";
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

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href={`/financeiro/contas?tipo=${c.tipo}`} className="font-medium text-primary underline-offset-2 hover:underline">
            ← Contas {receber ? "a receber" : "a pagar"}
          </Link>
        </p>
        <h1 className="font-display text-3xl font-semibold break-words text-foreground">{c.descricao ?? "Conta"}</h1>
        <SeloDaConta tipo={c.tipo} status={c.status} atrasada={c.atrasada} />
      </div>

      {nova && <Aviso tipo="sucesso">Conta cadastrada.</Aviso>}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Valores">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Valor total</p>
          <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{reais(c.totalCentavos)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">{receber ? "Recebido" : "Pago"}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{reais(c.pagoCentavos)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Restante</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${c.atrasada ? "text-status-danger" : "text-foreground"}`}>{reais(c.restanteCentavos)}</p>
        </div>
      </section>

      {aberta && pode(membro.permissoes, "financeiro", "criar") && (
        <section aria-labelledby="titulo-pagamento" className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 id="titulo-pagamento" className="mb-1 font-display text-xl font-semibold text-card-foreground">
            {receber ? "Registrar recebimento" : "Registrar pagamento"}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Pode ser parcial: o restante continua em aberto.
            {c.origem === "venda" && " Parcelas do cartão são recebidas sozinhas no vencimento; registre aqui só se a maquininha antecipou."}
          </p>
          <FormularioPagamento contaId={c.id} tipo={c.tipo} restanteCentavos={c.restanteCentavos} hoje={dia} />
        </section>
      )}

      <section aria-labelledby="titulo-dados" className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 id="titulo-dados" className="mb-2 font-display text-xl font-semibold text-card-foreground">
          Dados da conta
        </h2>
        <dl>
          <Linha rotulo="Tipo">{receber ? "A receber" : "A pagar"}</Linha>
          <Linha rotulo="Vencimento">{dataBr(c.vencimento)}</Linha>
          <Linha rotulo="Categoria">{ROTULO_CATEGORIA[c.categoria]}</Linha>
          <Linha rotulo="Origem">
            {c.venda ? (
              <Link href={`/vendas/${c.venda.id}`} className="text-primary underline-offset-2 hover:underline">
                Venda nº {c.venda.numero}
              </Link>
            ) : c.despesa ? (
              <Link href={`/financeiro/despesas-fixas/${c.despesa.id}`} className="text-primary underline-offset-2 hover:underline">
                Despesa fixa: {c.despesa.descricao}
              </Link>
            ) : (
              `Manual${c.criadaPor ? `, cadastrada por ${c.criadaPor}` : ""}`
            )}
          </Linha>
        </dl>
      </section>

      <section aria-labelledby="titulo-historico" className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 id="titulo-historico" className="mb-2 font-display text-xl font-semibold text-card-foreground">
          {receber ? "Recebimentos" : "Pagamentos"}
        </h2>
        {c.lancamentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registrado ainda.</p>
        ) : (
          <ol className="divide-y">
            {c.lancamentos.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span className="text-foreground">
                  {dataBrasileira(l.data)} · {l.registradoPor ?? "automático no vencimento"}
                </span>
                <span className="font-semibold text-foreground tabular-nums">{reais(l.valorCentavos)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {alteravel && (pode(membro.permissoes, "financeiro", "editar") || pode(membro.permissoes, "financeiro", "excluir")) && (
        <section aria-labelledby="titulo-editar" className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 id="titulo-editar" className="mb-1 font-display text-xl font-semibold text-card-foreground">
            Corrigir a conta
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">Enquanto não houver pagamento, a conta pode ser alterada ou cancelada.</p>
          <div className="space-y-6">
            {pode(membro.permissoes, "financeiro", "editar") && (
              <FormularioConta
                hoje={dia}
                conta={{ id: c.id, tipo: c.tipo, descricao: c.descricao ?? "", categoria: c.categoria, totalCentavos: c.totalCentavos, vencimento: c.vencimento }}
              />
            )}
            {pode(membro.permissoes, "financeiro", "excluir") && <BotaoCancelarConta contaId={c.id} />}
          </div>
        </section>
      )}
    </div>
  );
}
