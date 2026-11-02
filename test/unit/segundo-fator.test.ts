import { describe, expect, it, vi } from "vitest";
import { autorizar, type NivelDeAcesso } from "@/lib/auth/autorizacao";
import { resolverContextoDaRequisicao, type DependenciasDoContexto, type EntradaDoContexto } from "@/lib/auth/contexto";
import {
  emissorDoAmbiente,
  instantesDasClaims,
  lerCodigo,
  lerNomeDoAutenticador,
  MENSAGENS_DO_SEGUNDO_FATOR,
  reconfirmacaoValida,
  sessaoAnteriorARedefinicao,
} from "@/lib/dominio/segundo-fator";
import { qrCodeComoImagem } from "@/lib/auth/adaptador-supabase";
import { autenticadoEmDasClaims } from "@/lib/dominio/suporte";
import { deBase32, paraBase32, totp, type Algoritmo } from "../apoio/totp";

// SPEC-019, etapa 1 — testes unitários do 2º fator do Administrador: T13 (gerador TOTP dos testes
// conferido com a RFC 6238) e T01 (contexto: aal1, aal2, redefinição, 8 h pela senha, reconfirmação).

describe("T13 — gerador TOTP dos testes (RFC 6238, apêndice B)", () => {
  const sementes: Record<Algoritmo, Buffer> = {
    sha1: Buffer.from("12345678901234567890"),
    sha256: Buffer.from("12345678901234567890123456789012"),
    sha512: Buffer.from("1234567890123456789012345678901234567890123456789012345678901234"),
  };
  const vetores: [number, Record<Algoritmo, string>][] = [
    [59, { sha1: "94287082", sha256: "46119246", sha512: "90693936" }],
    [1111111109, { sha1: "07081804", sha256: "68084774", sha512: "25091201" }],
    [1111111111, { sha1: "14050471", sha256: "67062674", sha512: "99943326" }],
    [1234567890, { sha1: "89005924", sha256: "91819424", sha512: "93441116" }],
    [2000000000, { sha1: "69279037", sha256: "90698825", sha512: "38618901" }],
    [20000000000, { sha1: "65353130", sha256: "77737706", sha512: "47863826" }],
  ];
  for (const [segundos, esperados] of vetores) {
    for (const algoritmo of ["sha1", "sha256", "sha512"] as const) {
      it(`T = ${segundos}, ${algoritmo}: ${esperados[algoritmo]}`, () => {
        expect(totp(sementes[algoritmo], segundos * 1000, { digitos: 8, algoritmo })).toBe(esperados[algoritmo]);
      });
    }
  }
  it("base32 (o segredo do QR code) vai e volta", () => {
    const bytes = Buffer.from("12345678901234567890");
    expect(paraBase32(bytes)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(deBase32("gezd gnbv gy3t qojq gezd gnbv gy3t qojq").equals(bytes)).toBe(true);
    expect(totp(bytes, 59_000)).toBe("287082");
  });
});

describe("claims da sessão: nível, login com senha e último código", () => {
  it("lê o aal e os horários do amr por método; o código vale como 'totp' ou 'mfa/totp'", () => {
    const s = instantesDasClaims({ aal: "aal2", amr: [{ method: "password", timestamp: 1_000 }, { method: "totp", timestamp: 1_300 }] });
    expect(s).toEqual({ nivel: "aal2", senhaEm: new Date(1_000_000), codigoEm: new Date(1_300_000) });
    expect(instantesDasClaims({ aal: "aal2", amr: [{ method: "mfa/totp", timestamp: 2_000 }] }).codigoEm).toEqual(new Date(2_000_000));
    expect(instantesDasClaims({ aal: "aal3", amr: "x" })).toEqual({ nivel: null, senhaEm: null, codigoEm: null });
    expect(instantesDasClaims(null)).toEqual({ nivel: null, senhaEm: null, codigoEm: null });
  });

  it("CA-03: as 8 h contam do login com senha, não do código; sem senha (link de recuperação), não há horário", () => {
    const senha = Date.parse("2026-11-02T12:00:00Z") / 1000;
    const claims = { aal: "aal2", amr: [{ method: "password", timestamp: senha }, { method: "totp", timestamp: senha + 300 }] };
    expect(autenticadoEmDasClaims(claims)).toEqual(new Date(senha * 1000));
    expect(autenticadoEmDasClaims({ amr: [{ method: "recovery", timestamp: senha }] })).toBeNull();
  });

  it("reconfirmação: código verificado há menos de 10 min (INV-002)", () => {
    const agora = new Date("2026-11-02T12:00:00Z");
    const antes = (min: number) => new Date(agora.getTime() - min * 60_000);
    expect(reconfirmacaoValida(antes(9.9), agora)).toBe(true);
    expect(reconfirmacaoValida(antes(10), agora)).toBe(false);
    expect(reconfirmacaoValida(null, agora)).toBe(false);
    expect(reconfirmacaoValida(antes(-2), agora)).toBe(false);
  });

  it("redefinição: a sessão com login anterior (ou sem login com senha) deixa de valer", () => {
    const redefinido = new Date("2026-11-02T12:00:00Z");
    expect(sessaoAnteriorARedefinicao(new Date("2026-11-02T11:00:00Z"), redefinido)).toBe(true);
    expect(sessaoAnteriorARedefinicao(null, redefinido)).toBe(true);
    expect(sessaoAnteriorARedefinicao(new Date("2026-11-02T12:05:00Z"), redefinido)).toBe(false);
    expect(sessaoAnteriorARedefinicao(new Date("2026-11-02T11:00:00Z"), null)).toBe(false);
    // O login vem do JWT em segundos inteiros: no mesmo segundo da redefinição, vale como depois.
    expect(sessaoAnteriorARedefinicao(new Date("2026-11-02T12:00:00.000Z"), new Date("2026-11-02T12:00:00.700Z"))).toBe(false);
    expect(sessaoAnteriorARedefinicao(new Date("2026-11-02T11:59:59.000Z"), new Date("2026-11-02T12:00:00.700Z"))).toBe(true);
  });

  it("QR code do SDK: o SVG cru vira uma imagem codificada (um '#' não corta a imagem)", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#fff"/></svg>';
    const imagem = qrCodeComoImagem(`data:image/svg+xml;utf-8,${svg}`);
    expect(imagem.startsWith("data:image/svg+xml;charset=utf-8,%3Csvg")).toBe(true);
    expect(imagem).not.toContain("#");
    expect(decodeURIComponent(imagem.slice("data:image/svg+xml;charset=utf-8,".length))).toBe(svg);
    expect(qrCodeComoImagem("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });

  it("código, nome do autenticador e emissor do ambiente", () => {
    expect(lerCodigo("123 456")).toEqual({ ok: true, codigo: "123456" });
    expect(lerCodigo("12345")).toEqual({ ok: false, erro: MENSAGENS_DO_SEGUNDO_FATOR.codigoFormato });
    expect(lerCodigo(undefined).ok).toBe(false);
    expect(lerNomeDoAutenticador("  Meu   celular ")).toEqual({ ok: true, nome: "Meu celular" });
    expect(lerNomeDoAutenticador("").ok).toBe(false);
    expect(lerNomeDoAutenticador("x".repeat(41)).ok).toBe(false);
    expect(emissorDoAmbiente(undefined)).toBe("Health Enterprise");
    expect(emissorDoAmbiente(" HE Homologação ")).toBe("HE Homologação");
    expect(emissorDoAmbiente("A:B")).toBe("A B");
  });
});

// ---------------------------------------------------------------------------------------
// T01 — contexto e autorização da conta de Administrador (INV-001).

const AGORA = new Date("2026-11-02T15:00:00Z");
const ADMIN = "a0000000-0000-4000-8000-000000000001";
const NEGOCIO = "b0000000-0000-4000-8000-000000000001";
const ACESSO = "c0000000-0000-4000-8000-000000000001";
const VERSAO = "2026-11-01";

function deps(conta: Partial<{ administradorEm: Date | null; versaoTermosAceita: string | null; segundoFatorRedefinidoEm: Date | null }> = {}, lidas = { n: 0 }): DependenciasDoContexto {
  return {
    filiacao: async () => ({ papel: "DONO", permissoesCustom: null }),
    conta: async () => ({ administradorEm: AGORA, versaoTermosAceita: VERSAO, ...conta }),
    liberacao: async () => {
      lidas.n++;
      return { id: ACESSO, negocioId: NEGOCIO, negocio: "Negócio X", negocioEncerrado: false, modulos: ["catalogo"], expiraEm: new Date(AGORA.getTime() + 3_600_000), revogadoEm: null };
    },
  };
}

const entrada = (extra: Partial<EntradaDoContexto> = {}): EntradaDoContexto => ({
  usuarioId: ADMIN,
  negocioDoCookie: undefined,
  suporteDoCookie: ACESSO,
  autenticadoEm: new Date(AGORA.getTime() - 3_600_000),
  nivelDaSessao: "aal2",
  codigoEm: new Date(AGORA.getTime() - 3_500_000),
  agora: AGORA,
  versaoDosTermos: VERSAO,
  ...extra,
});

const TODOS: NivelDeAcesso[] = [
  { tipo: "administrador" },
  { tipo: "conta" },
  { tipo: "sessao" },
  { tipo: "permissao", modulo: "catalogo", acao: "ver" },
  { tipo: "dono" },
];

describe("T01 — sem 2º fator, nada (CA-02, INV-001)", () => {
  it("sessão aal1: nenhum contexto de suporte é montado (a liberação nem é lida) e tudo é recusado, menos as telas do 2º fator", async () => {
    const lidas = { n: 0 };
    const c = await resolverContextoDaRequisicao(entrada({ nivelDaSessao: "aal1", codigoEm: null }), deps({}, lidas));
    expect(c).toMatchObject({ administrador: true, segundoFatorPendente: true, negocioId: null, suporte: null, permissoes: null });
    expect(lidas.n).toBe(0);
    for (const nivel of TODOS) expect(autorizar(c, nivel)).toEqual({ ok: false, motivo: "SegundoFatorPendente" });
    expect(autorizar(c, { tipo: "segundoFator" })).toMatchObject({ ok: true });
  });

  it("sem nível informado também é pendente (falha fechada)", async () => {
    const c = await resolverContextoDaRequisicao(entrada({ nivelDaSessao: null }), deps());
    expect(c?.segundoFatorPendente).toBe(true);
  });

  it("aal2: o contexto de sempre, com o horário do último código para a reconfirmação", async () => {
    const c = await resolverContextoDaRequisicao(entrada(), deps());
    expect(c).toMatchObject({ segundoFatorPendente: false, negocioId: NEGOCIO, suporte: { acessoId: ACESSO } });
    expect(c?.codigoVerificadoEm).toEqual(new Date(AGORA.getTime() - 3_500_000));
    expect(autorizar(c, { tipo: "administrador" })).toMatchObject({ ok: true });
  });

  it("ordem: senha → código → aceite dos termos (o código vem antes)", async () => {
    const semCodigo = await resolverContextoDaRequisicao(entrada({ nivelDaSessao: "aal1" }), deps({ versaoTermosAceita: "2026-10-23" }));
    expect(autorizar(semCodigo, { tipo: "conta" })).toEqual({ ok: false, motivo: "SegundoFatorPendente" });
    const comCodigo = await resolverContextoDaRequisicao(entrada(), deps({ versaoTermosAceita: "2026-10-23" }));
    expect(autorizar(comCodigo, { tipo: "administrador" })).toEqual({ ok: false, motivo: "TermosPendentes" });
    expect(autorizar(comCodigo, { tipo: "conta" })).toMatchObject({ ok: true });
  });

  it("as telas do 2º fator são só da conta de Administrador; o usuário comum não é afetado", async () => {
    const comum = await resolverContextoDaRequisicao(entrada({ nivelDaSessao: "aal1", negocioDoCookie: NEGOCIO }), deps({ administradorEm: null }));
    expect(comum).toMatchObject({ administrador: false, papel: "DONO" });
    expect(comum?.segundoFatorPendente).toBeUndefined();
    expect(autorizar(comum, { tipo: "segundoFator" })).toEqual({ ok: false, motivo: "SomenteAdministrador" });
    expect(autorizar(comum, { tipo: "permissao", modulo: "catalogo", acao: "ver" })).toMatchObject({ ok: true });
  });
});

describe("T01 — sessão de 8 h pela senha e redefinição do 2º fator (CA-03, CA-05)", () => {
  it("CA-03: login com senha às 9h e código às 9h05 vencem às 17h", async () => {
    const senha = new Date("2026-11-02T12:00:00Z"); // 9h em São Paulo
    const codigo = new Date("2026-11-02T12:05:00Z");
    const as = (iso: string) => resolverContextoDaRequisicao(entrada({ autenticadoEm: senha, codigoEm: codigo, agora: new Date(iso) }), deps());
    expect((await as("2026-11-02T19:59:00Z"))?.sessaoExpirada).toBe(false);
    expect((await as("2026-11-02T20:00:00Z"))?.sessaoExpirada).toBe(true);
    expect((await as("2026-11-02T20:04:00Z"))?.sessaoExpirada).toBe(true);
  });

  it("redefinição pelo workflow: a sessão aberta antes vence; um novo login depois vale", async () => {
    const redefinido = new Date(AGORA.getTime() - 1_800_000);
    const antes = await resolverContextoDaRequisicao(entrada(), deps({ segundoFatorRedefinidoEm: redefinido }));
    expect(antes?.sessaoExpirada).toBe(true);
    expect(autorizar(antes, { tipo: "segundoFator" })).toEqual({ ok: false, motivo: "SessaoExpirada" });
    const depois = await resolverContextoDaRequisicao(entrada({ autenticadoEm: new Date(AGORA.getTime() - 600_000), nivelDaSessao: "aal1" }), deps({ segundoFatorRedefinidoEm: redefinido }));
    expect(depois).toMatchObject({ sessaoExpirada: false, segundoFatorPendente: true });
  });
});

// ---------------------------------------------------------------------------------------
// T01 — reconfirmação nas ações críticas (CA-04, INV-002): a fábrica, com a guarda como dublê.

const guarda = vi.hoisted(() => ({ contexto: null as unknown, pedidos: [] as unknown[] }));
vi.mock("@/lib/auth/servidor", () => ({
  exigirNivel: async (nivel: unknown) => {
    guarda.pedidos.push(nivel);
    return { contexto: guarda.contexto };
  },
}));

describe("T01 — ação crítica (acaoCritica)", () => {
  it("sem código nos últimos 10 min, nada é executado e a resposta pede o código; com ele, a ação roda", async () => {
    const { acaoCritica } = await import("@/lib/auth/acao");
    const executadas: string[] = [];
    const acao = acaoCritica(async (_c, nome: string) => {
      executadas.push(nome);
      return { status: "feito" as const };
    });

    guarda.contexto = { usuarioId: ADMIN, administrador: true, codigoVerificadoEm: new Date(Date.now() - 11 * 60_000) };
    expect(await acao("suspender")).toEqual({ status: "reconfirmar", mensagem: MENSAGENS_DO_SEGUNDO_FATOR.reconfirmar });
    guarda.contexto = { usuarioId: ADMIN, administrador: true, codigoVerificadoEm: null };
    expect(await acao("suspender")).toMatchObject({ status: "reconfirmar" });
    expect(executadas).toEqual([]);

    guarda.contexto = { usuarioId: ADMIN, administrador: true, codigoVerificadoEm: new Date(Date.now() - 60_000) };
    expect(await acao("suspender")).toEqual({ status: "feito" });
    expect(executadas).toEqual(["suspender"]);
    expect(guarda.pedidos.every((p) => (p as { tipo: string }).tipo === "administrador")).toBe(true);
  });
});
