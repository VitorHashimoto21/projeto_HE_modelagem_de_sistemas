import type { ParametrosFiscais, TabelaFiscal } from "./arquivo";

/**
 * Plano de carga (SPEC-003, 5.1): compara o arquivo com o que está no banco, registro
 * a registro, pela chave e pela vigência. Função pura — a gravação fica no comando de carga.
 */

export const TABELAS_FISCAIS: TabelaFiscal[] = [
  "faixaTributaria",
  "cnaeAnexo",
  "parametroMei",
  "parametroFatorR",
  "margemPadraoCategoria",
];

/** Campos que identificam o parâmetro (além da vigência). */
export const CAMPOS_DA_CHAVE: Record<TabelaFiscal, string[]> = {
  faixaTributaria: ["anexo", "faixaOrdem"],
  cnaeAnexo: ["cnae"],
  parametroMei: ["atividade"],
  parametroFatorR: [],
  margemPadraoCategoria: ["categoria"],
};

export type Valor = string | number | boolean;
export type Registro = Record<string, Valor> & { vigenteDesde: string };

export type Operacao =
  /** Chave nova ou nova vigência de uma chave existente. */
  | { tipo: "criar"; tabela: TabelaFiscal; registro: Registro; novaVersao: boolean }
  | { tipo: "inalterado"; tabela: TabelaFiscal; registro: Registro }
  /** Mesmo valor de chave e vigência, com outro valor: só com --corrigir (OPEN-002). */
  | { tipo: "corrigir"; tabela: TabelaFiscal; registro: Registro; anterior: Registro };

export type PlanoDeCarga = {
  operacoes: Operacao[];
  /** Valor diferente para a mesma chave e vigência, sem --corrigir. */
  conflitos: string[];
  /** Versões no banco que não estão no arquivo (nunca são apagadas). */
  somenteNoBanco: string[];
};

export const descreverChave = (tabela: TabelaFiscal, r: Registro) => {
  const partes = CAMPOS_DA_CHAVE[tabela].map((c) => `${c} ${r[c]}`);
  return `${tabela}${partes.length ? `, ${partes.join(", ")}` : ""}, vigência ${r.vigenteDesde}`;
};

const chaveDe = (tabela: TabelaFiscal, r: Registro) => CAMPOS_DA_CHAVE[tabela].map((c) => String(r[c])).join("|");
const chaveComVigencia = (tabela: TabelaFiscal, r: Registro) => `${chaveDe(tabela, r)}@${r.vigenteDesde}`;

/** Igualdade de valores: números comparados como números (o banco devolve "7.30" para 7.3). */
function mesmoValor(a: Valor | undefined, b: Valor | undefined): boolean {
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return a === b;
}

function diferencas(tabela: TabelaFiscal, arquivo: Registro, banco: Registro): string[] {
  const ignorar = new Set([...CAMPOS_DA_CHAVE[tabela], "vigenteDesde"]);
  return Object.keys(arquivo).filter((c) => !ignorar.has(c) && !mesmoValor(arquivo[c], banco[c]));
}

export function planejarCarga(
  parametros: ParametrosFiscais,
  noBanco: Record<TabelaFiscal, Registro[]>,
  opcoes: { corrigir?: boolean } = {},
): PlanoDeCarga {
  const operacoes: Operacao[] = [];
  const conflitos: string[] = [];
  const somenteNoBanco: string[] = [];

  for (const tabela of TABELAS_FISCAIS) {
    const doArquivo = parametros[tabela] as Registro[];
    const existentes = new Map(noBanco[tabela].map((r) => [chaveComVigencia(tabela, r), r]));
    const chavesExistentes = new Set(noBanco[tabela].map((r) => chaveDe(tabela, r)));

    for (const registro of doArquivo) {
      const anterior = existentes.get(chaveComVigencia(tabela, registro));
      if (!anterior) {
        operacoes.push({ tipo: "criar", tabela, registro, novaVersao: chavesExistentes.has(chaveDe(tabela, registro)) });
        continue;
      }
      const campos = diferencas(tabela, registro, anterior);
      if (campos.length === 0) {
        operacoes.push({ tipo: "inalterado", tabela, registro });
      } else if (opcoes.corrigir) {
        operacoes.push({ tipo: "corrigir", tabela, registro, anterior });
      } else {
        conflitos.push(
          `${descreverChave(tabela, registro)}: ${campos.join(", ")} diferente do valor já carregado. ` +
            "Se a lei mudou, inclua um novo registro com a nova vigenteDesde; se foi erro de digitação, rode a carga com --corrigir.",
        );
      }
    }

    const noArquivo = new Set(doArquivo.map((r) => chaveComVigencia(tabela, r)));
    for (const r of noBanco[tabela]) {
      if (!noArquivo.has(chaveComVigencia(tabela, r))) somenteNoBanco.push(descreverChave(tabela, r));
    }
  }

  return { operacoes, conflitos, somenteNoBanco };
}

export type Resumo = Record<TabelaFiscal, { criados: number; novasVersoes: number; inalterados: number; corrigidos: number }>;

export function resumirPlano(plano: PlanoDeCarga): Resumo {
  const resumo = Object.fromEntries(
    TABELAS_FISCAIS.map((t) => [t, { criados: 0, novasVersoes: 0, inalterados: 0, corrigidos: 0 }]),
  ) as Resumo;
  for (const op of plano.operacoes) {
    const linha = resumo[op.tabela];
    if (op.tipo === "criar") {
      if (op.novaVersao) linha.novasVersoes++;
      else linha.criados++;
    } else if (op.tipo === "inalterado") linha.inalterados++;
    else linha.corrigidos++;
  }
  return resumo;
}
