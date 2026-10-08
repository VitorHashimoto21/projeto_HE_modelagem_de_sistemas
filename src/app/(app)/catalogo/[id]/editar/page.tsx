import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormularioItem } from "@/components/catalogo/formularios";
import { exigirPermissao } from "@/lib/auth/servidor";
import { catalogo } from "@/lib/db";
import { ItemNaoEncontrado } from "@/lib/db/catalogo";

export const metadata: Metadata = { title: "Editar item" };

// Edição do item (SPEC-006, 5.3): Catálogo — editar. O tipo e o preço não mudam aqui.
export default async function EditarItem({ params }: PageProps<"/catalogo/[id]/editar">) {
  const membro = await exigirPermissao("catalogo", "editar");
  const { id } = await params;
  const c = catalogo(membro);
  const item = await c.detalhar(id).catch((e) => {
    if (e instanceof ItemNaoEncontrado) notFound();
    throw e;
  });
  const disponiveis = await c.opcoesDeMaterial(id);
  // Materiais arquivados que já estão no serviço continuam na lista (OPEN-006).
  const jaVinculados = item.materiaisDoServico
    .filter((m) => !disponiveis.some((d) => d.id === m.materialId))
    .map((m) => ({ id: m.materialId, nome: `${m.nome} (arquivado)`, unidadeMedida: m.unidadeMedida, custo: m.custo }));

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="font-display text-3xl font-semibold break-words text-foreground">Editar {item.nome}</h1>
      <FormularioItem
        opcoes={[...disponiveis, ...jaVinculados]}
        valores={{
          id: item.id,
          tipo: item.tipo,
          nome: item.nome,
          categoria: item.categoria,
          unidadeMedida: item.unidadeMedida,
          custoBase: item.custoBase,
          comissaoPercentual: item.comissaoPercentual,
          estoqueMinimo: item.estoqueMinimo,
          materiais: item.materiaisDoServico.map((m) => ({ materialId: m.materialId, quantidade: m.quantidade })),
        }}
      />
    </div>
  );
}
