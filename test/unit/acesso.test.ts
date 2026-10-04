import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { criarAdaptadorSupabase } from "@/lib/auth/adaptador-supabase";
import { VERSAO_TERMOS } from "@/lib/auth/validacao";
import { lerDocumentoLegal, rotaDoLink } from "@/lib/legal";

// SPEC-002 — T15 (INV-001, RNF03): nenhuma senha nas tabelas da aplicação nem nos logs.
describe("senha só no Supabase Auth", () => {
  it("nenhum modelo do schema tem campo de senha", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf-8");
    const campos = schema
      .split(/\r?\n/)
      .map((l) => l.replace(/\/\/.*$/, "").trim())
      .filter((l) => /^[a-z]\w*\s+\S/.test(l))
      .map((l) => l.split(/\s+/)[0]);
    expect(campos.filter((c) => /senha|passw|secret/i.test(c))).toEqual([]);
  });

  it("os logs do adaptador não contêm a senha nem o e-mail", async () => {
    const erro = { code: "unexpected_failure", status: 500, message: "Database error saving new user" };
    const supabase = {
      auth: {
        signUp: vi.fn().mockResolvedValue({ data: { user: null }, error: erro }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: erro }),
        updateUser: vi.fn().mockResolvedValue({ error: erro }),
      },
    } as unknown as SupabaseClient;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const auth = criarAdaptadorSupabase(supabase);
    await auth.cadastrar({ nome: "Ana", email: "ana@exemplo.com", senha: "SenhaSecreta1", versaoTermos: "x", urlDeConfirmacao: "u" });
    await auth.entrar("ana@exemplo.com", "SenhaSecreta1");
    await auth.definirSenha("SenhaSecreta1");

    const tudo = JSON.stringify(log.mock.calls);
    expect(log).toHaveBeenCalled();
    expect(tudo).not.toContain("SenhaSecreta1");
    expect(tudo).not.toContain("ana@exemplo.com");
  });

  afterEach(() => vi.restoreAllMocks());
});

describe("tradução dos erros do Supabase Auth", () => {
  const com = (auth: Record<string, unknown>) => criarAdaptadorSupabase({ auth } as unknown as SupabaseClient);
  const falha = (code: string, status = 400) => vi.fn().mockResolvedValue({ data: {}, error: { code, status } });

  it("login: credenciais, e-mail não confirmado e limite de tentativas", async () => {
    expect(await com({ signInWithPassword: falha("invalid_credentials") }).entrar("a@b.co", "x")).toEqual({ ok: false, erro: "CredenciaisInvalidas" });
    expect(await com({ signInWithPassword: falha("email_not_confirmed") }).entrar("a@b.co", "x")).toEqual({ ok: false, erro: "EmailNaoConfirmado" });
    expect(await com({ signInWithPassword: falha("over_request_rate_limit", 429) }).entrar("a@b.co", "x")).toEqual({ ok: false, erro: "MuitasTentativas" });
  });

  it("cadastro de e-mail já confirmado (usuário sem identidades) conta como conta existente (CA-04)", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { user: { id: "x", identities: [] } }, error: null });
    const r = await com({ signUp }).cadastrar({ nome: "A", email: "a@b.co", senha: "12345678", versaoTermos: VERSAO_TERMOS, urlDeConfirmacao: "u" });
    expect(r).toEqual({ ok: true, contaJaExistia: true });
    expect(signUp.mock.calls[0][0].options.data).toEqual({ nome: "A", aceiteTermos: "true", versaoTermosAceita: VERSAO_TERMOS });
  });

  it("recuperação para e-mail inexistente responde como sucesso (INV-004)", async () => {
    expect(await com({ resetPasswordForEmail: falha("user_not_found", 404) }).pedirRecuperacao("a@b.co", "u")).toEqual({ ok: true });
  });
});

// SPEC-002 — escopo 10 e OPEN-005: a versão gravada no cadastro é a dos documentos publicados.
describe("textos legais", () => {
  it("a versão vigente é a mesma da política e dos termos", async () => {
    expect((await lerDocumentoLegal("privacidade")).versao).toBe(VERSAO_TERMOS);
    expect((await lerDocumentoLegal("termos")).versao).toBe(VERSAO_TERMOS);
  });

  it("links entre os documentos viram rotas", () => {
    expect(rotaDoLink("politica-de-privacidade.md")).toBe("/privacidade");
    expect(rotaDoLink("termos-de-uso.md")).toBe("/termos");
    expect(rotaDoLink("https://exemplo.com")).toBe("https://exemplo.com");
  });
});
