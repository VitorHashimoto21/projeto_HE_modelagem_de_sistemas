/**
 * Regras fiscais puras (SPEC-003; ADR-005: domínio em TypeScript, sem framework nem banco).
 * Os valores (alíquotas, parcelas, limites) chegam sempre como dados — nunca fixos aqui (RNF08).
 */

export type FaixaDoSimples = {
  /** Limite inicial, exclusivo. */
  rbt12De: number;
  /** Limite final, inclusivo. */
  rbt12Ate: number;
  /** Alíquota nominal, em %. */
  aliquota: number;
  parcelaDeduzir: number;
};

export class RbtInvalido extends Error {
  constructor() {
    super("O RBT12 precisa ser maior que zero (RN21).");
    this.name = "RbtInvalido";
  }
}

/** Imposto anual da faixa para um RBT12: RBT12 × alíquota nominal − parcela a deduzir. */
export function impostoDaFaixa(faixa: Pick<FaixaDoSimples, "aliquota" | "parcelaDeduzir">, rbt12: number): number {
  return (rbt12 * faixa.aliquota) / 100 - faixa.parcelaDeduzir;
}

/**
 * Alíquota efetiva do Simples, em % (RF38):
 * (RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12. Sem arredondamento: quem exibe arredonda.
 */
export function aliquotaEfetiva(faixa: Pick<FaixaDoSimples, "aliquota" | "parcelaDeduzir">, rbt12: number): number {
  if (!(rbt12 > 0) || !Number.isFinite(rbt12)) throw new RbtInvalido();
  return (impostoDaFaixa(faixa, rbt12) / rbt12) * 100;
}

/** A faixa vale para rbt12De < RBT12 ≤ rbt12Ate (limites contínuos — OPEN-16 do Mapa). */
export function faixaContem(faixa: Pick<FaixaDoSimples, "rbt12De" | "rbt12Ate">, rbt12: number): boolean {
  return faixa.rbt12De < rbt12 && rbt12 <= faixa.rbt12Ate;
}

/**
 * Normaliza um código CNAE (subclasse, 7 dígitos) para o formato "4772-5/00".
 * Aceita "4772-5/00", "4772500", "4772-500", "4772.5-00" ou o número 4772500 (formato
 * da consulta de CNPJ). Devolve null se não houver exatamente 7 dígitos.
 */
export function normalizarCnae(codigo: string | number): string | null {
  const digitos = String(codigo).replace(/\D/g, "");
  if (digitos.length !== 7) return null;
  return `${digitos.slice(0, 4)}-${digitos.slice(4, 5)}/${digitos.slice(5)}`;
}
