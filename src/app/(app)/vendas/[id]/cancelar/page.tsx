import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { rotuloUnidade } from "@/components/catalogo/rotulos";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoBotao } from "@/components/ui/estilos";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
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
      <CabecalhoDePagina
        voltar={{ href: `/vendas/${p.id}`, rotulo: `Venda nº ${p.numero}` }}
        titulo={`Cancelar a venda nº ${p.numero}`}
        descricao="A venda continua no histórico como cancelada, com quem cancelou, quando e o motivo. Ela sai do faturamento e dos cálculos da Calculadora."
      />

      <Superficie aria-labelledby="titulo-efeitos">
        <TituloDaSuperficie id="titulo-efeitos" titulo="O que vai acontecer" />
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
      </Superficie>

      <Superficie aria-labelledby="titulo-cancelar" className="ring-1 ring-status-danger/30">
        <TituloDaSuperficie id="titulo-cancelar" titulo="Só cancelar" />
        <FormularioCancelamento vendaId={p.id} numero={p.numero} reembolsoCentavos={p.recebidoCentavos} />
      </Superficie>

      {podeTrocar && (
        <Superficie aria-labelledby="titulo-trocar">
          <TituloDaSuperficie
            id="titulo-trocar"
            titulo="Cancelar e trocar"
            descricao={`Escolha itens de até ${reais(p.valorTotalCentavos)}. O valor já recebido vira crédito de troca, e só a diferença é devolvida.`}
          />
          <Link href={`/vendas/${p.id}/trocar`} className={classeDoBotao("principal")}>
            <ArrowLeftRight aria-hidden="true" />
            Montar a troca
          </Link>
        </Superficie>
      )}
    </div>
  );
}
