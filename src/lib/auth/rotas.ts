/**
 * Rotas de acesso e destino de retorno (SPEC-002, 5.2 e 5.5). Sem dependências de
 * framework: usado pelo proxy, pelas Server Actions e pelos testes.
 */

/** Página inicial do negócio ativo; sem negócio válido, ela leva a "Meus negócios" (SPEC-004, OPEN-005). */
export const ROTA_INICIAL = "/painel";
export const ROTA_MEUS_NEGOCIOS = "/negocios";
export const ROTA_ENTRAR = "/entrar";
export const ROTA_NOVA_SENHA = "/nova-senha";
export const ROTA_LINK_INVALIDO = "/link-invalido";
/** Área sem permissão (SPEC-005, 5.5). */
export const ROTA_SEM_ACESSO = "/sem-acesso";

/** Páginas só para quem não está autenticado (quem já entrou vai para a inicial). */
const SO_SEM_SESSAO = ["/entrar", "/cadastro", "/esqueci-a-senha"];

/** Páginas abertas a todos, com ou sem sessão. O convite (SPEC-005, 5.3) decide sozinho o que mostrar. */
const PUBLICAS = ["/link-invalido", "/privacidade", "/termos", "/auth", "/api/saude", "/convite"];

const corresponde = (caminho: string, base: string) => caminho === base || caminho.startsWith(`${base}/`);

export type DecisaoDeRota = { tipo: "seguir" } | { tipo: "redirecionar"; para: string };

/**
 * Decide o que fazer com uma requisição de página (INV-005, CA-08): sem sessão, as
 * páginas autenticadas levam ao login com o destino original guardado em `proximo`.
 */
export function decidirRota(caminho: string, busca: string, autenticado: boolean): DecisaoDeRota {
  if (PUBLICAS.some((b) => corresponde(caminho, b))) return { tipo: "seguir" };

  if (SO_SEM_SESSAO.some((b) => corresponde(caminho, b))) {
    return autenticado ? { tipo: "redirecionar", para: ROTA_INICIAL } : { tipo: "seguir" };
  }

  // A nova senha só faz sentido com a sessão aberta pelo link de recuperação.
  if (corresponde(caminho, ROTA_NOVA_SENHA)) {
    return autenticado ? { tipo: "seguir" } : { tipo: "redirecionar", para: `${ROTA_LINK_INVALIDO}?tipo=recuperacao` };
  }

  if (autenticado) return { tipo: "seguir" };

  const destino = caminho === "/" ? "" : `?proximo=${encodeURIComponent(caminho + busca)}`;
  return { tipo: "redirecionar", para: `${ROTA_ENTRAR}${destino}` };
}

/**
 * Destino de retorno seguro (INV-007): só caminhos internos. Qualquer outro valor
 * (outro domínio, "//host", "/\host", esquemas como javascript:) vira a página inicial.
 */
export function destinoSeguro(valor: unknown): string {
  if (typeof valor !== "string" || valor.length === 0 || valor.length > 512) return ROTA_INICIAL;
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.startsWith("/\\")) return ROTA_INICIAL;
  if (/[\u0000-\u001f\\]/.test(valor)) return ROTA_INICIAL;
  try {
    const base = "http://interno.invalid";
    const url = new URL(valor, base);
    if (url.origin !== base) return ROTA_INICIAL;
    if (SO_SEM_SESSAO.some((b) => corresponde(url.pathname, b))) return ROTA_INICIAL;
    return url.pathname + url.search + url.hash;
  } catch {
    return ROTA_INICIAL;
  }
}
