import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { casasDecimais, lerNumero } from "@/lib/dominio/catalogo";
import {
  CATEGORIAS,
  dataPermitidaNoFinanceiro,
  DIAS_RETROATIVOS_FINANCEIRO,
  TAMANHO_DESCRICAO,
  VALOR_MAXIMO_CENTAVOS,
  type Categoria,
  type TipoDeLancamento,
} from "@/lib/dominio/financeiro";
import { ehForma, MAX_NUMERO_DOCUMENTO, type FormaDoPagamento } from "@/lib/dominio/contas";

/**
 * Validação do Financeiro (SPEC-009, 5.7). Roda no navegador e no servidor; "hoje" é o dia
 * local de São Paulo, informado por quem chama (no servidor, sempre o relógio do servidor).
 */

export const MENSAGENS_FINANCEIRO = {
  valorObrigatorio: "Informe o valor",
  valorInvalido: "Use um valor maior que zero, até R$ 9.999.999,99, com até 2 casas",
  tipoInvalido: "Escolha entrada ou saída",
  tipoContaInvalido: "Escolha a pagar ou a receber",
  categoriaInvalida: "Escolha a categoria",
  descricaoObrigatoria: "Informe a descrição",
  descricaoLonga: `Use no máximo ${TAMANHO_DESCRICAO} caracteres`,
  dataObrigatoria: "Informe a data",
  dataInvalida: `Use uma data entre hoje e ${DIAS_RETROATIVOS_FINANCEIRO} dias atrás`,
  vencimentoObrigatorio: "Informe o vencimento",
  vencimentoInvalido: "Use uma data válida",
  diaInvalido: "Use um dia de 1 a 31",
  // SPEC-026
  formaObrigatoria: "Escolha a forma do pagamento.",
  numeroDocumentoLongo: `Use no máximo ${MAX_NUMERO_DOCUMENTO} caracteres`,
  pessoaInvalida: "Escolha uma opção da lista",
} as const;

export type Validacao<T> = { ok: true; dados: T } | { ok: false; erros: ErrosDeCampo };

