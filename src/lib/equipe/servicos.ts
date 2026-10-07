import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import type { ErrosDeCampo } from "@/lib/auth/validacao";
import type { ConsultasDeEquipe, MembroDaEquipe } from "@/lib/db/equipe";
import { dataBrasileira } from "@/lib/dominio/datas";
import { permissoesEfetivas, resumoDaMatriz, ROTULO_PAPEL, validarMatriz, matrizDoFormulario, matrizParaGravar } from "@/lib/dominio/permissoes";
import type { MensagemDeEmail } from "@/lib/integracoes/email";
import { formatoDeTokenValido, gerarToken, hashDoToken, validadeDoConvite } from "./token";
import { mascararEmail, validarConvite, type PapelDoConvite } from "./validacao";

/**
 * Fluxos da equipe (SPEC-005, seção 5), independentes do Next.js: as Server Actions
 * passam pela guarda da fábrica (só o Dono) e chamam estas funções, que conferem o
 * papel de novo (RN02, INV-001) e validam tudo.
 */

export const MENSAGENS_DA_EQUIPE = {
  somenteDono: "Só o Dono pode gerenciar a equipe.",
  semSessao: "Sua sessão expirou. Entre de novo.",
  proprioDono: "Você já é o Dono deste negócio.",
  jaEhMembro: "Esta pessoa já faz parte da equipe.",
  convitePendente: "Já existe um convite pendente para este e-mail. Use “Reenviar”.",
  limiteDoPlano: "No plano gratuito, o negócio pode ter 1 colaborador. Para convidar mais pessoas, é preciso o plano pago.",
  negocioIndisponivel: "Este negócio não está disponível.",
  conviteCriado: "Convite criado.",
  emailEnviado: "Enviamos o convite por e-mail. Você também pode copiar o link abaixo e mandar por outro canal.",
  emailNaoEnviado: "Não conseguimos enviar o e-mail. Copie o link e envie para a pessoa.",
  conviteInvalido: "Este convite não vale mais. Peça um novo ao Dono do negócio.",
  conviteCancelado: "Convite cancelado.",
  alvoEhDono: "O Dono do negócio não pode ser alterado nem removido.",
  membroNaoEncontrado: "Esta pessoa não faz mais parte da equipe.",
  papelAlterado: "Papel alterado. Valem as permissões padrão do novo papel.",
  permissoesSalvas: "Permissões salvas.",
  membroRemovido: "Pessoa removida da equipe.",
  jaFazParte: "Você já faz parte deste negócio.",
  donoNaoSai: "O Dono não pode sair do próprio negócio.",
  falhaInterna: "Não foi possível concluir agora. Tente novamente.",
} as const;

const M = MENSAGENS_DA_EQUIPE;

export type EstadoDoConvite =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: ErrosDeCampo; valores?: Record<string, string> }
  /** O link aparece uma única vez para o Dono copiar (OPEN-004). */
  | { status: "criado"; email: string; link: string; emailEnviado: boolean; mensagem: string };

export type EstadoDaAcao = { status: "ocioso" } | { status: "erro"; mensagem: string } | { status: "ok"; mensagem: string };

export const CONVITE_INICIAL: EstadoDoConvite = { status: "ocioso" };
export const ACAO_INICIAL: EstadoDaAcao = { status: "ocioso" };

export type DependenciasDaEquipe = {
  /** Usuário da sessão validada no servidor (null = sem sessão). */
  usuarioId: string | null;
  /** Membro do negócio ativo, com o papel lido do banco nesta requisição (INV-004). */
  membro: ContextoDoMembro | null;
  consultas: ConsultasDeEquipe;
  enviarEmail(mensagem: MensagemDeEmail): Promise<boolean>;
  /** Endereço da aplicação (para o link do convite). */
  origem: string;
  agora(): Date;
  definirNegocioAtivo(negocioId: string): Promise<void>;
  /** Negócio ativo atual (cookie já validado) e como limpá-lo ao sair dele. */
  negocioAtivo: string | null;
  limparNegocioAtivo(): Promise<void>;
};

const linkDoConvite = (origem: string, token: string) => `${origem}/convite/${token}`;

