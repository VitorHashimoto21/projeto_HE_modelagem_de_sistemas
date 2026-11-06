import type { ResultadoDaDecisao, ResultadoDoCancelamento, ResultadoDoPedido } from "@/lib/db/plataforma";
import type { MensagemDeEmail } from "@/lib/integracoes/email";
import { dataHoraCompleta } from "@/lib/dominio/suporte";
import { ROTULO_PLANO } from "@/lib/dominio/planos";
import {
  MENSAGENS_DA_PLATAFORMA,
  ROTULO_MOTIVO_DA_TROCA,
  validarPedidoDePlano,
  validarRecusa,
  type CampoDoPedidoDePlano,
  type PedidoDePlano,
} from "@/lib/dominio/plataforma";

/**
 * Fluxos dos pedidos da plataforma (SPEC-019, 5.8), sem framework: as Server Actions (já com o 2º fator
 * e o código reconfirmado) só leem o formulário e chamam estes fluxos, que validam tudo de novo. A regra
 * das duas pessoas (INV-006) é conferida no banco, dentro da transação.
 */

export type EstadoDoPedido =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: Partial<Record<CampoDoPedidoDePlano, string>> }
  | { status: "ok"; mensagem: string };

export const PEDIDO_INICIAL: EstadoDoPedido = { status: "ocioso" };

/** Aprovar, recusar ou cancelar: a resposta vai para a tela, com a explicação na recusa. */
export type EstadoDaDecisao = { status: "ocioso" } | { status: "erro"; mensagem: string } | { status: "ok"; mensagem: string };

export const DECISAO_INICIAL: EstadoDaDecisao = { status: "ocioso" };

type Dono = { nome: string; email: string; negocio: string };

export type DependenciasDaPlataforma = {
  administradorId: string;
  agora: () => Date;
  pedirTrocaDePlano: (negocioId: string, administradorId: string, dados: PedidoDePlano, agora: Date) => Promise<ResultadoDoPedido>;
  decidirTrocaDePlano: (pedidoId: string, administradorId: string, decisao: { aprovar: true } | { aprovar: false; motivo: string }, agora: Date) => Promise<ResultadoDaDecisao>;
  cancelar: (pedidoId: string, administradorId: string, agora: Date) => Promise<ResultadoDoCancelamento>;
  dono: (negocioId: string) => Promise<Dono | null>;
  /** E-mail depois da resposta (OPEN-008): a falha no envio nunca bloqueia nada. */
  avisar: (m: MensagemDeEmail) => void;
  origem: string;
};

const M = MENSAGENS_DA_PLATAFORMA;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pedir a troca de plano (5.8, item 1): plano de destino, motivo da lista e descrição. */
export async function pedirTrocaDePlano(campos: Record<string, string | undefined>, deps: DependenciasDaPlataforma): Promise<EstadoDoPedido> {
  const negocioId = campos.negocioId ?? "";
  if (!UUID.test(negocioId)) return { status: "erro", mensagem: M.negocioInexistente };
  const v = validarPedidoDePlano(campos);
  if (!v.ok) return { status: "erro", erros: v.erros };
  const r = await deps.pedirTrocaDePlano(negocioId, deps.administradorId, v.dados, deps.agora());
  if (r.ok) return { status: "ok", mensagem: M.pedidoFeito(r.expiraEm) };
  switch (r.erro) {
    case "MesmoPlano":
      return { status: "erro", erros: { para: M.mesmoPlano(r.plano) } };
    case "PedidoPendente":
      return { status: "erro", mensagem: M.pedidoPendente };
    case "NegocioEncerrado":
      return { status: "erro", mensagem: M.negocioEncerrado };
    case "NegocioInexistente":
      return { status: "erro", mensagem: M.negocioInexistente };
  }
}

function mensagemDaDecisao(r: Extract<ResultadoDaDecisao, { ok: false }>): string {
  switch (r.erro) {
    case "MesmoAdministrador":
      return M.mesmoAdministrador;
    case "PedidoExpirado":
      return M.pedidoExpirado;
    case "PedidoJaDecidido":
      return M.pedidoJaDecidido;
    case "SolicitanteSemPapel":
      return M.solicitanteSemPapel;
    case "NegocioEncerrado":
      return M.negocioEncerrado;
    case "MesmoPlano":
      return `${M.mesmoPlano(r.plano)} Recuse o pedido.`;
    case "PedidoInexistente":
    case "NaoEAdministrador":
      return M.pedidoInexistente;
  }
}

/**
 * Aprovar (5.8, itens 3 a 5): outra conta de Administrador. O plano muda pela função da troca do Dono, e o
 * Dono recebe o e-mail (com domínio) além do aviso na tela Plano e em "Acessos do suporte".
 */
