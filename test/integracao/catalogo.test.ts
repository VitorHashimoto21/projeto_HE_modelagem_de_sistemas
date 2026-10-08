import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import * as servicos from "@/lib/catalogo/servicos";
import { MENSAGENS_FLUXO_CATALOGO as F } from "@/lib/catalogo/servicos";
import { MENSAGENS_CATALOGO as M } from "@/lib/catalogo/validacao";
import { criarConsultasDoCatalogo } from "@/lib/db/catalogo";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-006 — testes de integração (seção 12): banco real e cliente do negócio (SPEC-001).

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());

let usuario: string;
let negocioA: string;
let negocioB: string;

const depsDe = (negocioId: string) => ({
  catalogo: criarConsultasDoCatalogo(comNegocio(base, { negocioId, usuarioId: usuario }), negocioId),
  usuarioId: usuario,
});
const deps = () => depsDe(negocioA);

const produto = (nome: string, extra: Record<string, string> = {}) => ({
  tipo: "PRODUTO_FISICO",
  nome,
  categoria: "BELEZA",
  unidadeMedida: "un",
  custoBase: "10,00",
  ...extra,
});
const servico = (nome: string, materiais: { materialId: string; quantidade: number | string }[] = [], extra: Record<string, string> = {}) => ({
  tipo: "SERVICO",
  nome,
  categoria: "BELEZA",
  unidadeMedida: "atend",
  custoBase: "20",
  materiais: JSON.stringify(materiais),
  ...extra,
});

