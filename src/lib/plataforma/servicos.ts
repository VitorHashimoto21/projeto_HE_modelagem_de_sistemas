import type { ResultadoDaDecisao, ResultadoDaSuspensao, ResultadoDoCancelamento, ResultadoDoPedido, ResultadoDoPedidoDeEmergencia } from "@/lib/db/plataforma";
import type { ResultadoDaEntradaNaEmergencia, ResultadoDoResultado } from "@/lib/db/suporte";
import type { MensagemDeEmail } from "@/lib/integracoes/email";
import {
  MENSAGENS_DA_EMERGENCIA,
  ROTULO_MOTIVO_DA_EMERGENCIA,
  validarPedidoDeEmergencia,
  validarResultado,
  type CampoDaEmergencia,
  type PedidoDeEmergencia,
} from "@/lib/dominio/emergencia";
import type { Modulo } from "@/lib/dominio/permissoes";
import { ROTULO_PLANO } from "@/lib/dominio/planos";
import {
  MENSAGENS_DA_PLATAFORMA,
  ROTULO_MOTIVO_DA_TROCA,
  validarPedidoDePlano,
  validarRecusa,
  type CampoDoPedidoDePlano,
  type PedidoDePlano,
} from "@/lib/dominio/plataforma";
import { dataHoraCompleta, listaDeModulos, PRAZOS } from "@/lib/dominio/suporte";
import {
  MENSAGENS_DA_SUSPENSAO,
  ROTULO_MOTIVO_DA_SUSPENSAO,
  validarReativacao,
  validarSuspensao,
  type CampoDaSuspensao,
  type DadosDaSuspensao,
} from "@/lib/dominio/suspensao";

/**
 * Fluxos dos pedidos da plataforma (SPEC-019, 5.6 e 5.8), sem framework: as Server Actions (já com o 2º
 * fator e, nas críticas, o código reconfirmado) só leem o formulário e chamam estes fluxos, que validam tudo
 * de novo. A regra das duas pessoas (INV-006) é conferida no banco, dentro da transação.
 */

export type EstadoDoPedido =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: Partial<Record<CampoDoPedidoDePlano, string>> }
  | { status: "ok"; mensagem: string };

export const PEDIDO_INICIAL: EstadoDoPedido = { status: "ocioso" };

/** SPEC-019 (5.6): o pedido de emergência, com os erros de cada campo. */
export type EstadoDaEmergencia =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: Partial<Record<CampoDaEmergencia, string>> }
  | { status: "ok"; mensagem: string };

export const EMERGENCIA_INICIAL: EstadoDaEmergencia = { status: "ocioso" };

/** Aprovar, recusar, cancelar e registrar o resultado: a resposta vai para a tela, com a explicação na recusa. */
export type EstadoDaDecisao = { status: "ocioso" } | { status: "erro"; mensagem: string } | { status: "ok"; mensagem: string };

export const DECISAO_INICIAL: EstadoDaDecisao = { status: "ocioso" };

/** SPEC-019 (5.7): suspender e reativar, com os erros de cada campo. */
export type EstadoDaSuspensao =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: Partial<Record<CampoDaSuspensao, string>> }
  | { status: "ok"; mensagem: string };

export const SUSPENSAO_INICIAL: EstadoDaSuspensao = { status: "ocioso" };

type Dono = { nome: string; email: string; negocio: string };
type Decisao = { aprovar: true } | { aprovar: false; motivo: string };

export type DependenciasDaPlataforma = {
  administradorId: string;
  agora: () => Date;
  pedirTrocaDePlano: (negocioId: string, administradorId: string, dados: PedidoDePlano, agora: Date) => Promise<ResultadoDoPedido>;
  pedirEmergencia: (negocioId: string, administradorId: string, dados: PedidoDeEmergencia, agora: Date) => Promise<ResultadoDoPedidoDeEmergencia>;
  /** Aprova ou recusa um pedido de qualquer tipo. */
  decidir: (pedidoId: string, administradorId: string, decisao: Decisao, agora: Date) => Promise<ResultadoDaDecisao>;
  cancelar: (pedidoId: string, administradorId: string, agora: Date) => Promise<ResultadoDoCancelamento>;
  entrarNaEmergencia: (negocioId: string, administradorId: string, agora: Date) => Promise<ResultadoDaEntradaNaEmergencia>;
  registrarResultado: (acessoId: string, administradorId: string, resultado: string, agora: Date) => Promise<ResultadoDoResultado>;
  suspender: (negocioId: string, administradorId: string, dados: DadosDaSuspensao, agora: Date) => Promise<ResultadoDaSuspensao>;
  reativar: (negocioId: string, administradorId: string, descricao: string, agora: Date) => Promise<ResultadoDaSuspensao>;
  dono: (negocioId: string) => Promise<Dono | null>;
  /** E-mail depois da resposta (OPEN-008): a falha no envio nunca bloqueia nada. */
  avisar: (m: MensagemDeEmail) => void;
  origem: string;
};

