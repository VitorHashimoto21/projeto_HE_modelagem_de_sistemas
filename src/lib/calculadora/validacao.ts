import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { casasDecimais, lerNumero } from "@/lib/dominio/catalogo";

/**
 * Validação da Calculadora (SPEC-010, 5.2 e 5.5). Roda no navegador e no servidor.
 * Percentuais em % (15 = 15%); dinheiro devolvido em centavos.
 */

export const MENSAGENS_CALCULADORA = {
  margemInvalida: "Use uma margem de 0 a 99,99%, com até 2 casas",
  comissaoInvalida: "Use uma comissão de 0 a 99,99%, com até 2 casas",
  taxaInvalida: "Use uma taxa de 0 a 30%, com até 2 casas",
  percentualInvalido: "Use um percentual de 0 a 95%, com até 2 casas",
  capacidadeInvalida: "Use um número maior que zero, com até 2 casas",
  unidadeLonga: "Use no máximo 30 caracteres",
  valorInvalido: "Use um valor maior que zero, até R$ 9.999.999,99, com até 2 casas",
  arredondamentoInvalido: "Escolha o preço a confirmar",
  precoVistoInvalido: "Não foi possível ler o preço. Calcule de novo.",
} as const;

export type Validacao<T> = { ok: true; dados: T } | { ok: false; erros: ErrosDeCampo };

const vazio = (v: string | undefined) => !v || !v.trim();

/** Percentual opcional: vazio → null; senão entre mínimo e máximo, com até 2 casas. */
function lerPercentual(texto: string | undefined, max: number, campo: string, mensagem: string, erros: ErrosDeCampo, maxExclusivo = false): number | null {
  if (vazio(texto)) return null;
  const n = lerNumero(texto!.replace("%", ""));
  if (n === null || n < 0 || (maxExclusivo ? n >= max : n > max) || casasDecimais(n) > 2) {
    erros[campo] = mensagem;
    return null;
  }
  return n;
}

function lerReais(texto: string | undefined, campo: string, erros: ErrosDeCampo): number | null {
  if (vazio(texto)) return null;
  const n = lerNumero(texto);
  if (n === null || !(n > 0) || n > 9_999_999.99 || casasDecimais(n) > 2) {
    erros[campo] = MENSAGENS_CALCULADORA.valorInvalido;
    return null;
  }
  return Math.round(n * 100);
}

const resultado = <T>(erros: ErrosDeCampo, dados: () => T): Validacao<T> => (Object.keys(erros).length ? { ok: false, erros } : { ok: true, dados: dados() });

export type OpcoesDoCalculo = { margem: number | null; comissao: number | null };

/** Margem e comissão para simular (vazias → as sugeridas: categoria e item). */
export function validarOpcoes(campos: Record<string, string>): Validacao<OpcoesDoCalculo> {
  const erros: ErrosDeCampo = {};
  const margem = lerPercentual(campos.margem, 100, "margem", MENSAGENS_CALCULADORA.margemInvalida, erros, true);
  const comissao = lerPercentual(campos.comissao, 100, "comissao", MENSAGENS_CALCULADORA.comissaoInvalida, erros, true);
  return resultado(erros, () => ({ margem, comissao }));
}

export type DadosDaConfirmacao = { margem: number | null; arredondar: boolean; precoVistoCentavos: number };

/** Confirmação (5.3): só a margem, a escolha do arredondamento e o preço visto vêm do navegador. */
export function validarConfirmacao(campos: Record<string, string>): Validacao<DadosDaConfirmacao> {
  const erros: ErrosDeCampo = {};
  const margem = lerPercentual(campos.margem, 100, "margem", MENSAGENS_CALCULADORA.margemInvalida, erros, true);
  if (campos.arredondar !== "exato" && campos.arredondar !== "real") erros.arredondar = MENSAGENS_CALCULADORA.arredondamentoInvalido;
  const visto = Number(campos.precoVisto);
  if (!Number.isInteger(visto) || visto <= 0) erros.preco = MENSAGENS_CALCULADORA.precoVistoInvalido;
  return resultado(erros, () => ({ margem, arredondar: campos.arredondar === "real", precoVistoCentavos: visto }));
}

export type DadosDosParametros = {
  taxaCartao: number;
  capacidadeMensal: number | null;
  unidadeCapacidade: string | null;
  ticketMedioCentavos: number | null;
  faturamentoEstimadoCentavos: number | null;
  cmvEstimado: number | null;
  margemMeta: number | null;
};

/** Parâmetros de precificação (5.5). Faturamento estimado vazio → capacidade × ticket, se houver. */
export function validarParametros(campos: Record<string, string>): Validacao<DadosDosParametros> {
  const erros: ErrosDeCampo = {};
  const taxaCartao = lerPercentual(campos.taxaCartao, 30, "taxaCartao", MENSAGENS_CALCULADORA.taxaInvalida, erros) ?? 0;
  let capacidadeMensal: number | null = null;
  if (!vazio(campos.capacidadeMensal)) {
    const n = lerNumero(campos.capacidadeMensal);
    if (n === null || !(n > 0) || n > 99_999_999.99 || casasDecimais(n) > 2) erros.capacidadeMensal = MENSAGENS_CALCULADORA.capacidadeInvalida;
    else capacidadeMensal = n;
  }
  const unidadeCapacidade = (campos.unidadeCapacidade ?? "").trim().replace(/\s+/g, " ") || null;
  if (unidadeCapacidade && unidadeCapacidade.length > 30) erros.unidadeCapacidade = MENSAGENS_CALCULADORA.unidadeLonga;
  const ticketMedioCentavos = lerReais(campos.ticketMedio, "ticketMedio", erros);
  let faturamentoEstimadoCentavos = lerReais(campos.faturamentoEstimado, "faturamentoEstimado", erros);
  if (faturamentoEstimadoCentavos === null && !erros.faturamentoEstimado && capacidadeMensal !== null && ticketMedioCentavos !== null) {
    faturamentoEstimadoCentavos = faturamentoSugerido(capacidadeMensal, ticketMedioCentavos);
    if (faturamentoEstimadoCentavos > 999_999_999) erros.faturamentoEstimado = MENSAGENS_CALCULADORA.valorInvalido;
  }
  const cmvEstimado = lerPercentual(campos.cmvEstimado, 95, "cmvEstimado", MENSAGENS_CALCULADORA.percentualInvalido, erros);
  const margemMeta = lerPercentual(campos.margemMeta, 95, "margemMeta", MENSAGENS_CALCULADORA.percentualInvalido, erros);
  return resultado(erros, () => ({ taxaCartao, capacidadeMensal, unidadeCapacidade, ticketMedioCentavos, faturamentoEstimadoCentavos, cmvEstimado, margemMeta }));
}

/** Faturamento estimado sugerido = capacidade × ticket médio (RF50). */
export const faturamentoSugerido = (capacidade: number, ticketCentavos: number) => Math.round(capacidade * ticketCentavos);
