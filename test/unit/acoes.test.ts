import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// SPEC-005 — T17 (INV-005, OPEN-008): toda Server Action é criada pela fábrica, que
// declara o nível de acesso e executa a guarda no servidor antes do corpo da ação.

const FABRICAS = ["acaoPublica", "acaoComSessao", "acaoDoDono", "acaoComPermissao"];

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

const semComentarios = (codigo: string) => codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const comUseServer = arquivos("src").filter((f) => /^\s*["']use server["']/.test(semComentarios(readFileSync(f, "utf-8"))));

describe("T17 — Server Actions só pela fábrica", () => {
  it("existem arquivos de Server Actions (o teste não está olhando para o lugar errado)", () => {
    expect(comUseServer.length).toBeGreaterThanOrEqual(3);
  });

  it("nenhuma Server Action fora de arquivos 'use server' de módulo (diretiva inline)", () => {
    const inline = arquivos("src").filter((f) => !comUseServer.includes(f) && /^\s+["']use server["']/m.test(readFileSync(f, "utf-8")));
    expect(inline).toEqual([]);
  });

  for (const arquivo of comUseServer) {
    it(`${arquivo}: toda exportação é criada por ${FABRICAS.join(" / ")}`, () => {
      const codigo = semComentarios(readFileSync(arquivo, "utf-8"));
      expect(codigo).not.toMatch(/export\s+(async\s+)?function/);
      expect(codigo).not.toMatch(/export\s+default/);
      expect(codigo).not.toMatch(/export\s*\{/);
      const exportacoes = [...codigo.matchAll(/export\s+const\s+(\w+)\s*=\s*(\w+)\s*\(/g)];
      const todas = [...codigo.matchAll(/export\s+(const|let|var)\s+(\w+)/g)];
      expect(exportacoes.length).toBe(todas.length);
      for (const [, nome, fabrica] of exportacoes) expect(FABRICAS, `${nome} usa ${fabrica}`).toContain(fabrica);
    });
  }
});
