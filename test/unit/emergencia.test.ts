import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { resolverContextoDaRequisicao, type LiberacaoDoContexto } from "@/lib/auth/contexto";
import { autorizar } from "@/lib/auth/autorizacao";
import {
  fimDaEmergencia,
  lerPedidoDeEmergencia,
  MENSAGENS_DA_EMERGENCIA,
  validarPedidoDeEmergencia,
  validarResultado,
} from "@/lib/dominio/emergencia";
import * as servicos from "@/lib/plataforma/servicos";

// SPEC-019, etapa 3b — testes unitários: o domínio do acesso de emergência (5.6), o contexto puro (INV-010 e
// INV-003) e os fluxos com dependências falsas. O banco está em test/integracao/emergencia.test.ts.

const E = MENSAGENS_DA_EMERGENCIA;
const ADMIN = "a0000000-0000-4000-8000-000000000001";
const OUTRO_ADMIN = "a0000000-0000-4000-8000-000000000002";
const NEGOCIO = "c0000000-0000-4000-8000-000000000001";
const ACESSO = "b0000000-0000-4000-8000-000000000001";
const PEDIDO = "e0000000-0000-4000-8000-000000000001";
const AGORA = new Date("2026-11-06T15:00:00Z");
const VERSAO = "2026-11-01";

const CAMPOS = { motivo: "ORDEM_JUDICIAL", referencia: "  Processo 123/2026 ", justificativa: "Ofício pede o histórico de vendas", "modulo.vendas": "on", "modulo.financeiro": "on", prazo: "4h" };

describe("pedido de emergência (5.6)", () => {
  it("aceita o motivo da lista, a referência, a justificativa, os módulos e o prazo", () => {
    expect(validarPedidoDeEmergencia(CAMPOS)).toEqual({
      ok: true,
      dados: { motivo: "ORDEM_JUDICIAL", referencia: "Processo 123/2026", justificativa: "Ofício pede o histórico de vendas", modulos: ["vendas", "financeiro"], prazo: "4h" },
    });
  });

  it("recusa motivo fora da lista, campos vazios ou longos, sem módulo e prazo acima de 4 h", () => {
    expect(validarPedidoDeEmergencia({ motivo: "CURIOSIDADE", prazo: "12h" })).toEqual({
      ok: false,
      erros: { motivo: E.motivoObrigatorio, referencia: E.referenciaObrigatoria, justificativa: E.justificativaObrigatoria, modulos: E.modulosObrigatorios, prazo: E.prazoInvalido },
    });
    const longos = validarPedidoDeEmergencia({ ...CAMPOS, referencia: "x".repeat(121), justificativa: "y".repeat(501) });
    expect(longos).toEqual({ ok: false, erros: { referencia: E.longo(120), justificativa: E.longo(500) } });
    for (const prazo of ["1h", "2h", "4h"]) expect(validarPedidoDeEmergencia({ ...CAMPOS, prazo }).ok).toBe(true);
  });

  it("lê os dados gravados só quando estão completos; o acesso dura o prazo, da aprovação", () => {
    expect(lerPedidoDeEmergencia({ motivo: "INCIDENTE", referencia: "INC-1", justificativa: "x", modulos: ["estoque", "x"], prazo: "2h" })).toEqual({
      motivo: "INCIDENTE",
      referencia: "INC-1",
      justificativa: "x",
      modulos: ["estoque"],
      prazo: "2h",
    });
    expect(lerPedidoDeEmergencia({ motivo: "INCIDENTE", referencia: "INC-1", justificativa: "x", modulos: [], prazo: "2h" })).toBeNull();
    expect(lerPedidoDeEmergencia({ motivo: "INCIDENTE" })).toBeNull();
    expect(fimDaEmergencia(AGORA, "4h")).toEqual(new Date("2026-11-06T19:00:00Z"));
  });

  it("o resultado é obrigatório, até 1000 caracteres", () => {
    expect(validarResultado({ resultado: "  Causa achada  " })).toEqual({ ok: true, resultado: "Causa achada" });
    expect(validarResultado({ resultado: " " })).toEqual({ ok: false, erro: E.resultadoObrigatorio });
    expect(validarResultado({ resultado: "z".repeat(1001) })).toEqual({ ok: false, erro: E.longo(1000) });
  });
});

// ---------------------------------------------------------------------------------------
// Contexto (INV-010) e somente leitura (INV-003).

