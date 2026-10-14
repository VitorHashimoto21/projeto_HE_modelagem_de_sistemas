/**
 * Gráficos do design system (SPEC-016, 5.5). Puro: escalas e proporções, sem framework.
 * Os componentes em src/components/graficos/ só desenham o que sai daqui.
 */

/** Teto "amigável" e 3 linhas de grade (ex.: máximo 310 → teto 375, grade 125/250/375). */
export function escalaAmigavel(maximo: number, linhas = 3): { teto: number; grade: number[] } {
  if (!(maximo > 0)) return { teto: linhas, grade: Array.from({ length: linhas }, (_, i) => i + 1) };
  const passoBruto = maximo / linhas;
  const potencia = 10 ** Math.floor(Math.log10(passoBruto));
  const passo = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 10].map((m) => m * potencia).find((p) => p >= passoBruto)!;
  const teto = passo * linhas;
  return { teto, grade: Array.from({ length: linhas }, (_, i) => passo * (i + 1)) };
}

/** Proporção 0–1 de um valor no teto, sem passar dos limites. */
export const proporcao = (valor: number, teto: number) => (teto > 0 ? Math.min(1, Math.max(0, valor / teto)) : 0);

export type PosicoesDoMedidor = {
  /** Fim da parte sólida (faturado). */
  faturado: number;
  /** Fim da parte hachurada (ritmo até o fim do mês); null sem estimativa. */
  ritmo: number | null;
  /** Marca do ponto de equilíbrio. */
  equilibrio: number;
  /** Marca da meta (null sem meta: o fim da escala é o equilíbrio). */
  meta: number | null;
  /** O ritmo passa do fim da escala? */
  ritmoPassa: boolean;
};

/** Posições no medidor da meta (SPEC-016, 5.5): a escala termina na meta, ou no equilíbrio sem meta. */
export function posicoesDoMedidor(e: { faturadoCentavos: number; equilibrioCentavos: number; metaCentavos: number | null; ritmoCentavos: number | null }): PosicoesDoMedidor {
  const fim = e.metaCentavos ?? e.equilibrioCentavos;
  return {
    faturado: proporcao(e.faturadoCentavos, fim),
    ritmo: e.ritmoCentavos === null ? null : proporcao(e.ritmoCentavos, fim),
    equilibrio: proporcao(e.equilibrioCentavos, fim),
    meta: e.metaCentavos === null ? null : 1,
    ritmoPassa: e.ritmoCentavos !== null && e.ritmoCentavos > fim,
  };
}

/** Participação de cada parte no todo, em %, somando 100 (o maior resto absorve o arredondamento). */
export function participacoes(valores: number[]): number[] {
  const total = valores.reduce((s, v) => s + v, 0);
  if (total <= 0) return valores.map(() => 0);
  const brutos = valores.map((v) => (v / total) * 100);
  const inteiros = brutos.map(Math.floor);
  let falta = 100 - inteiros.reduce((s, v) => s + v, 0);
  const ordem = brutos.map((b, i) => [b - inteiros[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of ordem) {
    if (falta <= 0) break;
    inteiros[i]++;
    falta--;
  }
  return inteiros;
}

/** Saudação pela hora local de São Paulo. */
export function saudacao(agora: Date): string {
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(agora));
  return hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
}
