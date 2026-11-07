/**
 * Acesso de emergência (SPEC-019, 5.6 — RN38). Pura: sem framework nem banco. Sem a liberação do Dono,
 * um Administrador pede e OUTRA conta aprova (INV-006). O acesso é somente leitura, nos módulos
 * pedidos, por 1 h, 2 h ou 4 h, sem renovação, e o Dono vê tudo desde o pedido (INV-007).
 */
import { MODULOS, type Modulo } from "./permissoes";
import { campoDoModulo, dataHoraCompleta, PRAZOS, type Prazo } from "./suporte";

export const MOTIVOS_DA_EMERGENCIA = ["ORDEM_JUDICIAL", "INCIDENTE", "DONO_SEM_ACESSO"] as const;
export type MotivoDaEmergencia = (typeof MOTIVOS_DA_EMERGENCIA)[number];

/** O motivo por extenso: na gaveta, no Acesso do suporte do Dono e no acesso gravado. */
export const ROTULO_MOTIVO_DA_EMERGENCIA: Record<MotivoDaEmergencia, string> = {
  ORDEM_JUDICIAL: "Ordem judicial ou requisição de autoridade competente",
  INCIDENTE: "Incidente de segurança ou falha que afeta os dados do negócio",
  DONO_SEM_ACESSO: "Dono sem acesso, a pedido de um membro",
};

/** O motivo curto, para as faixas. */
export const MOTIVO_CURTO_DA_EMERGENCIA: Record<MotivoDaEmergencia, string> = {
  ORDEM_JUDICIAL: "ordem judicial",
  INCIDENTE: "incidente de segurança",
  DONO_SEM_ACESSO: "Dono sem acesso",
};

/** O que vai na referência, conforme o motivo. */
export const DICA_DA_REFERENCIA: Record<MotivoDaEmergencia, string> = {
  ORDEM_JUDICIAL: "Número do processo ou do ofício.",
  INCIDENTE: "Número do incidente.",
  DONO_SEM_ACESSO: "O membro que pediu e por qual canal.",
};

export const PRAZOS_DA_EMERGENCIA = ["1h", "2h", "4h"] as const satisfies readonly Prazo[];
export type PrazoDaEmergencia = (typeof PRAZOS_DA_EMERGENCIA)[number];
export const MAX_REFERENCIA = 120;
export const MAX_JUSTIFICATIVA = 500;
export const MAX_RESULTADO = 1000;

export type PedidoDeEmergencia = { motivo: MotivoDaEmergencia; referencia: string; justificativa: string; modulos: Modulo[]; prazo: PrazoDaEmergencia };
export type CampoDaEmergencia = "motivo" | "referencia" | "justificativa" | "modulos" | "prazo";

const ehMotivo = (v: unknown): v is MotivoDaEmergencia => (MOTIVOS_DA_EMERGENCIA as readonly unknown[]).includes(v);
const ehPrazo = (v: unknown): v is PrazoDaEmergencia => (PRAZOS_DA_EMERGENCIA as readonly unknown[]).includes(v);
const limpar = (v: string | undefined) => (v ?? "").trim().replace(/\s+/g, " ");

export function validarPedidoDeEmergencia(
  campos: Record<string, string | undefined>,
): { ok: true; dados: PedidoDeEmergencia } | { ok: false; erros: Partial<Record<CampoDaEmergencia, string>> } {
  const erros: Partial<Record<CampoDaEmergencia, string>> = {};
  if (!ehMotivo(campos.motivo)) erros.motivo = MENSAGENS_DA_EMERGENCIA.motivoObrigatorio;
  const referencia = limpar(campos.referencia);
  if (!referencia) erros.referencia = MENSAGENS_DA_EMERGENCIA.referenciaObrigatoria;
  else if (referencia.length > MAX_REFERENCIA) erros.referencia = MENSAGENS_DA_EMERGENCIA.longo(MAX_REFERENCIA);
  const justificativa = limpar(campos.justificativa);
  if (!justificativa) erros.justificativa = MENSAGENS_DA_EMERGENCIA.justificativaObrigatoria;
  else if (justificativa.length > MAX_JUSTIFICATIVA) erros.justificativa = MENSAGENS_DA_EMERGENCIA.longo(MAX_JUSTIFICATIVA);
  const modulos = MODULOS.filter((m) => campos[campoDoModulo(m)] === "on");
  if (modulos.length === 0) erros.modulos = MENSAGENS_DA_EMERGENCIA.modulosObrigatorios;
  if (!ehPrazo(campos.prazo)) erros.prazo = MENSAGENS_DA_EMERGENCIA.prazoInvalido;
  if (Object.keys(erros).length) return { ok: false, erros };
  return { ok: true, dados: { motivo: campos.motivo as MotivoDaEmergencia, referencia, justificativa, modulos, prazo: campos.prazo as PrazoDaEmergencia } };
}

