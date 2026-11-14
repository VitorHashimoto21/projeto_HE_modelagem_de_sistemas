/**
 * Cliente com dados completos (SPEC-022): CPF, telefone, CEP, documento, máscaras e o selo
 * "completo para nota" (5.4). Funções puras (ADR-005); o CNPJ fica em cnpj.ts.
 */
import { formatarCnpj } from "./cnpj";
import { mascararContato, mascararEmail } from "./suporte";

export const TIPOS_CLIENTE = ["PESSOA_FISICA", "PESSOA_JURIDICA"] as const;
export type TipoCliente = (typeof TIPOS_CLIENTE)[number];
export const ROTULO_TIPO_CLIENTE: Record<TipoCliente, string> = { PESSOA_FISICA: "Pessoa física", PESSOA_JURIDICA: "Empresa" };

/** Situação na inscrição estadual (OPEN-003): é o indIEDest da NF-e. */
export const SITUACOES_IE = ["CONTRIBUINTE", "ISENTO", "NAO_CONTRIBUINTE"] as const;
export type SituacaoIe = (typeof SITUACOES_IE)[number];
export const ROTULO_SITUACAO_IE: Record<SituacaoIe, string> = {
  CONTRIBUINTE: "Contribuinte do ICMS",
  ISENTO: "Isenta",
  NAO_CONTRIBUINTE: "Não contribuinte do ICMS",
};

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const ehUf = (valor: string): valor is (typeof UFS)[number] => (UFS as readonly string[]).includes(valor);

const digitos = (valor: string) => valor.replace(/\D/g, "");

// ---------------------------------------------------------------------------------------
// CPF

/** Só os dígitos; null se não forem exatamente 11 (letras no meio também invalidam). */
export function normalizarCpf(valor: string): string | null {
  if (/[a-z]/i.test(valor)) return null;
  const d = digitos(valor);
  return d.length === 11 ? d : null;
}

