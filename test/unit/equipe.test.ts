import { describe, expect, it } from "vitest";
import { autorizar, type NivelDeAcesso } from "@/lib/auth/autorizacao";
import type { ContextoComPapel } from "@/lib/auth/contexto";
import { MATRIZ_COMPLETA, PREDEFINICOES, campoDaPermissao } from "@/lib/dominio/permissoes";
import { menuDoMembro } from "@/lib/equipe/menu";
import { mensagemDoConvite } from "@/lib/equipe/servicos";
import { formatoDeTokenValido, gerarToken, hashDoToken, validadeDoConvite } from "@/lib/equipe/token";
import { mascararEmail, validarConvite } from "@/lib/equipe/validacao";

// SPEC-005 — T03, T04 e a decisão das guardas (5.5).

describe("T03 — validação do convite", () => {
  it("normaliza o e-mail e aceita Gerente ou Colaborador", () => {
    expect(validarConvite({ email: "  Joana@Exemplo.COM ", papel: "GERENTE" })).toEqual({
      ok: true,
      dados: { email: "joana@exemplo.com", papel: "GERENTE", permissoesCustom: null },
    });
  });

  it("recusa e-mail inválido e papel Dono ou desconhecido (INV-002)", () => {
    expect(validarConvite({ email: "", papel: "COLABORADOR" })).toMatchObject({ ok: false, erros: { email: expect.any(String) } });
    expect(validarConvite({ email: "nao-e-email", papel: "COLABORADOR" })).toMatchObject({ ok: false, erros: { email: "E-mail inválido" } });
    expect(validarConvite({ email: "a@b.com", papel: "DONO" })).toMatchObject({ ok: false, erros: { papel: expect.any(String) } });
    expect(validarConvite({ email: "a@b.com" })).toMatchObject({ ok: false, erros: { papel: expect.any(String) } });
  });

  it("permissões personalizadas: incoerentes são recusadas; iguais ao padrão viram null", () => {
    const incoerente = { email: "a@b.com", papel: "COLABORADOR", personalizar: "on", [campoDaPermissao("financeiro", "editar")]: "on" };
    expect(validarConvite(incoerente)).toMatchObject({ ok: false, erros: { permissoes: expect.stringMatching(/Financeiro/) } });

    const padrao: Record<string, string> = { email: "a@b.com", papel: "COLABORADOR", personalizar: "on" };
    for (const [m, acoes] of Object.entries(PREDEFINICOES.COLABORADOR)) {
      for (const [a, v] of Object.entries(acoes)) if (v) padrao[`perm.${m}.${a}`] = "on";
    }
    expect(validarConvite(padrao)).toMatchObject({ ok: true, dados: { permissoesCustom: null } });

    const soDespesas = { email: "a@b.com", papel: "COLABORADOR", personalizar: "on", [campoDaPermissao("financeiro", "criar")]: "on" };
    const r = validarConvite(soDespesas);
    expect(r.ok && r.dados.permissoesCustom?.financeiro).toEqual({ ver: false, criar: true, editar: false, excluir: false });
  });

  it("sem “Personalizar”, as caixas enviadas são ignoradas", () => {
    expect(validarConvite({ email: "a@b.com", papel: "GERENTE", [campoDaPermissao("vendas", "ver")]: "on" })).toMatchObject({
      ok: true,
      dados: { permissoesCustom: null },
    });
  });

  it("e-mail mascarado", () => {
    expect(mascararEmail("joana@exemplo.com")).toBe("j•••@exemplo.com");
    expect(mascararEmail("sem-arroba")).toBe("•••");
  });
});

