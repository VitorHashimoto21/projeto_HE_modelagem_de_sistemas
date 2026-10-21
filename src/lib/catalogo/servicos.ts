import type { CategoriaItem } from "@/generated/prisma/enums";
import type { ErrosDeCampo } from "@/lib/auth/validacao";
import {
  ItemNaoEncontrado,
  MaterialInvalido,
  NcmForaDaTabela,
  NcmObrigatorio,
  NomeDuplicado,
  PrecoIgualAoAtual,
  SubcategoriaInvalida,
  SubcategoriaNaoEncontrada,
  SubcategoriaRepetida,
  type ConsultasDoCatalogo,
  type NcmDoItem,
  type ResultadoDaBuscaNcm,
} from "@/lib/db/catalogo";
import { formatarReais, precoAbaixoDoCusto } from "@/lib/dominio/catalogo";
import { lerNcm } from "@/lib/dominio/ncm";
import {
  MENSAGENS_CATALOGO,
  ROTULO_CATEGORIA,
  subcategoriaDeOutraCategoria,
  validarItem,
  validarNomeDaSubcategoria,
  validarPreco,
  validarSubcategoria,
} from "./validacao";

/**
 * Fluxos do catálogo (SPEC-006, seção 5), independentes do Next.js: as Server Actions
 * (com a guarda de permissão da SPEC-005) só leem o formulário e chamam estas funções.
 */

export const MENSAGENS_FLUXO_CATALOGO = {
  nomeDuplicado: "Já existe um item ativo com esse nome. Use outro nome (ex.: com o tamanho ou a variação).",
  nomeDuplicadoAoReativar: "Já existe um item ativo com o mesmo nome. Renomeie um deles antes de reativar.",
  naoEncontrado: "Item não encontrado.",
  precoIgual: "Esse já é o preço atual.",
  falhaInterna: "Não foi possível concluir agora. Tente novamente.",
  precoAbaixoDoCusto: (custo: number) => `Este preço está abaixo do custo do item (${formatarReais(custo)}).`,
  subcategoriaRepetida: (nome: string, categoria: CategoriaItem) => `Já existe “${nome}” em ${ROTULO_CATEGORIA[categoria]}.`,
  subcategoriaNaoEncontrada: "Subcategoria não encontrada. Ela pode ter sido excluída.",
  semPermissaoSubcategoria: "Você não tem permissão para criar subcategorias.",
  semPermissaoNcm: "Você não tem permissão para cadastrar ou editar itens.",
} as const;

export type EstadoDoItem =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: ErrosDeCampo }
  | { status: "salvo"; itemId: string };

export type EstadoDoPreco =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: ErrosDeCampo }
  | { status: "salvo"; aviso?: string };

export const ITEM_INICIAL: EstadoDoItem = { status: "ocioso" };
export const PRECO_INICIAL: EstadoDoPreco = { status: "ocioso" };

export type DependenciasDoCatalogo = { catalogo: ConsultasDoCatalogo; usuarioId: string };

function traduzir(e: unknown): { mensagem?: string; erros?: ErrosDeCampo } {
  if (e instanceof NomeDuplicado) return { erros: { nome: MENSAGENS_FLUXO_CATALOGO.nomeDuplicado } };
  if (e instanceof MaterialInvalido) return { erros: { materiais: MENSAGENS_CATALOGO.materiaisInvalidos } };
  if (e instanceof ItemNaoEncontrado) return { mensagem: MENSAGENS_FLUXO_CATALOGO.naoEncontrado };
  if (e instanceof PrecoIgualAoAtual) return { erros: { preco: MENSAGENS_FLUXO_CATALOGO.precoIgual } };
  if (e instanceof SubcategoriaInvalida) return { erros: { subcategoriaId: subcategoriaDeOutraCategoria(e.categoria) } };
  if (e instanceof SubcategoriaRepetida) return { erros: { nome: MENSAGENS_FLUXO_CATALOGO.subcategoriaRepetida(e.nome, e.categoria) } };
  if (e instanceof SubcategoriaNaoEncontrada) return { mensagem: MENSAGENS_FLUXO_CATALOGO.subcategoriaNaoEncontrada };
  if (e instanceof NcmForaDaTabela) return { erros: { ncm: MENSAGENS_CATALOGO.ncmForaDaTabela } };
  if (e instanceof NcmObrigatorio) return { erros: { ncm: MENSAGENS_CATALOGO.ncmObrigatorio } };
  console.error("[catalogo] falha:", e instanceof Error ? e.name : "erro");
  return { mensagem: MENSAGENS_FLUXO_CATALOGO.falhaInterna };
}

