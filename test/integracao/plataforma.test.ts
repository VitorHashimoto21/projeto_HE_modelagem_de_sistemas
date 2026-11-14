import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDePlanos } from "@/lib/db/planos";
import { criarConsultasDaPlataforma } from "@/lib/db/plataforma";
import { criarConsultasDeSuporte } from "@/lib/db/suporte";
import type { PedidoDePlano } from "@/lib/dominio/plataforma";
import * as servicos from "@/lib/plataforma/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-019, etapa 3a — testes de integração (seção 12): T05 (pedidos com duas pessoas) e T09 (troca de
// plano pela plataforma com as regras do RF73), com o banco real, as checagens e os gatilhos da migração.
// Cobre os CA-15 e CA-16 e o INV-006.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const plataforma = criarConsultasDaPlataforma(base);
const planos = criarConsultasDePlanos(base);
const suporte = criarConsultasDeSuporte(base);

let dono: string;
let adminA: string;
let adminB: string;
let adminC: string;
let comum: string;
let negocio: string;
let outroNegocio: string;

const HORA = 3_600_000;
const PAGO: PedidoDePlano = { para: "PAGO", motivo: "CORTESIA", descricao: "Cortesia de 3 meses combinada no atendimento" };
const GRATUITO: PedidoDePlano = { para: "GRATUITO", motivo: "CORRECAO", descricao: "O plano pago foi ativado por engano" };

async function usuario(nome: string, admin = false) {
  return (await base.usuario.create({ data: { id: randomUUID(), nome, email: `${nome.toLowerCase().replace(/\s+/g, ".")}@exemplo.com`, administradorEm: admin ? new Date() : null } })).id;
}

async function colaborador(nome: string, negocioId = negocio) {
  const u = await usuario(nome);
  return (await base.membroNegocio.create({ data: { usuarioId: u, negocioId, papel: "COLABORADOR" } })).id;
}

async function pedir(dados = PAGO, quem = adminA, agora = new Date(), negocioId = negocio) {
  const r = await plataforma.pedirTrocaDePlano(negocioId, quem, dados, agora);
  if (!r.ok) throw new Error(`pedido recusado: ${r.erro}`);
  return r.id;
}

const plano = async (negocioId = negocio) => (await base.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { plano: true } })).plano;
const eventos = (negocioId = negocio) => base.registroSuporte.findMany({ where: { negocioId }, orderBy: { criadoEm: "asc" }, select: { evento: true, usuarioId: true, pedidoId: true, descricao: true } });

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await base.$executeRawUnsafe(`DELETE FROM auth.mfa_factors`);
  dono = await usuario("Rafael Dono");
  adminA = await usuario("Ana Suporte", true);
  adminB = await usuario("Bruno Suporte", true);
  adminC = await usuario("Carla Suporte", true);
  comum = await usuario("Conta Comum");
  negocio = (await base.negocio.create({ data: { nome: "Salão da Gisele" } })).id;
  outroNegocio = (await base.negocio.create({ data: { nome: "Outro Negócio" } })).id;
  await base.membroNegocio.create({ data: { usuarioId: dono, negocioId: negocio, papel: "DONO" } });
  await base.membroNegocio.create({ data: { usuarioId: dono, negocioId: outroNegocio, papel: "DONO" } });
});

afterAll(async () => {
  await base.$disconnect();
});

