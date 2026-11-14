import { spawnSync } from "node:child_process";
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

// Ajuste da homologação da SPEC-019 (T17): só o SUPABASE_URL faltava, e o erro citava os dois segredos. O passo
// "Verificar se o ambiente está configurado" roda aqui de verdade, no bash, com cada combinação.
describe("workflow Administradores: o erro diz qual segredo falta", () => {
  const texto = readFileSync(".github/workflows/administradores.yml", "utf8");
  const inicio = texto.indexOf("      - name: Verificar se o ambiente está configurado");
  const fim = texto.indexOf("\n      - ", inicio + 10);
  const script = texto
    .slice(texto.indexOf("run: |", inicio) + "run: |".length, fim)
    .split("\n")
    .map((l) => l.replace(/^ {10}/, ""))
    .join("\n")
    .replaceAll("${{ inputs.ambiente }}", "homologacao");

  function rodar(env: Record<string, string>) {
    const ambiente = { PATH: process.env.PATH ?? "", DIRECT_URL: "postgresql://x", ...env } as unknown as NodeJS.ProcessEnv;
    const r = spawnSync("bash", ["-e", "-c", script], { env: ambiente, encoding: "utf8" });
    return { codigo: r.status, saida: r.stdout + r.stderr };
  }

  it("com os dois segredos, segue", () => {
    expect(rodar({ ACAO: "redefinir-2fator", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_x" })).toEqual({ codigo: 0, saida: "" });
  });

  it("sem um deles, diz qual; sem os dois, diz os dois", () => {
    const semUrl = rodar({ ACAO: "redefinir-2fator", SUPABASE_URL: "", SUPABASE_SECRET_KEY: "sb_secret_x" });
    expect(semUrl.codigo).toBe(1);
    expect(semUrl.saida).toContain("::error title=Administradores::Falta o segredo SUPABASE_URL no ambiente homologacao.");
    expect(semUrl.saida).toContain("Environment secrets");
    expect(semUrl.saida).not.toContain("SUPABASE_SECRET_KEY");

    const semChave = rodar({ ACAO: "redefinir-2fator", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SECRET_KEY: "" });
    expect(semChave.saida).toContain("Falta o segredo SUPABASE_SECRET_KEY no ambiente homologacao.");

    const semNenhum = rodar({ ACAO: "redefinir-2fator", SUPABASE_URL: "", SUPABASE_SECRET_KEY: "" });
    expect(semNenhum.saida).toContain("Faltam os segredos SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente homologacao.");
  });

  it("conceder e retirar não precisam dos segredos do Supabase", () => {
    expect(rodar({ ACAO: "conceder", SUPABASE_URL: "", SUPABASE_SECRET_KEY: "" })).toEqual({ codigo: 0, saida: "" });
  });

  it("sem DIRECT_URL, para antes de tudo", () => {
    expect(rodar({ ACAO: "conceder", DIRECT_URL: "" }).saida).toContain("Segredo DIRECT_URL não definido para o ambiente homologacao.");
  });
});