/** Cadastrar Produto Físico ou Serviço (5.1, 5.2). */
export async function criarItem(campos: Record<string, string>, deps: DependenciasDoCatalogo): Promise<EstadoDoItem> {
  const v = validarItem(campos, { tipo: "criar" });
  if (!v.ok) return { status: "erro", erros: v.erros };
  try {
    return { status: "salvo", itemId: await deps.catalogo.criar(v.dados, deps.usuarioId) };
  } catch (e) {
    return { status: "erro", ...traduzir(e) };
  }
}

/** Editar (5.3): o tipo vem do item gravado, nunca do formulário (INV-002). */
export async function editarItem(id: string, campos: Record<string, string>, deps: DependenciasDoCatalogo): Promise<EstadoDoItem> {
  try {
    const tipoDoItem = await deps.catalogo.tipoDoItem(id);
    if (campos.tipo && campos.tipo !== tipoDoItem) {
      return { status: "erro", erros: { tipo: "O tipo do item não pode ser alterado." } };
    }
    const v = validarItem(campos, { tipo: "editar", tipoDoItem });
    if (!v.ok) return { status: "erro", erros: v.erros };
    await deps.catalogo.editar(id, v.dados);
    return { status: "salvo", itemId: id };
  } catch (e) {
    return { status: "erro", ...traduzir(e) };
  }
}

/** Preço oficial manual (5.4): grava e avisa se ficou abaixo do custo (CA-07). */
export async function definirPreco(id: string, campos: Record<string, string>, deps: DependenciasDoCatalogo): Promise<EstadoDoPreco> {
  const v = validarPreco(campos);
  if (!v.ok) return { status: "erro", erros: v.erros };
  try {
    const { custoTotal } = await deps.catalogo.definirPreco(id, v.dados, deps.usuarioId, "MANUAL");
    return precoAbaixoDoCusto(v.dados, custoTotal)
      ? { status: "salvo", aviso: MENSAGENS_FLUXO_CATALOGO.precoAbaixoDoCusto(custoTotal) }
      : { status: "salvo" };
  } catch (e) {
    return { status: "erro", ...traduzir(e) };
  }
}

/** Arquivar ou reativar (5.3, OPEN-001/OPEN-006). */
export async function arquivarItem(
  id: string,
  arquivar: boolean,
  deps: DependenciasDoCatalogo,
): Promise<{ ok: true; usadoEm: { id: string; nome: string }[] } | { ok: false; codigo: CodigoDoArquivamento }> {
  try {
    return { ok: true, ...(await deps.catalogo.arquivar(id, arquivar)) };
  } catch (e) {
    if (e instanceof NomeDuplicado) return { ok: false, codigo: "nome-duplicado" };
    if (e instanceof ItemNaoEncontrado) return { ok: false, codigo: "nao-encontrado" };
    traduzir(e);
    return { ok: false, codigo: "falha" };
  }
}

export type CodigoDoArquivamento = "nome-duplicado" | "nao-encontrado" | "falha";

/** Mensagens dos resultados de arquivar/reativar, pelo código da URL. */
export const MENSAGENS_DO_ARQUIVAMENTO: Record<string, { tipo: "ok" | "erro"; texto: string }> = {
  arquivado: { tipo: "ok", texto: "Item arquivado. Ele não aparece mais na lista nem nas escolhas de material." },
  reativado: { tipo: "ok", texto: "Item reativado." },
  "nome-duplicado": { tipo: "erro", texto: MENSAGENS_FLUXO_CATALOGO.nomeDuplicadoAoReativar },
  "nao-encontrado": { tipo: "erro", texto: MENSAGENS_FLUXO_CATALOGO.naoEncontrado },
  falha: { tipo: "erro", texto: MENSAGENS_FLUXO_CATALOGO.falhaInterna },
};

