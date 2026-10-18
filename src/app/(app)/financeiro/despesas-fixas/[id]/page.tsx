import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { reais, ROTULO_CATEGORIA } from "@/components/financeiro/exibicao";
import { BotaoAtivo, FormularioDespesa } from "@/components/financeiro/formularios";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { Selo } from "@/components/ui/selo";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
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
      <CabecalhoDePagina
        voltar={{ href: "/financeiro/despesas-fixas", rotulo: "Despesas fixas" }}
        titulo={
          <span className="inline-flex flex-wrap items-center gap-3 break-words">
            {d.descricao}
            {!d.ativo && <Selo tom="neutro">Desativada</Selo>}
          </span>
        }
        descricao={`${d.valorCentavos !== null ? reais(d.valorCentavos) : das !== null ? `${reais(das)} (valor oficial vigente)` : "Valor oficial"}, todo dia ${d.diaVencimento}, ${ROTULO_CATEGORIA[d.categoria].toLowerCase()}`}
      />

      {ehDas && (
        <AvisoDaPagina tom="info">
          O DAS do MEI é criado sozinho para negócios MEI. Cada mês usa o valor oficial vigente para a atividade do negócio; só o dia de vencimento pode ser alterado.
          {!d.ativo && " Está desativado porque o negócio não é mais MEI."}
        </AvisoDaPagina>
      )}

      {podeEditar ? (
        <>
          <Superficie aria-labelledby="titulo-alterar">
            <TituloDaSuperficie id="titulo-alterar" titulo={ehDas ? "Dia de vencimento" : "Alterar"} />
            <FormularioDespesa
              despesa={{ id: d.id, descricao: d.descricao, valorCentavos: d.valorCentavos, diaVencimento: d.diaVencimento, categoria: d.categoria, das: ehDas }}
            />
          </Superficie>
          {!ehDas && (
            <Superficie aria-labelledby="titulo-ativo">
              <TituloDaSuperficie
                id="titulo-ativo"
                titulo={d.ativo ? "Desativar" : "Reativar"}
                descricao={
                  d.ativo
                    ? "Desativada, a despesa deixa de gerar contas. As contas já geradas continuam em Contas."
                    : "Reativada, volta a gerar contas a partir deste mês (ou do próximo, se o dia de vencimento já passou)."
                }
              />
              <BotaoAtivo despesaId={d.id} ativo={d.ativo} />
            </Superficie>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Você pode consultar esta despesa, mas não alterá-la.</p>
      )}
    </div>
  );
}
