import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { ItemNaoEncontrado } from "@/lib/db/catalogo";
import { EstoqueInsuficiente, instanteDaOcorrencia, ItemArquivado, ItemSemEstoque, type ConsultasDoEstoque } from "@/lib/db/estoque";
import { validarMinimo, validarMovimentacao } from "./validacao";

/**
 * Fluxos do estoque (SPEC-007, seção 5), independentes do Next.js: as Server Actions (com
 * a guarda de permissão da SPEC-005) só leem o formulário e chamam estas funções.
 */

const quantidadeBr = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export const MENSAGENS_FLUXO_ESTOQUE = {
  insuficiente: (saldo: number) => `Estoque insuficiente: há ${quantidadeBr(saldo)} em estoque.`,
  naoEncontrado: "Produto não encontrado.",
  semEstoque: "Este item não tem estoque controlado.",
  arquivado: "Este produto está arquivado. Reative-o no Catálogo para movimentar o estoque.",
  falhaInterna: "Não foi possível concluir agora. Tente novamente.",
  entrada: (q: number, saldo: number) => `Entrada registrada: +${quantidadeBr(q)}. Saldo: ${quantidadeBr(saldo)}.`,
  saida: (q: number, saldo: number) => `Saída registrada: −${quantidadeBr(q)}. Saldo: ${quantidadeBr(saldo)}.`,
} as const;

export type EstadoDoEstoque =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: ErrosDeCampo }
  | { status: "salvo"; mensagem: string };

export const ESTOQUE_INICIAL: EstadoDoEstoque = { status: "ocioso" };

export type DependenciasDoEstoque = {
  estoque: ConsultasDoEstoque;
  usuarioId: string;
  /** Dia local de hoje (São Paulo) e o relógio — injetáveis nos testes. */
  hoje: string;
  agora: Date;
};

function traduzir(e: unknown): { mensagem?: string; erros?: ErrosDeCampo } {
  if (e instanceof EstoqueInsuficiente) return { erros: { quantidade: MENSAGENS_FLUXO_ESTOQUE.insuficiente(e.saldo) } };
  if (e instanceof ItemNaoEncontrado) return { mensagem: MENSAGENS_FLUXO_ESTOQUE.naoEncontrado };
  if (e instanceof ItemSemEstoque) return { mensagem: MENSAGENS_FLUXO_ESTOQUE.semEstoque };
  if (e instanceof ItemArquivado) return { mensagem: MENSAGENS_FLUXO_ESTOQUE.arquivado };
  console.error("[estoque] falha:", e instanceof Error ? e.name : "erro");
  return { mensagem: MENSAGENS_FLUXO_ESTOQUE.falhaInterna };
}

/** Entrada (UC7) ou saída manual com motivo (UC8). */
export async function registrarMovimentacao(
  itemId: string,
  tipo: "entrada" | "saida",
  campos: Record<string, string>,
  deps: DependenciasDoEstoque,
): Promise<EstadoDoEstoque> {
  const v = validarMovimentacao(campos, tipo, deps.hoje);
  if (!v.ok) return { status: "erro", erros: v.erros };
  try {
    const r = await deps.estoque.registrar({
      itemId,
      tipo: tipo === "entrada" ? "ENTRADA" : "SAIDA_MANUAL",
      quantidade: v.dados.quantidade,
      motivo: v.dados.motivo,
      observacao: v.dados.observacao,
      data: instanteDaOcorrencia(v.dados.dia, deps.agora),
      usuarioId: deps.usuarioId,
    });
    return {
      status: "salvo",
      mensagem: (tipo === "entrada" ? MENSAGENS_FLUXO_ESTOQUE.entrada : MENSAGENS_FLUXO_ESTOQUE.saida)(v.dados.quantidade, r.saldoPosterior),
    };
  } catch (e) {
    return { status: "erro", ...traduzir(e) };
  }
}

/** Mínimo manual (5.3): define ou remove (vazio = voltar à sugestão). */
export async function definirMinimo(itemId: string, campos: Record<string, string>, deps: DependenciasDoEstoque): Promise<EstadoDoEstoque> {
  const v = validarMinimo(campos);
  if (!v.ok) return { status: "erro", erros: v.erros };
  try {
    await deps.estoque.definirMinimo(itemId, v.dados);
    return { status: "salvo", mensagem: v.dados === null ? "Mínimo manual removido: vale a sugestão." : "Mínimo manual salvo." };
  } catch (e) {
    return { status: "erro", ...traduzir(e) };
  }
}
