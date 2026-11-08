import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// SPEC-019 (5.11): o workflow "Administradores" roda num repositório público. O e-mail da conta nunca vai para
// o log: é lido do evento e mascarado no primeiro passo, antes de qualquer passo que mostre as variáveis.
describe("workflow Administradores: e-mail fora do log", () => {
  const texto = readFileSync(".github/workflows/administradores.yml", "utf8");
  const passos = texto.slice(texto.indexOf("    steps:"));

  it("o e-mail não entra pelo env nem pela linha de comando", () => {
    expect(texto).not.toMatch(/EMAIL:\s*\$\{\{\s*inputs\.email/);
    expect(passos).not.toMatch(/\$\{\{\s*(inputs|github\.event\.inputs)\.email/);
  });

  it("o primeiro passo lê o e-mail do evento, mascara e só então o passa adiante", () => {
    const primeiro = passos.split(/\n      - /)[1];
    expect(primeiro).toContain("name: Mascarar o e-mail no log");
    const mascara = primeiro.indexOf("::add-mask::$EMAIL");
    const repassa = primeiro.indexOf('>> "$GITHUB_ENV"');
    expect(mascara).toBeGreaterThan(-1);
    expect(repassa).toBeGreaterThan(mascara);
  });
});