describe("T04 — token do convite (INV-007)", () => {
  it("32 bytes em base64url, únicos, e só o SHA-256 vai para o banco", () => {
    const a = gerarToken();
    const b = gerarToken();
    expect(a).not.toBe(b);
    expect(formatoDeTokenValido(a)).toBe(true);
    expect(hashDoToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDoToken(a)).not.toContain(a);
    expect(hashDoToken(a)).toBe(hashDoToken(a));
  });

  it("recusa formatos inválidos antes de consultar o banco", () => {
    for (const t of ["", "curto", "x".repeat(44), `${"a".repeat(42)}/`]) expect(formatoDeTokenValido(t)).toBe(false);
  });

  it("validade de 7 dias (OPEN-004)", () => {
    const agora = new Date("2026-10-07T12:00:00Z");
    expect(validadeDoConvite(agora).toISOString()).toBe("2026-10-14T12:00:00.000Z");
  });

  it("e-mail do convite: negócio, quem convidou, papel, permissões, validade e link (RF72)", () => {
    const m = mensagemDoConvite({
      email: "joana@exemplo.com",
      negocio: "Studio Gisele",
      convidadoPor: "Gisele",
      papel: "COLABORADOR",
      permissoesCustom: null,
      expiraEm: new Date("2026-10-15T02:00:00Z"),
      link: "https://he.exemplo/convite/abc",
    });
    expect(m.para).toBe("joana@exemplo.com");
    expect(m.assunto).toContain("Studio Gisele");
    expect(m.texto).toContain("Gisele convidou você para a equipe de Studio Gisele no Health Enterprise, como Colaborador.");
    expect(m.texto).toContain("- Financeiro: sem acesso");
    expect(m.texto).toContain("até 14/10/2026"); // data local de São Paulo
    expect(m.texto).toContain("https://he.exemplo/convite/abc");
  });
});

describe("guardas no servidor (5.5, INV-001, INV-005)", () => {
  const base = { usuarioId: "u", negocioRecusado: false };
  const dono: ContextoComPapel = { ...base, negocioId: "n", papel: "DONO", permissoes: MATRIZ_COMPLETA };
  const colaborador: ContextoComPapel = { ...base, negocioId: "n", papel: "COLABORADOR", permissoes: PREDEFINICOES.COLABORADOR };
  const semNegocio: ContextoComPapel = { ...base, negocioId: null, papel: null, permissoes: null };
  const nivel = {
    publica: { tipo: "publica" },
    sessao: { tipo: "sessao" },
    dono: { tipo: "dono" },
    verFinanceiro: { tipo: "permissao", modulo: "financeiro", acao: "ver" },
    criarVenda: { tipo: "permissao", modulo: "vendas", acao: "criar" },
  } satisfies Record<string, NivelDeAcesso>;

  it("pública passa sem sessão; as demais exigem sessão", () => {
    expect(autorizar(null, nivel.publica).ok).toBe(true);
    for (const n of [nivel.sessao, nivel.dono, nivel.criarVenda]) expect(autorizar(null, n)).toEqual({ ok: false, motivo: "SemSessao" });
  });

  it("sessão basta para ações sem negócio; módulo e Configurações exigem negócio ativo", () => {
    expect(autorizar(semNegocio, nivel.sessao).ok).toBe(true);
    expect(autorizar(semNegocio, nivel.dono)).toEqual({ ok: false, motivo: "SemNegocio" });
    expect(autorizar(semNegocio, nivel.criarVenda)).toEqual({ ok: false, motivo: "SemNegocio" });
  });

  it("Configurações só para o Dono (RN02)", () => {
    expect(autorizar(dono, nivel.dono)).toMatchObject({ ok: true, membro: { papel: "DONO", negocioId: "n" } });
    expect(autorizar(colaborador, nivel.dono)).toEqual({ ok: false, motivo: "SomenteDono" });
  });

  it("CA-10 — permissão por módulo e ação", () => {
    expect(autorizar(colaborador, nivel.criarVenda).ok).toBe(true);
    expect(autorizar(colaborador, nivel.verFinanceiro)).toEqual({ ok: false, motivo: "SemPermissao" });
    expect(autorizar(dono, nivel.verFinanceiro).ok).toBe(true);
  });

  it("menu: Configurações só para o Dono; sem negócio, nenhum item", () => {
    expect(menuDoMembro("DONO", MATRIZ_COMPLETA).map((i) => i.href)).toEqual(["/painel", "/catalogo", "/estoque", "/vendas/nova", "/vendas", "/financeiro", "/negocio/equipe", "/negocio/dados"]);
    expect(menuDoMembro("GERENTE", MATRIZ_COMPLETA).map((i) => i.href)).toEqual(["/painel", "/catalogo", "/estoque", "/vendas/nova", "/vendas", "/financeiro"]); // módulos entram conforme as specs (SPEC-006 a SPEC-009)
    expect(menuDoMembro(null, null)).toEqual([]);
  });
});
