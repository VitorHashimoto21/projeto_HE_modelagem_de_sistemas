import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { autorizar } from "@/lib/auth/autorizacao";
import { resolverContextoComPapel } from "@/lib/auth/contexto";
import { criarConsultasDeAcesso } from "@/lib/db/acesso";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDeEquipe } from "@/lib/db/equipe";
import { criarConsultasDeNegocios } from "@/lib/db/negocios";
import { MATRIZ_COMPLETA, PREDEFINICOES, campoDaPermissao, pode } from "@/lib/dominio/permissoes";
import * as servicos from "@/lib/equipe/servicos";
import { MENSAGENS_DA_EQUIPE as M, type DependenciasDaEquipe } from "@/lib/equipe/servicos";
import { hashDoToken } from "@/lib/equipe/token";
import type { MensagemDeEmail } from "@/lib/integracoes/email";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-005 — testes de integração (seção 12): banco real, papel e permissões lidos pela
// mesma resolução de contexto da aplicação (resolverContextoComPapel + autorizar) e
// envio de e-mail simulado (nunca o Resend de verdade).

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const consultas = criarConsultasDeEquipe(base);
const acesso = criarConsultasDeAcesso(base);
const repoNegocios = criarConsultasDeNegocios(base);

const DIA = 24 * 60 * 60 * 1000;
let agora: Date;
let emails: MensagemDeEmail[];
let envioFunciona: boolean;
let ativo: string | null;

let dono: string;
let negocio: string;

/** Membro como a aplicação o vê nesta requisição (INV-004): filiação lida do banco. */
async function membroDe(usuarioId: string, negocioId: string) {
  const contexto = await resolverContextoComPapel(usuarioId, negocioId, (u, n) => acesso.filiacao(u, n));
  const r = autorizar(contexto, { tipo: "sessao" });
  return r.ok ? r.membro : null;
}

async function deps(usuarioId: string | null, negocioId: string | null = negocio): Promise<DependenciasDaEquipe> {
  return {
    usuarioId,
    membro: usuarioId && negocioId ? await membroDe(usuarioId, negocioId) : null,
    consultas,
    enviarEmail: async (m) => {
      if (!envioFunciona) return false;
      emails.push(m);
      return true;
    },
    origem: "https://he.teste",
    agora: () => agora,
    definirNegocioAtivo: async (id) => {
      ativo = id;
    },
    negocioAtivo: ativo,
    limparNegocioAtivo: async () => {
      ativo = null;
    },
  };
}

async function novoUsuario(nome: string, email = `${randomUUID()}@exemplo.com`) {
  return (await base.usuario.create({ data: { id: randomUUID(), nome, email } })).id;
}

async function novoNegocio(donoId: string, nome = "Studio") {
  return repoNegocios.criarComDono(donoId, {
    nome,
    regime: "AUTONOMO",
    cnpj: null,
    razaoSocial: null,
    cnaePrincipal: null,
    anexoSimples: null,
    sujeitoFatorR: false,
    atividadeMei: null,
    impostoPercentualManual: 5,
  });
}

const tokenDoLink = (link: string) => link.split("/convite/")[1];

async function convidar(email: string, papel = "COLABORADOR", extra: Record<string, string> = {}) {
  const r = await servicos.convidar({ email, papel, ...extra }, await deps(dono));
  if (r.status !== "criado") throw new Error(`convite não criado: ${JSON.stringify(r)}`);
  return { ...r, token: tokenDoLink(r.link) };
}

/** Cria a conta do convidado e aceita pelo link. */
async function entrarNaEquipe(email: string, papel = "COLABORADOR", extra: Record<string, string> = {}) {
  const { token } = await convidar(email, papel, extra);
  const usuario = await novoUsuario("Convidada", email);
  const r = await servicos.aceitarConvite({ token }, await deps(usuario, null));
  if (r.status !== "aceito") throw new Error(`aceite falhou: ${JSON.stringify(r)}`);
  const membro = await base.membroNegocio.findFirstOrThrow({ where: { usuarioId: usuario, negocioId: negocio } });
  return { usuario, membroId: membro.id };
}

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  agora = new Date();
  emails = [];
  envioFunciona = true;
  ativo = null;
  dono = await novoUsuario("Gisele", "gisele@exemplo.com");
  negocio = await novoNegocio(dono, "Studio Gisele");
});

