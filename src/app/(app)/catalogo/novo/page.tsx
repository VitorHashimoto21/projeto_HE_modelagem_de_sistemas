import type { Metadata } from "next";
import { FormularioItem } from "@/components/catalogo/formularios";
import { exigirPermissao } from "@/lib/auth/servidor";
import { catalogo } from "@/lib/db";

export const metadata: Metadata = { title: "Novo item" };

// Cadastro de Produto Físico ou Serviço (SPEC-006, UC5/UC6): Catálogo — criar.
export default async function NovoItem() {
  const membro = await exigirPermissao("catalogo", "criar");
  const opcoes = await catalogo(membro).opcoesDeMaterial();
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Novo item</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">A quantidade em estoque é lançada depois, na entrada de estoque.</p>
      </div>
      <FormularioItem opcoes={opcoes} />
    </div>
  );
}
