/**
 * Contas a pagar e a receber (SPEC-026): forma do pagamento, nº do documento e filtros da lista.
 * Regras puras, sem framework nem banco (ADR-005).
 */
import { CATEGORIAS, type Categoria } from "./financeiro";

/** OPEN-008: formas do pagamento ou recebimento de uma conta. */
export const FORMAS_DO_PAGAMENTO = ["DINHEIRO", "PIX", "DEBITO", "CREDITO", "BOLETO", "TRANSFERENCIA", "OUTRA"] as const;
export type FormaDoPagamento = (typeof FORMAS_DO_PAGAMENTO)[number];

export const ROTULO_FORMA: Record<FormaDoPagamento, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  DEBITO: "Cartão de débito",
  CREDITO: "Cartão de crédito",
  BOLETO: "Boleto",
  TRANSFERENCIA: "Transferência",
  OUTRA: "Outra",
};

/** Pagamentos anteriores à SPEC-026 (5.5, item 3). */
export const FORMA_NAO_INFORMADA = "Não informada";
/** Valor do filtro para os pagamentos sem forma. */
export const FILTRO_SEM_FORMA = "NAO_INFORMADA";

export const rotuloDaForma = (forma: FormaDoPagamento | null) => (forma ? ROTULO_FORMA[forma] : FORMA_NAO_INFORMADA);
export const ehForma = (valor: string): valor is FormaDoPagamento => (FORMAS_DO_PAGAMENTO as readonly string[]).includes(valor);

/** Nº do documento (5.4, item 1): opcional, até 40 caracteres, sem precisar ser único. */
export const MAX_NUMERO_DOCUMENTO = 40;

/** Fornecedor ou cliente nos seletores (OPEN-006): só o nome. */
export type OpcaoDePessoa = { id: string; nome: string };

/** As listas dos seletores e o que a pessoa pode cadastrar sem sair do formulário (5.2, itens 5 e 6). */
export type OpcoesDoVinculo = { fornecedores: OpcaoDePessoa[]; clientes: OpcaoDePessoa[]; podeCriarFornecedor: boolean; podeCriarCliente: boolean };

export const SEM_OPCOES: OpcoesDoVinculo = { fornecedores: [], clientes: [], podeCriarFornecedor: false, podeCriarCliente: false };

/** Origem da conta (5.6): manual, gerada por uma despesa fixa ou por uma venda no cartão. */
export const ORIGENS_DA_CONTA = ["manual", "despesa", "venda"] as const;
export type OrigemDaConta = (typeof ORIGENS_DA_CONTA)[number];
export const ROTULO_ORIGEM: Record<OrigemDaConta, string> = { manual: "Manual", despesa: "Despesa fixa", venda: "Venda no cartão" };

export const MENSAGENS_DOS_FILTROS = {
  dataInvalida: "Data inválida.",
  periodoInvertido: "A data final precisa ser igual ou posterior à inicial.",
} as const;

/** Filtros novos da lista de contas (5.6, item 2), já validados. */
export type FiltrosDasContas = {
  busca: string | null;
  vencimentoDe: string | null;
  vencimentoAte: string | null;
  pagamentoDe: string | null;
  pagamentoAte: string | null;
  /** Fornecedor (a pagar) ou cliente (a receber). */
  pessoaId: string | null;
  forma: FormaDoPagamento | typeof FILTRO_SEM_FORMA | null;
  categoria: Categoria | null;
  origem: OrigemDaConta | null;
};

export const SEM_FILTROS: FiltrosDasContas = {
  busca: null,
  vencimentoDe: null,
  vencimentoAte: null,
  pagamentoDe: null,
  pagamentoAte: null,
  pessoaId: null,
  forma: null,
  categoria: null,
  origem: null,
};

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function diaValido(d: string) {
  if (!DIA.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Lê os filtros do endereço da página (5.6). Valores desconhecidos são ignorados (o endereço pode
 * ter sido editado à mão); datas inválidas e período invertido voltam com a mensagem, e a lista
 * não é filtrada por eles.
 */
export function lerFiltrosDasContas(busca: Record<string, unknown>): { filtros: FiltrosDasContas; erros: Partial<Record<"vencimento" | "pagamento", string>> } {
  const erros: Partial<Record<"vencimento" | "pagamento", string>> = {};
  const periodo = (campo: "vencimento" | "pagamento"): [string | null, string | null] => {
    const de = texto(busca[`${campo}De`]);
    const ate = texto(busca[`${campo}Ate`]);
    if ((de && !diaValido(de)) || (ate && !diaValido(ate))) {
      erros[campo] = MENSAGENS_DOS_FILTROS.dataInvalida;
      return [null, null];
    }
    if (de && ate && ate < de) {
      erros[campo] = MENSAGENS_DOS_FILTROS.periodoInvertido;
      return [null, null];
    }
    return [de || null, ate || null];
  };
  const [vencimentoDe, vencimentoAte] = periodo("vencimento");
  const [pagamentoDe, pagamentoAte] = periodo("pagamento");
  const termo = texto(busca.busca).replace(/\s+/g, " ").slice(0, 100);
  const pessoa = texto(busca.pessoa);
  const forma = texto(busca.forma);
  const categoria = texto(busca.categoria);
  const origem = texto(busca.origem);
  return {
    filtros: {
      busca: termo || null,
      vencimentoDe,
      vencimentoAte,
      pagamentoDe,
      pagamentoAte,
      pessoaId: UUID.test(pessoa) ? pessoa.toLowerCase() : null,
      forma: ehForma(forma) || forma === FILTRO_SEM_FORMA ? (forma as FiltrosDasContas["forma"]) : null,
      categoria: Object.hasOwn(CATEGORIAS, categoria) ? (categoria as Categoria) : null,
      origem: (ORIGENS_DA_CONTA as readonly string[]).includes(origem) ? (origem as OrigemDaConta) : null,
    },
    erros,
  };
}

/** Quantos filtros estão ativos (o período conta como um), para o botão "Filtros" no celular (5.6, item 5). */
export function quantidadeDeFiltros(f: FiltrosDasContas): number {
  return [
    f.busca,
    f.vencimentoDe || f.vencimentoAte,
    f.pagamentoDe || f.pagamentoAte,
    f.pessoaId,
    f.forma,
    f.categoria,
    f.origem,
  ].filter(Boolean).length;
}

/** Os filtros de volta para o endereço, só os ativos. */
export function parametrosDosFiltros(f: FiltrosDasContas): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.busca) p.busca = f.busca;
  if (f.vencimentoDe) p.vencimentoDe = f.vencimentoDe;
  if (f.vencimentoAte) p.vencimentoAte = f.vencimentoAte;
  if (f.pagamentoDe) p.pagamentoDe = f.pagamentoDe;
  if (f.pagamentoAte) p.pagamentoAte = f.pagamentoAte;
  if (f.pessoaId) p.pessoa = f.pessoaId;
  if (f.forma) p.forma = f.forma;
  if (f.categoria) p.categoria = f.categoria;
  if (f.origem) p.origem = f.origem;
  return p;
}

/** Algum filtro de pagamento ativo: o total "Pago" soma só os pagamentos que atendem (5.6, item 4). */
export const filtraPagamentos = (f: FiltrosDasContas) => Boolean(f.pagamentoDe || f.pagamentoAte || f.forma);
