import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { ItemArquivado, ItemSemEstoque } from "@/lib/db/estoque";
import {
  ClienteInvalido,
  EstoqueInsuficienteNaVenda,
  ItemNaoVendavel,
  PrecoMudou,
  SomaDivergente,
  type ConsultasDeVendas,
} from "@/lib/db/vendas";
import { reaisDeCentavos } from "@/lib/dominio/venda";
import { MENSAGENS_VENDA, validarCarrinho, validarCliente } from "./validacao";

/**
 * Fluxos da venda (SPEC-008, seção 5), independentes do Next.js: as Server Actions (com a
 * guarda de permissão da SPEC-005) só leem o formulário e chamam estas funções.
 */

const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export const MENSAGENS_FLUXO_VENDA = {
  estoque: (nome: string, saldo: number, unidade: string) =>
    `Estoque insuficiente para ${nome}: há ${qtd(saldo)}${unidade ? ` ${unidade}` : ""}.`,
  naoVendavel: (nome: string, motivo: ItemNaoVendavel["motivo"]) =>
    motivo === "sem-preco"
      ? `${nome} não pode ser vendido: ainda não tem preço oficial.`
      : motivo === "arquivado"
        ? `${nome} não pode ser vendido: está arquivado.`
        : "Um dos itens não foi encontrado. Recarregue a página.",
  precoMudou: (itens: { nome: string; precoCentavos: number }[]) =>
    `O preço mudou: ${itens.map((i) => `${i.nome} agora custa ${reaisDeCentavos(i.precoCentavos)}`).join("; ")}. Revise os pagamentos.`,
  somaDivergente: (total: number) => `A soma dos pagamentos precisa ser igual ao total da venda (${reaisDeCentavos(total)}).`,
  clienteInvalido: "Cliente não encontrado. Escolha outro ou cadastre de novo.",
  falhaInterna: "Não foi possível registrar a venda agora. Nada foi gravado; tente novamente.",
} as const;

export type EstadoDaVenda =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: ErrosDeCampo }
  | { status: "registrada"; vendaId: string; numero: number; jaExistia: boolean };

export const VENDA_INICIAL: EstadoDaVenda = { status: "ocioso" };

export type DependenciasDaVenda = { vendas: ConsultasDeVendas; usuarioId: string; hoje: string; agora: Date };

/** Registrar a venda (5.2). O carrinho chega como JSON no campo "carrinho". */
export async function registrarVenda(campos: Record<string, string>, deps: DependenciasDaVenda): Promise<EstadoDaVenda> {
  let bruto: unknown;
  try {
    bruto = JSON.parse(campos.carrinho ?? "");
  } catch {
    return { status: "erro", mensagem: MENSAGENS_VENDA.carrinhoInvalido };
  }
  const v = validarCarrinho(bruto, deps.hoje);
  if (!v.ok) return { status: "erro", erros: v.erros, mensagem: v.erros.carrinho };
  try {
    const r = await deps.vendas.registrar(v.dados, deps.usuarioId, deps.agora);
    return { status: "registrada", vendaId: r.id, numero: r.numero, jaExistia: r.jaExistia };
  } catch (e) {
    if (e instanceof EstoqueInsuficienteNaVenda) return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.estoque(e.nome, e.saldo, e.unidade) };
    if (e instanceof ItemNaoVendavel) return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.naoVendavel(e.nome, e.motivo) };
    if (e instanceof PrecoMudou) return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.precoMudou(e.itens) };
    if (e instanceof SomaDivergente) return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.somaDivergente(e.totalCentavos) };
    if (e instanceof ClienteInvalido) return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.clienteInvalido };
    if (e instanceof ItemArquivado || e instanceof ItemSemEstoque) return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.naoVendavel("Um dos itens", "arquivado") };
    console.error("[vendas] falha ao registrar:", e instanceof Error ? e.name : "erro");
    return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.falhaInterna };
  }
}

export type EstadoDoCliente =
  | { status: "ocioso" }
  | { status: "erro"; erros: ErrosDeCampo }
  | { status: "criado"; cliente: { id: string; nome: string; contato: string | null } };

/** Cadastro rápido de cliente (OPEN-005). */
export async function cadastrarCliente(campos: Record<string, string>, deps: DependenciasDaVenda): Promise<EstadoDoCliente> {
  const v = validarCliente(campos);
  if (!v.ok) return { status: "erro", erros: v.erros };
  return { status: "criado", cliente: await deps.vendas.criarCliente(v.dados.nome, v.dados.contato) };
}
