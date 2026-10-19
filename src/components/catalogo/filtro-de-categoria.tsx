"use client";

import { useState } from "react";
import { classeDoCampo } from "@/components/ui/classes";
import type { CategoriaItem } from "@/generated/prisma/enums";
import { CATEGORIAS, ROTULO_CATEGORIA } from "@/lib/catalogo/validacao";
import { cn } from "@/lib/utils";
import type { OpcaoDeSubcategoria } from "./subcategorias";

// Filtro de categoria e subcategoria do Catálogo e do Estoque (SPEC-020, 5.4): a subcategoria aparece
// quando a categoria escolhida tem subcategorias e volta para "Todas" ao trocar a categoria. Fica num
// formulário GET; quem usa monta com uma `key` da URL, para recomeçar quando os filtros mudam.

const classe = cn(classeDoCampo(), "h-11 w-auto min-w-0 flex-1 basis-40 rounded-full py-0");

export function FiltroDeCategoria({
  categoria,
  subcategoria,
  subcategorias,
}: {
  categoria?: CategoriaItem;
  subcategoria?: string;
  subcategorias: OpcaoDeSubcategoria[];
}) {
  const [escolhida, setEscolhida] = useState<string>(categoria ?? "");
  const [sub, setSub] = useState(subcategoria ?? "");
  const daCategoria = subcategorias.filter((s) => s.categoria === escolhida);
  return (
    <>
      <label className="sr-only" htmlFor="categoria">
        Categoria
      </label>
      <select
        id="categoria"
        name="categoria"
        value={escolhida}
        onChange={(e) => {
          setEscolhida(e.target.value);
          setSub("");
        }}
        className={classe}
      >
        <option value="">Todas as categorias</option>
        {CATEGORIAS.map((c) => (
          <option key={c} value={c}>
            {ROTULO_CATEGORIA[c]}
          </option>
        ))}
      </select>
      {escolhida && daCategoria.length > 0 && (
        <>
          <label className="sr-only" htmlFor="subcategoria">
            Subcategoria
          </label>
          <select id="subcategoria" name="subcategoria" value={sub} onChange={(e) => setSub(e.target.value)} className={classe}>
            <option value="">Todas as subcategorias</option>
            {daCategoria.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
            <option value="sem">Sem subcategoria</option>
          </select>
        </>
      )}
    </>
  );
}
