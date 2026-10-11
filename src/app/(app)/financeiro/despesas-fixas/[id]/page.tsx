import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { reais, ROTULO_CATEGORIA } from "@/components/financeiro/exibicao";
import { BotaoAtivo, FormularioDespesa } from "@/components/financeiro/formularios";
import { exigirPermissao } from "@/lib/auth/servidor";
import { financeiro } from "@/lib/db";
import { DespesaNaoEncontrada } from "@/lib/db/financeiro";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";

export const metadata: Metadata = { title: "Despesa fixa" };

// Despesa fixa (SPEC-009, 5.5 e 5.6): Financeiro — ver; alterar e ativar/desativar com
// "editar". O DAS do MEI só permite o dia de vencimento.
export default async function DespesaFixa({ params }: PageProps<"/financeiro/despesas-fixas/[id]">) {
  const membro = await exigirPermissao("financeiro", "ver");
  const { id } = await params;
  const f = financeiro(membro);
  const [d, das] = await Promise.all([
    f.detalharDespesa(id).catch((e) => {
      if (e instanceof DespesaNaoEncontrada) notFound();
      throw e;
    }),
    f.dasVigente(hoje()),
  ]);
  const ehDas = d.origem === "DAS_MEI";
  const podeEditar = pode(membro.permissoes, "financeiro", "editar");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href="/financeiro/despesas-fixas" className="font-medium text-primary underline-offset-2 hover:underline">
            ← Despesas fixas
          </Link>
        </p>
        <h1 className="font-display text-3xl font-semibold break-words text-foreground">{d.descricao}</h1>
        <p className="text-sm text-muted-foreground">
          {d.valorCentavos !== null ? reais(d.valorCentavos) : das !== null ? `${reais(das)} (valor oficial vigente)` : "Valor oficial"} · todo dia {d.diaVencimento} ·{" "}
          {ROTULO_CATEGORIA[d.categoria]}
          {!d.ativo && " · desativada"}
        </p>
      </div>

      {ehDas && (
        <p className="rounded-xl border bg-muted/50 px-4 py-3 text-sm text-foreground">
          O DAS do MEI é criado sozinho para negócios MEI. Cada mês usa o valor oficial vigente para a atividade do negócio; só o dia de vencimento pode ser alterado.
          {!d.ativo && " Está desativado porque o negócio não é mais MEI."}
        </p>
      )}

      {podeEditar ? (
        <>
          <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 font-display text-xl font-semibold text-card-foreground">{ehDas ? "Dia de vencimento" : "Alterar"}</h2>
            <FormularioDespesa
              despesa={{ id: d.id, descricao: d.descricao, valorCentavos: d.valorCentavos, diaVencimento: d.diaVencimento, categoria: d.categoria, das: ehDas }}
            />
          </section>
          {!ehDas && (
            <section className="rounded-2xl border bg-card p-6 shadow-sm">
              <h2 className="mb-1 font-display text-xl font-semibold text-card-foreground">{d.ativo ? "Desativar" : "Reativar"}</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                {d.ativo
                  ? "Desativada, a despesa deixa de gerar contas. As contas já geradas continuam em Contas."
                  : "Reativada, volta a gerar contas a partir deste mês (ou do próximo, se o dia de vencimento já passou)."}
              </p>
              <BotaoAtivo despesaId={d.id} ativo={d.ativo} />
            </section>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Você pode consultar esta despesa, mas não alterá-la.</p>
      )}
    </div>
  );
}