/** Texto do e-mail do convite (RF72): negócio, quem convidou, papel, permissões, validade e link. */
export function mensagemDoConvite(d: {
  email: string;
  negocio: string;
  convidadoPor: string;
  papel: PapelDoConvite;
  permissoesCustom: unknown;
  expiraEm: Date;
  link: string;
}): MensagemDeEmail {
  const resumo = resumoDaMatriz(permissoesEfetivas(d.papel, d.permissoesCustom));
  return {
    para: d.email,
    assunto: `Convite para a equipe de ${d.negocio} no Health Enterprise`,
    texto: [
      "Olá!",
      "",
      `${d.convidadoPor} convidou você para a equipe de ${d.negocio} no Health Enterprise, como ${ROTULO_PAPEL[d.papel]}.`,
      "",
      d.permissoesCustom ? "Permissões (personalizadas pelo Dono):" : "Permissões:",
      ...resumo.map((l) => `- ${l}`),
      "",
      `Para aceitar, abra o link abaixo até ${dataBrasileira(d.expiraEm)}. Se ainda não tem conta, você pode criá-la com este e-mail.`,
      d.link,
      "",
      "Se você não esperava este convite, pode ignorar esta mensagem.",
    ].join("\n"),
  };
}

function exigirDono(deps: DependenciasDaEquipe): ContextoDoMembro | null {
  return deps.membro && deps.membro.papel === "DONO" ? deps.membro : null;
}

async function enviarConvite(
  deps: DependenciasDaEquipe,
  dono: ContextoDoMembro,
  convite: { email: string; papel: PapelDoConvite; permissoesCustom: unknown; expiraEm: Date },
  token: string,
): Promise<EstadoDoConvite> {
  const link = linkDoConvite(deps.origem, token);
  const [resumo, perfil] = await Promise.all([deps.consultas.doNegocio(dono.negocioId).resumo(), deps.consultas.usuario(dono.usuarioId)]);
  const emailEnviado = await deps
    .enviarEmail(mensagemDoConvite({ ...convite, negocio: resumo?.nome ?? "", convidadoPor: perfil?.nome ?? "O Dono", link }))
    .catch(() => false);
  return { status: "criado", email: convite.email, link, emailEnviado, mensagem: emailEnviado ? M.emailEnviado : M.emailNaoEnviado };
}

/** Convidar (5.2 — UC3 e UC4). */
export async function convidar(campos: Record<string, string>, deps: DependenciasDaEquipe): Promise<EstadoDoConvite> {
  const dono = exigirDono(deps);
  if (!dono) return { status: "erro", mensagem: M.somenteDono };
  const valores = { email: campos.email ?? "", papel: campos.papel ?? "" };
  const v = validarConvite(campos);
  if (!v.ok) return { status: "erro", erros: v.erros, valores };

  const perfil = await deps.consultas.usuario(dono.usuarioId);
  if (perfil?.email.toLowerCase() === v.dados.email) return { status: "erro", erros: { email: M.proprioDono }, valores };

  const agora = deps.agora();
  const token = gerarToken();
  const expiraEm = validadeDoConvite(agora);
  const r = await deps.consultas
    .doNegocio(dono.negocioId)
    .criarConvite({ ...v.dados, tokenHash: hashDoToken(token), expiraEm, convidadoPorId: dono.usuarioId }, agora);
  if (!r.ok) {
    switch (r.erro) {
      case "JaEhMembro":
        return { status: "erro", erros: { email: M.jaEhMembro }, valores };
      case "ConvitePendenteExistente":
        return { status: "erro", erros: { email: M.convitePendente }, valores };
      case "LimiteDoPlano":
        return { status: "erro", mensagem: M.limiteDoPlano, valores };
      default:
        return { status: "erro", mensagem: M.negocioIndisponivel };
    }
  }
  return enviarConvite(deps, dono, { ...v.dados, expiraEm }, token);
}

