/**
 * LGPD (SPEC-014). Puro: valores anônimos, confirmação da exclusão e montagem dos arquivos
 * da exportação. Os valores já chegam serializáveis (Decimal e datas como texto).
 */
import { gerarCsv } from "./relatorios";

export const NOME_ANONIMO = "Usuário excluído";
export const CLIENTE_ANONIMO = "Cliente anonimizado";
export const DOMINIO_ANONIMO = "anonimo.invalid";
/** E-mail único e não entregável (RFC 2606) que substitui o do titular. */
export const emailAnonimo = (id: string) => `excluido-${id}@${DOMINIO_ANONIMO}`;
export const emailDeConviteAnonimo = (id: string) => `convite-${id}@${DOMINIO_ANONIMO}`;
export const ANOS_DE_RETENCAO = 5;
export const DIAS_ATE_LIMPAR_CONVITE = 90;

/** Data prevista de eliminação (OPEN-005): o dia do encerramento + 5 anos (29/02 vira 28/02). */
export function dataDeEliminacao(diaDoEncerramento: string): string {
  const [a, m, d] = diaDoEncerramento.split("-").map(Number);
  const alvo = a + ANOS_DE_RETENCAO;
  const ultimo = new Date(Date.UTC(alvo, m, 0)).getUTCDate();
  return `${alvo}-${String(m).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

export const MENSAGENS_LGPD = {
  emailDiferente: "Digite o e-mail desta conta, exatamente como aparece acima.",
  semCiencia: "Marque que você entende que a exclusão é definitiva.",
  jaExcluida: "Esta conta já foi excluída.",
  falhaInterna: "Não foi possível excluir a conta agora. Nada foi alterado; tente novamente.",
  excluida: "Sua conta foi excluída. Os seus dados pessoais foram anonimizados.",
} as const;

/** Confirmação da exclusão (OPEN-002): o e-mail da conta digitado e a ciência marcada. */
export function conferirConfirmacao(campos: { email?: string; ciencia?: string }, emailDaConta: string): { ok: true } | { ok: false; erros: Partial<Record<"email" | "ciencia", string>> } {
  const erros: Partial<Record<"email" | "ciencia", string>> = {};
  if ((campos.email ?? "").trim().toLowerCase() !== emailDaConta.trim().toLowerCase()) erros.email = MENSAGENS_LGPD.emailDiferente;
  if (campos.ciencia !== "on") erros.ciencia = MENSAGENS_LGPD.semCiencia;
  return Object.keys(erros).length ? { ok: false, erros } : { ok: true };
}

// ---------- Exportação (RNF04, OPEN-004) ----------

export type Valor = string | number | boolean | null;
export type Linha = Record<string, Valor>;
export type Tabelas = Record<string, Linha[]>;

export type DadosDoTitular = {
  geradoEm: string;
  titular: Linha;
  vinculos: Linha[];
  convitesRecebidos: Linha[];
  /** Negócios em que é o Dono: todos os dados (OPEN-004). */
  negociosComoDono: { negocio: Linha; tabelas: Tabelas }[];
  /** Negócios de outros Donos: só os registros feitos pelo titular (OPEN-004). */
  registrosEmOutrosNegocios: { negocio: Linha; tabelas: Tabelas }[];
};

/** Valor para o CSV (OPEN-006 da SPEC-013): números com vírgula decimal, booleanos em português. */
function valorCsv(v: Valor): string {
  if (v === null) return "";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "number") return String(v).replace(".", ",");
  return /^-?\d+\.\d+$/.test(v) ? v.replace(".", ",") : v;
}

/** Uma tabela vira um CSV com a união das colunas, na ordem em que aparecem. */
export function csvDeLinhas(linhas: Linha[]): string {
  const colunas = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  return gerarCsv(colunas.length ? colunas : ["vazio"], linhas.map((l) => colunas.map((c) => valorCsv(l[c] ?? null))));
}

/** Junta a mesma tabela de vários negócios, com a coluna do negócio na frente. */
function juntar(grupos: { negocio: Linha; tabelas: Tabelas }[]): Tabelas {
  const saida: Tabelas = {};
  for (const g of grupos) {
    for (const [nome, linhas] of Object.entries(g.tabelas)) {
      saida[nome] ??= [];
      saida[nome].push(...linhas.map((l) => ({ negocio: g.negocio.nome ?? null, ...l })));
    }
  }
  return saida;
}

const LEIA_ME = (geradoEm: string) => `Health Enterprise — exportação dos seus dados (LGPD)
Gerada em ${geradoEm} (UTC).

dados.json
  Tudo em um arquivo: titular, vínculos com negócios, convites recebidos, os dados
  completos dos negócios em que você é o Dono e, dos negócios de outros Donos, só os
  registros feitos por você.

Arquivos .csv (abrem no Excel ou no LibreOffice; ponto e vírgula, vírgula decimal)
  usuario.csv, vinculos.csv, convites-recebidos.csv
  <tabela>.csv                 dados dos negócios em que você é o Dono
                               (coluna "negocio" indica de qual negócio é cada linha)
  outros-negocios-<tabela>.csv registros feitos por você em negócios de outros Donos
  acessos-suporte.csv          acessos do suporte do HE que você liberou (motivo, módulos, prazo)
  registros-suporte.csv        registro de cada entrada, tela aberta e saída do suporte

Datas em ISO 8601 (UTC). Valores em reais com ponto decimal no JSON e vírgula no CSV.
Identificadores (id, negocioId, usuarioId...) ligam as linhas entre as tabelas.
`;

const nomeDoArquivo = (tabela: string) => tabela.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

/** Arquivos do .zip: `dados.json`, `LEIA-ME.txt` e um CSV por tabela. */
export function arquivosDaExportacao(d: DadosDoTitular): Record<string, string> {
  const arquivos: Record<string, string> = {
    "LEIA-ME.txt": LEIA_ME(d.geradoEm),
    "dados.json": JSON.stringify(d, null, 2),
    "usuario.csv": csvDeLinhas([d.titular]),
    "vinculos.csv": csvDeLinhas(d.vinculos),
    "convites-recebidos.csv": csvDeLinhas(d.convitesRecebidos),
  };
  if (d.negociosComoDono.length) arquivos["negocios.csv"] = csvDeLinhas(d.negociosComoDono.map((g) => g.negocio));
  for (const [tabela, linhas] of Object.entries(juntar(d.negociosComoDono))) arquivos[`${nomeDoArquivo(tabela)}.csv`] = csvDeLinhas(linhas);
  for (const [tabela, linhas] of Object.entries(juntar(d.registrosEmOutrosNegocios))) arquivos[`outros-negocios-${nomeDoArquivo(tabela)}.csv`] = csvDeLinhas(linhas);
  return arquivos;
}

export const nomeDoZip = (dia: string) => `he-meus-dados-${dia}.zip`;
