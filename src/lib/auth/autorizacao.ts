import { correcaoPermitida, moduloDaCorrecao, type IdDaCorrecao } from "@/lib/dominio/correcoes";
import type { Acao, Matriz, Modulo, Papel } from "@/lib/dominio/permissoes";
import type { SuspensaoDoNegocio } from "@/lib/dominio/suspensao";
import type { ContextoComPapel, SuporteAtivo } from "./contexto";

/**
 * Autorização no servidor (SPEC-005, 5.5; ADR-003). Sem dependências de framework:
 * as guardas de páginas e a fábrica de Server Actions usam esta decisão, e os testes
 * a exercitam direto.
 */

/** Nível de acesso que toda Server Action declara (OPEN-008). */
export type NivelDeAcesso =
  | { tipo: "publica" }
  /** Sessão sem negócio ativo (cadastrar negócio, aceitar convite, sair do negócio…). */
  | { tipo: "sessao"; origem?: "acao" }
  /**
   * Configurações do negócio (OPEN-002). SPEC-019 (5.7): `naSuspensao` marca as ações do Dono que continuam
   * com o negócio suspenso: liberar e revogar o suporte, encerrar a emergência e o desfazer, que recusa com a
   * explicação (OPEN-018). As demais são recusadas (`NegocioSuspenso`).
   */
  | { tipo: "dono"; origem?: "acao"; naSuspensao?: true }
  | {
      tipo: "permissao";
      modulo: Modulo;
      acao: Acao;
      origem?: "acao";
      /**
       * SPEC-019 (5.4): a ação é uma correção da lista fechada, ou uma consulta de formulário (o NCM)
       * que a correção usa. Sem isso, a ação nunca é aceita no modo suporte.
       */
      correcao?: IdDaCorrecao | "consulta";
    }
  /**
   * Minha conta (SPEC-014) e o novo aceite dos termos (SPEC-018, RF78): basta a sessão,
   * mesmo com os termos pendentes — a pessoa pode exportar os dados ou excluir a conta.
   */
  | { tipo: "conta" }
  /** Painel do Administrador da plataforma (SPEC-018, RF74). */
  | { tipo: "administrador" }
  /**
   * SPEC-019 (5.1): as telas do 2º fator. Só a conta de Administrador, com ou sem o código já
   * verificado (cadastrar, digitar o código, cadastrar outro autenticador).
   */
  | { tipo: "segundoFator" };

export type ContextoDoMembro = {
  usuarioId: string;
  negocioId: string;
  /** null só no modo suporte: o Administrador não tem papel no negócio (SPEC-018). */
  papel: Papel | null;
  permissoes: Matriz;
  /** SPEC-018: modo suporte — somente leitura e dados pessoais mascarados. */
  modoSuporte?: boolean;
  suporte?: SuporteAtivo | null;
  /** SPEC-019 (5.3): a correção do suporte que esta ação executa (sempre pelo motor das correções). */
  correcao?: IdDaCorrecao;
  /** SPEC-019 (5.7): o negócio está suspenso pela plataforma (somente leitura). */
  negocioSuspenso?: SuspensaoDoNegocio | null;
};

export type MotivoDaRecusa =
  | "SemSessao"
  | "SemNegocio"
  | "SomenteDono"
  | "SemPermissao"
  /** SPEC-018 (INV-002): no modo suporte, nenhuma Server Action é executada fora de um módulo em correção. */
  | "SomenteLeitura"
  /** SPEC-019 (5.4, INV-003): no módulo em correção, a ação não está na lista fechada. */
  | "ForaDaListaDeCorrecoes"
  /** SPEC-018 (INV-004): a conta de Administrador não cria negócio, não aceita convite nem troca de negócio. */
  | "ContaDeAdministrador"
  | "SomenteAdministrador"
  /** SPEC-018 (RF78): falta o aceite da versão vigente dos termos. */
  | "TermosPendentes"
  /** SPEC-018 (RNF12): sessão do Administrador com mais de 8 h. */
  | "SessaoExpirada"
  /** SPEC-019 (INV-001): conta de Administrador sem o código verificado nesta sessão. */
  | "SegundoFatorPendente"
  /** SPEC-019 (5.7, RN39, INV-008): o negócio está suspenso — nada é gravado nos módulos nem em Configurações. */
  | "NegocioSuspenso";

export type Autorizacao =
  | { ok: true; contexto: ContextoComPapel | null; membro: ContextoDoMembro | null }
  | { ok: false; motivo: MotivoDaRecusa };

function membroDo(contexto: ContextoComPapel): ContextoDoMembro | null {
  if (!contexto.negocioId || !contexto.permissoes) return null;
  const negocioSuspenso = contexto.negocioSuspenso ?? null;
  if (contexto.suporte) {
    return { usuarioId: contexto.usuarioId, negocioId: contexto.negocioId, papel: null, permissoes: contexto.permissoes, modoSuporte: true, suporte: contexto.suporte, negocioSuspenso };
  }
  if (!contexto.papel) return null;
  return { usuarioId: contexto.usuarioId, negocioId: contexto.negocioId, papel: contexto.papel, permissoes: contexto.permissoes, negocioSuspenso };
}

