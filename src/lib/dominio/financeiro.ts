import { diasEntre } from "./estoque";

/**
 * Regras puras do Financeiro (SPEC-009; ADR-005: sem framework nem banco). Dinheiro em
 * centavos inteiros; dias locais de São Paulo (AAAA-MM-DD) e competências AAAA-MM (RN29).
 */

/** Categorias fixas (RF32). */
export const CATEGORIAS = {
  VENDAS: "Vendas",
  FORNECEDORES: "Fornecedores",
  IMPOSTOS: "Impostos",
  SALARIO: "Salário",
  OUTROS: "Outros",
} as const;
export type Categoria = keyof typeof CATEGORIAS;

export type TipoDeLancamento = "ENTRADA" | "SAIDA";
export type SituacaoDaConta = "ABERTA" | "PARCIAL" | "QUITADA" | "CANCELADA";

/** Data retroativa de lançamentos e pagamentos (OPEN-007). */
export const DIAS_RETROATIVOS_FINANCEIRO = 90;
export const VALOR_MAXIMO_CENTAVOS = 999_999_999;
export const TAMANHO_DESCRICAO = 120;
/** Vencimento das contas do DAS do MEI (5.6). */
export const DIA_VENCIMENTO_DAS = 20;
/** Quantos meses a conferência recupera de uma vez (rotina parada, despesa antiga). */
export const MAX_COMPETENCIAS_POR_CONFERENCIA = 24;

/** Valor com sinal: entrada soma, saída subtrai. */
export const comSinal = (tipo: TipoDeLancamento, centavos: number) => (tipo === "ENTRADA" ? centavos : -centavos);

/** Saldo = Σ entradas − Σ saídas (RN14, INV-001). */
export const saldo = (lancamentos: { tipo: TipoDeLancamento; valorCentavos: number }[]) =>
  lancamentos.reduce((s, l) => s + comSinal(l.tipo, l.valorCentavos), 0);

/** Situação da conta pelo valor pago (Diagrama 3, INV-003). */
export function situacaoPeloValor(totalCentavos: number, pagoCentavos: number): Exclude<SituacaoDaConta, "CANCELADA"> {
  if (pagoCentavos <= 0) return "ABERTA";
  return pagoCentavos >= totalCentavos ? "QUITADA" : "PARCIAL";
}

/** Atrasada: vencimento antes de hoje e ainda falta pagar, em aberto ou parcial (5.3). */
export function estaAtrasada(c: { vencimento: string; status: SituacaoDaConta; totalCentavos: number; pagoCentavos: number }, hoje: string): boolean {
  return (c.status === "ABERTA" || c.status === "PARCIAL") && c.pagoCentavos < c.totalCentavos && c.vencimento < hoje;
}

/** Lançamento entra no caixa como entrada para a receber e como saída para a pagar (RN22). */
export const tipoDoPagamento = (tipoConta: "PAGAR" | "RECEBER"): TipoDeLancamento => (tipoConta === "RECEBER" ? "ENTRADA" : "SAIDA");

/** Data de lançamento ou pagamento: hoje ou até 90 dias atrás, nunca futura (OPEN-007). */
export function dataPermitidaNoFinanceiro(dia: string, hoje: string): boolean {
  const diff = diasEntre(dia, hoje);
  return diff >= 0 && diff <= DIAS_RETROATIVOS_FINANCEIRO;
}

// ---------- Competências e despesas fixas (RF67) ----------

/** Competência (AAAA-MM) de um dia local. */
export const competenciaDoDia = (dia: string) => dia.slice(0, 7);

/** Competência n meses depois (n pode ser negativo). */
export function somarMeses(comp: string, n: number): string {
  const [a, m] = comp.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Dia de vencimento na competência; nos meses mais curtos, o último dia (5.5). */
export function vencimentoNaCompetencia(comp: string, diaVencimento: number): string {
  const [a, m] = comp.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${comp}-${String(Math.min(diaVencimento, ultimo)).padStart(2, "0")}`;
}

/** OPEN-004: o mês do cadastro se o dia de vencimento ainda não passou; senão, o próximo. */
export function primeiraCompetencia(diaDoCadastro: string, diaVencimento: number): string {
  const comp = competenciaDoDia(diaDoCadastro);
  return vencimentoNaCompetencia(comp, diaVencimento) >= diaDoCadastro ? comp : somarMeses(comp, 1);
}

/** Competências devidas, da primeira até a atual (inclusive), no máximo as 24 mais recentes. */
export function competenciasDevidas(primeira: string, atual: string): string[] {
  if (primeira > atual) return [];
  const lista: string[] = [];
  for (let c = primeira; c <= atual; c = somarMeses(c, 1)) lista.push(c);
  return lista.slice(-MAX_COMPETENCIAS_POR_CONFERENCIA);
}

/** "10/2026" a partir de "2026-10". */
export const competenciaBrasileira = (comp: string) => `${comp.slice(5, 7)}/${comp.slice(0, 4)}`;

/** Descrição da conta gerada: "<despesa> — MM/AAAA" (5.5), no limite de 120 caracteres. */
export function descricaoDaContaFixa(descricao: string, comp: string): string {
  const sufixo = ` — ${competenciaBrasileira(comp)}`;
  return `${descricao.slice(0, TAMANHO_DESCRICAO - sufixo.length)}${sufixo}`;
}

/** Descrição do estorno: "Estorno de: …" (5.2), no limite de 120 caracteres. */
export function descricaoDoEstorno(original: string | null): string {
  const texto = `Estorno de: ${original ?? "lançamento"}`;
  return texto.length > TAMANHO_DESCRICAO ? `${texto.slice(0, TAMANHO_DESCRICAO - 1)}…` : texto;
}

export const centavosDe = (v: unknown) => Math.round(Number(String(v)) * 100);
export const reaisTexto = (centavos: number) => (centavos / 100).toFixed(2);
