/**
 * Regras puras do estoque (SPEC-007; ADR-005: sem framework nem banco). Os dias são
 * sempre dias locais de São Paulo no formato AAAA-MM-DD (RN29, OPEN-09 do Mapa).
 */

/** Motivos da saída manual (RF17). */
export const MOTIVOS_SAIDA = {
  PERDA: "Perda",
  QUEBRA: "Quebra",
  USO_INTERNO: "Uso interno",
  DOACAO: "Doação",
  OUTRO: "Outro",
} as const;
export type MotivoSaida = keyof typeof MOTIVOS_SAIDA;

/** Janela do consumo e da data retroativa (RF20, OPEN-005). */
export const JANELA_DIAS = 90;
export const QUANTIDADE_MAXIMA = 9_999_999.999;

/** Diferença em dias entre dois dias locais (b − a). */
export function diasEntre(a: string, b: string): number {
  const utc = (d: string) => {
    const [ano, mes, dia] = d.split("-").map(Number);
    return Date.UTC(ano, mes - 1, dia);
  };
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

/** Soma (ou subtrai) dias de um dia local. */
export function somarDias(dia: string, n: number): string {
  const [ano, mes, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, d + n)).toISOString().slice(0, 10);
}

/** Primeiro dia da janela de 90 dias que termina hoje (hoje entra). */
export const inicioDaJanela = (hoje: string) => somarDias(hoje, -(JANELA_DIAS - 1));

/** Data da movimentação: nem futura, nem anterior a 90 dias (OPEN-005). */
export function dataPermitida(dia: string, hoje: string): boolean {
  const diff = diasEntre(dia, hoje);
  return diff >= 0 && diff <= JANELA_DIAS;
}

export type ResumoDoConsumo = {
  /** Houve ao menos uma entrada (ENTRADA) e ao menos uma saída (manual ou venda), desde sempre (RN07). */
  cicloCompleto: boolean;
  /** Dia local da primeira movimentação do item, ou null se não houver. */
  primeiroDia: string | null;
  /** Soma das saídas (manual + venda) com data na janela. */
  saidasNaJanela: number;
  /** Soma dos estornos de venda com data na janela. */
  estornosNaJanela: number;
};

/**
 * Consumo médio diário (RF20, OPEN-004): (saídas − estornos da janela, nunca < 0) ÷ dias
 * com histórico na janela = dias desde a primeira movimentação, no máximo 90, contando hoje.
 */
export function consumoMedioDiario(r: ResumoDoConsumo, hoje: string): number {
  if (!r.primeiroDia) return 0;
  const dias = Math.min(JANELA_DIAS, Math.max(1, diasEntre(r.primeiroDia, hoje) + 1));
  return Math.max(0, r.saidasNaJanela - r.estornosNaJanela) / dias;
}

/** Sugestão = ⌈consumo × dias de cobertura⌉, inteira, só após o ciclo completo (RN07, RN08). */
export function sugestaoDeMinimo(r: ResumoDoConsumo, diasCobertura: number, hoje: string): number | null {
  if (!r.cicloCompleto) return null;
  // Arredonda o ruído de ponto flutuante antes do teto (60/30×7 = 14, não 15).
  return Math.ceil(Number((consumoMedioDiario(r, hoje) * diasCobertura).toFixed(9)));
}

export type MinimoEmVigor = { valor: number; origem: "manual" | "sugerido" } | null;

/** O manual vale se existir; senão a sugestão; senão nenhum (OPEN-002, INV-007). */
export function minimoEmVigor(manual: number | null, sugestao: number | null): MinimoEmVigor {
  if (manual !== null) return { valor: manual, origem: "manual" };
  if (sugestao !== null) return { valor: sugestao, origem: "sugerido" };
  return null;
}

export type Situacao = "SEM_ESTOQUE" | "BAIXO" | "NORMAL" | "SEM_MINIMO";

/** Situação do produto (5.4): o alerta vale com o mínimo manual mesmo antes do ciclo (OPEN-003). */
export function situacaoDoEstoque(saldo: number, minimo: MinimoEmVigor): Situacao {
  if (!minimo) return "SEM_MINIMO";
  if (saldo <= 0) return "SEM_ESTOQUE";
  if (saldo <= minimo.valor) return "BAIXO";
  return "NORMAL";
}

export const emAlerta = (s: Situacao) => s === "SEM_ESTOQUE" || s === "BAIXO";