function digitoDoCpf(base: string): number {
  const soma = [...base].reduce((acc, d, i) => acc + Number(d) * (base.length + 1 - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/** CPF com 11 dígitos, dígitos verificadores corretos e sem todos os dígitos iguais. */
export function cpfValido(valor: string): boolean {
  const cpf = normalizarCpf(valor);
  if (!cpf || /^(\d)\1{10}$/.test(cpf)) return false;
  const primeiro = digitoDoCpf(cpf.slice(0, 9));
  return cpf.endsWith(`${primeiro}${digitoDoCpf(cpf.slice(0, 9) + primeiro)}`);
}

/** "12345678909" → "123.456.789-09". */
export function formatarCpf(cpf: string): string {
  const d = digitos(cpf);
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf;
}

// ---------------------------------------------------------------------------------------
// Documento (CPF ou CNPJ, conforme o tipo)

export function formatarDocumento(tipo: TipoCliente, documento: string): string {
  return tipo === "PESSOA_FISICA" ? formatarCpf(documento) : formatarCnpj(documento);
}

// Máscara da lista e de quem só vê (OPEN-002): CPF ***.456.789-**; CNPJ 12.***.***/0001-**.
export function mascararDocumento(tipo: TipoCliente, documento: string): string {
  if (tipo === "PESSOA_FISICA") return documento.length === 11 ? `***.${documento.slice(3, 6)}.${documento.slice(6, 9)}-**` : "***";
  return documento.length === 14 ? `${documento.slice(0, 2)}.***.***/${documento.slice(8, 12)}-**` : "***";
}

// ---------------------------------------------------------------------------------------
// Telefone, CEP, e-mail e inscrições

/** DDDs em uso no Brasil (Anatel). */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** DDD e número, 10 ou 11 dígitos; null se não for um telefone brasileiro. */
export function normalizarTelefone(valor: string): string | null {
  if (/[a-z]/i.test(valor)) return null;
  const d = digitos(valor).replace(/^55(?=\d{10,11}$)/, "");
  return (d.length === 10 || d.length === 11) && DDDS.has(Number(d.slice(0, 2))) ? d : null;
}

/** "11987654321" → "(11) 98765-4321"; valores antigos fora do formato ficam como estão. */
export function formatarTelefone(telefone: string): string {
  if (!/^\d{10,11}$/.test(telefone)) return telefone;
  const meio = telefone.length === 11 ? 7 : 6;
  return `(${telefone.slice(0, 2)}) ${telefone.slice(2, meio)}-${telefone.slice(meio)}`;
}

export function normalizarCep(valor: string): string | null {
  if (/[a-z]/i.test(valor)) return null;
  const d = digitos(valor);
  return d.length === 8 ? d : null;
}

/** "05541030" → "05541-030". */
export const formatarCep = (cep: string) => (/^\d{8}$/.test(cep) ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep);

export const MAX_EMAIL = 254;
export const emailValido = (valor: string) => valor.length <= MAX_EMAIL && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);

/** Inscrição estadual ou municipal: sem pontuação, em maiúsculas; null se vazia ou fora do tamanho. */
export function normalizarInscricao(valor: string, maximo: number): string | null {
  const limpo = valor.replace(/[\s./-]/g, "").toUpperCase();
  return limpo.length >= 1 && limpo.length <= maximo && /^[0-9A-Z]+$/.test(limpo) ? limpo : null;
}

// ---------------------------------------------------------------------------------------
// Selo "completo para nota" (5.4) e exibição

export type DadosParaNota = {
  tipo: TipoCliente;
  nome: string;
  documento: string | null;
  situacaoIe: SituacaoIe | null;
  inscricaoEstadual: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
};

/**
 * O que falta para a nota fiscal (5.4): pessoa física, CPF e endereço completo; empresa, CNPJ,
 * a situação na inscrição estadual (com o número, se contribuinte) e endereço completo.
 * E-mail, telefone, nome fantasia, inscrição municipal e complemento não contam.
 */
export function faltandoParaNota(c: DadosParaNota): string[] {
  const falta: string[] = [];
  if (!c.nome.trim()) falta.push(c.tipo === "PESSOA_FISICA" ? "nome" : "razão social");
  if (!c.documento) falta.push(c.tipo === "PESSOA_FISICA" ? "CPF" : "CNPJ");
  if (c.tipo === "PESSOA_JURIDICA" && (!c.situacaoIe || (c.situacaoIe === "CONTRIBUINTE" && !c.inscricaoEstadual))) falta.push("inscrição estadual");
  const endereco = [
    ["CEP", c.cep],
    ["logradouro", c.logradouro],
    ["número do endereço", c.numero],
    ["bairro", c.bairro],
    ["município", c.municipio],
    ["UF", c.uf],
  ] as const;
  const vazios = endereco.filter(([, v]) => !v?.trim()).map(([rotulo]) => rotulo);
  if (vazios.length === endereco.length) falta.push("endereço");
  else falta.push(...vazios);
  return falta;
}

export const completoParaNota = (c: DadosParaNota) => faltandoParaNota(c).length === 0;

/** "Faltam: CPF, número do endereço" (5.3, item 2). */
export function textoDoQueFalta(falta: string[]): string {
  if (!falta.length) return "";
  return `${falta.length === 1 ? "Falta" : "Faltam"}: ${falta.join(", ")}`;
}

/** Na empresa, o nome fantasia quando houver (OPEN-009); senão, o nome ou a razão social. */
export const nomeDeExibicao = (c: { tipo: TipoCliente; nome: string; nomeFantasia: string | null }) =>
  c.tipo === "PESSOA_JURIDICA" && c.nomeFantasia ? c.nomeFantasia : c.nome;

/** Máscaras do e-mail e do telefone para quem só vê (OPEN-002): as mesmas do modo suporte. */
export const mascararEmailDoCliente = (email: string) => (email.includes("@") ? mascararEmail(email) : mascararContato(email));
export const mascararTelefoneDoCliente = (telefone: string) => mascararContato(telefone);