export async function aprovar(campos: Record<string, string | undefined>, deps: DependenciasDaPlataforma): Promise<EstadoDaDecisao> {
  const pedidoId = campos.pedidoId ?? "";
  if (!UUID.test(pedidoId)) return { status: "erro", mensagem: M.pedidoInexistente };
  const agora = deps.agora();
  const r = await deps.decidirTrocaDePlano(pedidoId, deps.administradorId, { aprovar: true }, agora);
  if (!r.ok) return { status: "erro", mensagem: mensagemDaDecisao(r) };
  if (r.situacao !== "APROVADO") return { status: "erro", mensagem: M.pedidoJaDecidido };
  const dono = await deps.dono(r.negocioId);
  if (dono) deps.avisar(emailDaTroca(dono, r, agora, deps.origem));
  return { status: "ok", mensagem: M.aprovado(r.pedido.para) };
}

/** Recusar (5.8, item 3): outra conta de Administrador, com o motivo. */
export async function recusar(campos: Record<string, string | undefined>, deps: DependenciasDaPlataforma): Promise<EstadoDaDecisao> {
  const pedidoId = campos.pedidoId ?? "";
  if (!UUID.test(pedidoId)) return { status: "erro", mensagem: M.pedidoInexistente };
  const v = validarRecusa(campos);
  if (!v.ok) return { status: "erro", mensagem: v.erro };
  const r = await deps.decidirTrocaDePlano(pedidoId, deps.administradorId, { aprovar: false, motivo: v.motivo }, deps.agora());
  if (!r.ok) return { status: "erro", mensagem: mensagemDaDecisao(r) };
  return { status: "ok", mensagem: M.recusado };
}

/** Cancelar o próprio pedido pendente (5.9, item 2). */
export async function cancelar(campos: Record<string, string | undefined>, deps: DependenciasDaPlataforma): Promise<EstadoDaDecisao> {
  const pedidoId = campos.pedidoId ?? "";
  if (!UUID.test(pedidoId)) return { status: "erro", mensagem: M.pedidoInexistente };
  const r = await deps.cancelar(pedidoId, deps.administradorId, deps.agora());
  if (r.ok) return { status: "ok", mensagem: M.cancelado };
  const mensagem = { PedidoInexistente: M.pedidoInexistente, PedidoJaDecidido: M.pedidoJaDecidido, PedidoExpirado: M.pedidoExpirado, SoQuemPediu: M.soQuemPediuCancela }[r.erro];
  return { status: "erro", mensagem };
}

// ---------------------------------------------------------------- e-mail ao Dono (5.8, item 5)

function emailDaTroca(dono: Dono, r: Extract<ResultadoDaDecisao, { situacao: "APROVADO" }>, quando: Date, origem: string): MensagemDeEmail {
  const plano = ROTULO_PLANO[r.pedido.para];
  const plural = (n: number, um: string, varios: string) => (n === 1 ? um : `${n} ${varios}`);
  const efeitos =
    r.pedido.para === "PAGO"
      ? [
          "Simulação: nenhuma cobrança é feita.",
          ...(r.reativados ? [`${plural(r.reativados, "1 colaborador voltou", "colaboradores voltaram")} a ter acesso.`] : []),
        ]
      : [
          "Nenhum dado foi apagado.",
          ...(r.suspensos ? [`${plural(r.suspensos, "1 colaborador ficou", "colaboradores ficaram")} sem acesso pelo limite do gratuito. Escolha quem continua em ${origem}/negocio/equipe.`] : []),
          ...(r.convitesCancelados ? [`${plural(r.convitesCancelados, "1 convite pendente foi cancelado", "convites pendentes foram cancelados")}.`] : []),
        ];
  return {
    para: dono.email,
    assunto: `O plano do ${dono.negocio} mudou para ${plano} pela plataforma do HE`,
    texto: [
      `Olá, ${dono.nome}!`,
      "",
      `O plano do negócio ${dono.negocio} passou para ${plano} em ${dataHoraCompleta(quando)}, numa troca feita pela plataforma do Health Enterprise e aprovada por duas pessoas da equipe.`,
      `Motivo: ${ROTULO_MOTIVO_DA_TROCA[r.pedido.motivo]} — ${r.pedido.descricao}`,
      ...efeitos,
      `Veja o histórico do plano em ${origem}/negocio/plano e o registro do suporte em ${origem}/negocio/suporte.`,
      "",
      "Se tiver dúvidas sobre esta troca, fale com o suporte do HE.",
    ].join("\n"),
  };
}
