import { z } from "zod";
import { limparDescricao, textoSemAcentos } from "@/lib/dominio/ncm";

/**
 * Leitura do arquivo oficial da tabela NCM (SPEC-021, 5.1): o JSON do Classif (Portal Único
 * Siscomex), guardado sem edição. Valida o formato e devolve só os códigos de 8 dígitos, cada
 * um com o caminho (as descrições dos níveis acima) e o texto de busca.
 */

export const CAMINHO_DA_TABELA_NCM = "docs/prisma_base/tabela_ncm.json";

export class TabelaNcmInvalida extends Error {
  constructor(public readonly problemas: string[]) {
    super(`Arquivo da tabela NCM inválido:\n- ${problemas.slice(0, 20).join("\n- ")}${problemas.length > 20 ? `\n- … e mais ${problemas.length - 20}` : ""}`);
    this.name = "TabelaNcmInvalida";
  }
}

export type CodigoNcm = {
  codigo: string;
  descricao: string;
  caminho: string[];
  textoBusca: string;
  vigenteDesde: string;
  vigenteAte: string | null;
  ato: string;
};

export type TabelaNcmLida = { atualizadaEm: string; ato: string; codigos: CodigoNcm[] };

const esquema = z.object({
  Data_Ultima_Atualizacao_NCM: z.string(),
  Ato: z.string().trim().min(1),
  Nomenclaturas: z
    .array(
      z.object({
        Codigo: z.string(),
        Descricao: z.string(),
        Data_Inicio: z.string(),
        Data_Fim: z.string(),
        Tipo_Ato_Ini: z.string(),
        Numero_Ato_Ini: z.string(),
        Ano_Ato_Ini: z.string(),
      }),
    )
    .min(1),
});

/** "21/10/2026" → "2026-10-21"; data inexistente → null. */
function dataBrasileira(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(iso) ? iso : null;
}

/** O arquivo usa 31/12/9999 para "sem fim". */
const SEM_FIM = "9999-12-31";
/** Tamanhos dos níveis acima do código de 8 dígitos: capítulo, posição, subposições e item. */
const NIVEIS_ACIMA = [2, 4, 5, 6, 7];

export function lerTabelaNcm(json: unknown): TabelaNcmLida {
  const r = esquema.safeParse(json);
  if (!r.success) throw new TabelaNcmInvalida(r.error.issues.slice(0, 20).map((i) => `${i.path.join(".")}: ${i.message}`));
  const atualizadaEm = dataBrasileira(r.data.Data_Ultima_Atualizacao_NCM.replace(/^\D+/, ""));
  const problemas: string[] = [];
  if (!atualizadaEm) problemas.push(`data da atualização ilegível: "${r.data.Data_Ultima_Atualizacao_NCM}"`);

  // Descrição de cada nível (vigente), para montar o caminho dos códigos de 8 dígitos.
  const niveis = new Map<string, string>();
  const codigos: CodigoNcm[] = [];
  const vistos = new Set<string>();
  for (const n of r.data.Nomenclaturas) {
    const digitos = n.Codigo.replace(/\./g, "");
    if (!/^\d+$/.test(digitos) || ![...NIVEIS_ACIMA, 8].includes(digitos.length)) {
      problemas.push(`código fora do formato: "${n.Codigo}"`);
      continue;
    }
    const inicio = dataBrasileira(n.Data_Inicio);
    const fim = dataBrasileira(n.Data_Fim);
    if (!inicio || !fim) {
      problemas.push(`${n.Codigo}: data de vigência ilegível`);
      continue;
    }
    if (fim < inicio) problemas.push(`${n.Codigo}: fim da vigência antes do início`);
    const descricao = limparDescricao(n.Descricao);
    if (!descricao) problemas.push(`${n.Codigo}: descrição vazia`);
    if (digitos.length < 8) {
      niveis.set(digitos, descricao);
      continue;
    }
    const chave = `${digitos}|${inicio}`;
    if (vistos.has(chave)) problemas.push(`${n.Codigo}: código repetido na mesma vigência`);
    vistos.add(chave);
    codigos.push({
      codigo: digitos,
      descricao,
      caminho: [],
      textoBusca: "",
      vigenteDesde: inicio,
      vigenteAte: fim === SEM_FIM ? null : fim,
      ato: `${n.Tipo_Ato_Ini.trim()} ${n.Numero_Ato_Ini.trim()}/${n.Ano_Ato_Ini.trim()}`,
    });
  }

  for (const c of codigos) {
    c.caminho = NIVEIS_ACIMA.map((t) => niveis.get(c.codigo.slice(0, t))).filter((d): d is string => !!d);
    // A posição sem desdobramento vem como "0504.00" ou no próprio código ("0205.00.00"); o capítulo, sempre.
    if (!niveis.has(c.codigo.slice(0, 2))) problemas.push(`${c.codigo}: sem capítulo no arquivo`);
    // Sem o capítulo: a descrição dele resume todas as posições ("…; bijuterias; moedas") e faria
    // "bijuteria" achar o capítulo 71 inteiro antes das bijuterias de fato.
    c.textoBusca = textoSemAcentos([c.codigo, ...c.caminho.slice(1), c.descricao].join(" "));
  }
  if (codigos.length === 0) problemas.push("nenhum código de 8 dígitos");
  if (problemas.length) throw new TabelaNcmInvalida(problemas);
  return { atualizadaEm: atualizadaEm!, ato: r.data.Ato.trim(), codigos };
}
