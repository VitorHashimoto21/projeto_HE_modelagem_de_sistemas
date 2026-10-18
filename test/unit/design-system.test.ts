import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// SPEC-016, T02 (CA-01, INV-003): as telas usam os tokens e os componentes do design system.
// Fora de src/components/ui, nenhuma cor escrita à mão (hex, rgb, rgba) e nenhum dos estilos
// antigos que o redesign substituiu (cartão com borda e sombra, rótulo em maiúsculas,
// fonte de título antiga).

const RAIZ = join(__dirname, "..", "..");
const PASTAS = ["src/app", "src/components"];
const FORA = ["src/components/ui/"];

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return caminho.endsWith(".tsx") ? [caminho] : [];
  });
}

const telas = PASTAS.flatMap((p) => arquivos(join(RAIZ, p)))
  .map((caminho) => ({ caminho: relative(RAIZ, caminho).replaceAll("\\", "/"), texto: readFileSync(caminho, "utf8") }))
  .filter((a) => !FORA.some((f) => a.caminho.startsWith(f)));

/** Linhas de um arquivo que casam com o padrão, sem comentários. */
function ocorrencias(padrao: RegExp) {
  return telas.flatMap((a) =>
    a.texto
      .split("\n")
      .map((linha, i) => ({ linha: linha.trim(), n: i + 1 }))
      .filter(({ linha }) => !linha.startsWith("//") && !linha.startsWith("*") && !linha.startsWith("/*") && padrao.test(linha))
      .map(({ linha, n }) => `${a.caminho}:${n}  ${linha.slice(0, 120)}`),
  );
}

describe("design system nas telas (SPEC-016, T02)", () => {
  it("varre as telas de verdade", () => {
    expect(telas.length).toBeGreaterThan(60);
  });

  it("nenhuma cor hex fora dos tokens (só o themeColor do layout raiz, que é a cor da estrutura)", () => {
    const tokens = readFileSync(join(RAIZ, "src/app/globals.css"), "utf8");
    const estrutura = tokens.match(/--estrutura:\s*(#[0-9a-f]{6})/i)?.[1];
    const achados = ocorrencias(/#[0-9a-fA-F]{3,8}\b(?![\w-])/).filter((o) => !(o.startsWith("src/app/layout.tsx") && estrutura && o.toLowerCase().includes(estrutura.toLowerCase())));
    expect(achados).toEqual([]);
  });

  it("nenhuma cor rgb/rgba escrita à mão", () => {
    expect(ocorrencias(/\brgba?\(/)).toEqual([]);
  });

  it("sem o cartão antigo (borda + sombra) nem sombra pequena repetida", () => {
    expect(ocorrencias(/rounded-2xl border bg-card|shadow-sm\b/)).toEqual([]);
  });

  it("sem rótulos em maiúsculas espaçadas nem a fonte de título antiga (5.8)", () => {
    expect(ocorrencias(/tracking-widest|font-display/)).toEqual([]);
  });
});