describe("T05 — pedido de troca de plano (5.8, item 1)", () => {
  it("fica pendente por 12 h, com o evento PLANO_SOLICITADO na mesma transação", async () => {
    const agora = new Date();
    const r = await plataforma.pedirTrocaDePlano(negocio, adminA, PAGO, agora);
    expect(r).toEqual({ ok: true, id: expect.any(String), expiraEm: new Date(agora.getTime() + 12 * HORA) });
    const p = await base.pedidoPlataforma.findFirstOrThrow({ where: { negocioId: negocio } });
    expect(p).toMatchObject({ tipo: "PLANO", situacao: "PENDENTE", solicitadoPorId: adminA, dados: PAGO, decididoPorId: null, decididoEm: null });
    expect(await eventos()).toEqual([{ evento: "PLANO_SOLICITADO", usuarioId: adminA, pedidoId: p.id, descricao: expect.stringContaining("plano Pago (cortesia)") }]);
    expect(await plano()).toBe("GRATUITO");
  });

  it("um pendente por negócio: o segundo pedido é recusado; em outro negócio, vale", async () => {
    await pedir();
    expect(await plataforma.pedirTrocaDePlano(negocio, adminB, PAGO, new Date())).toEqual({ ok: false, erro: "PedidoPendente" });
    expect((await plataforma.pedirTrocaDePlano(outroNegocio, adminB, PAGO, new Date())).ok).toBe(true);
    // O índice único parcial recusa também uma gravação direta.
    await expect(
      base.pedidoPlataforma.create({ data: { tipo: "PLANO", negocioId: negocio, solicitadoPorId: adminB, dados: PAGO, expiraEm: new Date(Date.now() + HORA) } }),
    ).rejects.toThrow();
  });

  it("recusa o mesmo plano, negócio encerrado e negócio inexistente; aceita negócio suspenso", async () => {
    expect(await plataforma.pedirTrocaDePlano(negocio, adminA, GRATUITO, new Date())).toEqual({ ok: false, erro: "MesmoPlano", plano: "GRATUITO" });
    expect(await plataforma.pedirTrocaDePlano(randomUUID(), adminA, PAGO, new Date())).toEqual({ ok: false, erro: "NegocioInexistente" });
    await base.negocio.update({ where: { id: outroNegocio }, data: { encerradoEm: new Date() } });
    expect(await plataforma.pedirTrocaDePlano(outroNegocio, adminA, PAGO, new Date())).toEqual({ ok: false, erro: "NegocioEncerrado" });
    expect(await base.pedidoPlataforma.count()).toBe(0);
  });

  it("o banco recusa dados fora da lista e prazo acima de 12 h", async () => {
    const criar = (dados: object, horas = 12) =>
      base.pedidoPlataforma.create({ data: { tipo: "PLANO", negocioId: negocio, solicitadoPorId: adminA, dados, criadoEm: new Date(), expiraEm: new Date(Date.now() + horas * HORA) } });
    await expect(criar({ ...PAGO, motivo: "AMIZADE" })).rejects.toThrow(/PedidoPlataforma_dados/);
    await expect(criar({ ...PAGO, descricao: " " })).rejects.toThrow(/PedidoPlataforma_dados/);
    await expect(criar({ ...PAGO, descricao: "x".repeat(301) })).rejects.toThrow(/PedidoPlataforma_dados/);
    await expect(criar({ motivo: "CORTESIA", descricao: "sem o plano" })).rejects.toThrow(/PedidoPlataforma_dados/);
    await expect(criar({ para: "PAGO", motivo: "CORTESIA" })).rejects.toThrow(/PedidoPlataforma_dados/);
    await expect(criar(PAGO, 13)).rejects.toThrow(/PedidoPlataforma_prazo/);
  });
});

