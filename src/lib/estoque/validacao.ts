import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { casasDecimais, lerNumero } from "@/lib/dominio/catalogo";
import { dataPermitida, MOTIVOS_SAIDA, QUANTIDADE_MAXIMA, type MotivoSaida } from "@/lib/dominio/estoque";

/**
 * Validação do estoque (SPEC-007, 5.6). Roda no navegador e no servidor; "hoje" é o dia
 * local de São Paulo, informado por quem chama (no servidor, sempre o relógio do servidor).
 */

export const MENSAGENS_ESTOQUE = {
  quantidadeObrigatoria: "Informe a quantidade",
  quantidadeInvalida: "Use uma quantidade maior que zero, com até 3 casas decimais",
  dataObrigatoria: "Informe a data",
  dataInvalida: "Use uma data entre hoje e 90 dias atrás",
  motivoObrigatorio: "Escolha o motivo da saída",
  observacaoObrigatoria: 'Descreva o motivo quando escolher "Outro"',
  observacaoLonga: "Use no máximo 200 caracteres",
  minimoInvalido: "Use um número maior ou igual a zero, com até 3 casas decimais",
  diasInvalidos: "Use um número inteiro de 1 a 90",
} as const;

export type DadosDaMovimentacao = {
  quantidade: number;
  /** Dia local da ocorrência (AAAA-MM-DD). */
  dia: string;
  motivo: MotivoSaida | null;
  observacao: string | null;
};

export type Validacao<T> = { ok: true; dados: T } | { ok: false; erros: ErrosDeCampo };

const vazio = (v: string | undefined) => !v || !v.trim();

function lerQuantidade(texto: string | undefined, erros: ErrosDeCampo): number | null {
  if (vazio(texto)) {
    erros.quantidade = MENSAGENS_ESTOQUE.quantidadeObrigatoria;
    return null;
  }
  const n = lerNumero(texto);
  if (n === null || !(n > 0) || n > QUANTIDADE_MAXIMA || casasDecimais(n) > 3) {
    erros.quantidade = MENSAGENS_ESTOQUE.quantidadeInvalida;
    return null;
  }
  return n;
}

/** Entrada (UC7) ou saída manual (UC8, com motivo). */
export function validarMovimentacao(
  campos: Record<string, string>,
  tipo: "entrada" | "saida",
  hoje: string,
): Validacao<DadosDaMovimentacao> {
  const erros: ErrosDeCampo = {};
  const quantidade = lerQuantidade(campos.quantidade, erros);

  const dia = (campos.data ?? "").trim();
  if (!dia) erros.data = MENSAGENS_ESTOQUE.dataObrigatoria;
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || Number.isNaN(Date.parse(`${dia}T00:00:00Z`)) || !dataPermitida(dia, hoje)) {
    erros.data = MENSAGENS_ESTOQUE.dataInvalida;
  }

  let motivo: MotivoSaida | null = null;
  if (tipo === "saida") {
    if (Object.hasOwn(MOTIVOS_SAIDA, campos.motivo ?? "")) motivo = campos.motivo as MotivoSaida;
    else erros.motivo = MENSAGENS_ESTOQUE.motivoObrigatorio;
  }

  const observacao = (campos.observacao ?? "").trim().replace(/\s+/g, " ") || null;
  if (observacao && observacao.length > 200) erros.observacao = MENSAGENS_ESTOQUE.observacaoLonga;
  else if (motivo === "OUTRO" && !observacao) erros.observacao = MENSAGENS_ESTOQUE.observacaoObrigatoria;

  if (Object.keys(erros).length) return { ok: false, erros };
  return { ok: true, dados: { quantidade: quantidade!, dia, motivo, observacao } };
}

/** Mínimo manual (5.3): vazio = remover e voltar à sugestão. */
export function validarMinimo(campos: Record<string, string>): Validacao<number | null> {
  if (vazio(campos.estoqueMinimo)) return { ok: true, dados: null };
  const n = lerNumero(campos.estoqueMinimo);
  if (n === null || n < 0 || n > QUANTIDADE_MAXIMA || casasDecimais(n) > 3) {
    return { ok: false, erros: { estoqueMinimo: MENSAGENS_ESTOQUE.minimoInvalido } };
  }
  return { ok: true, dados: n };
}

/** Dias de cobertura do negócio (OPEN-010): inteiro de 1 a 90. */
export function validarDiasCobertura(campos: Record<string, string>): Validacao<number> {
  const texto = (campos.diasCoberturaEstoque ?? "").trim();
  const n = Number(texto);
  if (!/^\d+$/.test(texto) || n < 1 || n > 90) return { ok: false, erros: { diasCoberturaEstoque: MENSAGENS_ESTOQUE.diasInvalidos } };
  return { ok: true, dados: n };
}
