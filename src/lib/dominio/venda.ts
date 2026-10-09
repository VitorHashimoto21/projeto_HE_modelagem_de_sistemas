/**
 * Regras puras da venda (SPEC-008; ADR-005: sem framework nem banco). Dinheiro é
 * calculado em centavos inteiros; quantidades, em milésimos (até 3 casas).
 */

export const FORMAS_DE_PAGAMENTO = { DINHEIRO: "Dinheiro", PIX: "PIX", DEBITO: "Débito", CREDITO: "Crédito" } as const;
export type FormaDePagamento = keyof typeof FORMAS_DE_PAGAMENTO;

/** Formas que entram no caixa na hora (RN09); o crédito vira contas a receber (RN10). */
export const ehImediato = (f: FormaDePagamento) => f !== "CREDITO";

export const MAX_PARCELAS = 12;
export const DIAS_RETROATIVOS = 7; // OPEN-002

export const paraCentavos = (reais: number) => Math.round(reais * 100);
export const paraReais = (centavos: number) => centavos / 100;

/**
 * Subtotal da linha em centavos: preço × quantidade, arredondado ao centavo (meio para
 * cima). Inteiros grandes: preço (até 999.999.999 centavos) × milésimos não cabem em
 * Number sem perder precisão, por isso BigInt.
 */
export function subtotalEmCentavos(precoCentavos: number, quantidade: number): number {
  const milesimos = BigInt(Math.round(quantidade * 1000));
  const produto = BigInt(precoCentavos) * milesimos; // centavos × 1000
  return Number((produto + BigInt(500)) / BigInt(1000));
}

/** Total da venda = Σ subtotais arredondados por linha (INV-003). */
export function totalEmCentavos(linhas: { precoCentavos: number; quantidade: number }[]): number {
  return linhas.reduce((soma, l) => soma + subtotalEmCentavos(l.precoCentavos, l.quantidade), 0);
}

/** RN11: valor ÷ N truncado em centavos; a diferença vai para a 1ª parcela. */
export function dividirEmParcelas(valorCentavos: number, n: number): number[] {
  if (!Number.isInteger(n) || n < 1 || n > MAX_PARCELAS) throw new Error("Número de parcelas inválido.");
  const base = Math.floor(valorCentavos / n);
  const parcelas = Array.from({ length: n }, () => base);
  parcelas[0] += valorCentavos - base * n;
  return parcelas;
}

/**
 * Vencimento da parcela k (OPEN-003): o mesmo dia da venda, k meses depois; se o mês não
 * tem esse dia, o último dia do mês. Dias locais AAAA-MM-DD.
 */
export function vencimentoDaParcela(diaDaVenda: string, k: number): string {
  const [ano, mes, dia] = diaDaVenda.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + k, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimo));
  return alvo.toISOString().slice(0, 10);
}

/** Troco do pagamento em dinheiro (OPEN-004): só exibido, nunca gravado. */
export function troco(recebidoCentavos: number, valorEmDinheiroCentavos: number): number | null {
  return recebidoCentavos >= valorEmDinheiroCentavos ? recebidoCentavos - valorEmDinheiroCentavos : null;
}

/** "R$ 1.234,56" a partir de centavos. */
export const reaisDeCentavos = (centavos: number) =>
  paraReais(centavos).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
