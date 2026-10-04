import { z } from "zod";
import { AnexoSimples, AtividadeMei, CategoriaItem } from "@/generated/prisma/enums";
import { impostoDaFaixa, normalizarCnae } from "@/lib/dominio/fiscal";

/**
 * Validação do arquivo de parâmetros fiscais (SPEC-003, seção 6), antes de qualquer
 * gravação. Chaves que começam com "_" são comentários e são ignoradas.
 */

export const CAMINHO_DO_ARQUIVO = "docs/prisma_base/parametros_fiscais_seed.json";

/** Tolerância (R$) da continuidade do imposto nas fronteiras das faixas (INV-003). */
const TOLERANCIA_CONTINUIDADE = 1;
/** A quebra entre as faixas 5 e 6 é esperada (sublimite de R$ 3,6 milhões). */
const ULTIMA_FRONTEIRA_CONTINUA = 4;

const data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "vigenteDesde deve ser uma data AAAA-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), "data inexistente");
const fonteLegal = z.string().trim().min(1, "fonte legal vazia (RN17)");
const valor = z.number().finite();
const enumDe = <T extends Record<string, string>>(e: T) => z.enum(Object.values(e) as [T[keyof T], ...T[keyof T][]]);

const semComentarios = (v: unknown) =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith("_")))
    : v;
const registro = <S extends z.ZodRawShape>(forma: S) => z.preprocess(semComentarios, z.strictObject(forma));

const esquemaFaixa = registro({
  anexo: enumDe(AnexoSimples),
  faixaOrdem: z.number().int().min(1).max(6),
  rbt12De: valor.min(0),
  rbt12Ate: valor.positive(),
  aliquota: valor.min(0).max(100),
  parcelaDeduzir: valor.min(0),
  fonteLegal,
  vigenteDesde: data,
});
const esquemaCnae = registro({
  cnae: z.string().refine((v) => normalizarCnae(v) === v, "CNAE deve estar no formato 0000-0/00"),
  descricao: z.string().trim().min(1),
  anexo: enumDe(AnexoSimples),
  sujeitoFatorR: z.boolean(),
  fonteLegal,
  vigenteDesde: data,
});
const esquemaMei = registro({
  atividade: enumDe(AtividadeMei),
  valorDasMensal: valor.positive(),
  limiteFaturamentoAnual: valor.positive(),
  fonteLegal,
  vigenteDesde: data,
});
const esquemaFatorR = registro({
  limiteMinimo: valor.gt(0).lt(100),
  anexoSeAtingir: enumDe(AnexoSimples),
  anexoSeNaoAtingir: enumDe(AnexoSimples),
  fonteLegal,
  vigenteDesde: data,
});
const esquemaMargem = registro({
  categoria: enumDe(CategoriaItem),
  margemPadrao: valor.min(0).lt(100),
  fonteLegal,
  vigenteDesde: data,
});

const esquemaArquivo = registro({
  faixaTributaria: z.array(esquemaFaixa).min(1),
  cnaeAnexo: z.array(esquemaCnae).min(1),
  parametroMei: z.array(esquemaMei).min(1),
  parametroFatorR: z.array(esquemaFatorR).min(1),
  margemPadraoCategoria: z.array(esquemaMargem).min(1),
});

export type ParametrosFiscais = z.output<typeof esquemaArquivo>;
export type TabelaFiscal = keyof ParametrosFiscais;

export class ArquivoInvalido extends Error {
  constructor(public readonly problemas: string[]) {
    super(`Arquivo de parâmetros fiscais inválido:\n- ${problemas.join("\n- ")}`);
    this.name = "ArquivoInvalido";
  }
}

const agrupar = <T>(lista: T[], chave: (x: T) => string) => {
  const grupos = new Map<string, T[]>();
  for (const x of lista) grupos.set(chave(x), [...(grupos.get(chave(x)) ?? []), x]);
  return grupos;
};

function duplicados<T>(tabela: string, lista: T[], chave: (x: T) => string, problemas: string[]) {
  for (const [k, grupo] of agrupar(lista, chave)) {
    if (grupo.length > 1) problemas.push(`${tabela}, ${k}: registro repetido para a mesma chave e vigência (INV-004)`);
  }
}

function faltando(tabela: string, presentes: Iterable<string>, esperados: string[], problemas: string[]) {
  const conjunto = new Set(presentes);
  for (const e of esperados) if (!conjunto.has(e)) problemas.push(`${tabela}: falta ${e} (INV-008)`);
}

