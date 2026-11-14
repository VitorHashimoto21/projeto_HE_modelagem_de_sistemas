/**
 * NCM — Nomenclatura Comum do Mercosul (SPEC-021). Funções puras: ler o que a pessoa digita,
 * formatar, montar o texto de busca e decidir se um código está vigente num dia.
 */

/** Separadores aceitos ao digitar um código (ex.: "7117.19.00", "7117 19 00", "7117-19-00"). */
const SEPARADORES = /[\s.\-]/g;

/** Os 8 dígitos do NCM informado, ou null se não for um código completo. Vazio também é null. */
export function lerNcm(texto: string | null | undefined): string | null {
  const digitos = (texto ?? "").replace(SEPARADORES, "");
  return /^\d{8}$/.test(digitos) ? digitos : null;
}

/** "71171900" → "7117.19.00". */
export function formatarNcm(codigo: string): string {
  return /^\d{8}$/.test(codigo) ? `${codigo.slice(0, 4)}.${codigo.slice(4, 6)}.${codigo.slice(6)}` : codigo;
}

/** Texto em minúsculas, sem acentos e com os espaços juntados — usado na busca e na carga. */
export function textoSemAcentos(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Mínimos da busca na tabela (5.2): 2 dígitos para código, 3 letras para palavras. */
export const MINIMO_DIGITOS = 2;
export const MINIMO_LETRAS = 3;
/** Resultados mostrados na gaveta de busca (5.2). */
export const LIMITE_DA_BUSCA = 20;

export type TermosDaBusca = { tipo: "codigo"; prefixo: string } | { tipo: "palavras"; palavras: string[] } | { tipo: "curta" };

/**
 * Como interpretar o que foi digitado na busca da tabela (5.2):
 * só dígitos (com pontos, traços ou espaços) → começo do código; com letras → todas as palavras.
 */
export function termosDaBusca(texto: string): TermosDaBusca {
  const limpo = texto.trim();
  const digitos = limpo.replace(SEPARADORES, "");
  if (/^\d+$/.test(digitos)) {
    return digitos.length >= MINIMO_DIGITOS ? { tipo: "codigo", prefixo: digitos.slice(0, 8) } : { tipo: "curta" };
  }
  const normalizado = textoSemAcentos(limpo);
  if (normalizado.replace(/[^a-z0-9]/g, "").length < MINIMO_LETRAS) return { tipo: "curta" };
  return { tipo: "palavras", palavras: normalizado.split(" ").filter(Boolean) };
}

/**
 * Começo de NCM na busca do Catálogo e do Estoque (5.5): só dígitos, com ou sem pontos e
 * espaços, e pelo menos 2 dígitos. Senão, null (a busca fica só no nome e na subcategoria).
 */
export function prefixoDeNcmNaBusca(texto: string | undefined): string | null {
  const t = termosDaBusca(texto ?? "");
  return t.tipo === "codigo" ? t.prefixo : null;
}

/** Descrição de um nível da tabela sem os traços do começo e a pontuação do fim ("-- Outras:" → "Outras"). */
export function limparDescricao(descricao: string): string {
  return descricao
    .replace(/^[\s\-–]+/, "")
    .replace(/[\s:;.]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Descrição para mostrar (5.2, 5.4): os níveis do caminho, sem o capítulo (longo demais), e o
 * próprio código. Ex.: "Bijuterias › De metais comuns, mesmo prateados, dourados ou platinados › Outras".
 */
export function descricaoDoNcm(caminho: string[], descricao: string): string {
  return [...caminho.slice(1), descricao].join(" › ");
}

export type Vigencia = { vigenteDesde: string; vigenteAte: string | null };

/** Vigente no dia (AAAA-MM-DD, fuso de São Paulo — RN29): entre o início e o fim, inclusive. */
export function vigenteNoDia(v: Vigencia, dia: string): boolean {
  return v.vigenteDesde <= dia && (v.vigenteAte === null || v.vigenteAte >= dia);
}
