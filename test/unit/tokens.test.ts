import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Extrai as declarações de cor (--nome: #hex) de cada bloco :root, .dark e @theme. */
function cores(caminho: string): Record<string, Record<string, string>> {
  const css = readFileSync(caminho, "utf8");
  const blocos: Record<string, Record<string, string>> = {};
  for (const [seletor, regex] of [
    [":root", /:root\s*\{([\s\S]*?)\n\}/],
    [".dark", /\.dark\s*\{([\s\S]*?)\n\}/],
    ["@theme", /@theme inline\s*\{([\s\S]*?)\n\}/],
  ] as const) {
    const corpo = regex.exec(css)?.[1] ?? "";
    blocos[seletor] = Object.fromEntries(
      [...corpo.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\b/g)].map((m) => [m[1], m[2].toLowerCase()]),
    );
  }
  return blocos;
}

// T11 — INV-009, CA-13
describe("tokens da identidade visual", () => {
  it("o CSS global usa exatamente as cores de docs/design/identidade/tokens/tokens.css", () => {
    const origem = cores("docs/design/identidade/tokens/tokens.css");
    const app = cores("src/app/globals.css");
    expect(Object.keys(origem[":root"]).length).toBeGreaterThan(30);
    expect(app).toEqual(origem);
  });
});
