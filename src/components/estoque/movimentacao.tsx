import { notFound } from "next/navigation";
import { rotuloUnidade } from "@/components/catalogo/rotulos";
import { FormularioMovimentacao } from "@/components/estoque/formularios";
import { MovimentacaoNaGaveta } from "@/components/estoque/formulario-na-gaveta";
import { quantidade } from "@/components/estoque/situacao";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { Superficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { estoque } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";

// Entrada e saída do estoque (SPEC-007, UC7/UC8) com URL própria (SPEC-016, OPEN-003): pela
// tela do produto abrem numa gaveta; pelo link direto ou ao recarregar, em página.

export type TipoDeMovimentacao = "entrada" | "saida";

const TITULO = { entrada: "Registrar entrada", saida: "Registrar saída manual" } as const;

async function carregar(id: string) {
  const membro = await exigirPermissao("estoque", "criar");
  const dia = hoje();
  const produto = await estoque(membro).situacaoDoProduto(id, dia);
  if (!produto) notFound();
  const unidade = rotuloUnidade(produto.unidadeMedida);
  return { produto, dia, unidade, descricao: `${produto.nome}: saldo de ${quantidade(produto.saldo)} ${unidade.toLowerCase()}.` };
}

export async function MovimentacaoEmPagina({ id, tipo }: { id: string; tipo: TipoDeMovimentacao }) {
  const { produto, dia, unidade, descricao } = await carregar(id);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <CabecalhoDePagina voltar={{ href: `/estoque/${produto.id}`, rotulo: produto.nome }} titulo={TITULO[tipo]} descricao={descricao} />
      <Superficie>
        <FormularioMovimentacao itemId={produto.id} tipo={tipo} hoje={dia} unidade={unidade} />
      </Superficie>
    </div>
  );
}

export async function MovimentacaoEmGaveta({ id, tipo }: { id: string; tipo: TipoDeMovimentacao }) {
  const { produto, dia, unidade, descricao } = await carregar(id);
  return <MovimentacaoNaGaveta titulo={TITULO[tipo]} descricao={descricao} itemId={produto.id} tipo={tipo} hoje={dia} unidade={unidade} />;
}
