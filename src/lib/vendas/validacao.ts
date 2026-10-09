import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { casasDecimais, lerNumero } from "@/lib/dominio/catalogo";
import { diasEntre } from "@/lib/dominio/estoque";
import { DIAS_RETROATIVOS, FORMAS_DE_PAGAMENTO, MAX_PARCELAS, paraCentavos, type FormaDePagamento } from "@/lib/dominio/venda";

/**
 * Validação da venda (SPEC-008, 5.5). Roda no navegador e no servidor. O carrinho chega
 * como JSON; o preço nunca vem daqui (INV-002) — só o "preço visto", para avisar se mudou.
 */

export const MAX_LINHAS = 100;
export const MAX_PAGAMENTOS = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MENSAGENS_VENDA = {
  carrinhoInvalido: "Não foi possível ler a venda. Recarregue a página e tente de novo.",
  carrinhoVazio: "Adicione ao menos um item",
  muitasLinhas: `Use no máximo ${MAX_LINHAS} itens por venda`,
  quantidadeInvalida: "Use uma quantidade maior que zero, com até 3 casas decimais",
  semPagamento: "Informe a forma de pagamento",
  formaInvalida: "Forma de pagamento inválida",
  valorInvalido: "Use um valor maior que zero, com até 2 casas",
  parcelasInvalidas: `Use de 1 a ${MAX_PARCELAS} parcelas, só no crédito`,
  dataInvalida: `Use uma data entre hoje e ${DIAS_RETROATIVOS} dias atrás`,
  clienteInvalido: "Cliente inválido",
  nomeObrigatorio: "Informe o nome do cliente",
  nomeLongo: "Use no máximo 120 caracteres",
  contatoLongo: "Use no máximo 120 caracteres",
} as const;

export type LinhaDoCarrinho = { itemId: string; quantidade: number; precoVistoCentavos: number | null };
export type PagamentoDoCarrinho = { forma: FormaDePagamento; valorCentavos: number; parcelas: number };
export type DadosDoCarrinho = {
  /** Identificador do carrinho = id da venda (proteção contra envio duplicado, INV-009). */
  id: string;
  /** Dia local da venda (OPEN-002). */
  dia: string;
  clienteId: string | null;
  linhas: LinhaDoCarrinho[];
  pagamentos: PagamentoDoCarrinho[];
};

export type Validacao<T> = { ok: true; dados: T } | { ok: false; erros: ErrosDeCampo };

const lerValor = (v: unknown) => (typeof v === "number" ? v : lerNumero(typeof v === "string" ? v : undefined));

/**
 * Valida a forma do carrinho (sem consultar o banco). Linhas do mesmo item são somadas.
 * A soma dos pagamentos é conferida no servidor contra o total calculado com o preço oficial.
 */
export function validarCarrinho(entrada: unknown, hoje: string): Validacao<DadosDoCarrinho> {
  const c = entrada as Record<string, unknown> | null;
  if (!c || typeof c !== "object" || typeof c.id !== "string" || !UUID.test(c.id)) {
    return { ok: false, erros: { carrinho: MENSAGENS_VENDA.carrinhoInvalido } };
  }
  const erros: ErrosDeCampo = {};

  const dia = typeof c.dia === "string" && c.dia ? c.dia : hoje;
  const diff = /^\d{4}-\d{2}-\d{2}$/.test(dia) && !Number.isNaN(Date.parse(`${dia}T00:00:00Z`)) ? diasEntre(dia, hoje) : -1;
  if (diff < 0 || diff > DIAS_RETROATIVOS) erros.dia = MENSAGENS_VENDA.dataInvalida;

  let clienteId: string | null = null;
  if (c.clienteId !== undefined && c.clienteId !== null && c.clienteId !== "") {
    if (typeof c.clienteId === "string" && UUID.test(c.clienteId)) clienteId = c.clienteId;
    else erros.cliente = MENSAGENS_VENDA.clienteInvalido;
  }

  const somadas = new Map<string, LinhaDoCarrinho>();
  const linhas = Array.isArray(c.linhas) ? c.linhas : [];
  if (linhas.length === 0) erros.itens = MENSAGENS_VENDA.carrinhoVazio;
  else if (linhas.length > MAX_LINHAS) erros.itens = MENSAGENS_VENDA.muitasLinhas;
  for (const l of linhas as Record<string, unknown>[]) {
    const quantidade = lerValor(l?.quantidade);
    if (typeof l?.itemId !== "string" || !UUID.test(l.itemId)) {
      erros.itens = MENSAGENS_VENDA.carrinhoInvalido;
      continue;
    }
    if (quantidade === null || !(quantidade > 0) || quantidade > 9_999_999.999 || casasDecimais(quantidade) > 3) {
      erros[`quantidade_${l.itemId}`] = MENSAGENS_VENDA.quantidadeInvalida;
      continue;
    }
    const precoVisto = typeof l.precoVisto === "number" ? paraCentavos(l.precoVisto) : null;
    const anterior = somadas.get(l.itemId);
    somadas.set(l.itemId, {
      itemId: l.itemId,
      quantidade: anterior ? Math.round((anterior.quantidade + quantidade) * 1000) / 1000 : quantidade,
      precoVistoCentavos: precoVisto,
    });
  }

  const pagamentos: PagamentoDoCarrinho[] = [];
  const brutos = Array.isArray(c.pagamentos) ? (c.pagamentos as Record<string, unknown>[]) : [];
  if (brutos.length === 0) erros.pagamentos = MENSAGENS_VENDA.semPagamento;
  else if (brutos.length > MAX_PAGAMENTOS) erros.pagamentos = MENSAGENS_VENDA.formaInvalida;
  for (const p of brutos) {
    const forma = p?.forma as FormaDePagamento;
    if (!Object.hasOwn(FORMAS_DE_PAGAMENTO, forma ?? "")) {
      erros.pagamentos = MENSAGENS_VENDA.formaInvalida;
      continue;
    }
    const valor = lerValor(p.valor);
    if (valor === null || !(valor > 0) || valor > 9_999_999.99 || casasDecimais(valor) > 2) {
      erros.pagamentos = MENSAGENS_VENDA.valorInvalido;
      continue;
    }
    const parcelas = p.parcelas === undefined || p.parcelas === null || p.parcelas === "" ? 1 : Number(p.parcelas);
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > MAX_PARCELAS || (forma !== "CREDITO" && parcelas !== 1)) {
      erros.pagamentos = MENSAGENS_VENDA.parcelasInvalidas;
      continue;
    }
    pagamentos.push({ forma, valorCentavos: paraCentavos(valor), parcelas });
  }

  if (Object.keys(erros).length) return { ok: false, erros };
  return { ok: true, dados: { id: c.id, dia, clienteId, linhas: [...somadas.values()], pagamentos } };
}

/** Cadastro rápido de cliente (OPEN-005). */
export function validarCliente(campos: Record<string, string>): Validacao<{ nome: string; contato: string | null }> {
  const nome = (campos.nome ?? "").trim().replace(/\s+/g, " ");
  const contato = (campos.contato ?? "").trim() || null;
  const erros: ErrosDeCampo = {};
  if (!nome) erros.nome = MENSAGENS_VENDA.nomeObrigatorio;
  else if (nome.length > 120) erros.nome = MENSAGENS_VENDA.nomeLongo;
  if (contato && contato.length > 120) erros.contato = MENSAGENS_VENDA.contatoLongo;
  return Object.keys(erros).length ? { ok: false, erros } : { ok: true, dados: { nome, contato } };
}
