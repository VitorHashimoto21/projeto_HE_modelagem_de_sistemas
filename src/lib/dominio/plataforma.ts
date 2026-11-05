/**
 * Pedidos da plataforma (SPEC-019, 5.6 e 5.8 — INV-006). Pura: sem framework nem banco. Um
 * Administrador pede e OUTRA conta de Administrador aprova ou recusa, em até 12 h. Nesta etapa (3a),
 * só a troca de plano; o acesso de emergência (3b) usa o mesmo pedido.
 */
import { dataHoraCompleta } from "./suporte";
import { ROTULO_PLANO, type Plano } from "./planos";

/** OPEN-007 e OPEN-014 (ajuste da equipe): o pedido fica pendente por até 12 h. */
export const HORAS_DO_PEDIDO = 12;
export const MAX_DESCRICAO_DO_PEDIDO = 300;
export const MAX_MOTIVO_DA_RECUSA = 300;

export const expiracaoDoPedido = (agora: Date) => new Date(agora.getTime() + HORAS_DO_PEDIDO * 3_600_000);

export type TipoDoPedido = "EMERGENCIA" | "PLANO";
export type SituacaoDoPedido = "PENDENTE" | "APROVADO" | "RECUSADO" | "CANCELADO" | "EXPIRADO";

/** O pedido pendente vencido conta como expirado, mesmo antes de o banco ser atualizado. */
export function situacaoEfetiva(p: { situacao: SituacaoDoPedido; expiraEm: Date }, agora: Date): SituacaoDoPedido {
  return p.situacao === "PENDENTE" && p.expiraEm.getTime() <= agora.getTime() ? "EXPIRADO" : p.situacao;
}

export const ROTULO_SITUACAO_DO_PEDIDO: Record<SituacaoDoPedido, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  RECUSADO: "Recusado",
  CANCELADO: "Cancelado",
  EXPIRADO: "Expirado",
};

// ---------------------------------------------------------------- troca de plano (5.8)

export const MOTIVOS_DA_TROCA = ["CORTESIA", "CORRECAO", "TESTE"] as const;
export type MotivoDaTroca = (typeof MOTIVOS_DA_TROCA)[number];

export const ROTULO_MOTIVO_DA_TROCA: Record<MotivoDaTroca, string> = { CORTESIA: "Cortesia", CORRECAO: "Correção", TESTE: "Teste" };

export const DICA_DO_MOTIVO_DA_TROCA: Record<MotivoDaTroca, string> = {
  CORTESIA: "O HE concede o plano sem cobrança.",
  CORRECAO: "Acerta um plano que ficou errado.",
  TESTE: "Para um teste combinado com o Dono.",
};

export type PedidoDePlano = { para: Plano; motivo: MotivoDaTroca; descricao: string };

const ehPlano = (v: unknown): v is Plano => v === "GRATUITO" || v === "PAGO";
const ehMotivo = (v: unknown): v is MotivoDaTroca => (MOTIVOS_DA_TROCA as readonly unknown[]).includes(v);
const limpar = (v: string | undefined) => (v ?? "").trim().replace(/\s+/g, " ");

export type CampoDoPedidoDePlano = "para" | "motivo" | "descricao";

export function validarPedidoDePlano(
  campos: Record<string, string | undefined>,
): { ok: true; dados: PedidoDePlano } | { ok: false; erros: Partial<Record<CampoDoPedidoDePlano, string>> } {
  const erros: Partial<Record<CampoDoPedidoDePlano, string>> = {};
  if (!ehPlano(campos.para)) erros.para = MENSAGENS_DA_PLATAFORMA.planoObrigatorio;
  if (!ehMotivo(campos.motivo)) erros.motivo = MENSAGENS_DA_PLATAFORMA.motivoObrigatorio;
  const descricao = limpar(campos.descricao);
  if (!descricao) erros.descricao = MENSAGENS_DA_PLATAFORMA.descricaoObrigatoria;
  else if (descricao.length > MAX_DESCRICAO_DO_PEDIDO) erros.descricao = MENSAGENS_DA_PLATAFORMA.descricaoLonga;
  if (Object.keys(erros).length) return { ok: false, erros };
  return { ok: true, dados: { para: campos.para as Plano, motivo: campos.motivo as MotivoDaTroca, descricao } };
}

