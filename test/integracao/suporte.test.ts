import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { autorizar } from "@/lib/auth/autorizacao";
import { resolverContextoDaRequisicao } from "@/lib/auth/contexto";
import { criarConsultasDeAcesso } from "@/lib/db/acesso";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { SomenteLeituraNoSuporte } from "@/lib/db/erros";
import { criarConsultasDaLgpd } from "@/lib/db/lgpd";
import { criarConsultasDeSuporte, type NegocioNoPainel } from "@/lib/db/suporte";
import { criarConsultasDeVendas } from "@/lib/db/vendas";
import { intervaloDoDia, hoje as hojeLocal } from "@/lib/dominio/datas";
import * as servicos from "@/lib/suporte/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-018 — testes de integração (seção 12): T04 a T11, com banco real, o cliente do negócio,
// os gatilhos da migração e a mesma resolução de contexto da aplicação.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const suporte = criarConsultasDeSuporte(base);
const acesso = criarConsultasDeAcesso(base);
const VERSAO = "2026-10-17";

let dono: string;
let admin: string;
let negocio: string;
let outroNegocio: string;

const agora = () => new Date();

async function usuario(nome: string, email: string, extra: Record<string, unknown> = {}) {
  return (await base.usuario.create({ data: { id: randomUUID(), nome, email, versaoTermosAceita: VERSAO, consentimentoLgpdEm: new Date(), ...extra } })).id;
}

/** Contexto como a aplicação o monta nesta requisição (servidor.ts → obterContexto). */
const contexto = (usuarioId: string, suporteDoCookie?: string, negocioDoCookie?: string) =>
  resolverContextoDaRequisicao(
    { usuarioId, negocioDoCookie, suporteDoCookie, autenticadoEm: new Date(Date.now() - 60_000), agora: new Date(), versaoDosTermos: VERSAO },
    { filiacao: (u, n) => acesso.filiacao(u, n), conta: (u) => acesso.estadoDaConta(u), liberacao: (id) => suporte.liberacaoDoContexto(id) },
  );

const LIBERAR = { motivo: "Vendas de ontem não aparecem no caixa", modulos: ["vendas" as const, "estoque" as const], prazo: "24h" as const };

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  dono = await usuario("Rafael Dono", "dono@exemplo.com");
  admin = await usuario("Vitor Suporte", "suporte@exemplo.com");
  negocio = (await base.negocio.create({ data: { nome: "Salão da Gisele" } })).id;
  outroNegocio = (await base.negocio.create({ data: { nome: "Outro Negócio" } })).id;
  await base.membroNegocio.create({ data: { usuarioId: dono, negocioId: negocio, papel: "DONO" } });
  await base.membroNegocio.create({ data: { usuarioId: dono, negocioId: outroNegocio, papel: "DONO" } });
  expect((await suporte.concederPapel("suporte@exemplo.com", "Equipe", agora())).ok).toBe(true);
});

afterAll(async () => {
  await base.$disconnect();
});

