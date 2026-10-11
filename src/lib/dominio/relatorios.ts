/**
 * Relatórios do plano pago (SPEC-013, 5.3 e 5.4). Puro: rentabilidade, período e CSV.
 * Dinheiro em centavos inteiros; dias em AAAA-MM-DD (São Paulo).
 */
import { somarDias } from "./estoque";
import { competenciaDoDia, somarMeses } from "./financeiro";

// ---------- Período ----------

export const MAX_DIAS_DO_PERIODO = 5 * 366;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

const valido = (d: string) => {
  if (!DIA.test(d)) return false;
  const [a, m, x] = d.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, x));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === x;
};
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

export const ATALHOS_DE_PERIODO = [
  { chave: "mes", rotulo: "Este mês" },
  { chave: "mesPassado", rotulo: "Mês passado" },
  { chave: "3meses", rotulo: "Últimos 3 meses" },
  { chave: "12meses", rotulo: "Últimos 12 meses" },
] as const;

/** Período pedido (atalho ou datas), com o mês atual como padrão; datas futuras viram hoje. */
export function lerPeriodo(p: { periodo?: string; de?: string; ate?: string }, hoje: string): { ok: true; de: string; ate: string; chave: string } | { ok: false; erro: string } {
  if (p.de !== undefined || p.ate !== undefined) {
    const de = p.de ?? "";
    const ate = p.ate && p.ate > hoje ? hoje : (p.ate ?? "");
    if (!valido(de) || !valido(ate)) return { ok: false, erro: "Use datas válidas." };
    if (de > ate) return { ok: false, erro: "A data inicial precisa ser anterior à final." };
    if (diasEntre(de, ate) > MAX_DIAS_DO_PERIODO) return { ok: false, erro: "O período pode ter no máximo 5 anos." };
    return { ok: true, de, ate, chave: "datas" };
  }
  const mes = competenciaDoDia(hoje);
  switch (p.periodo) {
    case "mesPassado": {
      const anterior = somarMeses(mes, -1);
      return { ok: true, de: `${anterior}-01`, ate: somarDias(`${mes}-01`, -1), chave: "mesPassado" };
    }
    case "3meses":
      return { ok: true, de: `${somarMeses(mes, -2)}-01`, ate: hoje, chave: "3meses" };
    case "12meses":
      return { ok: true, de: `${somarMeses(mes, -11)}-01`, ate: hoje, chave: "12meses" };
    default:
      return { ok: true, de: `${mes}-01`, ate: hoje, chave: "mes" };
  }
}

// ---------- Rentabilidade (RF70) ----------

export type LinhaVendida = {
  itemId: string;
  nome: string;
  arquivado: boolean;
  quantidade: number;
  faturamentoCentavos: number;
  custoCentavos: number;
  /** Linhas vendidas com custo gravado zero (a margem fica superestimada). */
  linhasSemCusto: number;
};

export type ItemRentavel = LinhaVendida & { margemCentavos: number; margemPercentual: number | null };

export type OrdemDaRentabilidade = "margem" | "faturamento" | "quantidade";

export type Rentabilidade = {
  itens: ItemRentavel[];
  totais: { quantidade: number; faturamentoCentavos: number; custoCentavos: number; margemCentavos: number; margemPercentual: number | null };
};

const percentual = (margem: number, faturamento: number) => (faturamento > 0 ? Math.round((margem / faturamento) * 10_000) / 100 : null);

/** Margem = faturamento − custo; margem % = margem ÷ faturamento, com 2 casas (5.3). */
export function calcularRentabilidade(linhas: LinhaVendida[], ordem: OrdemDaRentabilidade = "margem"): Rentabilidade {
  const itens = linhas.map((l) => {
    const margemCentavos = l.faturamentoCentavos - l.custoCentavos;
    return { ...l, margemCentavos, margemPercentual: percentual(margemCentavos, l.faturamentoCentavos) };
  });
  const chave: Record<OrdemDaRentabilidade, (i: ItemRentavel) => number> = {
    margem: (i) => i.margemCentavos,
    faturamento: (i) => i.faturamentoCentavos,
    quantidade: (i) => i.quantidade,
  };
  itens.sort((a, b) => chave[ordem](b) - chave[ordem](a) || a.nome.localeCompare(b.nome, "pt-BR"));
  const faturamentoCentavos = itens.reduce((s, i) => s + i.faturamentoCentavos, 0);
  const custoCentavos = itens.reduce((s, i) => s + i.custoCentavos, 0);
  return {
    itens,
    totais: {
      quantidade: itens.reduce((s, i) => s + i.quantidade, 0),
      faturamentoCentavos,
      custoCentavos,
      margemCentavos: faturamentoCentavos - custoCentavos,
      margemPercentual: percentual(faturamentoCentavos - custoCentavos, faturamentoCentavos),
    },
  };
}

// ---------- Formatação dos arquivos (OPEN-006) ----------

/** Valor para planilha em português: sem separador de milhar, vírgula decimal ("1234,56"; "-80,00"). */
export const valorParaPlanilha = (centavos: number) => {
  const sinal = centavos < 0 ? "-" : "";
  const abs = Math.abs(centavos);
  return `${sinal}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
};

/** Quantidade com até 3 casas e vírgula decimal. */
export const quantidadeParaPlanilha = (q: number) => String(Math.round(q * 1000) / 1000).replace(".", ",");

/** "2026-10-11" → "11/10/2026". */
export const diaBrasileiro = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;

const celula = (v: string) => (/[;"\r\n]/.test(v) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * CSV no padrão brasileiro (OPEN-006): ponto e vírgula, vírgula decimal, UTF-8 com BOM e
 * quebras de linha CRLF; células com ";", aspas ou quebra de linha entre aspas. Células que
 * começam com "=", "+", "-" ou "@" e não são números recebem um apóstrofo (injeção de fórmula).
 */
export function gerarCsv(cabecalho: string[], linhas: string[][]): string {
  const segura = (v: string) => (/^[=+\-@\t\r]/.test(v) && !/^-?\d+(,\d+)?$/.test(v) ? `'${v}` : v);
  const texto = [cabecalho, ...linhas].map((l) => l.map((v) => celula(segura(v))).join(";")).join("\r\n");
  return `﻿${texto}\r\n`;
}

export const RELATORIOS = {
  vendas: { rotulo: "Vendas", permissao: "vendas" },
  fluxo: { rotulo: "Fluxo de caixa", permissao: "financeiro" },
  contas: { rotulo: "Contas a pagar e a receber", permissao: "financeiro" },
  rentabilidade: { rotulo: "Rentabilidade por item", permissao: "vendas+financeiro" },
} as const;
export type Relatorio = keyof typeof RELATORIOS;

export const nomeDoArquivo = (r: Relatorio, de: string, ate: string, formato: "csv" | "pdf") => `he-${r}-${de}-a-${ate}.${formato}`;