/** Reenviar (5.4): token e validade novos; o link anterior para de valer (INV-007). */
export async function reenviarConvite(conviteId: string, deps: DependenciasDaEquipe): Promise<EstadoDoConvite> {
  const dono = exigirDono(deps);
  if (!dono) return { status: "erro", mensagem: M.somenteDono };
  const agora = deps.agora();
  const token = gerarToken();
  const c = await deps.consultas.doNegocio(dono.negocioId).renovarConvite(conviteId, hashDoToken(token), validadeDoConvite(agora), agora);
  if (!c || c.papel === "DONO") return { status: "erro", mensagem: M.conviteInvalido };
  return enviarConvite(deps, dono, { email: c.email, papel: c.papel, permissoesCustom: c.permissoesCustom, expiraEm: c.expiraEm }, token);
}

/** Cancelar convite pendente (5.4): o link para de valer e a vaga é liberada. */
export async function cancelarConvite(conviteId: string, deps: DependenciasDaEquipe): Promise<EstadoDaAcao> {
  const dono = exigirDono(deps);
  if (!dono) return { status: "erro", mensagem: M.somenteDono };
  const ok = await deps.consultas.doNegocio(dono.negocioId).cancelarConvite(conviteId, deps.agora());
  return ok ? { status: "ok", mensagem: M.conviteCancelado } : { status: "erro", mensagem: M.conviteInvalido };
}

async function membroAlteravel(membroId: string, deps: DependenciasDaEquipe): Promise<{ dono: ContextoDoMembro; alvo: MembroDaEquipe } | EstadoDaAcao> {
  const dono = exigirDono(deps);
  if (!dono) return { status: "erro", mensagem: M.somenteDono };
  const alvo = await deps.consultas.doNegocio(dono.negocioId).membro(membroId);
  if (!alvo) return { status: "erro", mensagem: M.membroNaoEncontrado };
  if (alvo.papel === "DONO") return { status: "erro", mensagem: M.alvoEhDono };
  return { dono, alvo };
}

/** Trocar o papel (5.4): limpa a matriz customizada; vale a predefinição do novo papel. */
export async function alterarPapel(membroId: string, papel: string, deps: DependenciasDaEquipe): Promise<EstadoDaAcao> {
  const r = await membroAlteravel(membroId, deps);
  if ("status" in r) return r;
  if (papel !== "GERENTE" && papel !== "COLABORADOR") return { status: "erro", mensagem: M.alvoEhDono };
  const ok = await deps.consultas.doNegocio(r.dono.negocioId).alterarPapel(membroId, papel);
  return ok ? { status: "ok", mensagem: M.papelAlterado } : { status: "erro", mensagem: M.membroNaoEncontrado };
}

/**
 * Editar as permissões (5.4 — UC4): grava a matriz inteira, com a regra de coerência;
 * "padrao" = voltar à predefinição do papel (limpa a matriz).
 */
export async function alterarPermissoes(membroId: string, campos: Record<string, string>, deps: DependenciasDaEquipe): Promise<EstadoDaAcao> {
  const r = await membroAlteravel(membroId, deps);
  if ("status" in r) return r;
  const papel = r.alvo.papel as PapelDoConvite;
  let matriz = null;
  if (campos.padrao !== "on") {
    const v = validarMatriz(matrizDoFormulario(campos));
    if (!v.ok) return { status: "erro", mensagem: v.erro };
    matriz = matrizParaGravar(papel, v.matriz);
  }
  const ok = await deps.consultas.doNegocio(r.dono.negocioId).alterarPermissoes(membroId, matriz);
  return ok ? { status: "ok", mensagem: M.permissoesSalvas } : { status: "erro", mensagem: M.membroNaoEncontrado };
}

/** Remover membro (5.4): perde o acesso na requisição seguinte (INV-009); os registros continuam. */
export async function removerMembro(membroId: string, deps: DependenciasDaEquipe): Promise<EstadoDaAcao> {
  const r = await membroAlteravel(membroId, deps);
  if ("status" in r) return r;
  const ok = await deps.consultas.doNegocio(r.dono.negocioId).remover(membroId);
  return ok ? { status: "ok", mensagem: M.membroRemovido } : { status: "erro", mensagem: M.membroNaoEncontrado };
}

// ---------- Aceitação (5.3) ----------

export type ConviteParaAceitar =
  | { status: "invalido" }
  | {
      status: "valido";
      negocio: string;
      convidadoPor: string;
      papel: PapelDoConvite;
      permissoes: string[];
      emailMascarado: string;
      /** Só para quem é dono do e-mail convidado (ou sem sessão, para preencher o cadastro). */
      email: string;
    };