describe("T04 — script: conceder e retirar o papel (INV-004, CA-08)", () => {
  it("recusa conta inexistente, com vínculo, com convite pendente e excluída", async () => {
    expect(await suporte.concederPapel("ninguem@exemplo.com", "Equipe", agora())).toEqual({ ok: false, erro: "ContaInexistente" });
    expect(await suporte.concederPapel("dono@exemplo.com", "Equipe", agora())).toEqual({ ok: false, erro: "ContaComVinculo", negocios: expect.arrayContaining(["Salão da Gisele"]) });

    await usuario("Convidada", "convidada@exemplo.com");
    await base.convite.create({
      data: { negocioId: negocio, email: "convidada@exemplo.com", papel: "COLABORADOR", tokenHash: "x".repeat(64), convidadoPorId: dono, expiraEm: new Date(Date.now() + 86_400_000) },
    });
    expect(await suporte.concederPapel("convidada@exemplo.com", "Equipe", agora())).toEqual({ ok: false, erro: "ConvitePendente" });

    await usuario("Excluída", "excluida@exemplo.com", { excluidoEm: new Date() });
    expect(await suporte.concederPapel("excluida@exemplo.com", "Equipe", agora())).toEqual({ ok: false, erro: "ContaExcluida" });
  });

  it("concede uma vez, registra quem rodou e retira", async () => {
    expect(await suporte.concederPapel("SUPORTE@exemplo.com", "Equipe", agora())).toMatchObject({ ok: true, jaEra: true });
    expect(await suporte.retirarPapel("suporte@exemplo.com", "Vitor", agora())).toEqual({ ok: true, naoEra: false });
    expect(await suporte.retirarPapel("suporte@exemplo.com", "Vitor", agora())).toEqual({ ok: true, naoEra: true });
    const eventos = await base.registroSuporte.findMany({ where: { usuarioId: admin }, orderBy: { criadoEm: "asc" }, select: { evento: true, negocioId: true, descricao: true } });
    expect(eventos).toEqual([
      { evento: "PAPEL_CONCEDIDO", negocioId: null, descricao: "Papel de Administrador concedido por Equipe (script)" },
      { evento: "PAPEL_RETIRADO", negocioId: null, descricao: "Papel de Administrador retirado por Vitor (script)" },
    ]);
    expect((await contexto(admin))?.administrador).toBe(false);
  });
});

describe("T05 — painel: só metadados (INV-009, CA-01)", () => {
  it("lista fechada de campos, busca por nome e por e-mail do Dono", async () => {
    await suporte.liberar(negocio, dono, LIBERAR, agora());
    const { negocios, total } = await suporte.listarNegocios("", 1, agora());
    expect(total).toBe(2);
    const campos: (keyof NegocioNoPainel)[] = ["id", "nome", "regime", "plano", "criadoEm", "membros", "encerrado", "dono", "liberacao"];
    for (const n of negocios) expect(Object.keys(n).sort()).toEqual([...campos].sort());
    const salao = negocios.find((n) => n.id === negocio)!;
    expect(salao).toMatchObject({ membros: 1, encerrado: false, dono: { nome: "Rafael Dono", email: "dono@exemplo.com" }, liberacao: { motivo: LIBERAR.motivo, modulos: ["estoque", "vendas"] } });
    expect(Object.keys(salao.liberacao!).sort()).toEqual(["expiraEm", "id", "modulos", "motivo"]);

    expect((await suporte.listarNegocios("salão", 1, agora())).negocios.map((n) => n.id)).toEqual([negocio]);
    expect((await suporte.listarNegocios("DONO@exemplo", 1, agora())).total).toBe(2);
    expect((await suporte.listarNegocios("nada-disso", 1, agora())).total).toBe(0);
  });
});

describe("T06 — sem liberação ativa, nenhum dado do negócio (INV-001, CA-02)", () => {
  it("sem liberação, com liberação revogada, expirada e de outro negócio", async () => {
    // Sem liberação: o cookie do negócio não vale para o Administrador (não é membro).
    expect(await contexto(admin, undefined, negocio)).toMatchObject({ administrador: true, negocioId: null });
    expect(await contexto(admin, randomUUID(), negocio)).toMatchObject({ negocioId: null, suporte: null });

    const l = (await suporte.liberar(negocio, dono, LIBERAR, agora()))!;
    expect(await contexto(admin, l.id, outroNegocio)).toMatchObject({ negocioId: negocio, suporte: { negocioId: negocio } });

    await suporte.revogar(negocio, l.id, dono, agora());
    expect(await contexto(admin, l.id)).toMatchObject({ negocioId: null, suporteEncerrado: "revogado" });

    const l2 = (await suporte.liberar(negocio, dono, { ...LIBERAR, prazo: "1h" }, agora()))!;
    await base.$executeRaw`UPDATE "AcessoSuporte" SET "criadoEm" = now() - interval '2 hours', "expiraEm" = now() - interval '1 hour' WHERE id = ${l2.id}::uuid`;
    expect(await contexto(admin, l2.id)).toMatchObject({ negocioId: null, suporteEncerrado: "expirou" });
  });

  it("a entrada também é recusada sem liberação ativa", async () => {
    expect(await suporte.entrar(randomUUID(), admin, agora())).toEqual({ ok: false, erro: "SemLiberacao" });
    const l = (await suporte.liberar(negocio, dono, LIBERAR, agora()))!;
    await suporte.revogar(negocio, l.id, dono, agora());
    expect(await suporte.entrar(l.id, admin, agora())).toEqual({ ok: false, erro: "Expirada" });
  });
});

