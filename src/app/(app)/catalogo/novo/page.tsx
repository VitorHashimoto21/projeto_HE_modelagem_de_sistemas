import type { Metadata } from "next";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { FormularioItem } from "@/components/catalogo/formularios";
import { exigirPermissao } from "@/lib/auth/servidor";
import { CATEGORIAS } from "@/lib/catalogo/validacao";
import { catalogo } from "@/lib/db";
import { retornoSeguro, rotuloDoRetorno } from "@/lib/estrutura/retorno";

export const metadata: Metadata = { title: "Novo item" };

// Cadastro de Produto Físico ou Serviço (SPEC-006, UC5/UC6): Catálogo — criar. Aberto por "Novo item"
// numa subcategoria (SPEC-020, 5.2), já vem com a categoria e a subcategoria, que ainda podem mudar.
export default async function NovoItem({ searchParams }: PageProps<"/catalogo/novo">) {
  const membro = await exigirPermissao("catalogo", "criar");
  const c = catalogo(membro);
  const [p, opcoes, subcategorias, sugestoesNcm, exigeNcm] = await Promise.all([
    searchParams,
    c.opcoesDeMaterial(),
    c.subcategorias(),
    c.sugestoesDeNcm(),
    c.emiteNotaDeProduto(),
  ]);
  const categoria = CATEGORIAS.find((cat) => cat === p.categoria);
  const subcategoria = categoria ? subcategorias.find((s) => s.id === p.subcategoria && s.categoria === categoria) : undefined;
  // Volta para onde a pessoa estava (a lista filtrada ou a tela Subcategorias) — correção da homologação T12.
  const voltar = retornoSeguro(p.voltar, "/catalogo");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CabecalhoDePagina voltar={{ href: voltar, rotulo: rotuloDoRetorno(voltar) }} titulo="Novo item" descricao="A quantidade em estoque é lançada depois, na entrada de estoque." />
      <FormularioItem
        opcoes={opcoes}
        subcategorias={subcategorias}
        voltar={voltar === "/catalogo" ? null : voltar}
        exigeNcm={exigeNcm}
        sugestoesNcm={sugestoesNcm}
        valores={categoria ? { categoria, subcategoriaId: subcategoria?.id ?? null } : undefined}
      />
    </div>
  );
}
