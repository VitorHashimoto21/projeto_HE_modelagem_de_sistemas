import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { gerarCsv } from "@/lib/dominio/relatorios";
import type { Tabela } from "./tabelas";

/**
 * Arquivos das exportações (SPEC-013, 5.4): CSV no padrão brasileiro (OPEN-006) e PDF gerado
 * no servidor com pdf-lib (OPEN-002), a partir da mesma Tabela.
 */

export const csvDaTabela = (t: Tabela) => gerarCsv(t.colunas.map((c) => c.titulo), [...t.linhas, t.totais]);

export type CabecalhoDoPdf = { negocio: string; periodo: string; geradoEm: string };

// Caracteres fora do latin-1 que a codificação WinAnsi das fontes padrão aceita.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const TROCAS: Record<string, string> = { "−": "-", "→": "->", "✓": "v", "▲": "^", "▼": "v", " ": " ", " ": " " };

/** Texto que a fonte padrão consegue desenhar: troca os conhecidos e põe "?" no resto. */
export function textoParaPdf(t: string): string {
  return [...t.replace(/[\r\n\t]+/g, " ")]
    .map((c) => TROCAS[c] ?? (c.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.has(c) ? c : "?"))
    .join("");
}

/** Corta o texto para caber na largura, com reticências. */
function caber(t: string, fonte: PDFFont, tamanho: number, largura: number): string {
  if (fonte.widthOfTextAtSize(t, tamanho) <= largura) return t;
  let s = t;
  while (s.length > 1 && fonte.widthOfTextAtSize(`${s}…`, tamanho) > largura) s = s.slice(0, -1);
  return `${s}…`;
}

const LARGURA = 842; // A4 deitado
const ALTURA = 595;
const MARGEM = 36;
const LINHA = 15;
const TAMANHO = 8;
const COR_LINHA = rgb(0.85, 0.85, 0.85);
const COR_TEXTO = rgb(0.1, 0.1, 0.1);
const COR_SUAVE = rgb(0.4, 0.4, 0.4);

export async function pdfDaTabela(t: Tabela, c: CabecalhoDoPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(textoParaPdf(`${t.titulo} — ${c.negocio}`));
  doc.setProducer("Health Enterprise");
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const util = LARGURA - 2 * MARGEM;
  const xs = t.colunas.reduce<number[]>((acc, col, i) => [...acc, i === 0 ? MARGEM : acc[i - 1] + t.colunas[i - 1].largura * util], []);

  let pagina!: PDFPage;
  let y = 0;

  const escrever = (texto: string, x: number, yy: number, f: PDFFont, tam: number, cor = COR_TEXTO) => pagina.drawText(textoParaPdf(texto), { x, y: yy, size: tam, font: f, color: cor });

  const linhaDaTabela = (celulas: string[], f: PDFFont) => {
    t.colunas.forEach((col, i) => {
      // Números alinhados à direita, com folga maior antes da coluna seguinte.
      const largura = col.largura * util - (col.numero ? 14 : 6);
      const texto = caber(textoParaPdf(celulas[i] ?? ""), f, TAMANHO, largura);
      const x = col.numero ? xs[i] + largura - f.widthOfTextAtSize(texto, TAMANHO) : xs[i];
      pagina.drawText(texto, { x, y, size: TAMANHO, font: f, color: COR_TEXTO });
    });
    pagina.drawLine({ start: { x: MARGEM, y: y - 4 }, end: { x: LARGURA - MARGEM, y: y - 4 }, thickness: 0.5, color: COR_LINHA });
    y -= LINHA;
  };

  const novaPagina = () => {
    pagina = doc.addPage([LARGURA, ALTURA]);
    y = ALTURA - MARGEM;
    escrever(c.negocio, MARGEM, y, negrito, 14);
    y -= 18;
    escrever(t.titulo, MARGEM, y, fonte, 11);
    escrever(`Período: ${c.periodo} · Gerado em ${c.geradoEm}`, LARGURA - MARGEM - fonte.widthOfTextAtSize(textoParaPdf(`Período: ${c.periodo} · Gerado em ${c.geradoEm}`), 9), y, fonte, 9, COR_SUAVE);
    y -= 24;
    linhaDaTabela(t.colunas.map((col) => col.titulo), negrito);
  };

  novaPagina();
  if (t.linhas.length === 0) {
    escrever("Nenhum registro no período.", MARGEM, y, fonte, TAMANHO, COR_SUAVE);
    y -= LINHA;
  }
  for (const l of t.linhas) {
    if (y < MARGEM + 2 * LINHA) novaPagina();
    linhaDaTabela(l, fonte);
  }
  if (y < MARGEM + 2 * LINHA) novaPagina();
  linhaDaTabela(t.totais, negrito);

  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    const texto = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(textoParaPdf(texto), { x: LARGURA - MARGEM - fonte.widthOfTextAtSize(texto, 8), y: MARGEM / 2, size: 8, font: fonte, color: COR_SUAVE });
  });
  return doc.save();
}
