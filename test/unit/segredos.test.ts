import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ignorado = (arquivo: string) => {
  try {
    execFileSync("git", ["check-ignore", "-q", arquivo]);
    return true;
  } catch {
    return false;
  }
};

// T10 — INV-008
describe("segredos fora do repositório", () => {
  it(".env e variações são ignorados pelo Git; o .env.example não", () => {
    expect(ignorado(".env")).toBe(true);
    expect(ignorado(".env.local")).toBe(true);
    expect(ignorado(".env.production")).toBe(true);
    expect(ignorado(".env.example")).toBe(false);
  });

  it("o .env.example só tem valores de exemplo locais", () => {
    const linhas = readFileSync(".env.example", "utf8")
      .split(/\r?\n/) // CRLF no Windows (core.autocrlf)
      .filter((l) => /^[A-Z_]+=/.test(l));
    expect(linhas.length).toBeGreaterThan(0);
    for (const linha of linhas) {
      const nome = linha.slice(0, linha.indexOf("="));
      const valor = linha.slice(linha.indexOf("=") + 1).replace(/^"|"$/g, "");
      if (!valor) continue;
      if (valor.startsWith("postgres")) {
        const url = new URL(valor);
        expect(url.hostname, linha).toBe("localhost");
        expect(url.password, linha).toBe("postgres");
      } else if (nome === "NEXT_PUBLIC_SUPABASE_URL") {
        expect(new URL(valor).hostname, linha).toBe("seu-projeto.supabase.co");
      } else if (/KEY|SECRET|TOKEN/.test(nome)) {
        // Chaves só como marcador (ex.: "sb_publishable_..."), nunca um valor real.
        expect(valor, linha).toMatch(/\.\.\.$/);
      }
    }
  });
});
