import type { Acao, Matriz, Modulo, Papel } from "@/lib/dominio/permissoes";
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
  /** Configurações do negócio (OPEN-002). */
  | { tipo: "dono"; origem?: "acao" }
  | { tipo: "permissao"; modulo: Modulo; acao: Acao; origem?: "acao" }
  /**
   * Minha conta (SPEC-014) e o novo aceite dos termos (SPEC-018, RF78): basta a sessão,
   * mesmo com os termos pendentes — a pessoa pode exportar os dados ou excluir a conta.
   */
  | { tipo: "conta" }
  /** Painel do Administrador da plataforma (SPEC-018, RF74). */
  | { tipo: "administrador" };

export type ContextoDoMembro = {
  usuarioId: string;
  negocioId: string;
  /** null só no modo suporte: o Administrador não tem papel no negócio (SPEC-018). */
  papel: Papel | null;
  permissoes: Matriz;
  /** SPEC-018: modo suporte — somente leitura e dados pessoais mascarados. */
  modoSuporte?: boolean;
  suporte?: SuporteAtivo | null;
};

export type MotivoDaRecusa =
  | "SemSessao"
  | "SemNegocio"
  | "SomenteDono"
  | "SemPermissao"
  /** SPEC-018 (INV-002): no modo suporte, nenhuma Server Action é executada. */
  | "SomenteLeitura"
  /** SPEC-018 (INV-004): a conta de Administrador não cria negócio, não aceita convite nem troca de negócio. */
  | "ContaDeAdministrador"
  | "SomenteAdministrador"
  /** SPEC-018 (RF78): falta o aceite da versão vigente dos termos. */
  | "TermosPendentes"
  /** SPEC-018 (RNF12): sessão do Administrador com mais de 8 h. */
  | "SessaoExpirada";

export type Autorizacao =
  | { ok: true; contexto: ContextoComPapel | null; membro: ContextoDoMembro | null }
  | { ok: false; motivo: MotivoDaRecusa };

function membroDo(contexto: ContextoComPapel): ContextoDoMembro | null {
  if (!contexto.negocioId || !contexto.permissoes) return null;
  if (contexto.suporte) {
    return { usuarioId: contexto.usuarioId, negocioId: contexto.negocioId, papel: null, permissoes: contexto.permissoes, modoSuporte: true, suporte: contexto.suporte };
  }
  if (!contexto.papel) return null;
  return { usuarioId: contexto.usuarioId, negocioId: contexto.negocioId, papel: contexto.papel, permissoes: contexto.permissoes };
}

export function autorizar(contexto: ContextoComPapel | null, nivel: NivelDeAcesso): Autorizacao {
  if (nivel.tipo === "publica") return { ok: true, contexto, membro: contexto ? membroDo(contexto) : null };
  if (!contexto) return { ok: false, motivo: "SemSessao" };
  if (contexto.sessaoExpirada) return { ok: false, motivo: "SessaoExpirada" };
  if (nivel.tipo === "conta") return { ok: true, contexto, membro: null };
  if (contexto.termosPendentes) return { ok: false, motivo: "TermosPendentes" };
  if (nivel.tipo === "administrador") {
    return contexto.administrador ? { ok: true, contexto, membro: null } : { ok: false, motivo: "SomenteAdministrador" };
  }

  const ehAcao = nivel.origem === "acao";
  if (ehAcao && contexto.suporte) return { ok: false, motivo: "SomenteLeitura" };
  if (ehAcao && contexto.administrador && nivel.tipo === "sessao") return { ok: false, motivo: "ContaDeAdministrador" };
  if (nivel.tipo === "sessao") return { ok: true, contexto, membro: membroDo(contexto) };

  const membro = membroDo(contexto);
  if (!membro) return { ok: false, motivo: "SemNegocio" };
  if (nivel.tipo === "dono") {
    return membro.papel === "DONO" ? { ok: true, contexto, membro } : { ok: false, motivo: "SomenteDono" };
  }
  return membro.permissoes[nivel.modulo][nivel.acao] ? { ok: true, contexto, membro } : { ok: false, motivo: "SemPermissao" };
}
