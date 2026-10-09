import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoDoFinanceiro, reais, ROTULO_CATEGORIA } from "@/components/financeiro/exibicao";
import { FormularioDespesa } from "@/components/financeiro/formularios";
import { exigirPermissao } from "@/lib/auth/servidor";
import { financeiro } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";
import { conferirFinanceiro } from "@/lib/financeiro/conferencia";

export const metadata: Metadata = { title: "Despesas fixas" };

// Despesas fixas (SPEC-009, 5.5 e 5.6): Financeiro — ver; nova com "criar"; editar e
// ativar/desativar com "editar". O DAS do MEI aparece sozinho para negócio MEI.
export default async function DespesasFixas() {
  const membro = await exigirPermissao("financeiro", "ver");
  const dia = hoje();
  await conferirFinanceiro(membro);
  const f = financeiro(membro);
  const [despesas, das] = await Promise.all([f.listarDespesas(), f.dasVigente(dia)]);
  const ativas = despesas.filter((d) => d.ativo);
  const totalMensal = ativas.reduce((s, d) => s + (d.valorCentavos ?? (d.origem === "DAS_MEI" ? (das ?? 0) : 0)), 0);
  const podeEditar = pode(membro.permissoes, "financeiro", "editar");

  return (
    <div className="space-y-8">
      <CabecalhoDoFinanceiro atual="despesas" titulo="Despesas fixas" />

      <section className="rounded-2xl border bg-card p-6 shadow-sm" aria-label="Total mensal">
        <p className="text-sm text-muted-foreground">Total mensal das despesas ativas</p>
        <p className="mt-1 text-3xl font-semibold text-foreground tabular-nums">{reais(totalMensal)}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Cada despesa ativa gera uma conta a pagar por mês, com o vencimento no dia escolhido. Mudar o valor vale para os próximos meses.
        </p>
      </section>

      <section aria-labelledby="titulo-lista" className="rounded-2xl border bg-card shadow-sm">
        <h2 id="titulo-lista" className="px-6 pt-6 font-display text-xl font-semibold text-card-foreground">
          Cadastradas
        </h2>
        {despesas.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhuma despesa fixa ainda. Cadastre aluguel, internet, salários…</p>
        ) : (
          <ul className="mt-2 divide-y">
            {despesas.map((d) => {
              const conteudo = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium break-words ${d.ativo ? "text-foreground" : "text-muted-foreground"}`}>{d.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      Todo dia {d.diaVencimento} · {ROTULO_CATEGORIA[d.categoria]}
                      {d.origem === "DAS_MEI" && " · automático (MEI)"}
                      {!d.ativo && " · desativada"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    {d.valorCentavos !== null ? reais(d.valorCentavos) : das !== null ? reais(das) : "—"}
                    {d.origem === "DAS_MEI" && <span className="block text-right text-xs font-normal text-muted-foreground">valor oficial vigente</span>}
                  </p>
                </>
              );
              return (
                <li key={d.id}>
                  {podeEditar ? (
                    <Link href={`/financeiro/despesas-fixas/${d.id}`} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-6 py-4 transition-colors hover:bg-accent/50">
                      {conteudo}
                    </Link>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-6 py-4">{conteudo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {pode(membro.permissoes, "financeiro", "criar") && (
        <section aria-labelledby="titulo-nova" className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 id="titulo-nova" className="mb-4 font-display text-xl font-semibold text-card-foreground">
            Nova despesa fixa
          </h2>
          <FormularioDespesa />
        </section>
      )}
    </div>
  );
}
