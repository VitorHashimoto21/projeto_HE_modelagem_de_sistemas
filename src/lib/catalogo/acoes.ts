"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acaoComPermissao } from "@/lib/auth/acao";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { catalogo } from "@/lib/db";
import { comRetorno, retornoSeguro } from "@/lib/estrutura/retorno";
import * as servicos from "./servicos";
import type { EstadoDaExclusao, EstadoDaSubcategoria, EstadoDoItem, EstadoDoPreco } from "./servicos";
import { podeCriarSubcategoria } from "./validacao";

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

/** O "voltar" da lista de origem segue para o detalhe (SPEC-020, correção da homologação T12). */
const retornoDo = (form: FormData) => retornoSeguro(texto(form, "voltar"), "") || null;

export const acaoCriarItem = acaoComPermissao("catalogo", "criar", async (membro, _: EstadoDoItem, form: FormData) => {
  const estado = await servicos.criarItem(camposDoFormulario(form), deps(membro));
  if (estado.status === "salvo") {
    revalidatePath("/catalogo");
    redirect(comRetorno(`/catalogo/${estado.itemId}?criado=1`, retornoDo(form)));
  }
  return estado;
});

export const acaoEditarItem = acaoComPermissao("catalogo", "editar", async (membro, _: EstadoDoItem, form: FormData) => {
  const id = texto(form, "itemId");
  const estado = await servicos.editarItem(id, camposDoFormulario(form), deps(membro));
  if (estado.status === "salvo") {
    revalidatePath("/catalogo", "layout");
    redirect(comRetorno(`/catalogo/${id}?salvo=1`, retornoDo(form)));
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
  redirect(comRetorno(`/catalogo/${encodeURIComponent(id)}?resultado=${resultado}`, retornoDo(form)));
});

// Subcategorias (SPEC-020, OPEN-005). Nenhuma é aceita no modo suporte (a fábrica recusa).

/**
 * Criar: quem cadastra ou edita itens (Catálogo — criar ou editar). A fábrica exige o mínimo
 * comum ("ver") e o corpo confere a combinação antes de qualquer gravação.
 */
export const acaoCriarSubcategoria = acaoComPermissao("catalogo", "ver", async (membro, _: EstadoDaSubcategoria, form: FormData) => {
  if (!podeCriarSubcategoria(membro.permissoes)) {
    return { status: "erro", mensagem: servicos.MENSAGENS_FLUXO_CATALOGO.semPermissaoSubcategoria } satisfies EstadoDaSubcategoria;
  }
  const estado = await servicos.criarSubcategoria(camposDoFormulario(form), deps(membro));
  if (estado.status === "salvo") revalidatePath("/catalogo", "layout");
  return estado;
});

export const acaoRenomearSubcategoria = acaoComPermissao("catalogo", "editar", async (membro, _: EstadoDaSubcategoria, form: FormData) => {
  const estado = await servicos.renomearSubcategoria(texto(form, "subcategoriaId"), camposDoFormulario(form), deps(membro));
  if (estado.status === "salvo") {
    revalidatePath("/catalogo", "layout");
    revalidatePath("/estoque", "layout");
  }
  return estado;
});

export const acaoExcluirSubcategoria = acaoComPermissao("catalogo", "excluir", async (membro, _: EstadoDaExclusao, form: FormData) => {
  const estado = await servicos.excluirSubcategoria(texto(form, "subcategoriaId"), deps(membro));
  if (estado.status === "excluida") {
    revalidatePath("/catalogo", "layout");
    revalidatePath("/estoque", "layout");
  }
  return estado;
});
