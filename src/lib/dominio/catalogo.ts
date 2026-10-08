/**
 * Regras puras do catálogo (SPEC-006; ADR-005: sem framework nem banco).
 */

/** Unidades de medida (OPEN-002). O valor gravado é a chave; a lista cresce sem migração. */
export const UNIDADES = {
  un: "Unidade",
  par: "Par",
  dz: "Dúzia",
  cx: "Caixa",
  pct: "Pacote",
  kg: "Quilo (kg)",
  g: "Grama (g)",
  l: "Litro (L)",
  ml: "Mililitro (mL)",
  m: "Metro (m)",
  cm: "Centímetro (cm)",
  m2: "Metro quadrado (m²)",
  h: "Hora",
  atend: "Atendimento",
  sessao: "Sessão",
} as const;

export type Unidade = keyof typeof UNIDADES;

export const ehUnidade = (v: string | undefined): v is Unidade => !!v && Object.hasOwn(UNIDADES, v);

/** Nome normalizado para a unicidade (OPEN-003): minúsculas e espaços únicos — igual ao SQL da migração. */
export function normalizarNome(nome: string): string {
  return nome.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Lê um valor digitado em formato brasileiro ou simples: "12,50", "1.234,56", "12.5",
 * "R$ 30". Devolve null se não for número.
 */
export function lerNumero(texto: string | undefined | null): number | null {
  if (texto === undefined || texto === null) return null;
  let v = texto.replace(/R\$|\s/g, "");
  if (!v) return null;
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  else if ((v.match(/\./g) ?? []).length > 1) v = v.replace(/\./g, "");
  if (!/^-?\d+(\.\d+)?$/.test(v)) return null;
  return Number(v);
}

/** Casas decimais de um número (para limitar centavos e quantidades). */
export function casasDecimais(n: number): number {
  const s = String(n);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

/** Custo total do item: custo próprio + Σ custo do material × quantidade (RF35, CA-03). */
export function custoTotal(custoBase: number, materiais: { custo: number; quantidade: number }[] = []): number {
  return centavos(materiais.reduce((soma, m) => soma + m.custo * m.quantidade, custoBase));
}

/** Preço abaixo do custo total gera aviso, sem bloquear (5.4, CA-07). */
export function precoAbaixoDoCusto(preco: number, custo: number): boolean {
  return preco < custo;
}

/** "R$ 1.234,56" */
export function formatarReais(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
