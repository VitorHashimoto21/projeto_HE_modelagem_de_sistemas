import { describe, expect, it } from "vitest";
import { autorizar, type NivelDeAcesso } from "@/lib/auth/autorizacao";
import { resolverContextoDaRequisicao, type DependenciasDoContexto, type LiberacaoDoContexto } from "@/lib/auth/contexto";
import { menuDoSuporte } from "@/lib/equipe/menu";
import {
  autenticadoEmDasClaims,
  descreverTela,
  expiraEm,
  mascararContato,
  mascararEmail,
  mascararNome,
  matrizDoSuporte,
  MENSAGENS_SUPORTE,
  sessaoDoAdministradorValida,
  situacaoDaLiberacao,
  validarLiberacao,
} from "@/lib/dominio/suporte";

// SPEC-018 — testes unitários (seção 12): T01 a T03 e as decisões de autorização do contexto
// de suporte (INV-001 a INV-004, INV-008, INV-010), sem banco.

const AGORA = new Date("2026-10-17T15:00:00Z");
const ADMIN = "a0000000-0000-4000-8000-000000000001";
const NEGOCIO = "b0000000-0000-4000-8000-000000000001";
const ACESSO = "c0000000-0000-4000-8000-000000000001";
const VERSAO = "2026-10-17";

describe("T01 — máscara de dados pessoais (INV-006)", () => {
  it("nome: inicial de cada palavra", () => {
    expect(mascararNome("Maria Silva")).toBe("M*** S***");
    expect(mascararNome("  ana   de souza ")).toBe("A*** D*** S***");
    expect(mascararNome("")).toBe("***");
  });
  it("contato: só os 2 últimos caracteres", () => {
    expect(mascararContato("(11) 98888-1234")).toBe("•••34");
    expect(mascararContato("x")).toBe("•••");
  });
  it("e-mail: primeira letra e o domínio", () => {
    expect(mascararEmail("rafael@exemplo.com")).toBe("r***@exemplo.com");
    expect(mascararEmail("sem-arroba")).toBe("***");
  });
});

describe("T02 — liberação: validação, prazos, situação e matriz só de leitura", () => {
  const campos = { motivo: "  Vendas   de ontem  ", "modulo.vendas": "on", "modulo.estoque": "on", prazo: "24h" };

  it("valida motivo, módulos e prazo", () => {
    expect(validarLiberacao(campos)).toEqual({ ok: true, dados: { motivo: "Vendas de ontem", modulos: ["estoque", "vendas"], prazo: "24h" } });
    expect(validarLiberacao({})).toEqual({
      ok: false,
      erros: { motivo: MENSAGENS_SUPORTE.motivoObrigatorio, modulos: MENSAGENS_SUPORTE.modulosObrigatorios, prazo: MENSAGENS_SUPORTE.prazoInvalido },
    });
    expect(validarLiberacao({ ...campos, motivo: "x".repeat(301) })).toMatchObject({ ok: false, erros: { motivo: MENSAGENS_SUPORTE.motivoLongo } });
    expect(validarLiberacao({ ...campos, prazo: "30d" })).toMatchObject({ ok: false, erros: { prazo: MENSAGENS_SUPORTE.prazoInvalido } });
    expect(validarLiberacao({ ...campos, "modulo.configuracoes": "on" })).toMatchObject({ ok: true, dados: { modulos: ["estoque", "vendas"] } });
  });

  it("prazos de 1 h, 24 h, 3 dias e 7 dias", () => {
    expect(expiraEm(AGORA, "1h").toISOString()).toBe("2026-10-17T16:00:00.000Z");
    expect(expiraEm(AGORA, "24h").toISOString()).toBe("2026-10-18T15:00:00.000Z");
    expect(expiraEm(AGORA, "3d").toISOString()).toBe("2026-10-20T15:00:00.000Z");
    expect(expiraEm(AGORA, "7d").toISOString()).toBe("2026-10-24T15:00:00.000Z");
  });

  it("situação: ativa, expirada ou revogada", () => {
    const fim = new Date("2026-10-18T15:00:00Z");
    expect(situacaoDaLiberacao({ expiraEm: fim, revogadoEm: null }, AGORA)).toBe("ATIVA");
    expect(situacaoDaLiberacao({ expiraEm: AGORA, revogadoEm: null }, AGORA)).toBe("EXPIRADA");
    expect(situacaoDaLiberacao({ expiraEm: fim, revogadoEm: AGORA }, AGORA)).toBe("REVOGADA");
  });

  it("matriz do suporte: só 'ver' nos módulos liberados (INV-003)", () => {
    const m = matrizDoSuporte(["vendas", "financeiro", "invalido"]);
    expect(m.vendas).toEqual({ ver: true, criar: false, editar: false, excluir: false });
    expect(m.financeiro).toEqual({ ver: true, criar: false, editar: false, excluir: false });
    expect(m.catalogo.ver).toBe(false);
    expect(Object.values(m).every((acoes) => !acoes.criar && !acoes.editar && !acoes.excluir)).toBe(true);
  });

  it("menu do suporte: só o que se lê, sem Nova venda nem Configurações", () => {
    expect(menuDoSuporte(matrizDoSuporte(["vendas", "estoque"])).map((i) => i.href)).toEqual(["/estoque", "/vendas", "/relatorios"]);
    expect(menuDoSuporte(matrizDoSuporte(["dashboard"])).map((i) => i.href)).toEqual(["/painel"]);
  });

  it("descrição das telas para o registro", () => {
    expect(descreverTela("/vendas?de=2026-10-01&ate=2026-10-17")).toEqual({ modulo: "vendas", descricao: "Vendas — histórico (01/10 a 17/10)" });
    expect(descreverTela(`/vendas/${ACESSO}`)).toEqual({ modulo: "vendas", descricao: "Vendas — detalhe de venda", detalhe: { tipo: "venda", id: ACESSO } });
    expect(descreverTela(`/estoque/${ACESSO}`)).toMatchObject({ modulo: "estoque", detalhe: { tipo: "item" } });
    expect(descreverTela("/vendas?periodo=7dias")).toEqual({ modulo: "vendas", descricao: "Vendas — histórico (últimos 7 dias)" });
    expect(descreverTela("/financeiro/contas")).toEqual({ modulo: "financeiro", descricao: "Financeiro — contas" });
    expect(descreverTela("/painel")).toEqual({ modulo: "dashboard", descricao: "Painel" });
  });
});

