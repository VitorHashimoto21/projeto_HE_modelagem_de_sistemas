import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Textos legais (SPEC-002, escopo 10; OPEN-003): a fonte é docs/legal/, lida no build
 * (as páginas são estáticas). A versão vem da linha "**Versão:**" de cada documento.
 */
export const DOCUMENTOS_LEGAIS = {
  privacidade: { arquivo: "politica-de-privacidade.md", rota: "/privacidade", titulo: "Política de Privacidade" },
  termos: { arquivo: "termos-de-uso.md", rota: "/termos", titulo: "Termos de Uso" },
} as const;

export type DocumentoLegal = keyof typeof DOCUMENTOS_LEGAIS;

export function versaoDoDocumento(texto: string): string | null {
  return texto.match(/\*\*Versão:\*\*\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/)?.[1] ?? null;
}

export async function lerDocumentoLegal(doc: DocumentoLegal): Promise<{ texto: string; versao: string | null }> {
  const texto = await readFile(path.join(process.cwd(), "docs", "legal", DOCUMENTOS_LEGAIS[doc].arquivo), "utf-8");
  return { texto, versao: versaoDoDocumento(texto) };
}

/** Links entre os documentos (".md") viram as rotas das páginas. */
export function rotaDoLink(href: string | undefined): string | undefined {
  const alvo = Object.values(DOCUMENTOS_LEGAIS).find((d) => href === d.arquivo);
  return alvo ? alvo.rota : href;
}