const M = MENSAGENS_DA_PLATAFORMA;
const E = MENSAGENS_DA_EMERGENCIA;
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

/**
 * Pedir acesso de emergência (5.6): motivo da lista, referência, justificativa, módulos e prazo. O Dono vê
 * o pedido em "Acessos do suporte" desde já (INV-007) e recebe o e-mail (com domínio).
 */
export async function pedirEmergencia(campos: Record<string, string | undefined>, deps: DependenciasDaPlataforma): Promise<EstadoDaEmergencia> {
  const negocioId = campos.negocioId ?? "";
  if (!UUID.test(negocioId)) return { status: "erro", mensagem: M.negocioInexistente };
  const v = validarPedidoDeEmergencia(campos);
  if (!v.ok) return { status: "erro", erros: v.erros };
  const agora = deps.agora();
  const r = await deps.pedirEmergencia(negocioId, deps.administradorId, v.dados, agora);
  if (!r.ok) {
    const mensagem = {
      NegocioInexistente: M.negocioInexistente,
      NegocioEncerrado: "Este negócio está encerrado: não há acesso de emergência.",
      PedidoPendente: E.pedidoPendente,
      LiberacaoAtiva: E.liberacaoAtiva,
      EmergenciaAtiva: E.emergenciaAtiva,
      ResultadoPendente: E.resultadoPendente,
    }[r.erro];
    return { status: "erro", mensagem };
  }
  const dono = await deps.dono(negocioId);
  if (dono) deps.avisar(emailDoPedidoDeEmergencia(dono, v.dados, agora, deps.origem));
  return { status: "ok", mensagem: E.pedidoFeito(r.expiraEm) };
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
    case "LiberacaoAtiva":
      return `${E.liberacaoAtiva} Recuse o pedido.`;
    case "EmergenciaAtiva":
      return E.emergenciaAtiva;
    case "PedidoInexistente":
    case "NaoEAdministrador":
      return M.pedidoInexistente;
  }
}

/**
 * Aprovar (5.6 e 5.8): outra conta de Administrador. Na troca de plano, o plano muda pela função da troca do
 * Dono; na emergência, nasce o acesso somente leitura. O Dono recebe o e-mail (com domínio) além do aviso no
 * sistema.
 */
export async function aprovar(campos: Record<string, string | undefined>, deps: DependenciasDaPlataforma): Promise<EstadoDaDecisao> {
  const pedidoId = campos.pedidoId ?? "";
  if (!UUID.test(pedidoId)) return { status: "erro", mensagem: M.pedidoInexistente };
  const agora = deps.agora();
  const r = await deps.decidir(pedidoId, deps.administradorId, { aprovar: true }, agora);
  if (!r.ok) return { status: "erro", mensagem: mensagemDaDecisao(r) };
  if (r.situacao !== "APROVADO") return { status: "erro", mensagem: M.pedidoJaDecidido };
  const dono = await deps.dono(r.negocioId);
  if (r.tipo === "PLANO") {
    if (dono) deps.avisar(emailDaTroca(dono, r, agora, deps.origem));
    return { status: "ok", mensagem: M.aprovado(r.pedido.para) };
  }
  if (dono) deps.avisar(emailDaEmergenciaAprovada(dono, r.emergencia, r.expiraEm, deps.origem));
  return { status: "ok", mensagem: E.aprovado(r.solicitadoPor, r.expiraEm) };
}