async function criar(campos: Record<string, string>, d = deps()) {
  const r = await servicos.criarItem(campos, d);
  if (r.status !== "salvo") throw new Error(`esperava salvo: ${JSON.stringify(r)}`);
  return r.itemId;
}

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Gisele", email: "gisele@exemplo.com" } })).id;
  negocioA = (await base.negocio.create({ data: { nome: "Studio A" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Studio B" } })).id;
});

afterAll(async () => {
  await base.$disconnect();
});

describe("cadastro", () => {
  it("T04 — Produto Físico nasce com estoque zero e sem preço (CA-01, INV-001)", async () => {
    const id = await criar(produto("Esmalte", { quantidadeEstoque: "50" }));
    const item = await base.item.findUniqueOrThrow({ where: { id } });
    expect(item).toMatchObject({ negocioId: negocioA, tipo: "PRODUTO_FISICO", nomeChave: "esmalte", precoAtual: null });
    expect(Number(item.quantidadeEstoque)).toBe(0);
    expect(await base.historicoPreco.count()).toBe(0);
  });

  it("T04 — preço no cadastro vira preço oficial com histórico Manual (CA-02, INV-004)", async () => {
    const id = await criar(produto("Esmalte", { preco: "18,90" }));
    const [h] = await base.historicoPreco.findMany({ where: { itemId: id } });
    expect(h).toMatchObject({ negocioId: negocioA, usuarioId: usuario, origem: "MANUAL", margemAplicada: null });
    expect(Number(h.preco)).toBe(18.9);
    expect(Number((await base.item.findUniqueOrThrow({ where: { id } })).precoAtual)).toBe(18.9);
  });

  it("T05 — serviço com materiais e custo total (CA-03)", async () => {
    const esmalte = await criar(produto("Esmalte", { custoBase: "8" }));
    const algodao = await criar(produto("Algodão", { custoBase: "0,50" }));
    const id = await criar(servico("Manicure", [
      { materialId: esmalte, quantidade: 0.25 },
      { materialId: algodao, quantidade: "2" },
    ]));
    const d = await deps().catalogo.detalhar(id);
    expect(d.materiaisDoServico.map((m) => [m.nome, m.quantidade])).toEqual([["Algodão", 2], ["Esmalte", 0.25]]);
    expect(d.custoTotal).toBe(23); // 20 + 8 × 0,25 + 0,50 × 2
    expect(await base.materialServico.count({ where: { negocioId: negocioA } })).toBe(2);
  });

  it("T06 — materiais inválidos são recusados e nada é gravado (CA-04, INV-003)", async () => {
    const outroServico = await criar(servico("Pedicure"));
    const arquivado = await criar(produto("Lixa"));
    await deps().catalogo.arquivar(arquivado, true);
    const deOutroNegocio = await criar(produto("Acetona"), depsDe(negocioB));
    const esmalte = await criar(produto("Esmalte"));

    for (const materialId of [outroServico, arquivado, deOutroNegocio, randomUUID()]) {
      const r = await servicos.criarItem(servico(`Serviço ${materialId.slice(0, 4)}`, [{ materialId, quantidade: 1 }]), deps());
      expect(r).toMatchObject({ status: "erro", erros: { materiais: M.materiaisInvalidos } });
    }
    expect(await servicos.criarItem(servico("Repetido", [{ materialId: esmalte, quantidade: 1 }, { materialId: esmalte, quantidade: 2 }]), deps()))
      .toMatchObject({ status: "erro", erros: { materiais: M.materialRepetido } });

    const manicure = await criar(servico("Manicure"));
    expect(await servicos.editarItem(manicure, servico("Manicure", [{ materialId: manicure, quantidade: 1 }]), deps()))
      .toMatchObject({ status: "erro", erros: { materiais: M.materiaisInvalidos } });
    expect(await base.materialServico.count()).toBe(0);
  });

  it("T07 — nome duplicado ao criar, editar e reativar (CA-05, INV-008)", async () => {
    const id = await criar(produto("Esmalte Vermelho"));
    expect(await servicos.criarItem(produto("  esmalte   VERMELHO "), deps())).toMatchObject({ status: "erro", erros: { nome: F.nomeDuplicado } });
    const outro = await criar(produto("Esmalte Azul"));
    expect(await servicos.editarItem(outro, produto("Esmalte vermelho"), deps())).toMatchObject({ status: "erro", erros: { nome: F.nomeDuplicado } });

    // Arquivado libera o nome; reativar com o nome ocupado é recusado.
    await deps().catalogo.arquivar(id, true);
    await criar(produto("Esmalte Vermelho"));
    expect(await servicos.arquivarItem(id, false, deps())).toEqual({ ok: false, codigo: "nome-duplicado" });
    // O mesmo nome em outro negócio é permitido.
    await criar(produto("Esmalte Vermelho"), depsDe(negocioB));
  });
});

describe("preço oficial", () => {
  it("T08 — preço manual com histórico (anterior, origem, usuário); igual ao atual é recusado (CA-06, CA-08)", async () => {
    const id = await criar(produto("Esmalte", { preco: "50" }));
    expect(await servicos.definirPreco(id, { preco: "55,00" }, deps())).toEqual({ status: "salvo" });
    expect(await servicos.definirPreco(id, { preco: "55" }, deps())).toMatchObject({ status: "erro", erros: { preco: F.precoIgual } });
    await servicos.definirPreco(id, { preco: "60" }, deps());

    const d = await deps().catalogo.detalhar(id);
    expect(d.precoAtual).toBe(60);
    expect(d.historico.map((h) => [h.preco, h.anterior, h.origem, h.usuario])).toEqual([
      [60, 55, "MANUAL", "Gisele"],
      [55, 50, "MANUAL", "Gisele"],
      [50, null, "MANUAL", "Gisele"],
    ]);
  });

  it("CA-07 — preço abaixo do custo grava com aviso", async () => {
    const id = await criar(produto("Esmalte", { custoBase: "30" }));
    expect(await servicos.definirPreco(id, { preco: "25" }, deps())).toEqual({ status: "salvo", aviso: F.precoAbaixoDoCusto(30) });
    expect(Number((await base.item.findUniqueOrThrow({ where: { id } })).precoAtual)).toBe(25);
  });

  it("T09 — falha ao gravar o preço desfaz tudo (INV-005)", async () => {
    const id = await criar(produto("Esmalte", { preco: "50" }));
    // Usuário inexistente: a FK do histórico falha; o preço do item não pode mudar.
    const r = await servicos.definirPreco(id, { preco: "70" }, { ...deps(), usuarioId: randomUUID() });
    expect(r).toMatchObject({ status: "erro", mensagem: F.falhaInterna });
    expect(Number((await base.item.findUniqueOrThrow({ where: { id } })).precoAtual)).toBe(50);
    expect(await base.historicoPreco.count()).toBe(1);
  });

  it("T10 — o banco recusa alterar ou apagar o histórico (CA-09, INV-006)", async () => {
    const id = await criar(produto("Esmalte", { preco: "50" }));
    // Direto no banco (SQL), sem passar pela aplicação; e também pelo Prisma.
    await expect(base.$executeRawUnsafe(`UPDATE "HistoricoPreco" SET preco = 1`)).rejects.toThrow(/he_somente_insercao/);
    await expect(base.$executeRawUnsafe(`DELETE FROM "HistoricoPreco"`)).rejects.toThrow(/he_somente_insercao/);
    await expect(base.historicoPreco.updateMany({ where: { itemId: id }, data: { preco: 1 } })).rejects.toThrow();
    await expect(base.historicoPreco.deleteMany({ where: { itemId: id } })).rejects.toThrow();
    const [h] = await base.historicoPreco.findMany();
    expect(Number(h.preco)).toBe(50);
  });
});

describe("edição, arquivamento e isolamento", () => {
  it("T11 — arquivar material em uso avisa os serviços; some das escolhas; reativa (CA-10)", async () => {
    const esmalte = await criar(produto("Esmalte"));
    const manicure = await criar(servico("Manicure", [{ materialId: esmalte, quantidade: 1 }]));
    expect(await servicos.arquivarItem(esmalte, true, deps())).toEqual({ ok: true, usadoEm: [{ id: manicure, nome: "Manicure" }] });

    const c = deps().catalogo;
    expect((await c.listar()).map((i) => i.nome)).toEqual(["Manicure"]);
    expect((await c.listar({ arquivados: true })).map((i) => i.nome)).toEqual(["Esmalte"]);
    expect(await c.opcoesDeMaterial()).toEqual([]);
    // O vínculo é mantido (OPEN-006) e o detalhe mostra o material como arquivado.
    expect((await c.detalhar(manicure)).materiaisDoServico[0]).toMatchObject({ nome: "Esmalte", arquivado: true });

    // Editar o serviço mantendo o material arquivado continua permitido; adicionar arquivado a outro, não.
    expect(await servicos.editarItem(manicure, servico("Manicure", [{ materialId: esmalte, quantidade: 2 }]), deps())).toMatchObject({ status: "salvo" });
    expect(await servicos.criarItem(servico("Pedicure", [{ materialId: esmalte, quantidade: 1 }]), deps())).toMatchObject({ status: "erro" });

    expect(await servicos.arquivarItem(esmalte, false, deps())).toEqual({ ok: true, usadoEm: [] });
    expect((await c.opcoesDeMaterial()).map((o) => o.nome)).toEqual(["Esmalte"]);
  });

  it("T12 — o tipo não muda (CA-11, INV-002); a edição não mexe em estoque nem preço", async () => {
    const id = await criar(produto("Esmalte", { preco: "50" }));
    expect(await servicos.editarItem(id, servico("Esmalte"), deps())).toMatchObject({ status: "erro", erros: { tipo: expect.any(String) } });
    expect(await servicos.editarItem(id, produto("Esmalte Gel", { custoBase: "12", preco: "1" }), deps())).toEqual({ status: "salvo", itemId: id });
    const item = await base.item.findUniqueOrThrow({ where: { id } });
    expect(item).toMatchObject({ tipo: "PRODUTO_FISICO", nome: "Esmalte Gel" });
    expect(Number(item.custoBase)).toBe(12);
    expect(Number(item.precoAtual)).toBe(50);
  });

  it("T14 — item de outro negócio é 'não encontrado' em toda operação (CA-13)", async () => {
    const alheio = await criar(produto("Acetona", { preco: "10" }), depsDe(negocioB));
    await expect(deps().catalogo.detalhar(alheio)).rejects.toThrow("Item não encontrado");
    expect(await servicos.editarItem(alheio, produto("Hackeado"), deps())).toMatchObject({ status: "erro", mensagem: F.naoEncontrado });
    expect(await servicos.definirPreco(alheio, { preco: "1" }, deps())).toMatchObject({ status: "erro", mensagem: F.naoEncontrado });
    expect(await servicos.arquivarItem(alheio, true, deps())).toEqual({ ok: false, codigo: "nao-encontrado" });
    expect(await deps().catalogo.listar()).toEqual([]);
    const item = await base.item.findUniqueOrThrow({ where: { id: alheio } });
    expect(item).toMatchObject({ nome: "Acetona", arquivadoEm: null });
    expect(Number(item.precoAtual)).toBe(10);
  });

  it("filtros da lista: busca, tipo e categoria", async () => {
    await criar(produto("Esmalte"));
    await criar(produto("Shampoo", { categoria: "CASA" }));
    await criar(servico("Manicure"));
    const c = deps().catalogo;
    expect((await c.listar({ busca: "MAN" })).map((i) => i.nome)).toEqual(["Manicure"]);
    expect((await c.listar({ tipo: "PRODUTO_FISICO" })).map((i) => i.nome)).toEqual(["Esmalte", "Shampoo"]);
    expect((await c.listar({ categoria: "CASA" })).map((i) => i.nome)).toEqual(["Shampoo"]);
  });

  it("T15 — lista com 500 itens em menos de 2 s (RNF06)", async () => {
    await base.item.createMany({
      data: Array.from({ length: 500 }, (_, i) => ({
        negocioId: negocioA,
        tipo: "PRODUTO_FISICO" as const,
        nome: `Item ${i}`,
        nomeChave: `item ${i}`,
        categoria: "OUTROS" as const,
        unidadeMedida: "un",
        custoBase: 1,
      })),
    });
    const inicio = Date.now();
    expect(await deps().catalogo.listar()).toHaveLength(500);
    expect(Date.now() - inicio).toBeLessThan(2_000);
  });
});
