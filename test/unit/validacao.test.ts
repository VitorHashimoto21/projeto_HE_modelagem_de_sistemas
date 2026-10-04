import { describe, expect, it } from "vitest";
import { esquemaCadastro, esquemaEntrar, esquemaNovaSenha, MENSAGENS, validar } from "@/lib/auth/validacao";

// SPEC-002 — T01 (CA-03): as mesmas regras rodam no navegador e no servidor.
const valido = { nome: "Ana Souza", email: "Ana@Exemplo.com ", senha: "12345678", confirmacao: "12345678", aceite: "on" };

describe("validação do cadastro", () => {
  it("aceita dados válidos e normaliza o e-mail", () => {
    const r = validar(esquemaCadastro, valido);
    expect(r).toEqual({ ok: true, dados: { ...valido, email: "ana@exemplo.com" } });
  });

  it.each([
    ["nome vazio", { nome: "  " }, "nome", MENSAGENS.nomeObrigatorio],
    ["e-mail vazio", { email: "" }, "email", MENSAGENS.emailObrigatorio],
    ["e-mail inválido", { email: "ana@" }, "email", MENSAGENS.emailInvalido],
    ["senha curta (OPEN-004)", { senha: "1234567", confirmacao: "1234567" }, "senha", MENSAGENS.senhaCurta],
    ["senha longa demais", { senha: "x".repeat(73), confirmacao: "x".repeat(73) }, "senha", MENSAGENS.senhaLonga],
    ["confirmação diferente", { confirmacao: "87654321" }, "confirmacao", MENSAGENS.confirmacaoDiferente],
    ["sem aceite (CA-02)", { aceite: undefined }, "aceite", MENSAGENS.aceiteObrigatorio],
    ["aceite com valor forjado", { aceite: "true" }, "aceite", MENSAGENS.aceiteObrigatorio],
  ])("recusa %s", (_, mudanca, campo, mensagem) => {
    const r = validar(esquemaCadastro, { ...valido, ...mudanca });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[campo]).toBe(mensagem);
  });

  it("8 caracteres sem símbolos bastam (OPEN-004)", () => {
    expect(validar(esquemaCadastro, { ...valido, senha: "abcdefgh", confirmacao: "abcdefgh" }).ok).toBe(true);
  });
});

describe("validação do login e da nova senha", () => {
  it("login exige e-mail válido e senha", () => {
    const r = validar(esquemaEntrar, { email: "x", senha: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros).toEqual({ email: MENSAGENS.emailInvalido, senha: MENSAGENS.senhaObrigatoria });
  });

  it("nova senha segue a mesma política e exige confirmação igual", () => {
    expect(validar(esquemaNovaSenha, { senha: "curta", confirmacao: "curta" }).ok).toBe(false);
    const r = validar(esquemaNovaSenha, { senha: "12345678", confirmacao: "1234567x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.confirmacao).toBe(MENSAGENS.confirmacaoDiferente);
  });
});
