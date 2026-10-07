import type { Acao, Matriz, Modulo, Papel } from "@/lib/dominio/permissoes";
import type { ContextoComPapel } from "./contexto";

/**
 * Autorização no servidor (SPEC-005, 5.5; ADR-003). Sem dependências de framework:
 * as guardas de páginas e a fábrica de Server Actions usam esta decisão, e os testes
 * a exercitam direto.
 */

/** Nível de acesso que toda Server Action declara (OPEN-008). */
export type NivelDeAcesso =
  | { tipo: "publica" }
  /** Sessão sem negócio ativo (cadastrar negócio, aceitar convite, sair do negócio…). */
  | { tipo: "sessao" }
  /** Configurações do negócio (OPEN-002). */
  | { tipo: "dono" }
  | { tipo: "permissao"; modulo: Modulo; acao: Acao };

export type ContextoDoMembro = {
  usuarioId: string;
  negocioId: string;
  papel: Papel;
  permissoes: Matriz;
};

export type MotivoDaRecusa = "SemSessao" | "SemNegocio" | "SomenteDono" | "SemPermissao";

export type Autorizacao =
  | { ok: true; contexto: ContextoComPapel | null; membro: ContextoDoMembro | null }
  | { ok: false; motivo: MotivoDaRecusa };

function membroDo(contexto: ContextoComPapel): ContextoDoMembro | null {
  if (!contexto.negocioId || !contexto.papel || !contexto.permissoes) return null;
  return { usuarioId: contexto.usuarioId, negocioId: contexto.negocioId, papel: contexto.papel, permissoes: contexto.permissoes };
}

export function autorizar(contexto: ContextoComPapel | null, nivel: NivelDeAcesso): Autorizacao {
  if (nivel.tipo === "publica") return { ok: true, contexto, membro: contexto ? membroDo(contexto) : null };
  if (!contexto) return { ok: false, motivo: "SemSessao" };
  if (nivel.tipo === "sessao") return { ok: true, contexto, membro: membroDo(contexto) };

  const membro = membroDo(contexto);
  if (!membro) return { ok: false, motivo: "SemNegocio" };
  if (nivel.tipo === "dono") {
    return membro.papel === "DONO" ? { ok: true, contexto, membro } : { ok: false, motivo: "SomenteDono" };
  }
  return membro.permissoes[nivel.modulo][nivel.acao] ? { ok: true, contexto, membro } : { ok: false, motivo: "SemPermissao" };
}
