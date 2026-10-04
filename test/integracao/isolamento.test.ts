import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { NegocioDivergente, OperacaoForaDoContexto } from "@/lib/db/erros";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());

let negocioA: string;
let negocioB: string;
let usuario: string;

const novoItem = (nome: string) => ({
  tipo: "PRODUTO_FISICO" as const,
  nome,
  categoria: "PRODUTOS" as const,
  unidadeMedida: "un",
  custoBase: 10,
});

async function limparBanco() {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const lista = tabelas.map((t) => `"${t.tablename}"`).join(", ");
  await base.$executeRawUnsafe(`TRUNCATE ${lista} CASCADE`);
}

beforeEach(async () => {
  await limparBanco();
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Ana", email: "ana@teste.dev" } })).id;
  negocioA = (await base.negocio.create({ data: { nome: "Negócio A" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Negócio B" } })).id;
  await base.item.createMany({
    data: [
      { ...novoItem("Item A1"), negocioId: negocioA },
      { ...novoItem("Item A2"), negocioId: negocioA },
      { ...novoItem("Item B1"), negocioId: negocioB },
    ],
  });
});

afterAll(async () => {
  await base.$disconnect();
});

const itemDe = async (negocioId: string) =>
  (await base.item.findFirstOrThrow({ where: { negocioId }, orderBy: { nome: "asc" } })).id;

// T01 — CA-03, INV-002
describe("isolamento na leitura", () => {
  it("cada contexto vê só os próprios itens (findMany, count, aggregate)", async () => {
    const a = comNegocio(base, { negocioId: negocioA });
    const itens = await a.item.findMany();
    expect(itens.map((i) => i.nome).sort()).toEqual(["Item A1", "Item A2"]);
    expect(await a.item.count()).toBe(2);
    expect((await a.item.aggregate({ _count: true }))._count).toBe(2);
  });

  it("um filtro por outro negocioId é somado ao contexto: não encontra nada", async () => {
    const a = comNegocio(base, { negocioId: negocioA });
    expect(await a.item.findMany({ where: { negocioId: negocioB } })).toEqual([]);
    expect(await a.item.findMany({ where: { OR: [{ negocioId: negocioB }, { nome: "Item B1" }] } })).toEqual([]);
  });
});

// T02 — CA-04, INV-003
describe("registro de outro negócio é indistinguível de inexistente", () => {
  it("busca por id retorna null, como um id inexistente", async () => {
    const a = comNegocio(base, { negocioId: negocioA });
    const itemB = await itemDe(negocioB);
    expect(await a.item.findUnique({ where: { id: itemB } })).toBeNull();
    expect(await a.item.findUnique({ where: { id: randomUUID() } })).toBeNull();
  });

  it("alterar ou excluir dá o mesmo erro de registro inexistente e não muda nada", async () => {
    const a = comNegocio(base, { negocioId: negocioA });
    const itemB = await itemDe(negocioB);
    const codigo = async (p: Promise<unknown>) => (await p.then(() => null, (e) => e))?.code;

    const inexistente = await codigo(a.item.update({ where: { id: randomUUID() }, data: { nome: "x" } }));
    expect(await codigo(a.item.update({ where: { id: itemB }, data: { nome: "x" } }))).toBe(inexistente);
    expect(await codigo(a.item.delete({ where: { id: itemB } }))).toBe(inexistente);
    expect((await a.item.updateMany({ where: { id: itemB }, data: { nome: "x" } })).count).toBe(0);
    expect((await a.item.deleteMany({ where: { id: itemB } })).count).toBe(0);

    const intacto = await base.item.findUniqueOrThrow({ where: { id: itemB } });
    expect(intacto.nome).toBe("Item B1");
  });
});

// T04 — CA-06, INV-004
describe("criação", () => {
  it("sem negocioId, grava o negocioId do contexto", async () => {
    const a = comNegocio(base, { negocioId: negocioA });
    const criado = await a.item.create({ data: novoItem("Novo") as never });
    expect(criado.negocioId).toBe(negocioA);
  });

  it("com negocioId ou negócio de outro contexto, recusa", async () => {
    const a = comNegocio(base, { negocioId: negocioA });
    await expect(a.item.create({ data: { ...novoItem("X"), negocioId: negocioB } })).rejects.toThrow(NegocioDivergente);
    await expect(
      a.item.create({ data: { ...novoItem("X"), negocio: { connect: { id: negocioB } } } }),
    ).rejects.toThrow(NegocioDivergente);
    await expect(
      a.item.createMany({ data: [{ ...novoItem("X"), negocioId: negocioB }] }),
    ).rejects.toThrow(NegocioDivergente);
    expect(await base.item.count({ where: { nome: "X" } })).toBe(0);
  });

  it("createMany grava todos no negócio do contexto", async () => {
    const a = comNegocio(base, { negocioId: negocioA });
    await a.item.createMany({ data: [novoItem("L1"), novoItem("L2")] as never });
    expect(await base.item.count({ where: { negocioId: negocioA, nome: { in: ["L1", "L2"] } } })).toBe(2);
  });

  it("o negocioId não pode ser alterado (cliente e banco)", async () => {
    const a = comNegocio(base, { negocioId: negocioA });
    const itemA = await itemDe(negocioA);
    await expect(a.item.update({ where: { id: itemA }, data: { negocioId: negocioB } })).rejects.toThrow(
      NegocioDivergente,
    );
    await expect(base.item.update({ where: { id: itemA }, data: { negocioId: negocioB } })).rejects.toThrow(
      /he_negocio_imutavel/,
    );
  });
});

// T05 — CA-07, INV-005
describe("registros filhos", () => {
  async function criarVendaEm(negocioId: string) {
    const ctx = comNegocio(base, { negocioId });
    const item = await itemDe(negocioId);
    return ctx.venda.create({
      data: {
        valorTotal: 20,
        itens: { create: [{ itemId: item, quantidade: 2, precoUnitario: 10, custoUnitario: 6 }] },
        pagamentos: { create: [{ forma: "PIX", valor: 20 }] },
      } as never,
      include: { itens: true, pagamentos: true },
    });
  }

  it("criações aninhadas recebem o negocioId do contexto", async () => {
    const venda = await criarVendaEm(negocioB);
    expect(venda.negocioId).toBe(negocioB);
    expect(venda.itens.every((i) => i.negocioId === negocioB)).toBe(true);
    expect(venda.pagamentos.every((p) => p.negocioId === negocioB)).toBe(true);
  });

  it("itens e pagamentos de venda de outro negócio não aparecem", async () => {
    const vendaB = await criarVendaEm(negocioB);
    const a = comNegocio(base, { negocioId: negocioA });
    expect(await a.itemVenda.findMany({ where: { vendaId: vendaB.id } })).toEqual([]);
    expect(await a.pagamento.findMany({ where: { vendaId: vendaB.id } })).toEqual([]);
    expect(await a.venda.findUnique({ where: { id: vendaB.id }, include: { itens: true } })).toBeNull();
  });

  it("filho ligado a pai de outro negócio é recusado (cliente e banco)", async () => {
    const vendaB = await criarVendaEm(negocioB);
    const itemA = await itemDe(negocioA);
    const a = comNegocio(base, { negocioId: negocioA });
    await expect(
      a.itemVenda.create({
        data: { vendaId: vendaB.id, itemId: itemA, quantidade: 1, precoUnitario: 1, custoUnitario: 1 } as never,
      }),
    ).rejects.toThrow(NegocioDivergente);
    await expect(
      base.itemVenda.create({
        data: { negocioId: negocioA, vendaId: vendaB.id, itemId: itemA, quantidade: 1, precoUnitario: 1, custoUnitario: 1 },
      }),
    ).rejects.toThrow(/he_negocio_divergente/);
    expect(await base.itemVenda.count({ where: { negocioId: negocioA } })).toBe(0);
  });

  it("movimentação de estoque com usuário (global) e venda do mesmo negócio é aceita", async () => {
    const vendaA = await criarVendaEm(negocioA);
    const a = comNegocio(base, { negocioId: negocioA, usuarioId: usuario });
    const mov = await a.movimentacaoEstoque.create({
      data: {
        itemId: await itemDe(negocioA),
        vendaId: vendaA.id,
        usuarioId: usuario,
        tipo: "SAIDA_VENDA",
        quantidade: 2,
        saldoAnterior: 5,
        saldoPosterior: 3,
      } as never,
    });
    expect(mov.negocioId).toBe(negocioA);
  });
});

describe("âncora e operações fora do contexto", () => {
  it("o negócio do contexto é o único visível e alterável", async () => {
    const a = comNegocio(base, { negocioId: negocioA });
    expect((await a.negocio.findMany()).map((n) => n.id)).toEqual([negocioA]);
    expect((await a.negocio.updateMany({ where: { id: negocioB }, data: { nome: "x" } })).count).toBe(0);
    // Regressão: o filtro do chamador não pode ser sobrescrito pelo do contexto (alteraria o negócio A).
    expect((await base.negocio.findUniqueOrThrow({ where: { id: negocioA } })).nome).toBe("Negócio A");
    expect((await base.negocio.findUniqueOrThrow({ where: { id: negocioB } })).nome).toBe("Negócio B");
    await expect(a.negocio.create({ data: { nome: "outro" } })).rejects.toThrow(OperacaoForaDoContexto);
    await expect(a.negocio.delete({ where: { id: negocioA } })).rejects.toThrow(OperacaoForaDoContexto);
  });
});

// T16 — CA-02, INV-011
describe("RLS", () => {
  it("todas as tabelas do schema public têm RLS ligado", async () => {
    const semRls = await base.$queryRaw<{ relname: string }[]>`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`;
    expect(semRls).toEqual([]);
  });

  it("não existe nenhuma policy (a API pública não lê nem grava)", async () => {
    const policies = await base.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM pg_policies WHERE schemaname = 'public'`;
    expect(Number(policies[0].n)).toBe(0);
  });
});