describe("T07 — modo suporte: somente leitura e clientes mascarados (INV-002, INV-006, CA-04, CA-05)", () => {
  it("o cliente do negócio recusa qualquer escrita no modo suporte", async () => {
    const db = comNegocio(base, { negocioId: negocio, usuarioId: admin, modoSuporte: true });
    expect(await db.item.count()).toBe(0);
    await expect(db.cliente.create({ data: { negocioId: negocio, nome: "X" } })).rejects.toThrow(SomenteLeituraNoSuporte);
    await expect(db.cliente.updateMany({ data: { nome: "X" } })).rejects.toThrow(SomenteLeituraNoSuporte);
    await expect(db.cliente.deleteMany({})).rejects.toThrow(SomenteLeituraNoSuporte);
    await expect(db.negocio.update({ where: { id: negocio }, data: { nome: "Outro" } })).rejects.toThrow(SomenteLeituraNoSuporte);
  });

  it("as Server Actions são recusadas com o contexto de suporte lido do banco", async () => {
    const l = (await suporte.liberar(negocio, dono, LIBERAR, agora()))!;
    const c = await contexto(admin, l.id);
    expect(autorizar(c, { tipo: "permissao", modulo: "vendas", acao: "ver" })).toMatchObject({ ok: true, membro: { modoSuporte: true } });
    expect(autorizar(c, { tipo: "permissao", modulo: "vendas", acao: "criar", origem: "acao" })).toEqual({ ok: false, motivo: "SomenteLeitura" });
    expect(autorizar(c, { tipo: "dono", origem: "acao" })).toEqual({ ok: false, motivo: "SomenteLeitura" });
    expect(autorizar(c, { tipo: "sessao", origem: "acao" })).toEqual({ ok: false, motivo: "SomenteLeitura" });
    expect(autorizar(c, { tipo: "permissao", modulo: "financeiro", acao: "ver" })).toEqual({ ok: false, motivo: "SemPermissao" });
  });

  it("vendas: nome do cliente mascarado só no modo suporte", async () => {
    const cliente = await base.cliente.create({ data: { negocioId: negocio, nome: "Maria Silva", telefone: "11988881234" } });
    await base.venda.create({ data: { negocioId: negocio, numero: 1, clienteId: cliente.id, data: new Date(), valorTotal: 50, registradaPorId: dono } });
    const { inicio, fim } = intervaloDoDia(hojeLocal());
    const doSuporte = criarConsultasDeVendas(comNegocio(base, { negocioId: negocio, modoSuporte: true }), negocio, { mascararClientes: true });
    const doDono = criarConsultasDeVendas(comNegocio(base, { negocioId: negocio }), negocio);
    expect((await doSuporte.listar(inicio, fim)).vendas[0].cliente).toBe("M*** S***");
    expect((await doDono.listar(inicio, fim)).vendas[0].cliente).toBe("Maria Silva");
    // SPEC-022: o seletor da venda leva só o nome (mascarado no suporte) e o que falta para a nota.
    expect(await doSuporte.clientes()).toEqual([{ id: cliente.id, nome: "M*** S***", faltando: ["CPF", "endereço"] }]);
    expect(JSON.stringify(await doSuporte.clientes())).not.toContain("1234");
  });
});

