import type { Metadata } from "next";
import Link from "next/link";
import { rotuloUnidade } from "@/components/catalogo/rotulos";
import { FrenteDeCaixa } from "@/components/vendas/frente-de-caixa";
import { exigirPermissao } from "@/lib/auth/servidor";
import { vendas } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";

export const metadata: Metadata = { title: "Nova venda" };

// Frente de caixa (SPEC-008, 5.1): Vendas — criar. Itens não arquivados com preço oficial (RN23).
export default async function NovaVenda() {
  const membro = await exigirPermissao("vendas", "criar");
  const c = vendas(membro);
  const [itens, clientes] = await Promise.all([c.itensVendaveis(), c.clientes()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-foreground">Nova venda</h1>
        <Link href="/vendas" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
          Ver vendas
        </Link>
      </div>
      {itens.length === 0 && (
        <p className="rounded-xl border border-status-warn/30 bg-status-warn-bg px-4 py-3 text-sm text-status-warn">
          Nenhum item com preço oficial. Defina o preço dos itens no{" "}
          <Link href="/catalogo" className="font-semibold underline underline-offset-2">
            Catálogo
          </Link>{" "}
          para poder vendê-los.
        </p>
      )}
      <FrenteDeCaixa
        hoje={hoje()}
        clientes={clientes}
        itens={itens.map((i) => ({
          id: i.id,
          nome: i.nome,
          tipo: i.tipo,
          unidade: rotuloUnidade(i.unidadeMedida),
          preco: i.preco,
          saldo: i.saldo,
          materiais: i.materiais.map((m) => ({ materialId: m.materialId, nome: m.nome, quantidade: m.quantidade, saldo: m.saldo })),
        }))}
      />
    </div>
  );
}
