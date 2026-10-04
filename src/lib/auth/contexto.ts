/**
 * Contexto da requisição (SPEC-002, 5.5): quem está acessando e, se houver, o negócio
 * ativo. O negócio vem de um cookie, mas só é aceito se o usuário for membro dele
 * (INV-006). Nenhum valor vindo do navegador é aceito sem essa confirmação.
 */

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
