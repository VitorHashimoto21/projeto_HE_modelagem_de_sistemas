import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { rotuloUnidade } from "@/components/catalogo/rotulos";
import { FrenteDeCaixa } from "@/components/vendas/frente-de-caixa";
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
  const [itens, clientes] = await Promise.all([c.itensVendaveis(), c.clientes()]);
  // O estoque da venda original volta antes da baixa da troca: o aviso da tela já considera isso.
  const devolve = new Map(p.devolucoes.map((d) => [d.itemId, d.quantidade]));
  const comDevolucao = (itemId: string, saldo: number) => saldo + (devolve.get(itemId) ?? 0);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href={`/vendas/${p.id}/cancelar`} className="font-medium text-primary underline-offset-2 hover:underline">
            ← Cancelar a venda nº {p.numero}
          </Link>
        </p>
        <h1 className="font-display text-3xl font-semibold text-foreground">Troca da venda nº {p.numero}</h1>
        <p className="text-sm text-muted-foreground">
          Monte o carrinho com os itens novos. Ao confirmar, a venda nº {p.numero} é cancelada e a troca é registrada como uma nova venda, tudo de uma vez.
        </p>
      </div>
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
