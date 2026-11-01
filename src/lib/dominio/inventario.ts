/**
 * Inventário do estoque numa data (SPEC-025, RN41). Regras puras: sem framework nem banco (ADR-005).
 *
 * A quantidade ao fim do dia é o saldo atual desfeito das movimentações posteriores (o estoque
 * nasce zerado — RN03 — e só muda por movimentações). O custo é o do histórico de custo vigente
 * até o fim do dia; antes do primeiro registro, vale o primeiro, marcado (OPEN-001).
 */
import { DataInvalida, intervaloDoDia } from "./datas";

/** Soma das movimentações de um produto com data de ocorrência depois do fim do dia escolhido. */
export type MovimentacoesPosteriores = { entradas: number; saidas: number };

const tres = (q: number) => Math.round(q * 1000) / 1000;

/**
 * INV-002: saldo ao fim do dia = saldo atual − entradas e estornos posteriores + saídas posteriores
 * (por venda e manuais). O resultado pode ser negativo quando uma saída foi registrada com data
 * anterior à entrada (5.4).
 */
export function quantidadeNaData(saldoAtual: number, posteriores: MovimentacoesPosteriores): number {
  return tres(saldoAtual - posteriores.entradas + posteriores.saidas);
}

export type RegistroDeCusto = { custoCentavos: number; vigenteDesde: Date };

/**
 * INV-003: o custo vigente até `fimDoDia` (exclusivo) é o do último registro anterior a ele. Antes
 * do primeiro registro, vale o primeiro, com `doInicio`. Sem histórico (não deveria acontecer depois
 * da migração), vale o custo atual, também marcado.
 */
export function custoNaData(historico: RegistroDeCusto[], fimDoDia: Date, custoAtualCentavos: number): { custoCentavos: number; doInicio: boolean } {
  const ordenado = [...historico].sort((a, b) => a.vigenteDesde.getTime() - b.vigenteDesde.getTime());
  const vigentes = ordenado.filter((r) => r.vigenteDesde.getTime() < fimDoDia.getTime());
  if (vigentes.length) return { custoCentavos: vigentes[vigentes.length - 1].custoCentavos, doInicio: false };
  if (ordenado.length) return { custoCentavos: ordenado[0].custoCentavos, doInicio: true };
  return { custoCentavos: custoAtualCentavos, doInicio: true };
}

/** OPEN-007: o inventário abre no último dia do mês anterior ao de hoje ("2026-11-01" → "2026-10-31"). */
export function dataPadraoDoInventario(hoje: string): string {
  const [a, m] = hoje.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m - 1, 0));
  return ultimo.toISOString().slice(0, 10);
}

export const MENSAGENS_INVENTARIO = {
  dataFutura: "Escolha uma data até hoje.",
  dataInvalida: "Data inválida.",
} as const;

/** Lê a data da URL: vazia vira a data padrão; futura ou inválida é recusada (CA-11). */
export function lerDataDoInventario(valor: string | undefined, hoje: string): { ok: true; data: string } | { ok: false; erro: string } {
  if (!valor) return { ok: true, data: dataPadraoDoInventario(hoje) };
  try {
    intervaloDoDia(valor);
  } catch (e) {
    if (e instanceof DataInvalida) return { ok: false, erro: MENSAGENS_INVENTARIO.dataInvalida };
    throw e;
  }
  return valor > hoje ? { ok: false, erro: MENSAGENS_INVENTARIO.dataFutura } : { ok: true, data: valor };
}

/** Produto como sai da consulta: dados atuais do item, quantidade e custo já calculados para a data. */
export type ProdutoNaData = {
  itemId: string;
  codigo: string | null;
  nome: string;
  arquivado: boolean;
  unidade: string;
  ncm: string | null;
  quantidade: number;
  custoCentavos: number;
  custoDoInicio: boolean;
};

export type LinhaDoInventario = ProdutoNaData & {
  /** Quantidade × custo, em centavos; nulo sem custo (OPEN-006). */
  valorCentavos: number | null;
  quantidadeNegativa: boolean;
};

export type AvisosDoInventario = { semCusto: number; semCodigo: number; semNcm: number; custoDoInicio: number; negativos: number };

export type Inventario = { data: string; linhas: LinhaDoInventario[]; totalCentavos: number; avisos: AvisosDoInventario };

/**
 * Monta o inventário (5.2–5.4): só produtos com quantidade diferente de zero (OPEN-002, INV-006),
 * em ordem de descrição, com o valor de cada linha arredondado em centavos e o total como a soma
 * das linhas (INV-008).
 */
export function montarInventario(data: string, produtos: ProdutoNaData[]): Inventario {
  const linhas: LinhaDoInventario[] = produtos
    .filter((p) => p.quantidade !== 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }) || a.itemId.localeCompare(b.itemId))
    .map((p) => ({
      ...p,
      valorCentavos: p.custoCentavos > 0 ? Math.round(p.quantidade * p.custoCentavos) : null,
      quantidadeNegativa: p.quantidade < 0,
    }));
  return {
    data,
    linhas,
    totalCentavos: linhas.reduce((s, l) => s + (l.valorCentavos ?? 0), 0),
    avisos: {
      semCusto: linhas.filter((l) => l.valorCentavos === null).length,
      semCodigo: linhas.filter((l) => !l.codigo).length,
      semNcm: linhas.filter((l) => !l.ncm).length,
      custoDoInicio: linhas.filter((l) => l.custoDoInicio && l.valorCentavos !== null).length,
      negativos: linhas.filter((l) => l.quantidadeNegativa).length,
    },
  };
}

/** Unidade como nas notas e na contabilidade: a sigla em maiúsculas ("un" → "UN"). */
export const siglaDaUnidade = (u: string) => u.toUpperCase();

/** Observação de cada linha nos arquivos (5.5). */
export function observacaoDaLinha(l: LinhaDoInventario): string {
  return [l.quantidadeNegativa ? "Quantidade negativa nesta data" : "", l.custoDoInicio && l.valorCentavos !== null ? "Custo do início do histórico" : "", l.valorCentavos === null ? "Sem custo" : ""]
    .filter(Boolean)
    .join(" · ");
}

/** Notas do fim do PDF, na mesma ordem dos avisos da tela. */
export function notasDoInventario(a: AvisosDoInventario): string[] {
  const n = (q: number, um: string, varios: string) => `${q} ${q === 1 ? um : varios}`;
  const notas: string[] = [];
  if (a.custoDoInicio) notas.push(`${n(a.custoDoInicio, "produto usa", "produtos usam")} o custo do início do histórico: o HE ainda não guardava o custo nesta data.`);
  if (a.negativos) notas.push(`${n(a.negativos, "produto tem", "produtos têm")} quantidade negativa nesta data: uma saída foi registrada com data anterior à entrada.`);
  const faltando = [a.semCusto && n(a.semCusto, "sem custo", "sem custo"), a.semCodigo && n(a.semCodigo, "sem código", "sem código"), a.semNcm && n(a.semNcm, "sem NCM", "sem NCM")].filter(Boolean);
  if (faltando.length) notas.push(`Produtos com dados faltando: ${faltando.join(", ")}.`);
  notas.push("Movimentações registradas depois desta data com data retroativa mudam o inventário dela.");
  return notas;
}
