/**
 * Lista de compras (SPEC-027, 5.6): os filtros do endereço da página e a situação das contas de cada
 * compra. Camada de domínio pura, sem framework nem banco (ADR-005).
 */

export const SITUACOES_DA_COMPRA = { REGISTRADA: "Registrada", CANCELADA: "Cancelada" } as const;
export type SituacaoDaCompra = keyof typeof SITUACOES_DA_COMPRA;

/** 5.6: a situação das contas da compra, ao lado da condição (à vista ou a prazo). */
export const PAGAMENTOS_DA_COMPRA = { A_PAGAR: "A pagar", PARCIAL: "Paga em parte", PAGA: "Paga" } as const;
export type PagamentoDaCompra = keyof typeof PAGAMENTOS_DA_COMPRA;

export const MENSAGENS_DA_LISTA = {
  dataInvalida: "Data inválida.",
  periodoInvertido: "A data final precisa ser igual ou posterior à inicial.",
} as const;

export type FiltrosDasCompras = {
  /** Nome do fornecedor, nº do documento ou nº da compra. */
  busca: string | null;
  /** Período da data da compra (AAAA-MM-DD), inclusivo. */
  de: string | null;
  ate: string | null;
  fornecedorId: string | null;
  situacao: SituacaoDaCompra | null;
};

export const SEM_FILTROS_DE_COMPRA: FiltrosDasCompras = { busca: null, de: null, ate: null, fornecedorId: null, situacao: null };

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function diaValido(d: string) {
  if (!DIA.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

/**
 * Lê os filtros do endereço (5.6), como na lista de contas: valores desconhecidos são ignorados;
 * data inválida e período invertido voltam com a mensagem, e a lista não é filtrada pelo período.
 */
export function lerFiltrosDasCompras(busca: Record<string, unknown>): { filtros: FiltrosDasCompras; erro: string | null } {
  let erro: string | null = null;
  let de = texto(busca.de);
  let ate = texto(busca.ate);
  if ((de && !diaValido(de)) || (ate && !diaValido(ate))) erro = MENSAGENS_DA_LISTA.dataInvalida;
  else if (de && ate && ate < de) erro = MENSAGENS_DA_LISTA.periodoInvertido;
  if (erro) de = ate = "";
  const termo = texto(busca.busca).replace(/\s+/g, " ").slice(0, 100);
  const fornecedor = texto(busca.fornecedor);
  const situacao = texto(busca.situacao);
  return {
    filtros: {
      busca: termo || null,
      de: de || null,
      ate: ate || null,
      fornecedorId: UUID.test(fornecedor) ? fornecedor.toLowerCase() : null,
      situacao: Object.hasOwn(SITUACOES_DA_COMPRA, situacao) ? (situacao as SituacaoDaCompra) : null,
    },
    erro,
  };
}

/**
 * Quantos filtros do painel estão ativos (o período conta como um), para o botão "Filtros" no celular.
 * A situação fica fora: tem os próprios botões acima do painel, como nas contas.
 */
export const quantidadeDeFiltrosDaCompra = (f: FiltrosDasCompras) => [f.busca, f.de || f.ate, f.fornecedorId].filter(Boolean).length;

/** Os filtros de volta para o endereço, só os ativos. */
export function parametrosDosFiltrosDaCompra(f: FiltrosDasCompras): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.busca) p.busca = f.busca;
  if (f.de) p.de = f.de;
  if (f.ate) p.ate = f.ate;
  if (f.fornecedorId) p.fornecedor = f.fornecedorId;
  if (f.situacao) p.situacao = f.situacao;
  return p;
}

/** A busca pelo nº da compra: "12", "nº 12" ou "#12". */
export function numeroDaBusca(busca: string): number | null {
  const m = /^(?:n[º°o]\.?\s*|#\s*)?(\d{1,9})$/i.exec(busca.trim());
  return m ? Number(m[1]) : null;
}

/**
 * 5.6: a situação das contas de uma compra registrada. Todas quitadas: paga; alguma com pagamento
 * (quitada ou em parte): paga em parte; nenhuma: a pagar. As canceladas não contam.
 */
export function pagamentoDaCompra(status: readonly string[]): PagamentoDaCompra {
  const validas = status.filter((s) => s !== "CANCELADA");
  if (validas.length > 0 && validas.every((s) => s === "QUITADA")) return "PAGA";
  if (validas.some((s) => s === "QUITADA" || s === "PARCIAL")) return "PARCIAL";
  return "A_PAGAR";
}
