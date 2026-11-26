import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { criarItem, type DependenciasDoCatalogo, type EstadoDoItem } from "@/lib/catalogo/servicos";
import { DocumentoDaCompraRepetido, ProdutoIndisponivel, ValoresDaCompraInvalidos, type ConsultasDeCompras, type ResumoDaCompra } from "@/lib/db/compras";
import { FornecedorNaoEncontrado } from "@/lib/db/fornecedores";
import { MENSAGENS_COMPRA, validarCompra, type DadosDaCompra } from "@/lib/dominio/compras";

/**
 * Fluxos da compra (SPEC-027, 5.1), independentes do Next.js: as Server Actions (com a guarda de
 * permissão) só leem o formulário e chamam estas funções. A compra chega como JSON no campo "compra".
 */

export const MENSAGENS_FLUXO_COMPRA = {
  falhaInterna: "Não foi possível registrar a compra agora. Nada foi gravado; tente novamente.",
  registrada: (numero: number) => `Compra nº ${numero} registrada.`,
  jaRegistrada: (numero: number) => `Esta compra já tinha sido registrada como a compra nº ${numero}.`,
} as const;

export type ProdutoComCustoNovo = { itemId: string; nome: string };

export type EstadoDaCompra =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: ErrosDeCampo }
  | { status: "revisada"; resumo: ResumoDaCompra }
  | { status: "registrada"; compraId: string; numero: number; jaExistia: boolean; custosNovos: ProdutoComCustoNovo[] };

export const COMPRA_INICIAL: EstadoDaCompra = { status: "ocioso" };

export type DependenciasDaCompra = { compras: ConsultasDeCompras; usuarioId: string; hoje: string; agora: Date };

function lerCompra(campos: Record<string, string>, hoje: string): { ok: true; dados: DadosDaCompra } | { ok: false; estado: EstadoDaCompra } {
  let bruto: unknown;
  try {
    bruto = JSON.parse(campos.compra ?? "");
  } catch {
    return { ok: false, estado: { status: "erro", mensagem: MENSAGENS_COMPRA.compraInvalida } };
  }
  const v = validarCompra(bruto, hoje);
  if (!v.ok) return { ok: false, estado: { status: "erro", erros: v.erros, mensagem: v.erros.compra ?? v.erros.condicao } };
  return { ok: true, dados: v.dados };
}

function erroDaCompra(e: unknown, acao: string): EstadoDaCompra {
  if (e instanceof DocumentoDaCompraRepetido) return { status: "erro", erros: { documento: MENSAGENS_COMPRA.documentoRepetido(e.numero, e.documento) } };
  if (e instanceof ProdutoIndisponivel) return { status: "erro", mensagem: MENSAGENS_COMPRA.produtoIndisponivel(e.nome) };
  if (e instanceof FornecedorNaoEncontrado) return { status: "erro", erros: { fornecedor: MENSAGENS_COMPRA.semFornecedor } };
  if (e instanceof ValoresDaCompraInvalidos) return { status: "erro", mensagem: MENSAGENS_COMPRA.compraInvalida };
  console.error(`[compras] falha ao ${acao}:`, e instanceof Error ? e.name : "erro");
  return { status: "erro", mensagem: MENSAGENS_FLUXO_COMPRA.falhaInterna };
}

/** Revisar (5.1, item 4): o resumo com o saldo novo, as contas e os três custos, sem gravar nada. */
export async function revisarCompra(campos: Record<string, string>, deps: DependenciasDaCompra): Promise<EstadoDaCompra> {
  const lida = lerCompra(campos, deps.hoje);
  if (!lida.ok) return lida.estado;
  try {
    return { status: "revisada", resumo: await deps.compras.revisar(lida.dados) };
  } catch (e) {
    return erroDaCompra(e, "revisar");
  }
}

/** Confirmar (5.1, item 5): o servidor valida tudo de novo e grava numa transação. */
export async function registrarCompra(campos: Record<string, string>, deps: DependenciasDaCompra): Promise<EstadoDaCompra> {
  const lida = lerCompra(campos, deps.hoje);
  if (!lida.ok) return lida.estado;
  try {
    const r = await deps.compras.registrar(lida.dados, deps.usuarioId, deps.agora);
    return { status: "registrada", compraId: r.id, numero: r.numero, jaExistia: r.jaExistia, custosNovos: r.custosNovos };
  } catch (e) {
    return erroDaCompra(e, "registrar");
  }
}

/** Os campos do "Novo produto" da compra (OPEN-003); os demais ficam para o Catálogo. */
const CAMPOS_DO_PRODUTO = ["nome", "categoria", "unidadeMedida", "codigo", "ncm", "custoBase"] as const;

/**
 * "Novo produto" sem sair da compra (OPEN-003): o mesmo cadastro do Catálogo (validação, nome e código
 * únicos, NCM obrigatório quando o negócio emite nota), sempre como produto físico, com o custo da linha.
 */
export async function criarProdutoDaCompra(campos: Record<string, string>, deps: DependenciasDoCatalogo): Promise<EstadoDoItem> {
  const doProduto = Object.fromEntries(CAMPOS_DO_PRODUTO.map((c) => [c, campos[c] ?? ""]));
  return criarItem({ ...doProduto, tipo: "PRODUTO_FISICO" }, deps);
}

