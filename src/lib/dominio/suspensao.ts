/**
 * Suspender e reativar o negócio (SPEC-019, 5.7 — RN39, INV-008). Pura: sem framework nem banco. Um
 * Administrador, com o código reconfirmado, suspende com um motivo da lista fechada e uma descrição; o
 * negócio fica somente leitura (os membros veem tudo e exportam os dados) até ser reativado.
 */
import { dataBrasileira } from "./datas";

export const MOTIVOS_DA_SUSPENSAO = ["PEDIDO_DO_DONO", "USO_INDEVIDO", "INCIDENTE_SEGURANCA", "ORDEM_JUDICIAL"] as const;
export type MotivoDaSuspensao = (typeof MOTIVOS_DA_SUSPENSAO)[number];

/** O motivo por extenso: na gaveta, no registro e em "Acessos do suporte". */
export const ROTULO_MOTIVO_DA_SUSPENSAO: Record<MotivoDaSuspensao, string> = {
  PEDIDO_DO_DONO: "Pedido do Dono",
  USO_INDEVIDO: "Uso indevido segundo os Termos de Uso",
  INCIDENTE_SEGURANCA: "Incidente de segurança",
  ORDEM_JUDICIAL: "Ordem judicial",
};

/** O motivo curto, para a faixa dos membros. */
export const MOTIVO_CURTO_DA_SUSPENSAO: Record<MotivoDaSuspensao, string> = {
  PEDIDO_DO_DONO: "pedido do Dono",
  USO_INDEVIDO: "uso indevido segundo os Termos",
  INCIDENTE_SEGURANCA: "incidente de segurança",
  ORDEM_JUDICIAL: "ordem judicial",
};

export const MAX_DESCRICAO_DA_SUSPENSAO = 500;

/** A suspensão em vigor, como o contexto da requisição a carrega (para a faixa e as recusas). */
export type SuspensaoDoNegocio = { desde: Date; motivo: MotivoDaSuspensao };

export type DadosDaSuspensao = { motivo: MotivoDaSuspensao; descricao: string };
export type CampoDaSuspensao = "motivo" | "descricao";

export const ehMotivoDaSuspensao = (v: unknown): v is MotivoDaSuspensao => (MOTIVOS_DA_SUSPENSAO as readonly unknown[]).includes(v);
const limpar = (v: string | undefined) => (v ?? "").trim().replace(/\s+/g, " ");

function validarDescricao(v: string | undefined, obrigatoria: string): { ok: true; descricao: string } | { ok: false; erro: string } {
  const descricao = limpar(v);
  if (!descricao) return { ok: false, erro: obrigatoria };
  if (descricao.length > MAX_DESCRICAO_DA_SUSPENSAO) return { ok: false, erro: MENSAGENS_DA_SUSPENSAO.longo(MAX_DESCRICAO_DA_SUSPENSAO) };
  return { ok: true, descricao };
}

export function validarSuspensao(
  campos: Record<string, string | undefined>,
): { ok: true; dados: DadosDaSuspensao } | { ok: false; erros: Partial<Record<CampoDaSuspensao, string>> } {
  const erros: Partial<Record<CampoDaSuspensao, string>> = {};
  if (!ehMotivoDaSuspensao(campos.motivo)) erros.motivo = MENSAGENS_DA_SUSPENSAO.motivoObrigatorio;
  const d = validarDescricao(campos.descricao, MENSAGENS_DA_SUSPENSAO.descricaoObrigatoria);
  if (!d.ok) erros.descricao = d.erro;
  if (!d.ok || Object.keys(erros).length) return { ok: false, erros };
  return { ok: true, dados: { motivo: campos.motivo as MotivoDaSuspensao, descricao: d.descricao } };
}

export function validarReativacao(campos: Record<string, string | undefined>): { ok: true; descricao: string } | { ok: false; erro: string } {
  const d = validarDescricao(campos.descricao, MENSAGENS_DA_SUSPENSAO.descricaoDaReativacao);
  return d.ok ? { ok: true, descricao: d.descricao } : { ok: false, erro: d.erro };
}

/** Os dados gravados no registro (Json): lidos com cuidado, o banco pode ter qualquer coisa. */
export function lerDadosDaSuspensao(dados: unknown): { motivo: MotivoDaSuspensao | null; descricao: string } | null {
  if (typeof dados !== "object" || dados === null) return null;
  const d = dados as Record<string, unknown>;
  if (typeof d.descricao !== "string") return null;
  return { motivo: ehMotivoDaSuspensao(d.motivo) ? d.motivo : null, descricao: d.descricao };
}

/** A faixa dos membros (5.7): "Negócio suspenso pelo HE desde 07/11/2026: incidente de segurança. Fale com o suporte." */
export const textoDaFaixaDaSuspensao = (s: SuspensaoDoNegocio) =>
  `Negócio suspenso pelo HE desde ${dataBrasileira(s.desde)}: ${MOTIVO_CURTO_DA_SUSPENSAO[s.motivo]}. Fale com o suporte.`;

/** A explicação da recusa (a página de "Negócio suspenso"): desde quando, o motivo e o que continua. */
export const explicacaoDaSuspensao = (s: SuspensaoDoNegocio) =>
  `Desde ${dataBrasileira(s.desde)}, por ${MOTIVO_CURTO_DA_SUSPENSAO[s.motivo]}, você e a equipe podem ver e exportar os dados, mas nada é gravado até a reativação. Para entender o motivo, fale com o suporte do HE.`;

export const MENSAGENS_DA_SUSPENSAO = {
  motivoObrigatorio: "Escolha o motivo da suspensão.",
  descricaoObrigatoria: "Descreva o que levou à suspensão.",
  descricaoDaReativacao: "Descreva por que o negócio pode voltar.",
  longo: (max: number) => `Use no máximo ${max} caracteres.`,
  suspenso: "Negócio suspenso. Os membros continuam vendo os dados, mas nada é gravado até a reativação. O Dono foi avisado.",
  reativado: "Negócio reativado. A gravação voltou, e o Dono foi avisado.",
  jaSuspenso: "Este negócio já está suspenso.",
  naoSuspenso: "Este negócio não está suspenso.",
  encerrado: "Negócio encerrado não pode ser suspenso.",
  inexistente: "Negócio não encontrado.",
  /** OPEN-018: o desfazer é recusado na suspensão, e os 30 dias continuam contando. */
  desfazer: "O negócio está suspenso. O desfazer volta quando ele for reativado, dentro dos 30 dias.",
  convite: "Este negócio está suspenso pelo HE. O convite poderá ser aceito quando ele for reativado.",
  /** No modo suporte, a liberação continua valendo para ver; as correções esperam a reativação. */
  correcoes: "O negócio está suspenso: as correções ficam recusadas até a reativação.",
} as const;