afterAll(async () => {
  await base.$disconnect();
});

describe("convidar (5.2)", () => {
  it("T05 — cria o convite pendente, envia o e-mail e guarda só o hash do token (CA-01, INV-007)", async () => {
    const r = await convidar("Joana@Exemplo.com");
    expect(r).toMatchObject({ status: "criado", email: "joana@exemplo.com", emailEnviado: true, mensagem: M.emailEnviado });
    expect(r.link).toMatch(/^https:\/\/he\.teste\/convite\/[A-Za-z0-9_-]{43}$/);

    const convite = await base.convite.findFirstOrThrow();
    expect(convite).toMatchObject({ negocioId: negocio, email: "joana@exemplo.com", papel: "COLABORADOR", status: "PENDENTE", convidadoPorId: dono });
    expect(convite.tokenHash).toBe(hashDoToken(r.token));
    expect(JSON.stringify(convite)).not.toContain(r.token);
    expect(convite.expiraEm.getTime() - agora.getTime()).toBe(7 * DIA);

    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({ para: "joana@exemplo.com", assunto: expect.stringContaining("Studio Gisele") });
    expect(emails[0].texto).toContain("Gisele convidou você");
    expect(emails[0].texto).toContain(r.link);
  });

  it("guarda a matriz personalizada no convite", async () => {
    await convidar("joana@exemplo.com", "COLABORADOR", { personalizar: "on", [campoDaPermissao("financeiro", "criar")]: "on" });
    const c = await base.convite.findFirstOrThrow();
    expect((c.permissoesCustom as Record<string, unknown>).financeiro).toEqual({ ver: false, criar: true, editar: false, excluir: false });
  });

  it("CA-14 — próprio e-mail, membro, convite pendente e dados inválidos: nada é gravado", async () => {
    const d = await deps(dono);
    expect(await servicos.convidar({ email: "GISELE@exemplo.com", papel: "GERENTE" }, d)).toMatchObject({ status: "erro", erros: { email: M.proprioDono } });

    await base.negocio.update({ where: { id: negocio }, data: { plano: "PAGO" } });
    await entrarNaEquipe("membro@exemplo.com");
    expect(await servicos.convidar({ email: "Membro@exemplo.com", papel: "GERENTE" }, await deps(dono))).toMatchObject({
      status: "erro",
      erros: { email: M.jaEhMembro },
    });

    await convidar("pendente@exemplo.com");
    expect(await servicos.convidar({ email: "pendente@exemplo.com", papel: "GERENTE" }, await deps(dono))).toMatchObject({
      status: "erro",
      erros: { email: M.convitePendente },
    });

    expect(await servicos.convidar({ email: "x", papel: "DONO" }, await deps(dono))).toMatchObject({ status: "erro", erros: { email: expect.any(String), papel: expect.any(String) } });
    expect(await base.convite.count()).toBe(2); // membro (aceito) + pendente
  });

  it("T06 — plano gratuito: 1 colaborador (membro ou convite pendente), inclusive com pedidos simultâneos (CA-02, INV-003)", async () => {
    await convidar("primeira@exemplo.com");
    expect(await servicos.convidar({ email: "segunda@exemplo.com", papel: "COLABORADOR" }, await deps(dono))).toEqual({
      status: "erro",
      mensagem: M.limiteDoPlano,
      valores: { email: "segunda@exemplo.com", papel: "COLABORADOR" },
    });

    // Várias rodadas de pedidos simultâneos: sem a trava do negócio, a corrida aparece.
    const d = await deps(dono);
    for (let rodada = 0; rodada < 5; rodada++) {
      await base.convite.deleteMany();
      const resultados = await Promise.all(
        Array.from({ length: 8 }, (_, i) => servicos.convidar({ email: `r${rodada}-${i}@exemplo.com`, papel: "COLABORADOR" }, d)),
      );
      expect(resultados.filter((r) => r.status === "criado")).toHaveLength(1);
      expect(await base.convite.count({ where: { status: "PENDENTE" } })).toBe(1);
    }
  });

  it("T06 — plano pago sem limite", async () => {
    await base.negocio.update({ where: { id: negocio }, data: { plano: "PAGO" } });
    for (const n of ["a", "b", "c"]) await convidar(`${n}@exemplo.com`);
    expect(await base.convite.count({ where: { status: "PENDENTE" } })).toBe(3);
  });

  it("T07 — cancelar libera a vaga; o link cancelado deixa de valer (CA-03)", async () => {
    const { token } = await convidar("primeira@exemplo.com");
    const c = await base.convite.findFirstOrThrow();
    expect(await servicos.cancelarConvite(c.id, await deps(dono))).toEqual({ status: "ok", mensagem: M.conviteCancelado });
    expect(await base.convite.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ status: "CANCELADO", respondidoEm: expect.any(Date) });
    expect(await servicos.lerConvite(token, { consultas, agora: () => agora })).toEqual({ status: "invalido" });
    await convidar("segunda@exemplo.com");
  });

  it("T07 — reenviar troca o token e a validade; o link anterior para de valer (INV-007)", async () => {
    const antigo = await convidar("joana@exemplo.com");
    const c = await base.convite.findFirstOrThrow();
    agora = new Date(agora.getTime() + 3 * DIA);
    const r = await servicos.reenviarConvite(c.id, await deps(dono));
    expect(r).toMatchObject({ status: "criado", emailEnviado: true });
    const novo = r.status === "criado" ? tokenDoLink(r.link) : "";
    expect(novo).not.toBe(antigo.token);
    expect(await servicos.lerConvite(antigo.token, { consultas, agora: () => agora })).toEqual({ status: "invalido" });
    expect(await servicos.lerConvite(novo, { consultas, agora: () => agora })).toMatchObject({ status: "valido", negocio: "Studio Gisele" });
    expect((await base.convite.findFirstOrThrow()).expiraEm.getTime() - agora.getTime()).toBe(7 * DIA);
    expect(emails).toHaveLength(2);
  });

  it("T20 — e-mail indisponível: o convite fica criado e o link copiável permite aceitar (CA-17)", async () => {
    envioFunciona = false;
    const r = await convidar("joana@exemplo.com");
    expect(r).toMatchObject({ status: "criado", emailEnviado: false, mensagem: M.emailNaoEnviado });
    const joana = await novoUsuario("Joana", "joana@exemplo.com");
    expect(await servicos.aceitarConvite({ token: r.token }, await deps(joana, null))).toEqual({ status: "aceito", negocioId: negocio });
  });
});