describe("T08 — liberar e revogar: só o Dono, uma ativa por negócio (INV-007, CA-03, CA-07)", () => {
  const deps = (papel: "DONO" | "GERENTE", usuarioId = dono): servicos.DependenciasDoDono => ({
    membro: { usuarioId, negocioId: negocio, papel, permissoes: {} as never },
    agora,
    liberar: suporte.liberar,
    revogar: suporte.revogar,
    dono: suporte.donoDoNegocio,
    avisar: () => undefined,
    origem: "http://localhost",
  });
  const campos = { motivo: LIBERAR.motivo, "modulo.vendas": "on", prazo: "24h" };

  it("só o Dono libera; uma nova liberação substitui a ativa, com registro", async () => {
    expect(await servicos.liberar(campos, deps("GERENTE"))).toMatchObject({ status: "erro" });
    expect(await servicos.liberar(campos, deps("DONO"))).toMatchObject({ status: "ok" });
    expect(await servicos.liberar({ ...campos, "modulo.estoque": "on" }, deps("DONO"))).toMatchObject({ status: "ok" });
    const lista = await suporte.liberacoesDoNegocio(negocio);
    expect(lista).toHaveLength(2);
    expect(lista.filter((l) => l.revogadoEm === null)).toHaveLength(1);
    expect(lista[1].eventos.map((e) => e.evento)).toEqual(["LIBERACAO", "REVOGACAO"]);
    expect((await suporte.liberacaoAtiva(negocio, agora()))?.modulos).toEqual(["estoque", "vendas"]);
  });

  it("revogar: só a ativa, uma vez; negócio encerrado não libera", async () => {
    const l = (await suporte.liberar(negocio, dono, LIBERAR, agora()))!;
    expect(await servicos.revogar(l.id, deps("DONO"))).toMatchObject({ status: "ok" });
    expect(await servicos.revogar(l.id, deps("DONO"))).toMatchObject({ status: "erro" });
    expect(await suporte.liberacaoAtiva(negocio, agora())).toBeNull();

    await base.negocio.update({ where: { id: negocio }, data: { encerradoEm: new Date() } });
    expect(await servicos.liberar(campos, deps("DONO"))).toMatchObject({ status: "erro", mensagem: expect.stringContaining("encerrado") });
  });

  it("restrições do banco: prazo máximo de 7 dias e módulos válidos", async () => {
    const criar = (data: Record<string, unknown>) =>
      base.acessoSuporte.create({ data: { negocioId: negocio, liberadoPorId: dono, motivo: "m", modulos: ["vendas"], expiraEm: new Date(Date.now() + 3_600_000), ...data } });
    await expect(criar({ expiraEm: new Date(Date.now() + 8 * 86_400_000) })).rejects.toThrow();
    await expect(criar({ modulos: ["configuracoes"] })).rejects.toThrow();
    await expect(criar({ modulos: [] })).rejects.toThrow();
    await expect(criar({ revogadoEm: new Date() })).rejects.toThrow();
  });
});

