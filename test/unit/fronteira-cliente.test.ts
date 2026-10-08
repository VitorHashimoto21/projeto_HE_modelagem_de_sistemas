import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Fronteira servidor × cliente: tudo o que um arquivo "use client" exporta vira uma
// referência de cliente. Uma função comum exportada dali (ex.: uma função de classes CSS)
// quebra a página do servidor que a chama — só em produção ("Attempted to call … from the
// server"). Por isso, arquivos "use client" exportam apenas componentes e hooks.

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

const deCliente = arquivos("src").filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf-8")));

describe("arquivos \"use client\" exportam só componentes e hooks", () => {
  it("encontra arquivos de cliente", () => {
    expect(deCliente.length).toBeGreaterThan(5);
  });

  for (const arquivo of deCliente) {
    it(arquivo, () => {
      const codigo = readFileSync(arquivo, "utf-8");
      const nomes = [
        ...[...codigo.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)/g)].map((m) => m[1]),
        ...[...codigo.matchAll(/export\s*\{([^}]*)\}/g)].flatMap((m) =>
          m[1]
            .split(",")
            .map((n) => n.trim())
            .filter((n) => n && !n.startsWith("type "))
            .map((n) => n.split(/\s+as\s+/).pop()!.trim()),
        ),
      ];
      const proibidos = nomes.filter((n) => !/^[A-Z]/.test(n) && !/^use[A-Z]/.test(n));
      expect(proibidos, "mova funções e constantes comuns para um módulo sem \"use client\"").toEqual([]);
    });
  }
});