/** Os dados gravados no pedido (Json): lidos com cuidado, o banco pode ter qualquer coisa. */
export function lerPedidoDeEmergencia(dados: unknown): PedidoDeEmergencia | null {
  if (typeof dados !== "object" || dados === null) return null;
  const d = dados as Record<string, unknown>;
  if (!ehMotivo(d.motivo) || !ehPrazo(d.prazo) || typeof d.referencia !== "string" || typeof d.justificativa !== "string" || !Array.isArray(d.modulos)) return null;
  const modulos = MODULOS.filter((m) => (d.modulos as unknown[]).includes(m));
  if (modulos.length === 0) return null;
  return { motivo: d.motivo, referencia: d.referencia, justificativa: d.justificativa, modulos, prazo: d.prazo };
}

/** O acesso começa na aprovação e dura o prazo pedido, sem renovação. */
export const fimDaEmergencia = (aprovadaEm: Date, prazo: PrazoDaEmergencia) => new Date(aprovadaEm.getTime() + PRAZOS[prazo].horas * 3_600_000);

export function validarResultado(campos: Record<string, string | undefined>): { ok: true; resultado: string } | { ok: false; erro: string } {
  const resultado = (campos.resultado ?? "").trim();
  if (!resultado) return { ok: false, erro: MENSAGENS_DA_EMERGENCIA.resultadoObrigatorio };
  if (resultado.length > MAX_RESULTADO) return { ok: false, erro: MENSAGENS_DA_EMERGENCIA.longo(MAX_RESULTADO) };
  return { ok: true, resultado };
}

export const MENSAGENS_DA_EMERGENCIA = {
  motivoObrigatorio: "Escolha o motivo da emergência.",
  referenciaObrigatoria: "Informe a referência: o processo ou ofício, o incidente, ou o membro que pediu.",
  justificativaObrigatoria: "Explique por que o acesso é necessário.",
  modulosObrigatorios: "Marque ao menos um módulo.",
  prazoInvalido: "Escolha 1, 2 ou 4 horas.",
  longo: (max: number) => `Use no máximo ${max} caracteres.`,
  resultadoObrigatorio: "Descreva o resultado do acesso.",
  liberacaoAtiva: "O Dono já liberou o acesso do suporte a este negócio. Use a liberação: a emergência é só para quando não há liberação.",
  emergenciaAtiva: "Este negócio já tem um acesso de emergência em andamento.",
  pedidoPendente: "Já existe um pedido de emergência pendente para este negócio.",
  resultadoPendente: "Registre o resultado do seu último acesso de emergência antes de fazer um novo pedido.",
  pedidoFeito: (expira: Date) => `Pedido registrado. O Dono já vê o pedido. Outra conta de Administrador precisa aprovar até ${dataHoraCompleta(expira)}.`,
  aprovado: (quem: string, fim: Date) => `Pedido aprovado: ${quem} pode entrar, somente leitura, até ${dataHoraCompleta(fim)}. O Dono foi avisado.`,
  semEmergencia: "Não há acesso de emergência ativo para você neste negócio.",
  soQuemPediuEntra: "Só quem pediu o acesso de emergência entra nele.",
  encerrada: "Acesso de emergência encerrado.",
  jaEncerrada: "Este acesso de emergência já tinha terminado.",
  resultadoRegistrado: "Resultado registrado.",
  resultadoJaRegistrado: "O resultado deste acesso já foi registrado.",
  aindaAtiva: "O acesso ainda está em andamento. Registre o resultado quando ele terminar.",
  soQuemPediuRegistra: "Só quem pediu o acesso registra o resultado.",
} as const;