describe("aceitar (5.3)", () => {
  it("T08 — com conta existente: vira membro com o papel do convite e o negócio fica ativo (CA-04)", async () => {
    const { token } = await convidar("joana@exemplo.com", "GERENTE");
    const joana = await novoUsuario("Joana", "joana@exemplo.com");
    expect(await servicos.lerConvite(token, { consultas, agora: () => agora })).toMatchObject({
      status: "valido",
      negocio: "Studio Gisele",
      convidadoPor: "Gisele",
      papel: "GERENTE",
      emailMascarado: "j•••@exemplo.com",
    });

    expect(await servicos.aceitarConvite({ token }, await deps(joana, null))).toEqual({ status: "aceito", negocioId: negocio });
    expect(ativo).toBe(negocio);
    expect(await acesso.filiacao(joana, negocio)).toEqual({ papel: "GERENTE", permissoesCustom: null });
    expect(await base.convite.findFirstOrThrow()).toMatchObject({ status: "ACEITO", respondidoEm: expect.any(Date) });
  });

  it("aceita com a matriz personalizada do convite", async () => {
    const { membroId } = await entrarNaEquipe("joana@exemplo.com", "COLABORADOR", { personalizar: "on", [campoDaPermissao("financeiro", "criar")]: "on" });
    const m = await base.membroNegocio.findUniqueOrThrow({ where: { id: membroId } });
    expect((m.permissoesCustom as Record<string, unknown>).financeiro).toEqual({ ver: false, criar: true, editar: false, excluir: false });
  });

  it("T08 — duas aceitações simultâneas criam um só membro (CA-07, INV-006)", async () => {
    const { token } = await convidar("joana@exemplo.com");
    const joana = await novoUsuario("Joana", "joana@exemplo.com");
    const d = await deps(joana, null);
    const r = await Promise.all([servicos.aceitarConvite({ token }, d), servicos.aceitarConvite({ token }, d)]);
    expect(r.filter((x) => x.status === "aceito")).toHaveLength(1);
    expect(await base.membroNegocio.count({ where: { usuarioId: joana } })).toBe(1);
  });

  it("T09 — expirado, cancelado, já aceito ou inventado: recusado e nada é criado (CA-06)", async () => {
    const joana = await novoUsuario("Joana", "joana@exemplo.com");
    const { token } = await convidar("joana@exemplo.com");

    agora = new Date(agora.getTime() + 8 * DIA);
    expect(await servicos.lerConvite(token, { consultas, agora: () => agora })).toEqual({ status: "invalido" });
    expect(await servicos.aceitarConvite({ token }, await deps(joana, null))).toMatchObject({ status: "erro", motivo: "ConviteInvalido", mensagem: M.conviteInvalido });
    expect((await base.convite.findFirstOrThrow()).status).toBe("EXPIRADO");

    expect(await servicos.aceitarConvite({ token: "a".repeat(43) }, await deps(joana, null))).toMatchObject({ motivo: "ConviteInvalido" });
    expect(await servicos.aceitarConvite({ token: "../../etc" }, await deps(joana, null))).toMatchObject({ motivo: "ConviteInvalido" });
    expect(await base.membroNegocio.count({ where: { usuarioId: joana } })).toBe(0);

    agora = new Date();
    const outro = await convidar("joana@exemplo.com");
    await servicos.aceitarConvite({ token: outro.token }, await deps(joana, null));
    expect(await servicos.aceitarConvite({ token: outro.token }, await deps(joana, null))).toMatchObject({ motivo: "ConviteInvalido" });
  });

  it("convite de negócio encerrado não vale", async () => {
    const { token } = await convidar("joana@exemplo.com");
    await base.negocio.update({ where: { id: negocio }, data: { encerradoEm: new Date() } });
    expect(await servicos.lerConvite(token, { consultas, agora: () => agora })).toEqual({ status: "invalido" });
  });

  it("T10 — conta com outro e-mail não aceita; o e-mail aparece mascarado (CA-08, INV-010)", async () => {
    const { token } = await convidar("joana@exemplo.com");
    const outra = await novoUsuario("Outra", "outra@exemplo.com");
    expect(await servicos.aceitarConvite({ token }, await deps(outra, null))).toEqual({
      status: "erro",
      motivo: "EmailDiferente",
      mensagem: "Este convite foi enviado para outro e-mail (j•••@exemplo.com). Entre com essa conta para aceitar.",
    });
    expect(await base.membroNegocio.count({ where: { usuarioId: outra } })).toBe(0);
    expect((await base.convite.findFirstOrThrow()).status).toBe("PENDENTE");
  });

  it("sem sessão, nada é aceito", async () => {
    const { token } = await convidar("joana@exemplo.com");
    expect(await servicos.aceitarConvite({ token }, await deps(null, null))).toMatchObject({ status: "erro", motivo: "SemSessao" });
  });

  it("T11 — “Convites para você”: só os pendentes válidos do e-mail da conta; aceitar pelo id (CA-05, OPEN-006)", async () => {
    await base.negocio.update({ where: { id: negocio }, data: { plano: "PAGO" } });
    await convidar("joana@exemplo.com", "GERENTE");
    await convidar("outra@exemplo.com");
    const joana = await novoUsuario("Joana", "joana@exemplo.com");

    const lista = await servicos.convitesParaVoce(await deps(joana, null));
    expect(lista).toEqual([
      { id: expect.any(String), papel: "GERENTE", expiraEm: expect.any(Date), negocioId: negocio, negocio: "Studio Gisele", convidadoPor: "Gisele" },
    ]);

    const outra = await novoUsuario("Outra", "outra@exemplo.com");
    expect(await servicos.aceitarConvite({ conviteId: lista[0].id }, await deps(outra, null))).toMatchObject({ motivo: "ConviteInvalido" });

    expect(await servicos.aceitarConvite({ conviteId: lista[0].id }, await deps(joana, null))).toEqual({ status: "aceito", negocioId: negocio });
    expect(await servicos.convitesParaVoce(await deps(joana, null))).toEqual([]);
  });
});