describe("T05 — duas pessoas (INV-006, CA-15, CA-16)", () => {
  it("quem pediu não aprova nem recusa o próprio pedido; o banco também recusa", async () => {
    const id = await pedir();
    expect(await plataforma.decidirTrocaDePlano(id, adminA, { aprovar: true }, new Date())).toEqual({ ok: false, erro: "MesmoAdministrador" });
    expect(await plataforma.decidirTrocaDePlano(id, adminA, { aprovar: false, motivo: "Não" }, new Date())).toEqual({ ok: false, erro: "MesmoAdministrador" });
    await expect(base.$executeRawUnsafe(`UPDATE "PedidoPlataforma" SET "situacao" = 'APROVADO', "decididoPorId" = '${adminA}', "decididoEm" = now() WHERE "id" = '${id}'`)).rejects.toThrow(
      /PedidoPlataforma_duas_pessoas/,
    );
    expect(await plano()).toBe("GRATUITO");
  });

  it("uma conta comum não decide", async () => {
    const id = await pedir();
    expect(await plataforma.decidirTrocaDePlano(id, comum, { aprovar: true }, new Date())).toEqual({ ok: false, erro: "NaoEAdministrador" });
    expect(await plano()).toBe("GRATUITO");
  });

  it("CA-15: B aprova, o plano muda pela plataforma com o motivo no histórico, e A não aprova o próprio", async () => {
    const suspenso = await colaborador("Suspensa");
    await base.membroNegocio.update({ where: { id: suspenso }, data: { suspensoEm: new Date() } });
    const id = await pedir();
    const agora = new Date();
    const r = await plataforma.decidirTrocaDePlano(id, adminB, { aprovar: true }, agora);
    expect(r).toEqual({ ok: true, tipo: "PLANO", situacao: "APROVADO", negocioId: negocio, pedido: PAGO, suspensos: 0, reativados: 1, convitesCancelados: 0 });

    const n = await base.negocio.findUniqueOrThrow({ where: { id: negocio }, select: { plano: true, planoAlteradoPorId: true, planoAlteradoEm: true } });
    expect(n).toEqual({ plano: "PAGO", planoAlteradoPorId: adminB, planoAlteradoEm: agora });
    expect(await base.membroNegocio.findUniqueOrThrow({ where: { id: suspenso }, select: { suspensoEm: true } })).toEqual({ suspensoEm: null });
    expect(await base.historicoPlano.findMany({ select: { de: true, para: true, usuarioId: true, pedidoId: true, motivo: true } })).toEqual([
      { de: "GRATUITO", para: "PAGO", usuarioId: adminB, pedidoId: id, motivo: PAGO.descricao },
    ]);
    expect(await base.pedidoPlataforma.findUniqueOrThrow({ where: { id } })).toMatchObject({ situacao: "APROVADO", decididoPorId: adminB, decididoEm: agora });
    expect((await eventos()).map((e) => [e.evento, e.usuarioId, e.pedidoId])).toEqual([
      ["PLANO_SOLICITADO", adminA, id],
      ["PLANO_APROVADO", adminB, id],
    ]);

    // A tela Plano do Dono mostra a troca "pela plataforma", com o motivo e a descrição.
    const s = await planos.doNegocio(negocio).situacao(new Date());
    expect(s?.historico).toEqual([{ id: expect.any(String), de: "GRATUITO", para: "PAGO", em: agora, por: "Bruno Suporte", plataforma: { motivo: "CORTESIA", descricao: PAGO.descricao } }]);
  });

  it("aprovação dupla: a segunda é recusada; duas aprovações ao mesmo tempo trocam o plano uma vez só", async () => {
    const id = await pedir();
    const [b, c] = await Promise.all([
      plataforma.decidirTrocaDePlano(id, adminB, { aprovar: true }, new Date()),
      plataforma.decidirTrocaDePlano(id, adminC, { aprovar: true }, new Date()),
    ]);
    expect([b.ok, c.ok].sort()).toEqual([false, true]);
    expect([b, c].find((x) => !x.ok)).toEqual({ ok: false, erro: "PedidoJaDecidido" });
    expect(await base.historicoPlano.count()).toBe(1);
    expect(await plataforma.decidirTrocaDePlano(id, adminC, { aprovar: false, motivo: "Tarde" }, new Date())).toEqual({ ok: false, erro: "PedidoJaDecidido" });
  });

  it("recusa com motivo: o plano não muda e o registro guarda quem recusou", async () => {
    const id = await pedir();
    const r = await plataforma.decidirTrocaDePlano(id, adminB, { aprovar: false, motivo: "Sem combinação com o Dono" }, new Date());
    expect(r).toEqual({ ok: true, tipo: "PLANO", situacao: "RECUSADO", negocioId: negocio, pedido: PAGO });
    expect(await base.pedidoPlataforma.findUniqueOrThrow({ where: { id } })).toMatchObject({ situacao: "RECUSADO", decididoPorId: adminB, motivoDaRecusa: "Sem combinação com o Dono" });
    expect((await eventos()).map((e) => e.evento)).toEqual(["PLANO_SOLICITADO", "PLANO_RECUSADO"]);
    expect(await plano()).toBe("GRATUITO");
    expect(await base.historicoPlano.count()).toBe(0);
  });

  it("CA-16: com uma conta só, o pedido fica pendente até expirar em 12 h, sem como aprovar", async () => {
    await base.usuario.updateMany({ where: { id: { in: [adminB, adminC] } }, data: { administradorEm: null } });
    const criado = new Date(Date.now() - 11 * HORA);
    const id = await pedir(PAGO, adminA, criado);
    expect(await plataforma.decidirTrocaDePlano(id, adminA, { aprovar: true }, new Date())).toEqual({ ok: false, erro: "MesmoAdministrador" });
    expect(await plataforma.decidirTrocaDePlano(id, adminB, { aprovar: true }, new Date())).toEqual({ ok: false, erro: "NaoEAdministrador" });
    expect((await plataforma.pedidosPendentes(new Date())).map((p) => p.id)).toEqual([id]);

    // Depois das 12 h: a leitura já o mostra expirado, e a primeira escrita o marca no banco.
    const depois = new Date(criado.getTime() + 12 * HORA + 1000);
    expect(await plataforma.pedidosPendentes(depois)).toEqual([]);
    expect((await plataforma.pedidosDecididos(depois))[0]).toMatchObject({ id, situacao: "EXPIRADO", decididoEm: new Date(criado.getTime() + 12 * HORA) });
    expect(await plataforma.decidirTrocaDePlano(id, adminA, { aprovar: true }, depois)).toEqual({ ok: false, erro: "PedidoExpirado" });
    expect(await base.pedidoPlataforma.findUniqueOrThrow({ where: { id } })).toMatchObject({ situacao: "EXPIRADO", decididoPorId: null, decididoEm: new Date(criado.getTime() + 12 * HORA) });
    expect(await plano()).toBe("GRATUITO");
  });

  it("pedido vencido não é aprovado por B, e um novo pedido pode ser feito no lugar dele", async () => {
    const criado = new Date(Date.now() - 13 * HORA);
    const vencido = await pedir(PAGO, adminA, criado);
    expect(await plataforma.decidirTrocaDePlano(vencido, adminB, { aprovar: true }, new Date())).toEqual({ ok: false, erro: "PedidoExpirado" });

    const outro = await pedir(PAGO, adminA, new Date(Date.now() - 13 * HORA), outroNegocio);
    // O novo pedido marca o vencido como expirado na mesma transação (o índice permite um só pendente).
    const novo = await pedir(PAGO, adminB, new Date(), outroNegocio);
    expect(await base.pedidoPlataforma.findUniqueOrThrow({ where: { id: outro }, select: { situacao: true } })).toEqual({ situacao: "EXPIRADO" });
    expect(await base.pedidoPlataforma.findUniqueOrThrow({ where: { id: novo }, select: { situacao: true } })).toEqual({ situacao: "PENDENTE" });
  });

  it("quem pediu cancela o próprio pedido; outra conta não cancela; depois, um novo pedido vale", async () => {
    const id = await pedir();
    expect(await plataforma.cancelar(id, adminB, new Date())).toEqual({ ok: false, erro: "SoQuemPediu" });
    expect(await plataforma.cancelar(id, adminA, new Date())).toEqual({ ok: true });
    expect(await base.pedidoPlataforma.findUniqueOrThrow({ where: { id } })).toMatchObject({ situacao: "CANCELADO", decididoPorId: null, decididoEm: expect.any(Date) });
    expect(await plataforma.cancelar(id, adminA, new Date())).toEqual({ ok: false, erro: "PedidoJaDecidido" });
    expect(await plataforma.decidirTrocaDePlano(id, adminB, { aprovar: true }, new Date())).toEqual({ ok: false, erro: "PedidoJaDecidido" });
    expect((await plataforma.pedirTrocaDePlano(negocio, adminB, PAGO, new Date())).ok).toBe(true);
  });

  it("quem pediu perdeu o papel: o pedido não é aprovado, mas pode ser recusado", async () => {
    const id = await pedir();
    await base.usuario.update({ where: { id: adminA }, data: { administradorEm: null } });
    expect(await plataforma.decidirTrocaDePlano(id, adminB, { aprovar: true }, new Date())).toEqual({ ok: false, erro: "SolicitanteSemPapel" });
    expect((await plataforma.decidirTrocaDePlano(id, adminB, { aprovar: false, motivo: "Conta sem o papel" }, new Date())).ok).toBe(true);
  });

  it("negócio encerrado depois do pedido: a aprovação é recusada; o Dono trocou antes: também", async () => {
    const id = await pedir();
    await base.negocio.update({ where: { id: negocio }, data: { encerradoEm: new Date() } });
    expect(await plataforma.decidirTrocaDePlano(id, adminB, { aprovar: true }, new Date())).toEqual({ ok: false, erro: "NegocioEncerrado" });

    const outro = await pedir(PAGO, adminA, new Date(), outroNegocio);
    expect((await planos.doNegocio(outroNegocio).alterarPlano("PAGO", dono, null, new Date())).ok).toBe(true);
    expect(await plataforma.decidirTrocaDePlano(outro, adminB, { aprovar: true }, new Date())).toEqual({ ok: false, erro: "MesmoPlano", plano: "PAGO" });
  });
});