/**
 * SPEC-019 (5.7, RN39): com o negócio suspenso, o membro vê tudo, mas nenhuma ação de módulo é executada
 * (só as consultas dos formulários, que não gravam) e as telas de incluir, editar e excluir não abrem.
 * O banco recusa a gravação também (gatilho he_negocio_suspenso, segunda barreira).
 */
function gravariaNaSuspensao(nivel: Extract<NivelDeAcesso, { tipo: "permissao" }>): boolean {
  return nivel.origem === "acao" ? nivel.correcao !== "consulta" : nivel.acao !== "ver";
}

export function autorizar(contexto: ContextoComPapel | null, nivel: NivelDeAcesso): Autorizacao {
  if (nivel.tipo === "publica") return { ok: true, contexto, membro: contexto ? membroDo(contexto) : null };
  if (!contexto) return { ok: false, motivo: "SemSessao" };
  if (contexto.sessaoExpirada) return { ok: false, motivo: "SessaoExpirada" };
  // SPEC-019 (5.1): senha → código → aceite dos termos → painel. Sem o código, só as telas do 2º fator.
  if (nivel.tipo === "segundoFator") {
    return contexto.administrador ? { ok: true, contexto, membro: null } : { ok: false, motivo: "SomenteAdministrador" };
  }
  if (contexto.administrador && contexto.segundoFatorPendente) return { ok: false, motivo: "SegundoFatorPendente" };
  if (nivel.tipo === "conta") return { ok: true, contexto, membro: null };
  if (contexto.termosPendentes) return { ok: false, motivo: "TermosPendentes" };
  if (nivel.tipo === "administrador") {
    return contexto.administrador ? { ok: true, contexto, membro: null } : { ok: false, motivo: "SomenteAdministrador" };
  }

  const ehAcao = nivel.origem === "acao";
  if (ehAcao && contexto.suporte) return autorizarNoSuporte(contexto, nivel);
  if (ehAcao && contexto.administrador && nivel.tipo === "sessao") return { ok: false, motivo: "ContaDeAdministrador" };
  if (nivel.tipo === "sessao") return { ok: true, contexto, membro: membroDo(contexto) };

  const membro = membroDo(contexto);
  if (!membro) return { ok: false, motivo: "SemNegocio" };
  const suspenso = Boolean(contexto.negocioSuspenso);
  if (nivel.tipo === "dono") {
    if (membro.papel !== "DONO") return { ok: false, motivo: "SomenteDono" };
    // SPEC-019 (5.7): Configurações continuam abertas para ver; gravar, só as ações marcadas `naSuspensao`.
    if (suspenso && ehAcao && !nivel.naSuspensao) return { ok: false, motivo: "NegocioSuspenso" };
    return { ok: true, contexto, membro };
  }
  if (membro.permissoes[nivel.modulo][nivel.acao]) {
    return suspenso && gravariaNaSuspensao(nivel) ? { ok: false, motivo: "NegocioSuspenso" } : { ok: true, contexto, membro };
  }
  // SPEC-019 (5.3): no modo suporte, a tela de uma correção da lista (ex.: o formulário de editar item).
  const correcao = nivel.correcao === "consulta" ? undefined : nivel.correcao;
  if (contexto.suporte && correcaoPermitida(correcao, contexto.suporte.modulosComCorrecao) && moduloDaCorrecao(correcao) === nivel.modulo) {
    return { ok: true, contexto, membro };
  }
  return { ok: false, motivo: "SemPermissao" };
}

/** A matriz do suporte com o módulo em correção liberado, só para o corpo da ação já autorizada. */
function comOModulo(matriz: Matriz, modulo: Modulo): Matriz {
  return { ...matriz, [modulo]: { ver: true, criar: true, editar: true, excluir: true } };
}

/**
 * SPEC-019 (5.3, 5.4; INV-003): no modo suporte, uma Server Action só passa se o módulo dela estiver em
 * "ver e corrigir" na liberação ativa (o contexto só traz esses módulos depois da entrada com o código
 * reconfirmado) e se ela for uma correção da lista fechada ou uma consulta de formulário desse módulo.
 * Nos outros módulos, continua somente leitura (SPEC-018, INV-002).
 */
function autorizarNoSuporte(contexto: ContextoComPapel, nivel: NivelDeAcesso): Autorizacao {
  const suporte = contexto.suporte!;
  // SPEC-019 (5.7, INV-003): no negócio suspenso, as correções são recusadas (o contexto já as tira da liberação).
  if (contexto.negocioSuspenso && nivel.tipo === "permissao" && nivel.correcao && nivel.correcao !== "consulta") {
    return { ok: false, motivo: "NegocioSuspenso" };
  }
  if (nivel.tipo !== "permissao" || !suporte.modulosComCorrecao.includes(nivel.modulo)) return { ok: false, motivo: "SomenteLeitura" };
  const membro = membroDo(contexto);
  if (!membro) return { ok: false, motivo: "SemNegocio" };
  const permissoes = comOModulo(membro.permissoes, nivel.modulo);
  if (nivel.correcao === "consulta") return { ok: true, contexto, membro: { ...membro, permissoes } };
  if (correcaoPermitida(nivel.correcao, suporte.modulosComCorrecao) && moduloDaCorrecao(nivel.correcao) === nivel.modulo) {
    return { ok: true, contexto, membro: { ...membro, permissoes, correcao: nivel.correcao } };
  }
  return { ok: false, motivo: "ForaDaListaDeCorrecoes" };
}
