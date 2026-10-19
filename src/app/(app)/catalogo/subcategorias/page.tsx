import type { Metadata } from "next";
import { GestaoDeSubcategorias } from "@/components/catalogo/gestao-de-subcategorias";
import { exigirPermissao } from "@/lib/auth/servidor";
import { podeCriarSubcategoria } from "@/lib/catalogo/validacao";
import { catalogo } from "@/lib/db";
import { pode } from "@/lib/dominio/permissoes";

export const metadata: Metadata = { title: "Subcategorias" };

// Subcategorias do negócio (SPEC-020, 5.3): Catálogo — ver. Criar com Catálogo — criar ou editar,
// renomear com editar e excluir com excluir (OPEN-005); no modo suporte, só a lista.
export default async function Subcategorias() {
  const membro = await exigirPermissao("catalogo", "ver");
  const subcategorias = await catalogo(membro).subcategorias();
  const somenteLeitura = membro.modoSuporte === true;
  return (
    <GestaoDeSubcategorias
      descricao="Organize o catálogo dentro de cada categoria. A margem sugerida continua a da categoria."
      subcategorias={subcategorias}
      podeCriar={!somenteLeitura && podeCriarSubcategoria(membro.permissoes)}
      podeRenomear={!somenteLeitura && pode(membro.permissoes, "catalogo", "editar")}
      podeExcluir={!somenteLeitura && pode(membro.permissoes, "catalogo", "excluir")}
      podeCriarItem={!somenteLeitura && pode(membro.permissoes, "catalogo", "criar")}
    />
  );
}