describe("T09 — troca pela plataforma com as regras do RF73", () => {
  async function paraOPago() {
    const id = await pedir(PAGO);
    expect((await plataforma.decidirTrocaDePlano(id, adminB, { aprovar: true }, new Date())).ok).toBe(true);
  }

  it("de volta ao gratuito com um colaborador: ele continua; o convite pendente é cancelado", async () => {
    const unica = await colaborador("Única");
    await base.convite.create({ data: { negocioId: negocio, email: "nova@exemplo.com", tokenHash: randomUUID(), expiraEm: new Date(Date.now() + 86_400_000), convidadoPorId: dono } });
    await paraOPago();
    const id = await pedir(GRATUITO, adminB);
    const r = await plataforma.decidirTrocaDePlano(id, adminC, { aprovar: true }, new Date());
    expect(r).toMatchObject({ ok: true, situacao: "APROVADO", suspensos: 0, convitesCancelados: 1 });
    expect(await base.membroNegocio.findUniqueOrThrow({ where: { id: unica }, select: { suspensoEm: true } })).toEqual({ suspensoEm: null });
    expect(await plano()).toBe("GRATUITO");
  });

  it("de volta ao gratuito com dois colaboradores: os dois ficam sem acesso até o Dono escolher; nada é apagado", async () => {
    const a = await colaborador("Primeira");
    const b = await colaborador("Segundo");
    await paraOPago();
    const id = await pedir(GRATUITO, adminA);
    const r = await plataforma.decidirTrocaDePlano(id, adminB, { aprovar: true }, new Date());
    expect(r).toMatchObject({ ok: true, suspensos: 2 });
    const membros = await base.membroNegocio.findMany({ where: { id: { in: [a, b] } }, select: { suspensoEm: true } });
    expect(membros.every((m) => m.suspensoEm !== null)).toBe(true);
    // O Dono escolhe quem volta pela troca de acesso do gratuito (SPEC-013, OPEN-001).
    expect(await planos.doNegocio(negocio).trocarAcesso(a, null, new Date())).toEqual({ ok: true });
    expect(await base.membroNegocio.count({ where: { negocioId: negocio } })).toBe(3);
    // Histórico: a primeira troca pela plataforma e a volta, também pela plataforma.
    const historico = await base.historicoPlano.findMany({ orderBy: { createdAt: "asc" }, select: { para: true, pedidoId: true } });
    expect(historico.map((h) => h.para)).toEqual(["PAGO", "GRATUITO"]);
    expect(historico.every((h) => h.pedidoId !== null)).toBe(true);
  });

});