describe("T09 — registro de auditoria imutável; entrada, telas e saída (INV-005, CA-06, CA-09)", () => {
  it("entrada (primeira só uma vez), tela com o número da venda e saída", async () => {
    const venda = await base.venda.create({ data: { negocioId: negocio, numero: 15, data: new Date(), valorTotal: 59.99, registradaPorId: dono } });
    const l = (await suporte.liberar(negocio, dono, LIBERAR, agora()))!;
    expect(await suporte.entrar(l.id, admin, agora())).toEqual({ ok: true, primeira: true, negocioId: negocio });
    expect(await suporte.entrar(l.id, admin, agora())).toEqual({ ok: true, primeira: false, negocioId: negocio });
    await suporte.registrarTela(negocio, l.id, admin, { modulo: "vendas", descricao: "Vendas — histórico (01/10 a 17/10)" });
    await suporte.registrarTela(negocio, l.id, admin, { modulo: "vendas", descricao: "Vendas — detalhe de venda", detalhe: { tipo: "venda", id: venda.id } });
    await suporte.sair(negocio, l.id, admin);

    const [lida] = await suporte.liberacoesDoNegocio(negocio);
    expect(lida.eventos.map((e) => [e.evento, e.descricao, e.autor])).toEqual([
      ["LIBERACAO", expect.stringContaining("Liberou Estoque, Vendas até"), "Rafael Dono"],
      ["ENTRADA", "Entrou em modo suporte (somente leitura)", "Vitor Suporte"],
      ["ENTRADA", "Entrou em modo suporte (somente leitura)", "Vitor Suporte"],
      ["TELA", "Vendas — histórico (01/10 a 17/10)", "Vitor Suporte"],
      ["TELA", "Vendas — venda nº 15", "Vitor Suporte"],
      ["SAIDA", "Saiu do modo suporte", "Vitor Suporte"],
    ]);
  });

  it("o banco recusa alterar e apagar o registro", async () => {
    await suporte.liberar(negocio, dono, LIBERAR, agora());
    await expect(base.registroSuporte.updateMany({ data: { descricao: "editado" } })).rejects.toThrow();
    await expect(base.registroSuporte.deleteMany({})).rejects.toThrow();
    expect(await base.registroSuporte.count({ where: { negocioId: negocio } })).toBe(1);
  });

  it("o registro só aponta para uma liberação do mesmo negócio", async () => {
    const l = (await suporte.liberar(negocio, dono, LIBERAR, agora()))!;
    await expect(
      base.registroSuporte.create({ data: { negocioId: outroNegocio, acessoId: l.id, usuarioId: admin, evento: "TELA", descricao: "x" } }),
    ).rejects.toThrow(/he_negocio_divergente/);
  });
});

describe("T10 — LGPD: exportação e exclusão de conta (RNF04, RN27)", () => {
  it("a exportação traz as liberações e o registro; a exclusão revoga a liberação ativa", async () => {
    const lgpd = criarConsultasDaLgpd(base);
    const l = (await suporte.liberar(negocio, dono, LIBERAR, agora()))!;
    await suporte.entrar(l.id, admin, agora());

    const dados = await lgpd.dadosDoTitular(dono, agora());
    const salao = dados!.negociosComoDono.find((g) => g.negocio.id === negocio)!;
    expect(salao.tabelas.acessosSuporte).toHaveLength(1);
    expect(salao.tabelas.registrosSuporte.map((r) => r.evento)).toEqual(expect.arrayContaining(["LIBERACAO", "ENTRADA"]));

    expect(await lgpd.excluirConta(dono, agora())).toMatchObject({ ok: true });
    expect(await suporte.liberacaoAtiva(negocio, agora())).toBeNull();
    expect(await contexto(admin, l.id)).toMatchObject({ negocioId: null, suporte: null });
    expect(await base.registroSuporte.count({ where: { negocioId: negocio } })).toBe(3);
  });

  it("excluir a conta de Administrador retira o papel", async () => {
    expect(await criarConsultasDaLgpd(base).excluirConta(admin, agora())).toMatchObject({ ok: true });
    expect((await base.usuario.findUniqueOrThrow({ where: { id: admin } })).administradorEm).toBeNull();
  });
});

describe("T11 — novo aceite da política e dos termos (INV-008, CA-10)", () => {
  it("versão anterior: só Minha conta até aceitar a vigente", async () => {
    await base.usuario.update({ where: { id: dono }, data: { versaoTermosAceita: "2026-10-03" } });
    const antes = await contexto(dono, undefined, negocio);
    expect(antes?.termosPendentes).toBe(true);
    expect(autorizar(antes, { tipo: "permissao", modulo: "vendas", acao: "ver" })).toEqual({ ok: false, motivo: "TermosPendentes" });
    expect(autorizar(antes, { tipo: "conta" }).ok).toBe(true);

    await acesso.aceitarTermos(dono, VERSAO, agora());
    const depois = await contexto(dono, undefined, negocio);
    expect(depois?.termosPendentes).toBe(false);
    expect(autorizar(depois, { tipo: "permissao", modulo: "vendas", acao: "ver" }).ok).toBe(true);
    expect((await base.usuario.findUniqueOrThrow({ where: { id: dono } })).termosAceitosEm).not.toBeNull();
  });
});
