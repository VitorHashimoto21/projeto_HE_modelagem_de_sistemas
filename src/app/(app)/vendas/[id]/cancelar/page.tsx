import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { rotuloUnidade } from "@/components/catalogo/rotulos";
import { FormularioCancelamento } from "@/components/vendas/cancelamento";
import { qtd } from "@/components/vendas/rotulos";
import { exigirPermissao } from "@/lib/auth/servidor";
import { vendas } from "@/lib/db";
import { VendaNaoEncontrada } from "@/lib/db/vendas";
import { pode } from "@/lib/dominio/permissoes";
import { reaisDeCentavos as reais } from "@/lib/dominio/venda";

export const metadata: Metadata = { title: "Cancelar venda" };

// Cancelar venda (SPEC-011, 5.1): Vendas — excluir/cancelar (OPEN-005). Mostra antes o que vai
// acontecer: estoque que volta, parcelas canceladas e o valor a devolver.
export default async function CancelarVenda({ params }: PageProps<"/vendas/[id]/cancelar">) {
  const membro = await exigirPermissao("vendas", "excluir");
  const { id } = await params;
  const p = await vendas(membro)
    .previaDoCancelamento(id)
    .catch((e) => {
      if (e instanceof VendaNaoEncontrada) notFound();
      throw e;
    });
  if (p.status === "CANCELADA") redirect(`/vendas/${p.id}`);
  const podeTrocar = pode(membro.permissoes, "vendas", "criar");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href={`/vendas/${p.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
            ← Venda nº {p.numero}
          </Link>
        </p>
        <h1 className="font-display text-3xl font-semibold text-foreground">Cancelar a venda nº {p.numero}</h1>
        <p className="text-sm text-muted-foreground">
          A venda continua no histórico como cancelada, com quem cancelou, quando e o motivo. Ela sai do faturamento e dos cálculos da Calculadora.
        </p>
      </div>

      <section aria-labelledby="titulo-efeitos" className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 id="titulo-efeitos" className="mb-3 font-display text-xl font-semibold text-card-foreground">
          O que vai acontecer
        </h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-medium text-foreground">Estoque que volta</dt>
            <dd className="text-muted-foreground">
              {p.devolucoes.length === 0
                ? "Nada (a venda não baixou estoque)."
                : p.devolucoes.map((d) => `${d.nome}: +${qtd(d.quantidade)} ${rotuloUnidade(d.unidadeMedida).toLowerCase()}`).join(" · ")}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Parcelas do cartão canceladas</dt>
            <dd className="text-muted-foreground">
              {p.contasAbertas.quantidade === 0
                ? "Nenhuma em aberto."
                : `${p.contasAbertas.quantidade} em aberto (${reais(p.contasAbertas.restanteCentavos)} que não vão mais entrar).`}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">A devolver ao cliente</dt>
            <dd className="text-muted-foreground">
              {p.recebidoCentavos === 0
                ? "Nada — nenhum valor da venda chegou ao caixa."
                : `${reais(p.recebidoCentavos)} já recebidos${p.trocaDe ? " (inclui o crédito de troca da venda nº " + p.trocaDe.numero + ")" : ""}. Sai do caixa como reembolso.`}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="titulo-cancelar" className="rounded-2xl border border-status-danger/30 bg-card p-6 shadow-sm">
        <h2 id="titulo-cancelar" className="mb-4 font-display text-xl font-semibold text-card-foreground">
          Só cancelar
        </h2>
        <FormularioCancelamento vendaId={p.id} numero={p.numero} reembolsoCentavos={p.recebidoCentavos} />
      </section>

      {podeTrocar && (
        <section aria-labelledby="titulo-trocar" className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 id="titulo-trocar" className="mb-1 font-display text-xl font-semibold text-card-foreground">
            Cancelar e trocar
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Escolha itens de até {reais(p.valorTotalCentavos)}. O valor já recebido vira crédito de troca, e só a diferença é devolvida.
          </p>
          <Link href={`/vendas/${p.id}/trocar`} className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
            Montar a troca
          </Link>
        </section>
      )}
    </div>
  );
}
