import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { ItemArquivado, ItemSemEstoque } from "@/lib/db/estoque";
import {
  ClienteInvalido,
  EstoqueInsuficienteNaVenda,
  FormaDeReembolsoAusente,
  ItemNaoVendavel,
  PrecoMudou,
  RestanteDaTroca,
  SomaDivergente,
  TrocaAcimaDoOriginal,
  VendaJaCancelada,
  VendaNaoEncontrada,
  type ConsultasDeVendas,
} from "@/lib/db/vendas";
import { reaisDeCentavos } from "@/lib/dominio/venda";
import { MENSAGENS_VENDA, validarCancelamento, validarCarrinho, validarCliente } from "./validacao";

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
  jaCancelada: "Esta venda já foi cancelada.",
  naoEncontrada: "Venda não encontrada.",
  trocaAcima: (limite: number) => `A troca precisa ter valor menor ou igual a ${reaisDeCentavos(limite)} (troca por valor maior fica fora do MVP).`,
  restanteDaTroca: (restante: number, credito: number) =>
    `Com o crédito de troca de ${reaisDeCentavos(credito)}, os pagamentos precisam somar ${reaisDeCentavos(restante)}. Os valores mudaram: revise e envie de novo.`,
  formaReembolso: (valor: number) => `Escolha como os ${reaisDeCentavos(valor)} serão devolvidos.`,
  falhaNoCancelamento: "Não foi possível cancelar agora. Nada foi alterado; tente novamente.",
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

// ---------- Cancelamento e troca (SPEC-011) ----------

export type EstadoDoCancelamento =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: ErrosDeCampo }
  | { status: "cancelada"; numero: number; trocaId: string | null; trocaNumero: number | null; reembolsoCentavos: number; creditoCentavos: number; jaExistia: boolean };

export const CANCELAMENTO_INICIAL: EstadoDoCancelamento = { status: "ocioso" };

function erroDoCancelamento(e: unknown): EstadoDoCancelamento {
  if (e instanceof VendaJaCancelada) return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.jaCancelada };
  if (e instanceof VendaNaoEncontrada) return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.naoEncontrada };
  if (e instanceof TrocaAcimaDoOriginal) return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.trocaAcima(e.limiteCentavos) };
  if (e instanceof RestanteDaTroca) return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.restanteDaTroca(e.restanteCentavos, e.creditoCentavos) };
  if (e instanceof FormaDeReembolsoAusente) return { status: "erro", erros: { formaReembolso: MENSAGENS_FLUXO_VENDA.formaReembolso(e.reembolsoCentavos) } };
  if (e instanceof EstoqueInsuficienteNaVenda) return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.estoque(e.nome, e.saldo, e.unidade) };
  if (e instanceof ItemNaoVendavel) return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.naoVendavel(e.nome, e.motivo) };
  if (e instanceof PrecoMudou) return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.precoMudou(e.itens) };
  if (e instanceof ClienteInvalido) return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.clienteInvalido };
  if (e instanceof ItemArquivado || e instanceof ItemSemEstoque) return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.naoVendavel("Um dos itens", "arquivado") };
  console.error("[vendas] falha ao cancelar:", e instanceof Error ? e.name : "erro");
  return { status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.falhaNoCancelamento };
}

/** Cancelar a venda (SPEC-011, 5.1): motivo e, se houver reembolso, a forma. */
export async function cancelarVenda(vendaId: string, campos: Record<string, string>, deps: DependenciasDaVenda): Promise<EstadoDoCancelamento> {
  const v = validarCancelamento(campos);
  if (!v.ok) return { status: "erro", erros: v.erros };
  try {
    const r = await deps.vendas.cancelar(vendaId, v.dados, deps.usuarioId, deps.agora);
    return { status: "cancelada", ...r };
  } catch (e) {
    return erroDoCancelamento(e);
  }
}

/** Cancelar e trocar (SPEC-011, 5.2): o carrinho da troca chega como JSON no campo "carrinho". */
export async function trocarVenda(vendaId: string, campos: Record<string, string>, deps: DependenciasDaVenda): Promise<EstadoDoCancelamento> {
  const v = validarCancelamento(campos);
  let bruto: unknown;
  try {
    bruto = JSON.parse(campos.carrinho ?? "");
  } catch {
    return { status: "erro", mensagem: MENSAGENS_VENDA.carrinhoInvalido };
  }
  const c = validarCarrinho(bruto, deps.hoje, { troca: true });
  if (!v.ok || !c.ok) {
    const erros = { ...(v.ok ? {} : v.erros), ...(c.ok ? {} : c.erros) };
    return { status: "erro", erros, mensagem: c.ok ? undefined : (c.erros.carrinho ?? Object.values(c.erros)[0]) };
  }
  try {
    const r = await deps.vendas.cancelar(vendaId, { ...v.dados, troca: c.dados }, deps.usuarioId, deps.agora);
    return { status: "cancelada", ...r };
  } catch (e) {
    return erroDoCancelamento(e);
  }
}
