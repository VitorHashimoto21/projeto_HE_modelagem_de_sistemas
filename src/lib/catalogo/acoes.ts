"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acaoComPermissao } from "@/lib/auth/acao";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { catalogo } from "@/lib/db";
import * as servicos from "./servicos";
import type { EstadoDoItem, EstadoDoPreco } from "./servicos";

// Server Actions do catálogo (SPEC-006). A fábrica exige a permissão do módulo Catálogo
// (SPEC-005) antes do corpo; o negócio vem do contexto validado, nunca do formulário.

const deps = (m: ContextoDoMembro): servicos.DependenciasDoCatalogo => ({
  catalogo: catalogo({ negocioId: m.negocioId, usuarioId: m.usuarioId }),
  usuarioId: m.usuarioId,
});

const texto = (form: FormData, campo: string) => {
  const v = form.get(campo);
  return typeof v === "string" ? v : "";
};

export const acaoCriarItem = acaoComPermissao("catalogo", "criar", async (membro, _: EstadoDoItem, form: FormData) => {
  const estado = await servicos.criarItem(camposDoFormulario(form), deps(membro));
  if (estado.status === "salvo") {
    revalidatePath("/catalogo");
    redirect(`/catalogo/${estado.itemId}?criado=1`);
  }
  return estado;
});

export const acaoEditarItem = acaoComPermissao("catalogo", "editar", async (membro, _: EstadoDoItem, form: FormData) => {
  const id = texto(form, "itemId");
  const estado = await servicos.editarItem(id, camposDoFormulario(form), deps(membro));
  if (estado.status === "salvo") {
    revalidatePath("/catalogo", "layout");
    redirect(`/catalogo/${id}?salvo=1`);
  }
  return estado;
});

/** Preço manual (OPEN-004: Catálogo — editar). */
export const acaoDefinirPreco = acaoComPermissao("catalogo", "editar", async (membro, _: EstadoDoPreco, form: FormData) => {
  const id = texto(form, "itemId");
  const estado = await servicos.definirPreco(id, camposDoFormulario(form), deps(membro));
  if (estado.status === "salvo") revalidatePath("/catalogo", "layout");
  return estado;
});

/** Arquivar e reativar (OPEN-001: "excluir" na matriz significa arquivar). */
export const acaoArquivarItem = acaoComPermissao("catalogo", "excluir", async (membro, form: FormData) => {
  const id = texto(form, "itemId");
  const arquivar = texto(form, "arquivar") === "1";
  const r = await servicos.arquivarItem(id, arquivar, deps(membro));
  revalidatePath("/catalogo", "layout");
  // Só códigos na URL (nunca texto livre); a página lê do banco os serviços que usam o item.
  const resultado = r.ok ? (arquivar ? "arquivado" : "reativado") : r.codigo;
  redirect(`/catalogo/${encodeURIComponent(id)}?resultado=${resultado}`);
});
