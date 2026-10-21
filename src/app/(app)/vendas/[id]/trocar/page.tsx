import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { rotuloUnidade } from "@/components/catalogo/rotulos";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { FrenteDeCaixa } from "@/components/vendas/frente-de-caixa";
import { AvisoForaPorNcm } from "@/components/vendas/fora-por-ncm";
import { ROTA_SEM_ACESSO } from "@/lib/auth/rotas";
import { exigirPermissao } from "@/lib/auth/servidor";
import { vendas } from "@/lib/db";
import { VendaNaoEncontrada } from "@/lib/db/vendas";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";

export const metadata: Metadata = { title: "Trocar venda" };

// Troca (SPEC-011, 5.2; OPEN-004): a frente de caixa em modo troca. Exige Vendas —
// excluir/cancelar e criar (OPEN-005).
export default async function TrocarVenda({ params }: PageProps<"/vendas/[id]/trocar">) {
  const membro = await exigirPermissao("vendas", "excluir");
  if (!pode(membro.permissoes, "vendas", "criar")) redirect(ROTA_SEM_ACESSO);
  const { id } = await params;
  const c = vendas(membro);
  const p = await c.previaDoCancelamento(id).catch((e) => {
    if (e instanceof VendaNaoEncontrada) notFound();
    throw e;
  });
  if (p.status === "CANCELADA") redirect(`/vendas/${p.id}`);
  const [itens, clientes, foraPorNcm] = await Promise.all([c.itensVendaveis(), c.clientes(), c.foraDaVendaPorFaltaDeNcm()]);
  // O estoque da venda original volta antes da baixa da troca: o aviso da tela já considera isso.
  const devolve = new Map(p.devolucoes.map((d) => [d.itemId, d.quantidade]));
  const comDevolucao = (itemId: string, saldo: number) => saldo + (devolve.get(itemId) ?? 0);

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        voltar={{ href: `/vendas/${p.id}/cancelar`, rotulo: `Cancelar a venda nº ${p.numero}` }}
        titulo={`Troca da venda nº ${p.numero}`}
        descricao={`Monte a venda com os itens novos. Ao confirmar, a venda nº ${p.numero} é cancelada e a troca é registrada como uma nova venda, tudo de uma vez.`}
      />
      <AvisoForaPorNcm quantidade={foraPorNcm} podeCompletar={pode(membro.permissoes, "catalogo", "editar")} />
      <FrenteDeCaixa
        hoje={hoje()}
        clientes={clientes}
        troca={{ vendaId: p.id, numero: p.numero, limiteCentavos: p.valorTotalCentavos, recebidoCentavos: p.recebidoCentavos }}
        itens={itens.map((i) => ({
          id: i.id,
          nome: i.nome,
          tipo: i.tipo,
          unidade: rotuloUnidade(i.unidadeMedida),
          preco: i.preco,
          saldo: i.saldo === null ? null : comDevolucao(i.id, i.saldo),
          materiais: i.materiais.map((m) => ({ materialId: m.materialId, nome: m.nome, quantidade: m.quantidade, saldo: comDevolucao(m.materialId, m.saldo) })),
        }))}
      />
    </div>
  );
}