// Subcategorias do negócio (SPEC-020, 5.3 e 5.5).

export type SubcategoriaSalva = { id: string; categoria: CategoriaItem; nome: string };

export type EstadoDaSubcategoria =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: ErrosDeCampo }
  | { status: "salvo"; subcategoria: SubcategoriaSalva };

export type EstadoDaExclusao =
  | { status: "ocioso" }
  | { status: "erro"; mensagem: string }
  | { status: "excluida"; itensAfetados: number };

export const SUBCATEGORIA_INICIAL: EstadoDaSubcategoria = { status: "ocioso" };
export const EXCLUSAO_INICIAL: EstadoDaExclusao = { status: "ocioso" };

/** Nova subcategoria (no cadastro do item ou na tela Subcategorias). */
export async function criarSubcategoria(campos: Record<string, string>, deps: DependenciasDoCatalogo): Promise<EstadoDaSubcategoria> {
  const v = validarSubcategoria(campos);
  if (!v.ok) return { status: "erro", erros: v.erros };
  try {
    return { status: "salvo", subcategoria: await deps.catalogo.criarSubcategoria(v.dados) };
  } catch (e) {
    return { status: "erro", ...traduzir(e) };
  }
}

/** Renomear: a categoria não muda; o nome novo aparece em todos os itens. */
export async function renomearSubcategoria(id: string, campos: Record<string, string>, deps: DependenciasDoCatalogo): Promise<EstadoDaSubcategoria> {
  const v = validarNomeDaSubcategoria(campos.nome);
  if (!v.ok) return { status: "erro", erros: v.erros };
  try {
    return { status: "salvo", subcategoria: await deps.catalogo.renomearSubcategoria(id, v.dados) };
  } catch (e) {
    return { status: "erro", ...traduzir(e) };
  }
}

/** Excluir (OPEN-004): os itens que a usavam ficam sem subcategoria. */
export async function excluirSubcategoria(id: string, deps: DependenciasDoCatalogo): Promise<EstadoDaExclusao> {
  try {
    return { status: "excluida", ...(await deps.catalogo.excluirSubcategoria(id)) };
  } catch (e) {
    const t = traduzir(e);
    return { status: "erro", mensagem: t.mensagem ?? MENSAGENS_FLUXO_CATALOGO.falhaInterna };
  }
}

// NCM (SPEC-021, 5.2): busca na tabela vigente e conferência de um código digitado.

export type EstadoDaBuscaNcm = ResultadoDaBuscaNcm | { status: "erro"; mensagem: string };

export async function buscarNcm(texto: string, deps: DependenciasDoCatalogo): Promise<EstadoDaBuscaNcm> {
  try {
    return await deps.catalogo.buscarNcm(typeof texto === "string" ? texto.slice(0, 120) : "");
  } catch (e) {
    return { status: "erro", mensagem: traduzir(e).mensagem ?? MENSAGENS_FLUXO_CATALOGO.falhaInterna };
  }
}

export type EstadoDaConferenciaNcm =
  | { status: "ok"; ncm: NcmDoItem }
  | { status: "invalido"; mensagem: string }
  | { status: "nao-encontrado"; mensagem: string }
  | { status: "erro"; mensagem: string };

/** O código digitado (8 dígitos) existe na tabela? Devolve a descrição e se está vigente. */
export async function conferirNcm(texto: string, deps: DependenciasDoCatalogo): Promise<EstadoDaConferenciaNcm> {
  const codigo = lerNcm(typeof texto === "string" ? texto : "");
  if (!codigo) return { status: "invalido", mensagem: MENSAGENS_CATALOGO.ncmInvalido };
  try {
    const ncm = await deps.catalogo.conferirCodigoNcm(codigo);
    return ncm ? { status: "ok", ncm } : { status: "nao-encontrado", mensagem: MENSAGENS_CATALOGO.ncmForaDaTabela };
  } catch (e) {
    return { status: "erro", mensagem: traduzir(e).mensagem ?? MENSAGENS_FLUXO_CATALOGO.falhaInterna };
  }
}
