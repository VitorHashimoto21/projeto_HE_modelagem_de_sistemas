import { somarMeses } from "./financeiro";

/**
 * Regras puras da Calculadora de precificação (SPEC-010; ADR-005: sem framework nem banco).
 * Dinheiro em centavos; percentuais em % (15 = 15%), como no banco e na SPEC-003. Os
 * valores fiscais chegam sempre como dados (RNF08).
 */

export type Anexo = "I" | "II" | "III" | "IV" | "V";
export type OrigemDoFaturamento = "real" | "proporcional" | "estimado" | "sem-dados";

const EPSILON = 1e-9;

/** As 12 competências anteriores ao mês do cálculo, da mais antiga para a mais nova (RF39, RN21). */
export function janelaDoRbt12(compAtual: string): string[] {
  return Array.from({ length: 12 }, (_, i) => somarMeses(compAtual, i - 12));
}

/** Meses entre duas competências (b − a). */
export function mesesEntre(a: string, b: string): number {
  const [aa, am] = a.split("-").map(Number);
  const [ba, bm] = b.split("-").map(Number);
  return (ba - aa) * 12 + (bm - am);
}

export type Rbt12 = {
  /** RBT12 usado no cálculo (proporcional ou estimado quando faltar histórico). */
  rbt12Centavos: number;
  /** Soma real das vendas das 12 competências anteriores. */
  realCentavos: number;
  /** Meses de histórico considerados (0 a 12). */
  mesesConsiderados: number;
  origem: OrigemDoFaturamento;
};

/**
 * RBT12 (RF39, RN21, OPEN-005): 12 meses de histórico → a soma real; 1 a 11 meses desde a
 * primeira venda → média desses meses × 12 (meses parados contam como zero); nenhum mês
 * anterior com vendas → faturamento estimado × 12; sem estimativa → sem dados.
 */
export function calcularRbt12(e: {
  compAtual: string;
  /** Faturamento por competência (só as da janela importam). */
  porCompetencia: Record<string, number>;
  /** Competência da primeira venda não cancelada do negócio, ou null. */
  primeiraCompetencia: string | null;
  faturamentoEstimadoCentavos: number | null;
}): Rbt12 {
  const janela = janelaDoRbt12(e.compAtual);
  const realCentavos = janela.reduce((s, c) => s + (e.porCompetencia[c] ?? 0), 0);
  const inicio = e.primeiraCompetencia && e.primeiraCompetencia > janela[0] ? e.primeiraCompetencia : janela[0];
  const meses = e.primeiraCompetencia && e.primeiraCompetencia < e.compAtual ? mesesEntre(inicio, e.compAtual) : 0;
  if (meses > 0 && realCentavos > 0) {
    return meses >= 12
      ? { rbt12Centavos: realCentavos, realCentavos, mesesConsiderados: 12, origem: "real" }
      : { rbt12Centavos: Math.round((realCentavos / meses) * 12), realCentavos, mesesConsiderados: meses, origem: "proporcional" };
  }
  if (e.faturamentoEstimadoCentavos && e.faturamentoEstimadoCentavos > 0) {
    return { rbt12Centavos: e.faturamentoEstimadoCentavos * 12, realCentavos, mesesConsiderados: 0, origem: "estimado" };
  }
  return { rbt12Centavos: 0, realCentavos, mesesConsiderados: 0, origem: "sem-dados" };
}

/** Desp. Fixas% = despesas fixas mensais ÷ faturamento médio mensal (RF49). */
export function despesasFixasPercentual(despesasCentavos: number, faturamentoMedioCentavos: number): number {
  if (!(faturamentoMedioCentavos > 0)) return Infinity;
  return (despesasCentavos / faturamentoMedioCentavos) * 100;
}

export type RegraFatorR = { limiteMinimo: number; anexoSeAtingir: Anexo; anexoSeNaoAtingir: Anexo };