function emergencia(extra: Partial<LiberacaoDoContexto> = {}): LiberacaoDoContexto {
  return {
    id: ACESSO,
    negocioId: NEGOCIO,
    negocio: "Negócio X",
    negocioEncerrado: false,
    modulos: ["vendas", "catalogo"],
    // Mesmo que o banco trouxesse módulos em correção, a emergência não corrige.
    modulosComCorrecao: ["catalogo"],
    entradaComCorrecaoEm: new Date(AGORA.getTime() - 60_000),
    expiraEm: new Date(AGORA.getTime() + 3_600_000),
    revogadoEm: null,
    emergencia: { motivo: "incidente de segurança", solicitadoPorId: ADMIN },
    ...extra,
  };
}

const contexto = (usuarioId: string, lida: LiberacaoDoContexto | null) =>
  resolverContextoDaRequisicao(
    {
      usuarioId,
      negocioDoCookie: undefined,
      suporteDoCookie: ACESSO,
      autenticadoEm: new Date(AGORA.getTime() - 3_600_000),
      nivelDaSessao: "aal2",
      codigoEm: new Date(AGORA.getTime() - 60_000),
      agora: AGORA,
      versaoDosTermos: VERSAO,
    },
    { filiacao: async () => null, conta: async () => ({ administradorEm: AGORA, versaoTermosAceita: VERSAO }), liberacao: async () => lida },
  );

describe("contexto da emergência (INV-010, INV-003)", () => {
  it("só a conta que pediu tem o contexto, somente leitura e com o motivo para a faixa", async () => {
    const c = await contexto(ADMIN, emergencia());
    expect(c?.suporte).toMatchObject({ acessoId: ACESSO, modulos: ["catalogo", "vendas"], modulosComCorrecao: [], correcaoPendente: false, emergencia: { motivo: "incidente de segurança" } });
    expect(autorizar(c, { tipo: "permissao", modulo: "catalogo", acao: "editar", origem: "acao", correcao: "catalogo.editarItem" })).toEqual({ ok: false, motivo: "SomenteLeitura" });
    expect(await contexto(OUTRO_ADMIN, emergencia())).toMatchObject({ negocioId: null, suporte: null, suporteEncerrado: null });
  });

  it("encerrada: o Administrador volta ao painel com o aviso da emergência; vencida, com o do prazo", async () => {
    expect(await contexto(ADMIN, emergencia({ revogadoEm: AGORA }))).toMatchObject({ suporte: null, suporteEncerrado: "emergencia" });
    expect(await contexto(ADMIN, emergencia({ expiraEm: AGORA }))).toMatchObject({ suporte: null, suporteEncerrado: "expirou" });
    expect(await contexto(ADMIN, emergencia({ negocioEncerrado: true }))).toMatchObject({ suporte: null, suporteEncerrado: "emergencia" });
  });
});

// ---------------------------------------------------------------------------------------
// Fluxos (servicos.ts) com dependências falsas.

function deps(extra: Partial<servicos.DependenciasDaPlataforma> = {}): servicos.DependenciasDaPlataforma {
  return {
    administradorId: ADMIN,
    agora: () => AGORA,
    pedirTrocaDePlano: vi.fn(async () => ({ ok: true as const, id: PEDIDO, expiraEm: AGORA })),
    pedirEmergencia: vi.fn(async () => ({ ok: true as const, id: PEDIDO, expiraEm: new Date("2026-11-07T03:00:00Z") })),
    decidir: vi.fn(async () => ({ ok: false as const, erro: "PedidoInexistente" as const })),
    cancelar: vi.fn(async () => ({ ok: true as const })),
    entrarNaEmergencia: vi.fn(async () => ({ ok: true as const, acessoId: ACESSO, expiraEm: AGORA, modulos: ["vendas" as const], primeira: true })),
    registrarResultado: vi.fn(async () => ({ ok: true as const, negocioId: NEGOCIO })),
    suspender: vi.fn(async () => ({ ok: true as const, negocio: "HE Testing" })),
    reativar: vi.fn(async () => ({ ok: true as const, negocio: "HE Testing" })),
    dono: vi.fn(async () => ({ nome: "Rafael", email: "dono@exemplo.com", negocio: "HE Testing" })),
    avisar: vi.fn(),
    origem: "https://he.exemplo.com",
    ...extra,
  };
}