/** Regras entre registros (INV-002, INV-003, INV-004, INV-008). */
function validarConsistencia(p: ParametrosFiscais): string[] {
  const problemas: string[] = [];

  // Faixas: cada (Anexo, vigência) tem as 6 faixas, contínuas e com imposto contínuo.
  duplicados("faixaTributaria", p.faixaTributaria, (f) => `Anexo ${f.anexo}, faixa ${f.faixaOrdem}, vigência ${f.vigenteDesde}`, problemas);
  faltando("faixaTributaria", p.faixaTributaria.map((f) => `Anexo ${f.anexo}`), Object.values(AnexoSimples).map((a) => `Anexo ${a}`), problemas);
  for (const [grupo, faixas] of agrupar(p.faixaTributaria, (f) => `Anexo ${f.anexo}, vigência ${f.vigenteDesde}`)) {
    const ordenadas = [...faixas].sort((a, b) => a.faixaOrdem - b.faixaOrdem);
    const ordens = ordenadas.map((f) => f.faixaOrdem).join(",");
    if (ordens !== "1,2,3,4,5,6") {
      problemas.push(`faixaTributaria, ${grupo}: deve ter as faixas 1 a 6 (tem ${ordens})`);
      continue;
    }
    if (ordenadas[0].rbt12De !== 0) problemas.push(`faixaTributaria, ${grupo}, faixa 1: rbt12De deve ser 0 (INV-002)`);
    for (const f of ordenadas) {
      if (f.rbt12Ate <= f.rbt12De) problemas.push(`faixaTributaria, ${grupo}, faixa ${f.faixaOrdem}: rbt12Ate deve ser maior que rbt12De`);
    }
    for (let i = 1; i < ordenadas.length; i++) {
      const [ant, atual] = [ordenadas[i - 1], ordenadas[i]];
      if (atual.rbt12De !== ant.rbt12Ate) {
        problemas.push(
          `faixaTributaria, ${grupo}, faixa ${atual.faixaOrdem}: rbt12De ${atual.rbt12De} ≠ rbt12Ate da faixa ${ant.faixaOrdem} (${ant.rbt12Ate}) — buraco ou sobreposição (INV-002)`,
        );
      } else if (ant.faixaOrdem <= ULTIMA_FRONTEIRA_CONTINUA) {
        const diferenca = Math.abs(impostoDaFaixa(ant, ant.rbt12Ate) - impostoDaFaixa(atual, ant.rbt12Ate));
        if (diferenca > TOLERANCIA_CONTINUIDADE) {
          problemas.push(
            `faixaTributaria, ${grupo}: imposto descontínuo entre as faixas ${ant.faixaOrdem} e ${atual.faixaOrdem} (diferença de R$ ${diferenca.toFixed(2)}) — confira alíquota e parcela a deduzir (INV-003)`,
          );
        }
      }
    }
  }

  duplicados("cnaeAnexo", p.cnaeAnexo, (c) => `CNAE ${c.cnae}, vigência ${c.vigenteDesde}`, problemas);

  duplicados("parametroMei", p.parametroMei, (m) => `${m.atividade}, vigência ${m.vigenteDesde}`, problemas);
  faltando("parametroMei", p.parametroMei.map((m) => m.atividade), Object.values(AtividadeMei), problemas);

  duplicados("parametroFatorR", p.parametroFatorR, (r) => `vigência ${r.vigenteDesde}`, problemas);
  for (const r of p.parametroFatorR) {
    if (r.anexoSeAtingir === r.anexoSeNaoAtingir) problemas.push(`parametroFatorR, vigência ${r.vigenteDesde}: os dois anexos são iguais`);
  }

  duplicados("margemPadraoCategoria", p.margemPadraoCategoria, (m) => `${m.categoria}, vigência ${m.vigenteDesde}`, problemas);
  faltando("margemPadraoCategoria", p.margemPadraoCategoria.map((m) => m.categoria), Object.values(CategoriaItem), problemas);

  return problemas;
}

/** Valida o conteúdo do arquivo (já lido como JSON). Lança ArquivoInvalido com todos os problemas. */
export function validarParametros(conteudo: unknown): ParametrosFiscais {
  const r = esquemaArquivo.safeParse(conteudo);
  if (!r.success) {
    throw new ArquivoInvalido(
      r.error.issues.map((i) => `${i.path.length ? i.path.join(".") : "arquivo"}: ${i.message}`),
    );
  }
  const problemas = validarConsistencia(r.data);
  if (problemas.length) throw new ArquivoInvalido(problemas);
  return r.data;
}

/**
 * Avisos que não impedem a carga (OPEN-006): o DAS do MEI muda todo janeiro com o
 * salário mínimo; se a versão mais nova é de um ano anterior, alguém precisa atualizar.
 */
export function avisosDosParametros(p: ParametrosFiscais, hoje = new Date()): string[] {
  const anoMaisNovo = Math.max(...p.parametroMei.map((m) => Number(m.vigenteDesde.slice(0, 4))));
  const anoAtual = hoje.getUTCFullYear();
  return anoMaisNovo < anoAtual
    ? [`O DAS do MEI mais recente é de ${anoMaisNovo}. Atualize parametroMei com o salário mínimo de ${anoAtual} (veja o README).`]
    : [];
}