/** Os dados gravados no pedido (Json): lidos com cuidado, o banco pode ter qualquer coisa. */
export function lerPedidoDePlano(dados: unknown): PedidoDePlano | null {
  if (typeof dados !== "object" || dados === null) return null;
  const d = dados as Record<string, unknown>;
  if (!ehPlano(d.para) || !ehMotivo(d.motivo) || typeof d.descricao !== "string") return null;
  return { para: d.para, motivo: d.motivo, descricao: d.descricao };
}

/** "plano Pago (cortesia)" — o resumo do pedido nas listas, no registro e nos e-mails. */
export const resumoDoPedidoDePlano = (d: Pick<PedidoDePlano, "para" | "motivo">) => `plano ${ROTULO_PLANO[d.para]} (${ROTULO_MOTIVO_DA_TROCA[d.motivo].toLowerCase()})`;

export function validarRecusa(campos: Record<string, string | undefined>): { ok: true; motivo: string } | { ok: false; erro: string } {
  const motivo = limpar(campos.motivoDaRecusa);
  if (!motivo) return { ok: false, erro: MENSAGENS_DA_PLATAFORMA.motivoDaRecusaObrigatorio };
  if (motivo.length > MAX_MOTIVO_DA_RECUSA) return { ok: false, erro: MENSAGENS_DA_PLATAFORMA.motivoDaRecusaLongo };
  return { ok: true, motivo };
}

export const MENSAGENS_DA_PLATAFORMA = {
  planoObrigatorio: "Escolha o plano de destino.",
  motivoObrigatorio: "Escolha o motivo da troca.",
  descricaoObrigatoria: "Descreva o pedido para quem vai aprovar.",
  descricaoLonga: `Use no máximo ${MAX_DESCRICAO_DO_PEDIDO} caracteres.`,
  motivoDaRecusaObrigatorio: "Conte por que o pedido foi recusado.",
  motivoDaRecusaLongo: `Use no máximo ${MAX_MOTIVO_DA_RECUSA} caracteres.`,
  mesmoPlano: (plano: Plano) => `O negócio já está no plano ${ROTULO_PLANO[plano].toLowerCase()}.`,
  negocioEncerrado: "Este negócio está encerrado: o plano não muda mais.",
  negocioInexistente: "Negócio não encontrado.",
  pedidoPendente: "Já existe um pedido de troca de plano pendente para este negócio. Aprove, recuse ou cancele esse antes.",
  pedidoFeito: (expira: Date) => `Pedido registrado. Outra conta de Administrador precisa aprovar até ${dataHoraCompleta(expira)}.`,
  mesmoAdministrador: "Ninguém aprova nem recusa o próprio pedido. Outra conta de Administrador precisa decidir.",
  pedidoExpirado: "Este pedido expirou: passaram 12 horas sem resposta. Se ainda for preciso, faça um novo pedido.",
  pedidoJaDecidido: "Este pedido já foi decidido. Atualize a página.",
  pedidoInexistente: "Pedido não encontrado. Atualize a página.",
  soQuemPediuCancela: "Só quem fez o pedido pode cancelá-lo.",
  solicitanteSemPapel: "Quem fez o pedido não é mais Administrador: o pedido não pode ser aprovado. Recuse-o.",
  aprovado: (plano: Plano) => `Pedido aprovado: o negócio passou para o plano ${ROTULO_PLANO[plano].toLowerCase()}. O Dono foi avisado.`,
  recusado: "Pedido recusado. Quem pediu vê o motivo no painel.",
  cancelado: "Pedido cancelado.",
  semOutraConta: "Só existe uma conta de Administrador: o pedido vai expirar sem aprovação. A regra das duas pessoas não tem exceção.",
} as const;