describe("gestão da equipe (5.4)", () => {
  it("T12 — Gerente, Colaborador e não membro não gerenciam a equipe (CA-09, RN02, INV-001)", async () => {
    await base.negocio.update({ where: { id: negocio }, data: { plano: "PAGO" } });
    const gerente = (await entrarNaEquipe("gerente@exemplo.com", "GERENTE")).usuario;
    const { usuario: colaborador, membroId } = await entrarNaEquipe("colab@exemplo.com");
    await convidar("pendente@exemplo.com");
    const pendente = await base.convite.findFirstOrThrow({ where: { status: "PENDENTE" } });
    const estranho = await novoUsuario("Estranho");
    const antes = JSON.stringify([await base.membroNegocio.findMany({ orderBy: { id: "asc" } }), await base.convite.findMany({ orderBy: { id: "asc" } })]);

    for (const usuario of [gerente, colaborador, estranho]) {
      const d = await deps(usuario);
      expect(await servicos.convidar({ email: "novo@exemplo.com", papel: "COLABORADOR" }, d)).toEqual({ status: "erro", mensagem: M.somenteDono });
      expect(await servicos.cancelarConvite(pendente.id, d)).toEqual({ status: "erro", mensagem: M.somenteDono });
      expect(await servicos.reenviarConvite(pendente.id, d)).toEqual({ status: "erro", mensagem: M.somenteDono });
      expect(await servicos.alterarPapel(membroId, "GERENTE", d)).toEqual({ status: "erro", mensagem: M.somenteDono });
      expect(await servicos.alterarPermissoes(membroId, {}, d)).toEqual({ status: "erro", mensagem: M.somenteDono });
      expect(await servicos.removerMembro(membroId, d)).toEqual({ status: "erro", mensagem: M.somenteDono });
    }
    const depois = JSON.stringify([await base.membroNegocio.findMany({ orderBy: { id: "asc" } }), await base.convite.findMany({ orderBy: { id: "asc" } })]);
    expect(depois).toBe(antes);
  });

  it("o Dono de outro negócio não alcança membros nem convites deste", async () => {
    await base.negocio.update({ where: { id: negocio }, data: { plano: "PAGO" } });
    const { membroId } = await entrarNaEquipe("colab@exemplo.com");
    await convidar("pendente@exemplo.com");
    const pendente = await base.convite.findFirstOrThrow({ where: { status: "PENDENTE" } });

    const outroDono = await novoUsuario("Outro dono");
    const outroNegocio = await novoNegocio(outroDono, "Outro");
    const d = await deps(outroDono, outroNegocio);
    expect(await servicos.removerMembro(membroId, d)).toEqual({ status: "erro", mensagem: M.membroNaoEncontrado });
    expect(await servicos.cancelarConvite(pendente.id, d)).toEqual({ status: "erro", mensagem: M.conviteInvalido });
    expect(await base.membroNegocio.count({ where: { id: membroId } })).toBe(1);
  });

  it("T13 — guardas pelo papel lido do banco a cada requisição (CA-10, INV-004)", async () => {
    const { usuario, membroId } = await entrarNaEquipe("colab@exemplo.com");
    let membro = await membroDe(usuario, negocio);
    expect(membro?.permissoes).toEqual(PREDEFINICOES.COLABORADOR);
    expect(autorizar(await resolverContextoComPapel(usuario, negocio, acesso.filiacao), { tipo: "permissao", modulo: "financeiro", acao: "ver" })).toEqual({
      ok: false,
      motivo: "SemPermissao",
    });
    expect(autorizar(await resolverContextoComPapel(usuario, negocio, acesso.filiacao), { tipo: "dono" })).toEqual({ ok: false, motivo: "SomenteDono" });

    await base.membroNegocio.update({ where: { id: membroId }, data: { papel: "GERENTE" } });
    membro = await membroDe(usuario, negocio);
    expect(membro?.permissoes).toEqual(MATRIZ_COMPLETA);
  });

  it("CA-11 — permissão customizada: criar no Financeiro sem ver", async () => {
    const { usuario, membroId } = await entrarNaEquipe("colab@exemplo.com");
    const r = await servicos.alterarPermissoes(membroId, { [campoDaPermissao("financeiro", "criar")]: "on", [campoDaPermissao("dashboard", "ver")]: "on" }, await deps(dono));
    expect(r).toEqual({ status: "ok", mensagem: M.permissoesSalvas });
    const ctx = await resolverContextoComPapel(usuario, negocio, acesso.filiacao);
    expect(autorizar(ctx, { tipo: "permissao", modulo: "financeiro", acao: "criar" }).ok).toBe(true);
    expect(autorizar(ctx, { tipo: "permissao", modulo: "financeiro", acao: "ver" }).ok).toBe(false);
    expect(autorizar(ctx, { tipo: "permissao", modulo: "vendas", acao: "criar" }).ok).toBe(false);
  });

  it("matriz incoerente é recusada; “voltar ao padrão” limpa a matriz", async () => {
    const { membroId } = await entrarNaEquipe("colab@exemplo.com");
    expect(await servicos.alterarPermissoes(membroId, { [campoDaPermissao("estoque", "editar")]: "on" }, await deps(dono))).toMatchObject({
      status: "erro",
      mensagem: expect.stringMatching(/Estoque/),
    });
    await servicos.alterarPermissoes(membroId, { [campoDaPermissao("vendas", "ver")]: "on" }, await deps(dono));
    expect((await base.membroNegocio.findUniqueOrThrow({ where: { id: membroId } })).permissoesCustom).not.toBeNull();
    await servicos.alterarPermissoes(membroId, { padrao: "on" }, await deps(dono));
    expect((await base.membroNegocio.findUniqueOrThrow({ where: { id: membroId } })).permissoesCustom).toBeNull();
  });

  it("T14 — trocar o papel limpa a matriz; remover tira o acesso na requisição seguinte (CA-12, INV-009)", async () => {
    const { usuario, membroId } = await entrarNaEquipe("colab@exemplo.com", "COLABORADOR", { personalizar: "on", [campoDaPermissao("financeiro", "criar")]: "on" });
    expect(await servicos.alterarPapel(membroId, "GERENTE", await deps(dono))).toEqual({ status: "ok", mensagem: M.papelAlterado });
    expect(await acesso.filiacao(usuario, negocio)).toEqual({ papel: "GERENTE", permissoesCustom: null });
    expect((await membroDe(usuario, negocio))?.permissoes).toEqual(MATRIZ_COMPLETA);

    // Os registros da pessoa continuam depois da remoção (ligados ao Usuario).
    const item = await base.item.create({ data: { negocioId: negocio, nome: "Esmalte", tipo: "PRODUTO_FISICO", categoria: "PRODUTOS", unidadeMedida: "un", custoBase: 5 } });
    await base.historicoPreco.create({ data: { negocioId: negocio, itemId: item.id, usuarioId: usuario, preco: 10, origem: "MANUAL" } });

    expect(await servicos.removerMembro(membroId, await deps(dono))).toEqual({ status: "ok", mensagem: M.membroRemovido });
    expect(await resolverContextoComPapel(usuario, negocio, acesso.filiacao)).toMatchObject({ negocioId: null, negocioRecusado: true, papel: null });
    expect(await base.historicoPreco.count({ where: { usuarioId: usuario } })).toBe(1);

    // A vaga do plano gratuito foi liberada.
    await convidar("nova@exemplo.com");
  });

  it("T15 — o Dono não é alterado, removido nem convidado como Dono (CA-13, INV-002)", async () => {
    const donoMembro = await base.membroNegocio.findFirstOrThrow({ where: { usuarioId: dono } });
    const d = await deps(dono);
    expect(await servicos.alterarPapel(donoMembro.id, "COLABORADOR", d)).toEqual({ status: "erro", mensagem: M.alvoEhDono });
    expect(await servicos.alterarPermissoes(donoMembro.id, {}, d)).toEqual({ status: "erro", mensagem: M.alvoEhDono });
    expect(await servicos.removerMembro(donoMembro.id, d)).toEqual({ status: "erro", mensagem: M.alvoEhDono });
    expect(await servicos.sairDoNegocio(negocio, await deps(dono))).toEqual({ status: "erro", mensagem: M.donoNaoSai });

    const { membroId } = await entrarNaEquipe("colab@exemplo.com");
    expect(await servicos.alterarPapel(membroId, "DONO", d)).toMatchObject({ status: "erro" });
    expect(await acesso.filiacao(dono, negocio)).toEqual({ papel: "DONO", permissoesCustom: null });
    expect(await base.membroNegocio.count({ where: { negocioId: negocio, papel: "DONO" } })).toBe(1);
  });

  it("T16 — o papel segue o negócio ativo (CA-15, RNF07)", async () => {
    const { usuario } = await entrarNaEquipe("colab@exemplo.com");
    const proprio = await novoNegocio(usuario, "Negócio da Joana");
    const noMeu = await membroDe(usuario, proprio);
    const noOutro = await membroDe(usuario, negocio);
    expect(noMeu).toMatchObject({ papel: "DONO" });
    expect(noOutro).toMatchObject({ papel: "COLABORADOR" });
    expect(pode(noOutro!.permissoes, "financeiro", "ver")).toBe(false);
  });

  it("T21 — sair do negócio: perde o acesso, limpa o negócio ativo e libera a vaga (CA-18, OPEN-007)", async () => {
    const { usuario } = await entrarNaEquipe("colab@exemplo.com");
    ativo = negocio;
    expect(await servicos.sairDoNegocio(negocio, await deps(usuario))).toEqual({ status: "ok", mensagem: "Você saiu do negócio." });
    expect(ativo).toBeNull();
    expect(await acesso.filiacao(usuario, negocio)).toBeNull();
    await convidar("nova@exemplo.com");
  });

  it("lista a equipe com o Dono primeiro e só os convites pendentes válidos", async () => {
    await base.negocio.update({ where: { id: negocio }, data: { plano: "PAGO" } });
    await entrarNaEquipe("colab@exemplo.com");
    await convidar("pendente@exemplo.com", "GERENTE");
    await convidar("vencido@exemplo.com");
    await base.convite.updateMany({ where: { email: "vencido@exemplo.com" }, data: { expiraEm: new Date(agora.getTime() - 1000) } });

    const { membros, convites } = await consultas.doNegocio(negocio).listar(agora);
    expect(membros.map((m) => m.papel)).toEqual(["DONO", "COLABORADOR"]);
    expect(convites.map((c) => c.email)).toEqual(["pendente@exemplo.com"]);
    expect((await base.convite.findFirstOrThrow({ where: { email: "vencido@exemplo.com" } })).status).toBe("EXPIRADO");
  });
});
