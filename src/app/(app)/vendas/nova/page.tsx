import type { Metadata } from "next";
import Link from "next/link";
import { rotuloUnidade } from "@/components/catalogo/rotulos";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoBotao } from "@/components/ui/estilos";
import { FrenteDeCaixa } from "@/components/vendas/frente-de-caixa";
import { AvisoForaPorNcm } from "@/components/vendas/fora-por-ncm";
import { exigirPermissao } from "@/lib/auth/servidor";
import { vendas } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";

export const metadata: Metadata = { title: "Nova venda" };

// Frente de caixa (SPEC-008, 5.1): Vendas — criar. Itens não arquivados com preço oficial (RN23).
// SPEC-017: ajustar materiais com Vendas — criar; ajustar preço também exige Vendas — editar, e
// só quem ajusta preço recebe os custos (para o aviso de preço abaixo do custo).
export default async function NovaVenda() {
  const membro = await exigirPermissao("vendas", "criar");
  const c = vendas(membro);
  const [itens, clientes, foraPorNcm] = await Promise.all([c.itensVendaveis(), c.clientes(), c.foraDaVendaPorFaltaDeNcm()]);
  const podeAjustarPreco = pode(membro.permissoes, "vendas", "editar");

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        titulo="Nova venda"
        acoes={
          <Link href="/vendas" className={classeDoBotao("secundario", "sm")}>
            Ver vendas
          </Link>
        }
      />
      <AvisoForaPorNcm quantidade={foraPorNcm} podeCompletar={pode(membro.permissoes, "catalogo", "editar")} />
      {itens.length === 0 && foraPorNcm === 0 && (
        <AvisoDaPagina tom="atencao">
          Nenhum item com preço oficial. Defina o preço dos itens no{" "}
          <Link href="/catalogo" className="font-semibold underline underline-offset-2">
            Catálogo
          </Link>{" "}
          para poder vendê-los.
        </AvisoDaPagina>
      )}
      <FrenteDeCaixa
        hoje={hoje()}
        clientes={clientes}
        podeAjustarPreco={podeAjustarPreco}
        itens={itens.map((i) => ({
          id: i.id,
          nome: i.nome,
          tipo: i.tipo,
          unidade: rotuloUnidade(i.unidadeMedida),
          preco: i.preco,
          saldo: i.saldo,
          custoBase: podeAjustarPreco ? i.custoBase : null,
          materiais: i.materiais.map((m) => ({
            materialId: m.materialId,
            nome: m.nome,
            quantidade: m.quantidade,
            saldo: m.saldo,
            unidade: rotuloUnidade(m.unidadeMedida),
            ...(podeAjustarPreco ? { custo: m.custo } : {}),
          })),
        }))}
      />
    </div>
  );
}
