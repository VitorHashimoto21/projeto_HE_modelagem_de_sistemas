/**
 * "Voltar para onde eu estava" (SPEC-020, correção da homologação T12): as listas do Catálogo e do
 * Estoque mandam o próprio endereço, com os filtros, no parâmetro `voltar`; o detalhe usa esse
 * endereço no "voltar" e o repassa à edição, ao arquivamento e ao cadastro. Só vale caminho interno
 * do Catálogo ou do Estoque — qualquer outro valor cai no destino padrão da tela.
 */

const BASE = "http://interno.invalid";
const PREFIXOS = ["/catalogo", "/estoque"];
const TAMANHO_MAXIMO = 512;

/** O endereço de retorno, se for seguro; senão, o padrão. */
export function retornoSeguro(valor: unknown, padrao: string): string {
  if (typeof valor !== "string" || valor.length === 0 || valor.length > TAMANHO_MAXIMO) return padrao;
  if (!valor.startsWith("/") || valor.startsWith("//") || /[\u0000-\u001f\\]/.test(valor)) return padrao;
  let url: URL;
  try {
    url = new URL(valor, BASE);
  } catch {
    return padrao;
  }
  if (url.origin !== BASE) return padrao;
  if (!PREFIXOS.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return padrao;
  return url.pathname + url.search;
}

/** Acrescenta `voltar` a um link (nada a acrescentar quando não há retorno). */
export function comRetorno(href: string, retorno: string | null | undefined): string {
  if (!retorno) return href;
  return `${href}${href.includes("?") ? "&" : "?"}voltar=${encodeURIComponent(retorno)}`;
}

/** Texto do "voltar" conforme o destino: a lista pelo nome; o detalhe de outro item, "Voltar". */
export function rotuloDoRetorno(retorno: string): string {
  const { pathname, searchParams } = new URL(retorno, BASE);
  if (pathname === "/estoque") return "Estoque";
  if (pathname === "/catalogo") return searchParams.get("arquivados") === "1" ? "Itens arquivados" : "Catálogo";
  if (pathname === "/catalogo/subcategorias") return "Subcategorias";
  return "Voltar";
}
