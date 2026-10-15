import type { Metadata } from "next";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { FormularioItem } from "@/components/catalogo/formularios";
import { exigirPermissao } from "@/lib/auth/servidor";
import { catalogo } from "@/lib/db";

export const metadata: Metadata = { title: "Novo item" };

// Cadastro de Produto Físico ou Serviço (SPEC-006, UC5/UC6): Catálogo — criar.
export default async function NovoItem() {
  const membro = await exigirPermissao("catalogo", "criar");
  const opcoes = await catalogo(membro).opcoesDeMaterial();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CabecalhoDePagina voltar={{ href: "/catalogo", rotulo: "Catálogo" }} titulo="Novo item" descricao="A quantidade em estoque é lançada depois, na entrada de estoque." />
      <FormularioItem opcoes={opcoes} />
    </div>
  );
}
