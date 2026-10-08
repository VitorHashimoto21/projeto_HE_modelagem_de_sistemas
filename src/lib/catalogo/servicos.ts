import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { ItemNaoEncontrado, MaterialInvalido, NomeDuplicado, PrecoIgualAoAtual, type ConsultasDoCatalogo } from "@/lib/db/catalogo";
import { formatarReais, precoAbaixoDoCusto } from "@/lib/dominio/catalogo";
import { MENSAGENS_CATALOGO, validarItem, validarPreco } from "./validacao";

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