describe("T03 — sessão do Administrador: 8 h desde a entrada (RNF12, INV-010)", () => {
  it("vale até 8 h; sem o horário da entrada, não vale (falha fechada)", () => {
    expect(sessaoDoAdministradorValida(new Date(AGORA.getTime() - 7.9 * 3_600_000), AGORA)).toBe(true);
    expect(sessaoDoAdministradorValida(new Date(AGORA.getTime() - 8 * 3_600_000), AGORA)).toBe(false);
    expect(sessaoDoAdministradorValida(null, AGORA)).toBe(false);
  });
  it("o horário da entrada vem do 'amr' do JWT (não muda na renovação)", () => {
    expect(autenticadoEmDasClaims({ amr: [{ method: "password", timestamp: 1_760_700_000 }] })?.getTime()).toBe(1_760_700_000_000);
    expect(autenticadoEmDasClaims({ iat: 1_760_700_000 })).toBeNull();
    expect(autenticadoEmDasClaims(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------
// Contexto e autorização (INV-001 a INV-004, INV-008).

function liberacao(extra: Partial<LiberacaoDoContexto> = {}): LiberacaoDoContexto {
  return { id: ACESSO, negocioId: NEGOCIO, negocio: "Negócio X", negocioEncerrado: false, modulos: ["vendas"], expiraEm: new Date(AGORA.getTime() + 3_600_000), revogadoEm: null, ...extra };
}

function deps(conta: { administradorEm: Date | null; versaoTermosAceita: string | null }, lida: LiberacaoDoContexto | null = liberacao()): DependenciasDoContexto {
  return {
    filiacao: async () => ({ papel: "DONO", permissoesCustom: null }),
    conta: async () => conta,
    liberacao: async () => lida,
  };
}

const entrada = (extra: Partial<Parameters<typeof resolverContextoDaRequisicao>[0]> = {}) => ({
  usuarioId: ADMIN,
  negocioDoCookie: NEGOCIO,
  suporteDoCookie: ACESSO,
  autenticadoEm: new Date(AGORA.getTime() - 3_600_000),
  agora: AGORA,
  versaoDosTermos: VERSAO,
  ...extra,
});

const ADMINISTRADOR = { administradorEm: AGORA, versaoTermosAceita: VERSAO };

describe("contexto da requisição (SPEC-018)", () => {
  it("Administrador nunca usa a filiação: o negócio só vem da liberação ativa (INV-001, INV-004)", async () => {
    const semCookie = await resolverContextoDaRequisicao(entrada({ suporteDoCookie: undefined }), deps(ADMINISTRADOR));
    expect(semCookie).toMatchObject({ administrador: true, negocioId: null, papel: null, permissoes: null, suporte: null });

    const ativo = await resolverContextoDaRequisicao(entrada(), deps(ADMINISTRADOR));
    expect(ativo).toMatchObject({ administrador: true, negocioId: NEGOCIO, papel: null, suporte: { acessoId: ACESSO, modulos: ["vendas"] } });
    expect(ativo!.permissoes!.vendas).toEqual({ ver: true, criar: false, editar: false, excluir: false });
  });

  it("liberação expirada, revogada, de negócio encerrado ou inexistente: sem negócio", async () => {
    const casos: [LiberacaoDoContexto | null, string | null][] = [
      [liberacao({ expiraEm: AGORA }), "expirou"],
      [liberacao({ revogadoEm: AGORA }), "revogado"],
      [liberacao({ negocioEncerrado: true }), "revogado"],
      [null, null],
    ];
    for (const [lida, encerrado] of casos) {
      const c = await resolverContextoDaRequisicao(entrada(), deps(ADMINISTRADOR, lida));
      expect(c).toMatchObject({ negocioId: null, suporte: null, suporteEncerrado: encerrado });
    }
    expect(await resolverContextoDaRequisicao(entrada({ suporteDoCookie: "nao-e-uuid" }), deps(ADMINISTRADOR))).toMatchObject({ negocioId: null, suporte: null });
  });

  it("usuário comum: o contexto de membro de sempre, mais a pendência dos termos", async () => {
    const c = await resolverContextoDaRequisicao(entrada(), deps({ administradorEm: null, versaoTermosAceita: "2026-10-03" }));
    expect(c).toMatchObject({ administrador: false, negocioId: NEGOCIO, papel: "DONO", suporte: null, termosPendentes: true, sessaoExpirada: false });
  });

  it("sessão do Administrador com mais de 8 h é marcada como expirada", async () => {
    const c = await resolverContextoDaRequisicao(entrada({ autenticadoEm: new Date(AGORA.getTime() - 9 * 3_600_000) }), deps(ADMINISTRADOR));
    expect(c?.sessaoExpirada).toBe(true);
    expect(autorizar(c, { tipo: "administrador" })).toEqual({ ok: false, motivo: "SessaoExpirada" });
  });
});

describe("autorização no modo suporte e para o Administrador", () => {
  it("páginas de leitura dos módulos liberados passam; o resto é recusado (INV-003)", async () => {
    const c = await resolverContextoDaRequisicao(entrada(), deps(ADMINISTRADOR));
    expect(autorizar(c, { tipo: "permissao", modulo: "vendas", acao: "ver" })).toMatchObject({ ok: true, membro: { modoSuporte: true, papel: null } });
    expect(autorizar(c, { tipo: "permissao", modulo: "financeiro", acao: "ver" })).toEqual({ ok: false, motivo: "SemPermissao" });
    expect(autorizar(c, { tipo: "permissao", modulo: "vendas", acao: "criar" })).toEqual({ ok: false, motivo: "SemPermissao" });
    expect(autorizar(c, { tipo: "dono" })).toEqual({ ok: false, motivo: "SomenteDono" });
  });

  it("nenhuma Server Action no modo suporte, nem de leitura (INV-002)", async () => {
    const c = await resolverContextoDaRequisicao(entrada(), deps(ADMINISTRADOR));
    const niveis: NivelDeAcesso[] = [
      { tipo: "sessao", origem: "acao" },
      { tipo: "dono", origem: "acao" },
      { tipo: "permissao", modulo: "vendas", acao: "ver", origem: "acao" },
      { tipo: "permissao", modulo: "vendas", acao: "criar", origem: "acao" },
    ];
    for (const n of niveis) expect(autorizar(c, n)).toEqual({ ok: false, motivo: "SomenteLeitura" });
    // Sair do modo suporte (ação do Administrador) continua possível.
    expect(autorizar(c, { tipo: "administrador" }).ok).toBe(true);
  });

  it("conta de Administrador fora do modo suporte: não cria negócio nem aceita convite (INV-004)", async () => {
    const c = await resolverContextoDaRequisicao(entrada({ suporteDoCookie: undefined }), deps(ADMINISTRADOR));
    expect(autorizar(c, { tipo: "sessao", origem: "acao" })).toEqual({ ok: false, motivo: "ContaDeAdministrador" });
    expect(autorizar(c, { tipo: "permissao", modulo: "vendas", acao: "ver" })).toEqual({ ok: false, motivo: "SemNegocio" });
  });

  it("usuário comum não entra no painel do Administrador", async () => {
    const c = await resolverContextoDaRequisicao(entrada(), deps({ administradorEm: null, versaoTermosAceita: VERSAO }));
    expect(autorizar(c, { tipo: "administrador" })).toEqual({ ok: false, motivo: "SomenteAdministrador" });
    expect(autorizar(c, { tipo: "permissao", modulo: "vendas", acao: "criar", origem: "acao" }).ok).toBe(true);
  });

  it("termos pendentes: só Minha conta e o aceite (INV-008)", async () => {
    const c = await resolverContextoDaRequisicao(entrada(), deps({ administradorEm: null, versaoTermosAceita: "2026-10-03" }));
    expect(autorizar(c, { tipo: "sessao" })).toEqual({ ok: false, motivo: "TermosPendentes" });
    expect(autorizar(c, { tipo: "permissao", modulo: "vendas", acao: "ver" })).toEqual({ ok: false, motivo: "TermosPendentes" });
    expect(autorizar(c, { tipo: "conta" }).ok).toBe(true);
  });
});
