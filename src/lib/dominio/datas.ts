/**
 * Utilitário de datas (RN29): datas são gravadas em UTC; "dia", "mês" e "competência"
 * são sempre calculados no fuso America/Sao_Paulo. Camada de domínio pura: sem
 * framework nem banco (ADR-001). O deslocamento do fuso vem do Intl (base de fusos
 * do sistema), sem offset fixo no código.
 */

export const FUSO_NEGOCIO = "America/Sao_Paulo";

export class DataInvalida extends Error {
  constructor(valor: unknown) {
    super(`Data inválida: ${String(valor)}`);
    this.name = "DataInvalida";
  }
}

export type Intervalo = {
  /** Início, inclusivo (UTC). */
  inicio: Date;
  /** Fim, exclusivo (UTC). */
  fim: Date;
};

const formatador = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_NEGOCIO,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type PartesLocais = { ano: number; mes: number; dia: number; hora: number; minuto: number; segundo: number };

function validarInstante(instante: Date): void {
  if (!(instante instanceof Date) || Number.isNaN(instante.getTime())) throw new DataInvalida(instante);
}

function partesLocais(instante: Date): PartesLocais {
  validarInstante(instante);
  const p = Object.fromEntries(formatador.formatToParts(instante).map((x) => [x.type, x.value]));
  return {
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour),
    minuto: Number(p.minute),
    segundo: Number(p.second),
  };
}

/** Diferença (ms) entre o relógio local de São Paulo e o UTC no instante dado. */
function deslocamento(instante: Date): number {
  const p = partesLocais(instante);
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

/** Instante UTC correspondente a um horário do relógio de São Paulo. */
function instanteLocal(ano: number, mes: number, dia: number): Date {
  const palpite = Date.UTC(ano, mes - 1, dia);
  let t = palpite - deslocamento(new Date(palpite));
  const ajuste = deslocamento(new Date(t));
  if (palpite - ajuste !== t) t = palpite - ajuste;
  return new Date(t);
}

const pad = (n: number, tamanho = 2) => String(n).padStart(tamanho, "0");

/** Dia local (AAAA-MM-DD) do instante, em America/Sao_Paulo. */
export function diaLocal(instante: Date): string {
  const p = partesLocais(instante);
  return `${pad(p.ano, 4)}-${pad(p.mes)}-${pad(p.dia)}`;
}

/** Data local no formato brasileiro (DD/MM/AAAA), em America/Sao_Paulo. */
export function dataBrasileira(instante: Date): string {
  const [ano, mes, dia] = diaLocal(instante).split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Competência (AAAA-MM) do instante, em America/Sao_Paulo. */
export function competencia(instante: Date): string {
  return diaLocal(instante).slice(0, 7);
}

/** Dia local de hoje. */
export function hoje(agora: Date = new Date()): string {
  return diaLocal(agora);
}

function lerDia(dia: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!m) throw new DataInvalida(dia);
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const teste = new Date(Date.UTC(a, me - 1, d));
  if (teste.getUTCFullYear() !== a || teste.getUTCMonth() !== me - 1 || teste.getUTCDate() !== d) {
    throw new DataInvalida(dia);
  }
  return [a, me, d];
}

function lerCompetencia(comp: string): [number, number] {
  const m = /^(\d{4})-(\d{2})$/.exec(comp);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new DataInvalida(comp);
  return [Number(m[1]), Number(m[2])];
}

/** Intervalo UTC [início, fim) do dia local informado (AAAA-MM-DD). */
export function intervaloDoDia(dia: string): Intervalo {
  const [a, m, d] = lerDia(dia);
  const seguinte = new Date(Date.UTC(a, m - 1, d + 1));
  return {
    inicio: instanteLocal(a, m, d),
    fim: instanteLocal(seguinte.getUTCFullYear(), seguinte.getUTCMonth() + 1, seguinte.getUTCDate()),
  };
}

/** Intervalo UTC [início, fim) da competência local informada (AAAA-MM). */
export function intervaloDaCompetencia(comp: string): Intervalo {
  const [a, m] = lerCompetencia(comp);
  const proximo = m === 12 ? [a + 1, 1] : [a, m + 1];
  return { inicio: instanteLocal(a, m, 1), fim: instanteLocal(proximo[0], proximo[1], 1) };
}