/** Recusar (5.6 e 5.8): outra conta de Administrador, com o motivo. */
export async function recusar(campos: Record<string, string | undefined>, deps: DependenciasDaPlataforma): Promise<EstadoDaDecisao> {
  const pedidoId = campos.pedidoId ?? "";
  if (!UUID.test(pedidoId)) return { status: "erro", mensagem: M.pedidoInexistente };
  const v = validarRecusa(campos);
  if (!v.ok) return { status: "erro", mensagem: v.erro };
  const r = await deps.decidir(pedidoId, deps.administradorId, { aprovar: false, motivo: v.motivo }, deps.agora());
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

/** Entrar no acesso de emergência (5.6): só quem pediu, enquanto vale. Devolve para onde ir. */
export async function entrarNaEmergencia(
  negocioId: string,
  deps: DependenciasDaPlataforma,
): Promise<{ ok: true; acessoId: string; expiraEm: Date; modulos: Modulo[] } | { ok: false; mensagem: string }> {
  if (!UUID.test(negocioId)) return { ok: false, mensagem: E.semEmergencia };
  const r = await deps.entrarNaEmergencia(negocioId, deps.administradorId, deps.agora());
  if (!r.ok) return { ok: false, mensagem: r.erro === "SoQuemPediu" ? E.soQuemPediuEntra : E.semEmergencia };
  return { ok: true, acessoId: r.acessoId, expiraEm: r.expiraEm, modulos: r.modulos };
}

/** Registrar o resultado (5.6, "Depois"): quem pediu, depois do fim do acesso, uma vez. */
export async function registrarResultado(campos: Record<string, string | undefined>, deps: DependenciasDaPlataforma): Promise<EstadoDaDecisao> {
  const acessoId = campos.acessoId ?? "";
  if (!UUID.test(acessoId)) return { status: "erro", mensagem: E.semEmergencia };
  const v = validarResultado(campos);
  if (!v.ok) return { status: "erro", mensagem: v.erro };
  const r = await deps.registrarResultado(acessoId, deps.administradorId, v.resultado, deps.agora());
  if (r.ok) return { status: "ok", mensagem: E.resultadoRegistrado };
  const mensagem = { AcessoInexistente: E.semEmergencia, SoQuemPediu: E.soQuemPediuRegistra, AindaAtiva: E.aindaAtiva, JaRegistrado: E.resultadoJaRegistrado }[r.erro];
  return { status: "erro", mensagem };
}

// ---------------------------------------------------------------- suspensão (5.7)

const S = MENSAGENS_DA_SUSPENSAO;

function mensagemDaSuspensao(erro: Extract<ResultadoDaSuspensao, { ok: false }>["erro"]): string {
  return { NegocioInexistente: S.inexistente, NaoEAdministrador: S.inexistente, NegocioEncerrado: S.encerrado, JaSuspenso: S.jaSuspenso, NaoSuspenso: S.naoSuspenso }[erro];
}

/**
 * Suspender (5.7): um Administrador, com o código reconfirmado (a ação é crítica), o motivo da lista e a
 * descrição. O Dono vê na hora (a faixa e "Acessos do suporte") e recebe o e-mail, com domínio.
 */
export async function suspender(campos: Record<string, string | undefined>, deps: DependenciasDaPlataforma): Promise<EstadoDaSuspensao> {
  const negocioId = campos.negocioId ?? "";
  if (!UUID.test(negocioId)) return { status: "erro", mensagem: S.inexistente };
  const v = validarSuspensao(campos);
  if (!v.ok) return { status: "erro", erros: v.erros };
  const agora = deps.agora();
  const r = await deps.suspender(negocioId, deps.administradorId, v.dados, agora);
  if (!r.ok) return { status: "erro", mensagem: mensagemDaSuspensao(r.erro) };
  const dono = await deps.dono(negocioId);
  if (dono) deps.avisar(emailDaSuspensao(dono, v.dados, agora, deps.origem));
  return { status: "ok", mensagem: S.suspenso };
}

/** Reativar (5.7): um Administrador, com o código reconfirmado e uma descrição. A faixa some e a gravação volta. */
export async function reativar(campos: Record<string, string | undefined>, deps: DependenciasDaPlataforma): Promise<EstadoDaSuspensao> {
  const negocioId = campos.negocioId ?? "";
  if (!UUID.test(negocioId)) return { status: "erro", mensagem: S.inexistente };
  const v = validarReativacao(campos);
  if (!v.ok) return { status: "erro", erros: { descricao: v.erro } };
  const agora = deps.agora();
  const r = await deps.reativar(negocioId, deps.administradorId, v.descricao, agora);
  if (!r.ok) return { status: "erro", mensagem: mensagemDaSuspensao(r.erro) };
  const dono = await deps.dono(negocioId);
  if (dono) deps.avisar(emailDaReativacao(dono, v.descricao, agora, deps.origem));
  return { status: "ok", mensagem: S.reativado };
}

// ---------------------------------------------------------------- e-mails ao Dono (5.6, 5.7, 5.8 e 5.10)

function emailDaSuspensao(dono: Dono, d: DadosDaSuspensao, quando: Date, origem: string): MensagemDeEmail {
  return {
    para: dono.email,
    assunto: `O ${dono.negocio} foi suspenso pela plataforma do HE`,
    texto: [
      `Olá, ${dono.nome}!`,
      "",
      `Em ${dataHoraCompleta(quando)}, o suporte do Health Enterprise suspendeu o negócio ${dono.negocio}.`,
      `Motivo: ${ROTULO_MOTIVO_DA_SUSPENSAO[d.motivo]} — ${d.descricao}`,
      "Enquanto durar a suspensão, você e a sua equipe continuam entrando e vendo todos os dados, mas nada é gravado: vendas, estoque, catálogo, financeiro e Configurações ficam somente leitura. Nada foi apagado.",
      `Você pode exportar os seus dados em ${origem}/conta e continua podendo liberar o acesso do suporte em ${origem}/negocio/suporte, onde a suspensão também aparece.`,
      "",
      "Para entender o motivo ou pedir a reativação, fale com o suporte do HE.",
    ].join("\n"),
  };
}

function emailDaReativacao(dono: Dono, descricao: string, quando: Date, origem: string): MensagemDeEmail {
  return {
    para: dono.email,
    assunto: `O ${dono.negocio} foi reativado`,
    texto: [
      `Olá, ${dono.nome}!`,
      "",
      `Em ${dataHoraCompleta(quando)}, o suporte do Health Enterprise reativou o negócio ${dono.negocio}. A gravação voltou para você e a sua equipe.`,
      `Descrição: ${descricao}`,
      "As contas das despesas fixas do período e as parcelas vencidas são conferidas ao abrir o Financeiro ou o Painel, nas datas de vencimento.",
      `O registro da suspensão e da reativação fica em ${origem}/negocio/suporte.`,
    ].join("\n"),
  };
}

function emailDaTroca(dono: Dono, r: Extract<ResultadoDaDecisao, { tipo: "PLANO"; situacao: "APROVADO" }>, quando: Date, origem: string): MensagemDeEmail {
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

function emailDoPedidoDeEmergencia(dono: Dono, e: PedidoDeEmergencia, quando: Date, origem: string): MensagemDeEmail {
  return {
    para: dono.email,
    assunto: `Pedido de acesso de emergência ao ${dono.negocio}`,
    texto: [
      `Olá, ${dono.nome}!`,
      "",
      `Em ${dataHoraCompleta(quando)}, uma pessoa do suporte do Health Enterprise pediu acesso de emergência ao negócio ${dono.negocio}, sem a sua liberação.`,
      `Motivo: ${ROTULO_MOTIVO_DA_EMERGENCIA[e.motivo]} (${e.referencia}).`,
      `Pedido: ver ${listaDeModulos(e.modulos)}, somente leitura, por ${PRAZOS[e.prazo].rotulo}.`,
      "O acesso só começa se outra pessoa da equipe aprovar, em até 12 horas. Você é avisado na aprovação e pode encerrar o acesso a qualquer momento.",
      `Acompanhe em ${origem}/negocio/suporte.`,
    ].join("\n"),
  };
}

function emailDaEmergenciaAprovada(dono: Dono, e: PedidoDeEmergencia, fim: Date, origem: string): MensagemDeEmail {
  return {
    para: dono.email,
    assunto: `Acesso de emergência do suporte ao ${dono.negocio} até ${dataHoraCompleta(fim)}`,
    texto: [
      `Olá, ${dono.nome}!`,
      "",
      `O pedido de acesso de emergência ao negócio ${dono.negocio} foi aprovado por uma segunda pessoa da equipe do Health Enterprise.`,
      `Motivo: ${ROTULO_MOTIVO_DA_EMERGENCIA[e.motivo]} (${e.referencia}).`,
      `Quem pediu pode ver ${listaDeModulos(e.modulos)}, somente leitura, até ${dataHoraCompleta(fim)}. Os dados dos seus clientes e fornecedores aparecem mascarados, e cada tela aberta fica registrada.`,
      `Você pode encerrar o acesso a qualquer momento em ${origem}/negocio/suporte.`,
    ].join("\n"),
  };
}