/**
 * Anexo efetivo (RF69, RN28, OPEN-007): sujeito ao Fator R → folha ÷ receita do período do
 * RBT12 real; ≥ limite → anexo "se atingir" (III), senão "se não atingir" (V). Sem receita real → V.
 */
export function anexoEfetivo(e: {
  sujeitoFatorR: boolean;
  anexoCadastro: Anexo;
  folhaCentavos: number;
  receitaRealCentavos: number;
  regra: RegraFatorR | null;
}): { anexo: Anexo; fatorR: number | null } {
  if (!e.sujeitoFatorR || !e.regra) return { anexo: e.anexoCadastro, fatorR: null };
  if (!(e.receitaRealCentavos > 0)) return { anexo: e.regra.anexoSeNaoAtingir, fatorR: null };
  const fatorR = (Math.max(0, e.folhaCentavos) / e.receitaRealCentavos) * 100;
  return { anexo: fatorR + EPSILON >= e.regra.limiteMinimo ? e.regra.anexoSeAtingir : e.regra.anexoSeNaoAtingir, fatorR };
}

export type ComponentesDoPreco = {
  custoCentavos: number;
  /** Percentuais em %. */
  despesasFixas: number;
  taxaCartao: number;
  comissao: number;
  imposto: number;
  margem: number;
};

export type PrecoCalculado =
  | { ok: true; soma: number; despesasVariaveis: number; precoExato: number; precoCentavos: number; arredondadoCentavos: number }
  | { ok: false; motivo: "inviavel"; soma: number; despesasVariaveis: number };

/**
 * Markup completo (RF34): Preço = Custo ÷ (1 − (DF% + DV% + Imp% + M%)), arredondado para
 * cima ao centavo (INV-001). Soma ≥ 100% → inviável (RN19, INV-002).
 */
export function calcularPreco(c: ComponentesDoPreco): PrecoCalculado {
  const despesasVariaveis = c.taxaCartao + c.comissao;
  const soma = c.despesasFixas + despesasVariaveis + c.imposto + c.margem;
  if (!Number.isFinite(soma) || soma >= 100 - EPSILON) return { ok: false, motivo: "inviavel", soma, despesasVariaveis };
  const precoExato = c.custoCentavos / (1 - soma / 100);
  const precoCentavos = Math.ceil(precoExato - 1e-6);
  return { ok: true, soma, despesasVariaveis, precoExato, precoCentavos, arredondadoCentavos: arredondarParaCimaAoReal(precoCentavos) };
}

/** "Arredondar para cima" ao próximo real inteiro — nunca abaixo do sugerido (OPEN-004). */
export const arredondarParaCimaAoReal = (centavos: number) => Math.ceil(centavos / 100) * 100;

/**
 * Ponto de equilíbrio (RF55) e faturamento meta (RF56):
 * despesas fixas ÷ (1 − CMV% − Imp% − taxa de cartão% [− margem meta%]); null se o denominador ≤ 0.
 */
export function pontoDeEquilibrio(e: { despesasFixasCentavos: number; cmv: number; imposto: number; taxaCartao: number; margemMeta?: number }): number | null {
  const denominador = 1 - (e.cmv + e.imposto + e.taxaCartao + (e.margemMeta ?? 0)) / 100;
  if (denominador <= EPSILON) return null;
  return Math.round(e.despesasFixasCentavos / denominador);
}

/** A parcela que mais pesa na soma (para explicar o preço inviável — 5.2). */
export function maiorParcela(c: Omit<ComponentesDoPreco, "custoCentavos">): keyof Omit<ComponentesDoPreco, "custoCentavos"> {
  const entradas = Object.entries(c) as [keyof Omit<ComponentesDoPreco, "custoCentavos">, number][];
  return entradas.reduce((m, x) => (x[1] > m[1] ? x : m))[0];
}

/** Percentual com 2 casas para exibição e gravação (o cálculo usa a precisão total). */
export const duasCasas = (n: number) => Math.round(n * 100) / 100;
