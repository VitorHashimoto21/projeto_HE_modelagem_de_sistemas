import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { gerarCsv } from "@/lib/dominio/relatorios";
import type { Tabela } from "./tabelas";

/**
 * Arquivos das exportações (SPEC-013, 5.4): CSV no padrão brasileiro (OPEN-006) e PDF gerado
 * no servidor com pdf-lib (OPEN-002), a partir da mesma Tabela.
 */

export const csvDaTabela = (t: Tabela) => gerarCsv(t.colunas.map((c) => c.titulo), [...t.linhas, t.totais]);

export type CabecalhoDoPdf = {
  negocio: string;
  periodo: string;
  geradoEm: string;
  /** Rótulo do período no cabeçalho; o inventário (SPEC-025) usa "Posição". */
  rotuloDoPeriodo?: string;
  /** Texto quando não há linhas. */
  vazio?: string;
  /** Notas impressas depois do total (SPEC-025, 5.5). */
  notas?: string[];
};

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

/** Máximo de linhas de uma célula que quebra; o que passar disso termina com reticências (fica inteiro no CSV). */
export const MAX_LINHAS_DA_CELULA = 10;

/**
 * Quebra o texto em linhas que cabem na largura, palavra por palavra (SPEC-028: os pagamentos do relatório de
 * Contas). Uma palavra maior que a largura é cortada; depois do máximo de linhas, a última termina com reticências.
 */
export function quebrarTexto(t: string, fonte: PDFFont, tamanho: number, largura: number, maximo = MAX_LINHAS_DA_CELULA): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of t.split(" ").filter(Boolean)) {
    const junto = atual ? `${atual} ${palavra}` : palavra;
    if (!atual || fonte.widthOfTextAtSize(junto, tamanho) <= largura) atual = junto;
    else {
      linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  if (linhas.length === 0) return [""];
  if (linhas.length > maximo) linhas.splice(maximo - 1, linhas.length, linhas.slice(maximo - 1).join(" "));
  return linhas.map((l) => caber(l, fonte, tamanho, largura));
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

  // SPEC-028: a tabela pode pedir uma fonte menor para caber (o relatório de Contas, com 13 colunas).
  const tamanho = t.tamanho ?? TAMANHO;
  const entrelinha = tamanho + 2;
  // Números alinhados à direita, com folga maior antes da coluna seguinte.
  const larguraDa = (i: number) => t.colunas[i].largura * util - (t.colunas[i].numero ? 14 : 6);
  /** As linhas de texto de cada célula: uma só, cortada, ou várias nas colunas que quebram (SPEC-028). */
  const celulasDaLinha = (celulas: string[], f: PDFFont) =>
    t.colunas.map((col, i) => {
      const texto = textoParaPdf(celulas[i] ?? "");
      return col.quebrar ? quebrarTexto(texto, f, tamanho, larguraDa(i)) : [caber(texto, f, tamanho, larguraDa(i))];
    });
  /** Altura que a linha ocupa além da linha simples. */
  const extraDa = (celulas: string[][]) => (Math.max(1, ...celulas.map((c) => c.length)) - 1) * entrelinha;
  const linhaDaTabela = (celulas: string[][], f: PDFFont) => {
    celulas.forEach((textos, i) =>
      textos.forEach((texto, k) => {
        const x = t.colunas[i].numero ? xs[i] + larguraDa(i) - f.widthOfTextAtSize(texto, tamanho) : xs[i];
        pagina.drawText(texto, { x, y: y - k * entrelinha, size: tamanho, font: f, color: COR_TEXTO });
      }),
    );
    const extra = extraDa(celulas);
    pagina.drawLine({ start: { x: MARGEM, y: y - extra - 4 }, end: { x: LARGURA - MARGEM, y: y - extra - 4 }, thickness: 0.5, color: COR_LINHA });
    y -= LINHA + extra;
  };

  const novaPagina = () => {
    pagina = doc.addPage([LARGURA, ALTURA]);
    y = ALTURA - MARGEM;
    escrever(c.negocio, MARGEM, y, negrito, 14);
    y -= 18;
    escrever(t.titulo, MARGEM, y, fonte, 11);
    const periodo = `${c.rotuloDoPeriodo ?? "Período"}: ${c.periodo} · Gerado em ${c.geradoEm}`;
    escrever(periodo, LARGURA - MARGEM - fonte.widthOfTextAtSize(textoParaPdf(periodo), 9), y, fonte, 9, COR_SUAVE);
    y -= 24;
    linhaDaTabela(celulasDaLinha(t.colunas.map((col) => col.titulo), negrito), negrito);
  };

  novaPagina();
  if (t.linhas.length === 0) {
    escrever(c.vazio ?? "Nenhum registro no período.", MARGEM, y, fonte, TAMANHO, COR_SUAVE);
    y -= LINHA;
  }
  for (const l of t.linhas) {
    const celulas = celulasDaLinha(l, fonte);
    if (y - extraDa(celulas) < MARGEM + 2 * LINHA) novaPagina();
    linhaDaTabela(celulas, fonte);
  }
  const totais = celulasDaLinha(t.totais, negrito);
  if (y - extraDa(totais) < MARGEM + 2 * LINHA) novaPagina();
  linhaDaTabela(totais, negrito);
  if (c.notas?.length) {
    y -= LINHA / 2;
    for (const nota of c.notas) {
      if (y < MARGEM + LINHA) {
        pagina = doc.addPage([LARGURA, ALTURA]);
        y = ALTURA - MARGEM;
      }
      escrever(caber(textoParaPdf(nota), fonte, TAMANHO, LARGURA - 2 * MARGEM), MARGEM, y, fonte, TAMANHO, COR_SUAVE);
      y -= LINHA;
    }
  }

  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    const texto = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(textoParaPdf(texto), { x: LARGURA - MARGEM - fonte.widthOfTextAtSize(texto, 8), y: MARGEM / 2, size: 8, font: fonte, color: COR_SUAVE });
  });
  return doc.save();
}