/** Lê o convite do link: inválido se desconhecido, cancelado, expirado, aceito ou de negócio encerrado. */
export async function lerConvite(token: string, deps: Pick<DependenciasDaEquipe, "consultas" | "agora">): Promise<ConviteParaAceitar> {
  if (!formatoDeTokenValido(token)) return { status: "invalido" };
  const c = await deps.consultas.conviteDoToken(hashDoToken(token), deps.agora());
  if (!c || !c.valido || c.papel === "DONO") return { status: "invalido" };
  return {
    status: "valido",
    negocio: c.negocio,
    convidadoPor: c.convidadoPor,
    papel: c.papel,
    permissoes: resumoDaMatriz(permissoesEfetivas(c.papel, c.permissoesCustom)),
    emailMascarado: mascararEmail(c.email),
    email: c.email,
  };
}

export type ResultadoDoAceite =
  | { status: "aceito"; negocioId: string }
  | { status: "erro"; motivo: "SemSessao" | "ConviteInvalido" | "EmailDiferente" | "JaEhMembro"; mensagem: string };

/**
 * Aceitar (5.3): pelo token do link ou pelo id em "Convites para você". Só a conta com o
 * e-mail do convite aceita (INV-010); o uso único é garantido no banco (INV-006).
 */
export async function aceitarConvite(
  alvo: { token: string } | { conviteId: string },
  deps: DependenciasDaEquipe,
): Promise<ResultadoDoAceite> {
  if (!deps.usuarioId) return { status: "erro", motivo: "SemSessao", mensagem: M.semSessao };
  const conta = await deps.consultas.usuario(deps.usuarioId);
  if (!conta) return { status: "erro", motivo: "SemSessao", mensagem: M.semSessao };
  const email = conta.email.toLowerCase();
  const agora = deps.agora();

  let conviteId: string;
  if ("token" in alvo) {
    if (!formatoDeTokenValido(alvo.token)) return { status: "erro", motivo: "ConviteInvalido", mensagem: M.conviteInvalido };
    const c = await deps.consultas.conviteDoToken(hashDoToken(alvo.token), agora);
    if (!c || !c.valido) return { status: "erro", motivo: "ConviteInvalido", mensagem: M.conviteInvalido };
    if (c.email !== email) {
      return {
        status: "erro",
        motivo: "EmailDiferente",
        mensagem: `Este convite foi enviado para outro e-mail (${mascararEmail(c.email)}). Entre com essa conta para aceitar.`,
      };
    }
    conviteId = c.id;
  } else {
    conviteId = alvo.conviteId;
  }

  const r = await deps.consultas.aceitar(conviteId, deps.usuarioId, email, agora);
  if (!r.ok) {
    return r.erro === "JaEhMembro"
      ? { status: "erro", motivo: "JaEhMembro", mensagem: M.jaFazParte }
      : { status: "erro", motivo: "ConviteInvalido", mensagem: M.conviteInvalido };
  }
  await deps.definirNegocioAtivo(r.negocioId);
  return { status: "aceito", negocioId: r.negocioId };
}

/** "Convites para você" (OPEN-006): pendentes e válidos para o e-mail da conta. */
export async function convitesParaVoce(deps: DependenciasDaEquipe) {
  if (!deps.usuarioId) return [];
  const conta = await deps.consultas.usuario(deps.usuarioId);
  if (!conta) return [];
  return deps.consultas.convitesDoEmail(conta.email.toLowerCase(), deps.agora());
}

/** Sair do negócio (OPEN-007): só quem não é Dono; limpa o negócio ativo se era ele. */
export async function sairDoNegocio(negocioId: string, deps: DependenciasDaEquipe): Promise<EstadoDaAcao> {
  if (!deps.usuarioId) return { status: "erro", mensagem: M.semSessao };
  const ok = await deps.consultas.sair(deps.usuarioId, negocioId);
  if (!ok) return { status: "erro", mensagem: M.donoNaoSai };
  if (deps.negocioAtivo === negocioId) await deps.limparNegocioAtivo();
  return { status: "ok", mensagem: "Você saiu do negócio." };
}