describe("integridade (INV-006, isolamento e só a decisão muda)", () => {
  it("pedido decidido não muda e nenhum pedido é apagado", async () => {
    const id = await pedir();
    await expect(base.$executeRawUnsafe(`UPDATE "PedidoPlataforma" SET "dados" = '{"para":"GRATUITO","motivo":"TESTE","descricao":"x"}' WHERE "id" = '${id}'`)).rejects.toThrow(/só a decisão/);
    await expect(base.$executeRawUnsafe(`DELETE FROM "PedidoPlataforma" WHERE "id" = '${id}'`)).rejects.toThrow(/não são apagados/);
    expect((await plataforma.decidirTrocaDePlano(id, adminB, { aprovar: false, motivo: "Não" }, new Date())).ok).toBe(true);
    await expect(base.$executeRawUnsafe(`UPDATE "PedidoPlataforma" SET "motivoDaRecusa" = 'Outro' WHERE "id" = '${id}'`)).rejects.toThrow(/já foi decidido/);
  });

  it("a situação vem com os campos dela (CHECK)", async () => {
    const id = await pedir();
    await expect(base.$executeRawUnsafe(`UPDATE "PedidoPlataforma" SET "situacao" = 'RECUSADO', "decididoPorId" = '${adminB}', "decididoEm" = now() WHERE "id" = '${id}'`)).rejects.toThrow(
      /PedidoPlataforma_decisao/,
    );
    await expect(base.$executeRawUnsafe(`UPDATE "PedidoPlataforma" SET "situacao" = 'APROVADO' WHERE "id" = '${id}'`)).rejects.toThrow(/PedidoPlataforma_decisao/);
  });

  it("o histórico e o registro só apontam pedidos do mesmo negócio; os eventos de plano exigem o pedido", async () => {
    const id = await pedir(PAGO, adminA, new Date(), outroNegocio);
    await expect(
      base.historicoPlano.create({ data: { negocioId: negocio, de: "GRATUITO", para: "PAGO", usuarioId: adminB, pedidoId: id, motivo: "x" } }),
    ).rejects.toThrow(/he_mesmo_negocio|negócio/i);
    await expect(base.registroSuporte.create({ data: { negocioId: negocio, usuarioId: adminB, evento: "PLANO_APROVADO", descricao: "x", pedidoId: id } })).rejects.toThrow(
      /he_mesmo_negocio|negócio/i,
    );
    await expect(base.registroSuporte.create({ data: { negocioId: negocio, usuarioId: adminB, evento: "PLANO_APROVADO", descricao: "x" } })).rejects.toThrow(
      /RegistroSuporte_evento_do_pedido/,
    );
    await expect(base.historicoPlano.create({ data: { negocioId: negocio, de: "GRATUITO", para: "PAGO", usuarioId: dono, motivo: "sem pedido" } })).rejects.toThrow(
      /HistoricoPlano_pela_plataforma/,
    );
  });

  it("os eventos de plano são só de inclusão (RN32)", async () => {
    await pedir();
    await expect(base.$executeRawUnsafe(`UPDATE "RegistroSuporte" SET "descricao" = 'x'`)).rejects.toThrow(/he_somente_insercao/);
    await expect(base.$executeRawUnsafe(`DELETE FROM "RegistroSuporte"`)).rejects.toThrow(/he_somente_insercao/);
  });

  it("RLS ligado e nenhuma política na tabela de pedidos (só o servidor lê)", async () => {
    const [t] = await base.$queryRaw<{ rls: boolean }[]>`SELECT relrowsecurity AS rls FROM pg_class WHERE relname = 'PedidoPlataforma'`;
    expect(t.rls).toBe(true);
    const politicas = await base.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_policies WHERE tablename = 'PedidoPlataforma'`;
    expect(politicas[0].n).toBe(0);
  });
});

describe("leituras do painel e do Dono (5.9 e 5.10)", () => {
  it("pendentes de todos os negócios, decididos e os do negócio, com os nomes", async () => {
    const id = await pedir();
    const outro = await pedir(PAGO, adminB, new Date(), outroNegocio);
    await plataforma.decidirTrocaDePlano(outro, adminC, { aprovar: false, motivo: "Sem combinação" }, new Date());

    expect((await plataforma.pedidosPendentes(new Date())).map((p) => [p.id, p.negocio, p.solicitadoPor, p.plano?.para])).toEqual([[id, "Salão da Gisele", "Ana Suporte", "PAGO"]]);
    expect(await plataforma.pedidosDecididos(new Date())).toEqual([
      expect.objectContaining({ id: outro, negocio: "Outro Negócio", situacao: "RECUSADO", decididoPor: "Carla Suporte", motivoDaRecusa: "Sem combinação" }),
    ]);
    expect((await plataforma.pedidosDoNegocio(negocio, new Date())).map((p) => p.id)).toEqual([id]);
  });

  it("Administradores: as contas com o papel e os autenticadores ativos (auth.mfa_factors)", async () => {
    await base.$executeRawUnsafe(
      `INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status) VALUES
        ('${randomUUID()}', '${adminA}', 'Celular', 'totp', 'verified'),
        ('${randomUUID()}', '${adminA}', 'Gerenciador', 'totp', 'verified'),
        ('${randomUUID()}', '${adminB}', 'Celular', 'totp', 'verified'),
        ('${randomUUID()}', '${adminB}', 'Pendente', 'totp', 'unverified')`,
    );
    const lista = await plataforma.administradores();
    expect(lista.map((a) => [a.nome, a.autenticadores])).toEqual([
      ["Ana Suporte", 2],
      ["Bruno Suporte", 1],
      ["Carla Suporte", 0],
    ]);
    expect(lista.every((a) => a.desde instanceof Date)).toBe(true);
  });
});

describe("fluxos (servicos.ts) com o banco: mensagens e o aviso ao Dono", () => {
  const avisos: { para: string; assunto: string; texto: string }[] = [];
  const deps = (administradorId: string): servicos.DependenciasDaPlataforma => ({
    administradorId,
    agora: () => new Date(),
    pedirTrocaDePlano: plataforma.pedirTrocaDePlano,
    pedirEmergencia: plataforma.pedirEmergencia,
    decidir: plataforma.decidir,
    entrarNaEmergencia: suporte.entrarNaEmergencia,
    suspender: plataforma.suspender,
    reativar: plataforma.reativar,
    registrarResultado: suporte.registrarResultado,
    cancelar: plataforma.cancelar,
    dono: suporte.donoDoNegocio,
    avisar: (m) => avisos.push(m),
    origem: "https://he.exemplo.com",
  });

  it("A pede, A não aprova, B aprova e o Dono recebe o e-mail com o motivo", async () => {
    avisos.length = 0;
    const pedido = await servicos.pedirTrocaDePlano({ negocioId: negocio, para: "PAGO", motivo: "CORTESIA", descricao: "  Cortesia   de 3 meses " }, deps(adminA));
    expect(pedido).toEqual({ status: "ok", mensagem: expect.stringContaining("Outra conta de Administrador precisa aprovar até") });
    const id = (await base.pedidoPlataforma.findFirstOrThrow({ select: { id: true, dados: true } })).id;
    expect((await base.pedidoPlataforma.findUniqueOrThrow({ where: { id } })).dados).toEqual({ para: "PAGO", motivo: "CORTESIA", descricao: "Cortesia de 3 meses" });

    expect(await servicos.aprovar({ pedidoId: id }, deps(adminA))).toEqual({ status: "erro", mensagem: expect.stringContaining("Ninguém aprova") });
    expect(avisos).toEqual([]);
    expect(await servicos.aprovar({ pedidoId: id }, deps(adminB))).toEqual({ status: "ok", mensagem: expect.stringContaining("plano pago") });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ para: "rafael.dono@exemplo.com", assunto: "O plano do Salão da Gisele mudou para Pago pela plataforma do HE" });
    expect(avisos[0].texto).toContain("Motivo: Cortesia — Cortesia de 3 meses");
  });

  it("a recusa exige o motivo, e o pedido repetido explica o pendente", async () => {
    await servicos.pedirTrocaDePlano({ negocioId: negocio, para: "PAGO", motivo: "TESTE", descricao: "Teste" }, deps(adminA));
    expect(await servicos.pedirTrocaDePlano({ negocioId: negocio, para: "PAGO", motivo: "TESTE", descricao: "De novo" }, deps(adminB))).toEqual({
      status: "erro",
      mensagem: expect.stringContaining("pendente"),
    });
    const id = (await base.pedidoPlataforma.findFirstOrThrow({ select: { id: true } })).id;
    expect(await servicos.recusar({ pedidoId: id, motivoDaRecusa: "   " }, deps(adminB))).toEqual({ status: "erro", mensagem: "Conte por que o pedido foi recusado." });
    expect(await servicos.recusar({ pedidoId: id, motivoDaRecusa: "Sem combinação" }, deps(adminB))).toEqual({ status: "ok", mensagem: expect.stringContaining("recusado") });
  });
});