describe("fluxos da emergência (servicos.ts)", () => {
  it("pedir: valida antes de gravar, avisa o Dono na hora e explica cada recusa", async () => {
    const d = deps();
    expect(await servicos.pedirEmergencia({ ...CAMPOS, motivo: "", negocioId: NEGOCIO }, d)).toMatchObject({ status: "erro", erros: { motivo: E.motivoObrigatorio } });
    expect(d.pedirEmergencia).not.toHaveBeenCalled();
    expect(await servicos.pedirEmergencia({ ...CAMPOS, negocioId: NEGOCIO }, d)).toEqual({ status: "ok", mensagem: expect.stringContaining("O Dono já vê o pedido") });
    expect(vi.mocked(d.avisar).mock.calls[0][0]).toMatchObject({ para: "dono@exemplo.com", assunto: "Pedido de acesso de emergência ao HE Testing" });
    expect(vi.mocked(d.avisar).mock.calls[0][0].texto).toContain("Ordem judicial ou requisição de autoridade competente (Processo 123/2026)");

    const com = (erro: "LiberacaoAtiva" | "EmergenciaAtiva" | "PedidoPendente" | "ResultadoPendente") =>
      servicos.pedirEmergencia({ ...CAMPOS, negocioId: NEGOCIO }, deps({ pedirEmergencia: async () => ({ ok: false, erro }) }));
    expect(await com("LiberacaoAtiva")).toEqual({ status: "erro", mensagem: E.liberacaoAtiva });
    expect(await com("EmergenciaAtiva")).toEqual({ status: "erro", mensagem: E.emergenciaAtiva });
    expect(await com("PedidoPendente")).toEqual({ status: "erro", mensagem: E.pedidoPendente });
    expect(await com("ResultadoPendente")).toEqual({ status: "erro", mensagem: E.resultadoPendente });
  });

  it("aprovar a emergência: quem pediu pode entrar até o fim do prazo, e o Dono recebe o e-mail", async () => {
    const fim = new Date("2026-11-06T17:00:00Z");
    const d = deps({
      decidir: async () => ({
        ok: true,
        tipo: "EMERGENCIA",
        situacao: "APROVADO",
        negocioId: NEGOCIO,
        emergencia: { motivo: "INCIDENTE", referencia: "INC-42", justificativa: "x", modulos: ["vendas"], prazo: "2h" },
        acessoId: ACESSO,
        expiraEm: fim,
        solicitadoPor: "Ana Suporte",
      }),
    });
    expect(await servicos.aprovar({ pedidoId: PEDIDO }, d)).toEqual({ status: "ok", mensagem: E.aprovado("Ana Suporte", fim) });
    const email = vi.mocked(d.avisar).mock.calls[0][0];
    expect(email.assunto).toMatch(/^Acesso de emergência do suporte ao HE Testing até /);
    expect(email.texto).toContain("Você pode encerrar o acesso a qualquer momento");
  });

  it("aprovar com liberação ativa explica o caminho; entrar e o resultado explicam as recusas", async () => {
    expect(await servicos.aprovar({ pedidoId: PEDIDO }, deps({ decidir: async () => ({ ok: false, erro: "LiberacaoAtiva" }) }))).toEqual({ status: "erro", mensagem: `${E.liberacaoAtiva} Recuse o pedido.` });
    expect(await servicos.entrarNaEmergencia(NEGOCIO, deps({ entrarNaEmergencia: async () => ({ ok: false, erro: "SoQuemPediu" }) }))).toEqual({ ok: false, mensagem: E.soQuemPediuEntra });
    expect(await servicos.entrarNaEmergencia("x", deps())).toEqual({ ok: false, mensagem: E.semEmergencia });
    expect(await servicos.registrarResultado({ acessoId: ACESSO, resultado: "" }, deps())).toEqual({ status: "erro", mensagem: E.resultadoObrigatorio });
    expect(await servicos.registrarResultado({ acessoId: ACESSO, resultado: "Ok" }, deps({ registrarResultado: async () => ({ ok: false, erro: "AindaAtiva" }) }))).toEqual({
      status: "erro",
      mensagem: E.aindaAtiva,
    });
    expect(await servicos.registrarResultado({ acessoId: ACESSO, resultado: "Ok" }, deps())).toEqual({ status: "ok", mensagem: E.resultadoRegistrado });
  });
});

// INV-002 e OPEN-003: pedir a emergência é ação crítica; o Dono encerra com a fábrica do Dono.
describe("ações da emergência", () => {
  const plataforma = readFileSync("src/lib/plataforma/acoes.ts", "utf8");
  const suporte = readFileSync("src/lib/suporte/acoes.ts", "utf8");
  it("pedir é crítica; entrar e registrar o resultado bastam a conta de Administrador", () => {
    expect(plataforma).toMatch(/export const acaoPedirEmergencia = acaoCritica\(/);
    expect(plataforma).toMatch(/export const acaoEntrarEmEmergencia = acaoDoAdministrador\(/);
    expect(plataforma).toMatch(/export const acaoRegistrarResultado = acaoDoAdministrador\(/);
  });
  it("encerrar é do Dono", () => {
    expect(suporte).toMatch(/export const acaoEncerrarEmergencia = acaoDoDono\(/);
  });
});
