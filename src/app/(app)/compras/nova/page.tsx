import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { rotuloUnidade } from "@/components/catalogo/rotulos";
import { RegistrarCompra } from "@/components/compras/registrar-compra";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoBotao } from "@/components/ui/estilos";
import { ROTA_SEM_ACESSO } from "@/lib/auth/rotas";
import { exigirPermissao } from "@/lib/auth/servidor";
import { catalogo, compras } from "@/lib/db";
import { podeRegistrarCompra } from "@/lib/dominio/compras";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";
import { opcoesDoVinculo } from "@/lib/financeiro/opcoes";

export const metadata: Metadata = { title: "Registrar compra" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Registrar compra (SPEC-027, 5.1): Estoque — criar e Financeiro — criar (OPEN-007); o suporte nunca
// registra (RN37). Só produtos físicos ativos (OPEN-003); o fornecedor pode vir escolhido (?fornecedor=).
export default async function NovaCompra({ searchParams }: PageProps<"/compras/nova">) {
  const membro = await exigirPermissao("estoque", "criar");
  if (!podeRegistrarCompra(membro)) redirect(ROTA_SEM_ACESSO);
  const p = await searchParams;
  const podeCriarProduto = pode(membro.permissoes, "catalogo", "criar");
  const [produtos, opcoes, exigeNcm] = await Promise.all([compras(membro).produtosDisponiveis(), opcoesDoVinculo(membro), podeCriarProduto ? catalogo(membro).emiteNotaDeProduto() : false]);
  const pedido = typeof p.fornecedor === "string" && UUID.test(p.fornecedor) ? p.fornecedor : "";
  const fornecedorInicial = opcoes.fornecedores.some((f) => f.id === pedido) ? pedido : "";

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        titulo="Registrar compra"
        descricao="A entrada no estoque, as contas a pagar e o custo dos produtos, de uma vez."
        acoes={
          <Link href="/estoque" className={classeDoBotao("secundario", "sm")}>
            Ver o estoque
          </Link>
        }
      />
      {produtos.length === 0 && !podeCriarProduto && (
        <AvisoDaPagina tom="atencao">
          Nenhum produto físico ativo no catálogo. Cadastre os produtos no{" "}
          <Link href="/catalogo" className="font-semibold underline underline-offset-2">
            Catálogo
          </Link>{" "}
          para registrar a compra.
        </AvisoDaPagina>
      )}
      <RegistrarCompra
        hoje={hoje()}
        fornecedores={opcoes.fornecedores}
        podeCriarFornecedor={opcoes.podeCriarFornecedor}
        fornecedorInicial={fornecedorInicial}
        podeCriarProduto={podeCriarProduto}
        exigeNcm={exigeNcm}
        produtos={produtos.map((i) => ({ id: i.id, nome: i.nome, codigo: i.codigo, unidade: rotuloUnidade(i.unidadeMedida), custoCentavos: i.custoCentavos, saldo: i.saldo }))}
      />
    </div>
  );
}