export type DadosDoLancamento = { tipo: TipoDeLancamento; valorCentavos: number; categoria: Categoria; descricao: string; dia: string };
export type DadosDoSaldoInicial = { valorCentavos: number; dia: string };
/** SPEC-026 (5.4): o fornecedor (a pagar) ou o cliente (a receber) e o nº do documento, opcionais. */
export type DadosDoVinculo = { pessoaId: string | null; numeroDocumento: string | null };
export type DadosDaConta = { tipo: "PAGAR" | "RECEBER"; descricao: string; categoria: Categoria; valorCentavos: number; vencimento: string } & DadosDoVinculo;
export type DadosDoPagamento = { valorCentavos: number; dia: string; forma: FormaDoPagamento };
export type DadosDaDespesa = { descricao: string; valorCentavos: number; diaVencimento: number; categoria: Categoria; fornecedorId: string | null };

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const diaValido = (d: string) => {
  if (!DIA.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
};

function lerValor(texto: string | undefined, erros: ErrosDeCampo, campo = "valor"): number | null {
  if (!texto || !texto.trim()) {
    erros[campo] = MENSAGENS_FINANCEIRO.valorObrigatorio;
    return null;
  }
  const n = lerNumero(texto);
  const centavos = n === null ? NaN : Math.round(n * 100);
  if (n === null || !(n > 0) || casasDecimais(n) > 2 || centavos > VALOR_MAXIMO_CENTAVOS) {
    erros[campo] = MENSAGENS_FINANCEIRO.valorInvalido;
    return null;
  }
  return centavos;
}

function lerDescricao(texto: string | undefined, erros: ErrosDeCampo): string {
  const d = (texto ?? "").trim().replace(/\s+/g, " ");
  if (!d) erros.descricao = MENSAGENS_FINANCEIRO.descricaoObrigatoria;
  else if (d.length > TAMANHO_DESCRICAO) erros.descricao = MENSAGENS_FINANCEIRO.descricaoLonga;
  return d;
}

function lerCategoria(texto: string | undefined, erros: ErrosDeCampo): Categoria {
  if (!Object.hasOwn(CATEGORIAS, texto ?? "")) erros.categoria = MENSAGENS_FINANCEIRO.categoriaInvalida;
  return texto as Categoria;
}

function lerData(texto: string | undefined, hoje: string, erros: ErrosDeCampo): string {
  const dia = (texto ?? "").trim();
  if (!dia) erros.data = MENSAGENS_FINANCEIRO.dataObrigatoria;
  else if (!diaValido(dia) || !dataPermitidaNoFinanceiro(dia, hoje)) erros.data = MENSAGENS_FINANCEIRO.dataInvalida;
  return dia;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fornecedor ou cliente escolhido na lista (vazio = sem). A existência é conferida no banco. */
function lerPessoa(texto: string | undefined, erros: ErrosDeCampo, campo = "pessoa"): string | null {
  const id = (texto ?? "").trim();
  if (!id) return null;
  if (!UUID.test(id)) {
    erros[campo] = MENSAGENS_FINANCEIRO.pessoaInvalida;
    return null;
  }
  return id.toLowerCase();
}

function lerNumeroDocumento(texto: string | undefined, erros: ErrosDeCampo): string | null {
  const n = (texto ?? "").trim().replace(/\s+/g, " ");
  if (n.length > MAX_NUMERO_DOCUMENTO) erros.numeroDocumento = MENSAGENS_FINANCEIRO.numeroDocumentoLongo;
  return n || null;
}

const resultado = <T>(erros: ErrosDeCampo, dados: () => T): Validacao<T> =>
  Object.keys(erros).length ? { ok: false, erros } : { ok: true, dados: dados() };

/** Lançamento avulso (UC12a, OPEN-002). */
export function validarLancamento(campos: Record<string, string>, hoje: string): Validacao<DadosDoLancamento> {
  const erros: ErrosDeCampo = {};
  const tipo = campos.tipo;
  if (tipo !== "ENTRADA" && tipo !== "SAIDA") erros.tipo = MENSAGENS_FINANCEIRO.tipoInvalido;
  const valorCentavos = lerValor(campos.valor, erros);
  const categoria = lerCategoria(campos.categoria, erros);
  const descricao = lerDescricao(campos.descricao, erros);
  const dia = lerData(campos.data, hoje, erros);
  return resultado(erros, () => ({ tipo: tipo as TipoDeLancamento, valorCentavos: valorCentavos!, categoria, descricao, dia }));
}

/** Saldo inicial (OPEN-001): valor positivo e data. Saldo zero não precisa ser informado. */
export function validarSaldoInicial(campos: Record<string, string>, hoje: string): Validacao<DadosDoSaldoInicial> {
  const erros: ErrosDeCampo = {};
  const valorCentavos = lerValor(campos.valor, erros);
  const dia = lerData(campos.data, hoje, erros);
  return resultado(erros, () => ({ valorCentavos: valorCentavos!, dia }));
}

/** Conta manual (5.3): vencimento pode ser passado ou futuro (até 10 anos de distância). */
export function validarConta(campos: Record<string, string>, hoje: string): Validacao<DadosDaConta> {
  const erros: ErrosDeCampo = {};
  const tipo = campos.tipo;
  if (tipo !== "PAGAR" && tipo !== "RECEBER") erros.tipo = MENSAGENS_FINANCEIRO.tipoContaInvalido;
  const descricao = lerDescricao(campos.descricao, erros);
  const categoria = lerCategoria(campos.categoria, erros);
  const valorCentavos = lerValor(campos.valor, erros);
  const vencimento = (campos.vencimento ?? "").trim();
  const ano = Number(hoje.slice(0, 4));
  if (!vencimento) erros.vencimento = MENSAGENS_FINANCEIRO.vencimentoObrigatorio;
  else if (!diaValido(vencimento) || Math.abs(Number(vencimento.slice(0, 4)) - ano) > 10) erros.vencimento = MENSAGENS_FINANCEIRO.vencimentoInvalido;
  const vinculo = lerVinculo(campos, erros);
  return resultado(erros, () => ({ tipo: tipo as "PAGAR" | "RECEBER", descricao, categoria, valorCentavos: valorCentavos!, vencimento, ...vinculo }));
}

function lerVinculo(campos: Record<string, string>, erros: ErrosDeCampo): DadosDoVinculo {
  return { pessoaId: lerPessoa(campos.pessoa, erros), numeroDocumento: lerNumeroDocumento(campos.numeroDocumento, erros) };
}

/** Correção do fornecedor ou cliente e do nº do documento (SPEC-026, 5.4, item 5), em qualquer conta. */
export function validarVinculo(campos: Record<string, string>): Validacao<DadosDoVinculo> {
  const erros: ErrosDeCampo = {};
  const vinculo = lerVinculo(campos, erros);
  return resultado(erros, () => vinculo);
}

/** Pagamento ou recebimento (5.3): o limite do restante é conferido no banco. */
export function validarPagamento(campos: Record<string, string>, hoje: string): Validacao<DadosDoPagamento> {
  const erros: ErrosDeCampo = {};
  const valorCentavos = lerValor(campos.valor, erros);
  const dia = lerData(campos.data, hoje, erros);
  // SPEC-026 (OPEN-008): a forma é obrigatória.
  const forma = (campos.forma ?? "").trim();
  if (!ehForma(forma)) erros.forma = MENSAGENS_FINANCEIRO.formaObrigatoria;
  return resultado(erros, () => ({ valorCentavos: valorCentavos!, dia, forma: forma as FormaDoPagamento }));
}

/** Dia de vencimento da despesa fixa: inteiro de 1 a 31. */
export function validarDiaVencimento(campos: Record<string, string>): Validacao<number> {
  const texto = (campos.diaVencimento ?? "").trim();
  const n = Number(texto);
  if (!/^\d{1,2}$/.test(texto) || n < 1 || n > 31) return { ok: false, erros: { diaVencimento: MENSAGENS_FINANCEIRO.diaInvalido } };
  return { ok: true, dados: n };
}

/** Despesa fixa manual (5.5). O DAS do MEI só valida o dia (validarDiaVencimento). */
export function validarDespesa(campos: Record<string, string>): Validacao<DadosDaDespesa> {
  const erros: ErrosDeCampo = {};
  const descricao = lerDescricao(campos.descricao, erros);
  const valorCentavos = lerValor(campos.valor, erros);
  const dia = validarDiaVencimento(campos);
  if (!dia.ok) Object.assign(erros, dia.erros);
  const categoria = lerCategoria(campos.categoria || "OUTROS", erros);
  const fornecedorId = lerPessoa(campos.fornecedor, erros, "fornecedor");
  return resultado(erros, () => ({ descricao, valorCentavos: valorCentavos!, diaVencimento: (dia as { dados: number }).dados, categoria, fornecedorId }));
}
