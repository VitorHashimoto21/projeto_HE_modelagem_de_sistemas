/**
 * Contexto da requisição (SPEC-002, 5.5): quem está acessando e, se houver, o negócio
 * ativo. O negócio vem de um cookie, mas só é aceito se o usuário for membro dele
 * (INV-006). Nenhum valor vindo do navegador é aceito sem essa confirmação.
 */

import { permissoesEfetivas, type Matriz, type Papel } from "@/lib/dominio/permissoes";

/** Cookie do negócio ativo (definido pela troca de negócio da SPEC-004). */
export const COOKIE_NEGOCIO_ATIVO = "he_negocio";

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

/** Contexto com o papel e as permissões efetivas no negócio ativo (SPEC-005, 5.5). */
export type ContextoComPapel = ContextoDaRequisicao & {
  /** null quando não há negócio ativo. */
  papel: Papel | null;
  permissoes: Matriz | null;
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
