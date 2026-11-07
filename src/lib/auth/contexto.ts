/**
 * Contexto da requisição (SPEC-002, 5.5): quem está acessando e, se houver, o negócio
 * ativo. O negócio vem de um cookie, mas só é aceito se o usuário for membro dele
 * (INV-006). Nenhum valor vindo do navegador é aceito sem essa confirmação.
 */

import { permissoesEfetivas, type Matriz, type Modulo, type Papel } from "@/lib/dominio/permissoes";
import { sessaoAnteriorARedefinicao, type NivelDaSessao } from "@/lib/dominio/segundo-fator";
import { matrizDoSuporte, modulosValidos, sessaoDoAdministradorValida, situacaoDaLiberacao } from "@/lib/dominio/suporte";

/** Cookie do negócio ativo (definido pela troca de negócio da SPEC-004). */
export const COOKIE_NEGOCIO_ATIVO = "he_negocio";
/** Cookie do modo suporte (SPEC-018): só o id da liberação; o contexto é sempre lido do banco. */
export const COOKIE_SUPORTE = "he_suporte";

export type ContextoDaRequisicao = {
  usuarioId: string;
  /** Negócio ativo confirmado no banco; null se não houver ou não for autorizado. */
  negocioId: string | null;
  /** Havia um negócio no cookie que não foi aceito (CA-11: ir para "Meus negócios"). */
  negocioRecusado: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolverContexto(
  usuarioId: string | null,
  negocioDoCookie: string | undefined,
  ehMembro: (usuarioId: string, negocioId: string) => Promise<boolean>,
): Promise<ContextoDaRequisicao | null> {
  if (!usuarioId) return null;
  if (!negocioDoCookie) return { usuarioId, negocioId: null, negocioRecusado: false };

  const aceito = UUID.test(negocioDoCookie) && (await ehMembro(usuarioId, negocioDoCookie));
  return aceito
    ? { usuarioId, negocioId: negocioDoCookie, negocioRecusado: false }
    : { usuarioId, negocioId: null, negocioRecusado: true };
}

/** Filiação do usuário no negócio, lida do banco junto com a confirmação (SPEC-005, INV-004). */
export type Filiacao = { papel: Papel; permissoesCustom: unknown };

/** Modo suporte ativo (SPEC-018, 5.5): liberação válida do Dono, lida do banco nesta requisição. */
export type SuporteAtivo = {
  acessoId: string;
  negocioId: string;
  negocio: string;
  modulos: Modulo[];
  /**
   * SPEC-019 (5.3): módulos em "ver e corrigir"; vazio na liberação só de leitura e enquanto a entrada
   * com o código reconfirmado não aconteceu nesta sessão.
   */
  modulosComCorrecao: Modulo[];
  /** SPEC-019 (5.3): a liberação tem correção, mas falta entrar de novo com o código. */
  correcaoPendente?: boolean;
  expiraEm: Date;
  /** SPEC-019 (5.6): acesso de emergência (somente leitura), com o motivo curto para a faixa vermelha. */
  emergencia?: { motivo: string } | null;
};

/** Contexto com o papel e as permissões efetivas no negócio ativo (SPEC-005, 5.5). */
export type ContextoComPapel = ContextoDaRequisicao & {
  /** null quando não há negócio ativo (e no modo suporte: o Administrador não tem papel no negócio). */
  papel: Papel | null;
  permissoes: Matriz | null;
  /** SPEC-018 (RF74): conta de Administrador da plataforma. */
  administrador?: boolean;
  /** SPEC-018 (RF76): modo suporte; o negócio ativo é o da liberação e a matriz só tem "ver". */
  suporte?: SuporteAtivo | null;
  /**
   * SPEC-018: havia um modo suporte que acabou (o Dono revogou ou o prazo venceu). SPEC-019 (5.6):
   * "emergencia" quando o acesso de emergência foi encerrado.
   */
  suporteEncerrado?: "revogado" | "expirou" | "emergencia" | null;
  /** SPEC-018 (RF78): a versão aceita da política e dos termos não é a vigente. */
  termosPendentes?: boolean;
  /** SPEC-018 (RNF12): sessão do Administrador com mais de 8 h desde a entrada. */
  sessaoExpirada?: boolean;
  /** SPEC-019 (INV-001): conta de Administrador sem o código verificado nesta sessão (`aal1`). */
  segundoFatorPendente?: boolean;
  /** SPEC-019 (INV-002): último código verificado nesta sessão, para a reconfirmação de 10 min. */
  codigoVerificadoEm?: Date | null;
};

/**
 * Resolve o contexto e, na mesma consulta de filiação, o papel e as permissões efetivas
 * (uma consulta por requisição). Nada vem do navegador além do id do negócio.
 */
export async function resolverContextoComPapel(
  usuarioId: string | null,
  negocioDoCookie: string | undefined,
  filiacao: (usuarioId: string, negocioId: string) => Promise<Filiacao | null>,
): Promise<ContextoComPapel | null> {
  let encontrada: Filiacao | null = null;
  const contexto = await resolverContexto(usuarioId, negocioDoCookie, async (u, n) => {
    encontrada = await filiacao(u, n);
    return encontrada !== null;
  });
  if (!contexto) return null;
  const f = contexto.negocioId ? (encontrada as Filiacao | null) : null;
  return {
    ...contexto,
    papel: f?.papel ?? null,
    permissoes: f ? permissoesEfetivas(f.papel, f.permissoesCustom) : null,
  };
}

/**
 * Estado da conta lido a cada requisição (SPEC-018): papel de Administrador e versão dos termos aceita.
 * SPEC-019 (OPEN-002): quando o 2º fator foi redefinido pelo workflow.
 */
export type EstadoDaConta = { administradorEm: Date | null; versaoTermosAceita: string | null; segundoFatorRedefinidoEm?: Date | null };

/** Liberação de suporte como o contexto precisa dela (SPEC-018). */
export type LiberacaoDoContexto = {
  id: string;
  negocioId: string;
  negocio: string;
  negocioEncerrado: boolean;
  modulos: string[];
  /** SPEC-019: subconjunto de `modulos` em "ver e corrigir". */
  modulosComCorrecao?: string[];
  /** SPEC-019 (5.3): a entrada deste Administrador com o código reconfirmado, se ainda não saiu. */
  entradaComCorrecaoEm?: Date | null;
  expiraEm: Date;
  revogadoEm: Date | null;
  /** SPEC-019 (5.6, INV-010): no acesso de emergência, o motivo curto e a conta que pediu (a única que entra). */
  emergencia?: { motivo: string; solicitadoPorId: string } | null;
};

export type EntradaDoContexto = {
  usuarioId: string | null;
  negocioDoCookie: string | undefined;
  suporteDoCookie: string | undefined;
  /** Momento da entrada com a senha desta sessão, das claims do JWT. */
  autenticadoEm: Date | null;
  /** SPEC-019: nível da sessão (`aal2` depois do código) e o último código verificado. */
  nivelDaSessao?: NivelDaSessao | null;
  codigoEm?: Date | null;
  agora: Date;
  versaoDosTermos: string;
};

export type DependenciasDoContexto = {
  filiacao: (usuarioId: string, negocioId: string) => Promise<Filiacao | null>;
  conta: (usuarioId: string) => Promise<EstadoDaConta | null>;
  liberacao: (acessoId: string, administradorId: string) => Promise<LiberacaoDoContexto | null>;
};

/**
 * Contexto completo da requisição (SPEC-002, SPEC-005 e SPEC-018). Para usuários comuns, é o
 * contexto de membro de sempre, mais a pendência dos termos. Para a conta de Administrador:
 * nunca há filiação (INV-004); o negócio ativo só existe com uma liberação ativa do Dono,
 * conferida no banco nesta requisição (INV-001), e a matriz tem só "ver" nos módulos
 * liberados (INV-003). O cookie do suporte é só um ponteiro: nada vem do navegador sem
 * a confirmação no banco.
 */
export async function resolverContextoDaRequisicao(e: EntradaDoContexto, deps: DependenciasDoContexto): Promise<ContextoComPapel | null> {
  if (!e.usuarioId) return null;
  const conta = await deps.conta(e.usuarioId);
  const termosPendentes = conta !== null && conta.versaoTermosAceita !== e.versaoDosTermos;

  if (!conta?.administradorEm) {
    const base = await resolverContextoComPapel(e.usuarioId, e.negocioDoCookie, deps.filiacao);
    return base && { ...base, administrador: false, suporte: null, suporteEncerrado: null, termosPendentes, sessaoExpirada: false };
  }

  // SPEC-019: 8 h contadas do login com senha (RNF12); a sessão aberta antes da redefinição do
  // 2º fator deixa de valer (OPEN-002); sem `aal2`, nenhum contexto de Administrador (INV-001).
  const sessaoExpirada = !sessaoDoAdministradorValida(e.autenticadoEm, e.agora) || sessaoAnteriorARedefinicao(e.autenticadoEm, conta.segundoFatorRedefinidoEm);
  const segundoFatorPendente = e.nivelDaSessao !== "aal2";
  const semNegocio = {
    usuarioId: e.usuarioId,
    negocioId: null,
    negocioRecusado: false,
    papel: null,
    permissoes: null,
    administrador: true,
    termosPendentes,
    sessaoExpirada,
    segundoFatorPendente,
    codigoVerificadoEm: e.codigoEm ?? null,
  };
  // Sem o código verificado, nem a liberação do suporte é lida: só as telas do 2º fator e "Sair".
  if (segundoFatorPendente) return { ...semNegocio, suporte: null, suporteEncerrado: null };
  const lida = e.suporteDoCookie && UUID.test(e.suporteDoCookie) ? await deps.liberacao(e.suporteDoCookie, e.usuarioId) : null;
  if (!lida) return { ...semNegocio, suporte: null, suporteEncerrado: null };
  // SPEC-019 (INV-010): o acesso de emergência só vale para a conta que pediu; para outra, o cookie não aponta nada.
  if (lida.emergencia && lida.emergencia.solicitadoPorId !== e.usuarioId) return { ...semNegocio, suporte: null, suporteEncerrado: null };

  const situacao = lida.negocioEncerrado ? "REVOGADA" : situacaoDaLiberacao(lida, e.agora);
  if (situacao !== "ATIVA") {
    const encerrado = situacao === "EXPIRADA" ? "expirou" : lida.emergencia ? "emergencia" : "revogado";
    return { ...semNegocio, suporte: null, suporteEncerrado: encerrado };
  }

  const modulos = modulosValidos(lida.modulos);
  // SPEC-019 (5.3, INV-003): a correção vale da entrada com o código reconfirmado, nesta sessão, até a
  // saída, a expiração ou a revogação. Sem ela (cookie de outra sessão, ou antes de entrar), só leitura.
  // SPEC-019 (INV-003): a emergência nunca corrige, seja o que for que o banco tenha.
  const comCorrecao = lida.emergencia ? [] : modulosValidos(lida.modulosComCorrecao ?? []).filter((m) => modulos.includes(m));
  const entrada = lida.entradaComCorrecaoEm ?? null;
  const correcaoLiberada = entrada !== null && e.autenticadoEm !== null && entrada.getTime() >= e.autenticadoEm.getTime();
  return {
    ...semNegocio,
    negocioId: lida.negocioId,
    permissoes: matrizDoSuporte(modulos),
    suporte: {
      acessoId: lida.id,
      negocioId: lida.negocioId,
      negocio: lida.negocio,
      modulos,
      modulosComCorrecao: correcaoLiberada ? comCorrecao : [],
      correcaoPendente: comCorrecao.length > 0 && !correcaoLiberada,
      expiraEm: lida.expiraEm,
      emergencia: lida.emergencia ? { motivo: lida.emergencia.motivo } : null,
    },
    suporteEncerrado: null,
  };
}
