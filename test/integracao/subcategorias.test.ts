import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import * as calculadora from "@/lib/calculadora/servicos";
import * as servicos from "@/lib/catalogo/servicos";
import { MENSAGENS_FLUXO_CATALOGO as F } from "@/lib/catalogo/servicos";
import { CATEGORIAS, subcategoriaDeOutraCategoria } from "@/lib/catalogo/validacao";
import { criarConsultasDoCatalogo, SubcategoriaNaoEncontrada } from "@/lib/db/catalogo";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { SomenteLeituraNoSuporte } from "@/lib/db/erros";
import { criarConsultasDoEstoque } from "@/lib/db/estoque";
import { criarConsultasDaLgpd } from "@/lib/db/lgpd";
import { criarConsultasFiscais } from "@/lib/db/parametros-fiscais";
import { criarConsultasDePrecificacao } from "@/lib/db/precificacao";
import { hoje as hojeLocal } from "@/lib/dominio/datas";
import { CAMINHO_DO_ARQUIVO, validarParametros } from "@/lib/fiscal/arquivo";
import { carregarParametros } from "../../scripts/fiscal/carga";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-020 — testes de integração (seção 12): banco real, cliente do negócio (SPEC-001) e os
// parâmetros fiscais do arquivo versionado.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();

let usuario: string;
let negocioA: string;
let negocioB: string;

const cliente = (negocioId = negocioA) => comNegocio(base, { negocioId, usuarioId: usuario });
const depsDe = (negocioId = negocioA) => ({ catalogo: criarConsultasDoCatalogo(cliente(negocioId), negocioId), usuarioId: usuario });

async function subcategoria(nome: string, categoria = "ACESSORIOS", negocioId = negocioA) {
  const r = await servicos.criarSubcategoria({ categoria, nome }, depsDe(negocioId));
  if (r.status !== "salvo") throw new Error(`esperava salvo: ${JSON.stringify(r)}`);
  return r.subcategoria.id;
}

const produto = (nome: string, extra: Record<string, string> = {}) => ({
  tipo: "PRODUTO_FISICO",
  nome,
  categoria: "ACESSORIOS",
  unidadeMedida: "un",
  custoBase: "25,00",
  ...extra,
});

async function item(campos: Record<string, string>, negocioId = negocioA) {
  const r = await servicos.criarItem(campos, depsDe(negocioId));
  if (r.status !== "salvo") throw new Error(`esperava salvo: ${JSON.stringify(r)}`);
  return r.itemId;
}

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Lia", email: "lia@exemplo.com" } })).id;
  negocioA = (await base.negocio.create({ data: { nome: "Semijoias da Lia" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Outra loja" } })).id;
});

afterAll(async () => {
  await base.$disconnect();
});

describe("T03/T10 — Acessórios na lista fixa e a migração", () => {
  it("o enum do banco tem Acessórios logo depois de Vestuário, na mesma ordem da lista da aplicação (INV-007)", async () => {
    const [{ ordem }] = await base.$queryRaw<{ ordem: string[] }[]>`SELECT enum_range(NULL::"CategoriaItem")::text[] AS ordem`;
    expect(ordem).toEqual(CATEGORIAS);
    expect(ordem.indexOf("ACESSORIOS")).toBe(ordem.indexOf("VESTUARIO") + 1);
  });

  it("a coluna nova do item é opcional e sem valor padrão: itens existentes ficam sem subcategoria (INV-008, CA-14)", async () => {
    const [coluna] = await base.$queryRaw<{ is_nullable: string; column_default: string | null }[]>`
      SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name = 'Item' AND column_name = 'subcategoriaId'`;
    expect(coluna).toEqual({ is_nullable: "YES", column_default: null });
    const id = await item(produto("Anel liso"));
    expect(await base.item.findUniqueOrThrow({ where: { id }, select: { categoria: true, subcategoriaId: true } })).toEqual({ categoria: "ACESSORIOS", subcategoriaId: null });
  });
});

describe("T05 — nome único por categoria (INV-003, CA-04)", () => {
  it("repetido na mesma categoria é recusado (sem diferenciar maiúsculas e espaços); em outra categoria ou outro negócio, não", async () => {
    await subcategoria("Brincos");
    expect(await servicos.criarSubcategoria({ categoria: "ACESSORIOS", nome: "  brincos " }, depsDe())).toEqual({
      status: "erro",
      erros: { nome: F.subcategoriaRepetida("brincos", "ACESSORIOS") },
    });
    expect(F.subcategoriaRepetida("Brincos", "ACESSORIOS")).toBe("Já existe “Brincos” em Acessórios.");
    await subcategoria("Brincos", "VESTUARIO");
    await subcategoria("Brincos", "ACESSORIOS", negocioB);
    expect(await base.subcategoria.count()).toBe(3);
  });

  it("duas criações simultâneas do mesmo nome: só uma grava (restrição única no banco)", async () => {
    const r = await Promise.all([
      servicos.criarSubcategoria({ categoria: "ACESSORIOS", nome: "Colares" }, depsDe()),
      servicos.criarSubcategoria({ categoria: "ACESSORIOS", nome: "colares" }, depsDe()),
    ]);
    expect(r.map((x) => x.status).sort()).toEqual(["erro", "salvo"]);
    expect(await base.subcategoria.count({ where: { negocioId: negocioA } })).toBe(1);
  });

  it("renomear para um nome já usado na categoria é recusado; o novo nome aparece em todos os itens (CA-06)", async () => {
    const aneis = await subcategoria("Aneis");
    await subcategoria("Colares");
    const ids = await Promise.all(["Anel 1", "Anel 2", "Anel 3", "Anel 4"].map((n) => item(produto(n, { subcategoriaId: aneis }))));
    const repetido = await servicos.renomearSubcategoria(aneis, { nome: "COLARES" }, depsDe());
    expect(repetido).toMatchObject({ status: "erro", erros: { nome: F.subcategoriaRepetida("COLARES", "ACESSORIOS") } });
    expect(await servicos.renomearSubcategoria(aneis, { nome: "Anéis" }, depsDe())).toMatchObject({ status: "salvo", subcategoria: { nome: "Anéis", categoria: "ACESSORIOS" } });
    const lista = await depsDe().catalogo.listar({});
    expect(lista.filter((i) => ids.includes(i.id)).map((i) => i.subcategoria?.nome)).toEqual(["Anéis", "Anéis", "Anéis", "Anéis"]);
  });

  it("a categoria de uma subcategoria não muda (gatilho do banco)", async () => {
    const id = await subcategoria("Brincos");
    await expect(base.subcategoria.update({ where: { id }, data: { categoria: "VESTUARIO" } })).rejects.toThrow(/he_subcategoria_categoria_fixa/);
  });
});

describe("T06 — subcategoria do item: mesma categoria e mesmo negócio (INV-002, INV-006, CA-05, CA-12)", () => {
  it("cadastro e edição recusam subcategoria de outra categoria ou de outro negócio", async () => {
    const vestidos = await subcategoria("Vestidos", "VESTUARIO");
    const deOutroNegocio = await subcategoria("Brincos", "ACESSORIOS", negocioB);
    const erro = { status: "erro", erros: { subcategoriaId: subcategoriaDeOutraCategoria("ACESSORIOS") } };
    expect(await servicos.criarItem(produto("Brinco", { subcategoriaId: vestidos }), depsDe())).toEqual(erro);
    expect(await servicos.criarItem(produto("Brinco", { subcategoriaId: deOutroNegocio }), depsDe())).toEqual(erro);
    expect(subcategoriaDeOutraCategoria("ACESSORIOS")).toBe("Escolha uma subcategoria de Acessórios");
    expect(await base.item.count()).toBe(0);
  });

  it("trocar a categoria exige limpar a subcategoria; sem ela, a edição grava", async () => {
    const brincos = await subcategoria("Brincos");
    const id = await item(produto("Brinco argola", { subcategoriaId: brincos }));
    const editar = (extra: Record<string, string>) => servicos.editarItem(id, produto("Brinco argola", extra), depsDe());
    expect(await editar({ categoria: "VESTUARIO", subcategoriaId: brincos })).toMatchObject({
      status: "erro",
      erros: { subcategoriaId: subcategoriaDeOutraCategoria("VESTUARIO") },
    });
    expect(await editar({ categoria: "VESTUARIO", subcategoriaId: "" })).toEqual({ status: "salvo", itemId: id });
    expect(await base.item.findUniqueOrThrow({ where: { id }, select: { categoria: true, subcategoriaId: true } })).toEqual({ categoria: "VESTUARIO", subcategoriaId: null });
  });

  it("o banco também recusa (gatilhos): categoria diferente e subcategoria de outro negócio", async () => {
    const brincos = await subcategoria("Brincos");
    const deOutroNegocio = await subcategoria("Brincos", "ACESSORIOS", negocioB);
    const id = await item(produto("Brinco argola", { subcategoriaId: brincos }));
    await expect(base.item.update({ where: { id }, data: { categoria: "VESTUARIO" } })).rejects.toThrow(/he_subcategoria_divergente/);
    await expect(base.item.update({ where: { id }, data: { subcategoriaId: deOutroNegocio } })).rejects.toThrow(/he_negocio_divergente/);
  });

  it("o outro negócio não vê, não renomeia e não exclui as subcategorias de A", async () => {
    const brincos = await subcategoria("Brincos");
    const b = depsDe(negocioB).catalogo;
    expect(await b.subcategorias()).toEqual([]);
    await expect(b.renomearSubcategoria(brincos, { nome: "X", nomeChave: "x" })).rejects.toBeInstanceOf(SubcategoriaNaoEncontrada);
    await expect(b.excluirSubcategoria(brincos)).rejects.toBeInstanceOf(SubcategoriaNaoEncontrada);
    expect(await servicos.excluirSubcategoria(brincos, depsDe(negocioB))).toEqual({ status: "erro", mensagem: F.subcategoriaNaoEncontrada });
    expect(await base.subcategoria.count()).toBe(1);
  });
});

describe("T04 — modo suporte só lê (INV-005, CA-11)", () => {
  it("o cliente do suporte lista, mas não cria, renomeia nem exclui", async () => {
    const brincos = await subcategoria("Brincos");
    const doSuporte = criarConsultasDoCatalogo(comNegocio(base, { negocioId: negocioA, modoSuporte: true }), negocioA);
    expect((await doSuporte.subcategorias()).map((s) => s.nome)).toEqual(["Brincos"]);
    await expect(doSuporte.criarSubcategoria({ categoria: "ACESSORIOS", nome: "Colares", nomeChave: "colares" })).rejects.toBeInstanceOf(SomenteLeituraNoSuporte);
    await expect(doSuporte.renomearSubcategoria(brincos, { nome: "X", nomeChave: "x" })).rejects.toBeInstanceOf(SomenteLeituraNoSuporte);
    await expect(doSuporte.excluirSubcategoria(brincos)).rejects.toBeInstanceOf(SomenteLeituraNoSuporte);
    expect(await base.subcategoria.findUniqueOrThrow({ where: { id: brincos }, select: { nome: true } })).toEqual({ nome: "Brincos" });
  });
});

describe("T07 — excluir em uso (INV-004, CA-07)", () => {
  it("os itens (ativos e arquivados) ficam sem subcategoria; preço, custo, estoque, histórico e o resto não mudam", async () => {
    const colares = await subcategoria("Colares");
    const outra = await subcategoria("Brincos");
    const ids = await Promise.all(["Colar 1", "Colar 2", "Colar 3"].map((n) => item(produto(n, { subcategoriaId: colares, preco: "89,90" }))));
    const brinco = await item(produto("Brinco", { subcategoriaId: outra }));
    await depsDe().catalogo.arquivar(ids[2], true);
    await base.item.update({ where: { id: ids[0] }, data: { quantidadeEstoque: 7 } });

    const lista = await depsDe().catalogo.subcategorias("ACESSORIOS");
    expect(lista.find((s) => s.id === colares)).toMatchObject({ itensAtivos: 2, itensArquivados: 1 });
    expect(await depsDe().catalogo.usoDaSubcategoria(colares)).toEqual({ nome: "Colares", categoria: "ACESSORIOS", itensAtivos: 2, itensArquivados: 1 });

    const campos = { id: true, nome: true, categoria: true, custoBase: true, precoAtual: true, quantidadeEstoque: true, arquivadoEm: true, nomeChave: true, subcategoriaId: true } as const;
    const antes = await base.item.findMany({ where: { id: { in: ids } }, select: campos, orderBy: { nome: "asc" } });
    const historicoAntes = await base.historicoPreco.count();

    expect(await servicos.excluirSubcategoria(colares, depsDe())).toEqual({ status: "excluida", itensAfetados: 3 });

    const depois = await base.item.findMany({ where: { id: { in: ids } }, select: campos, orderBy: { nome: "asc" } });
    expect(depois).toEqual(antes.map((i) => ({ ...i, subcategoriaId: null })));
    expect(await base.historicoPreco.count()).toBe(historicoAntes);
    expect(await base.subcategoria.count({ where: { id: colares } })).toBe(0);
    expect((await base.item.findUniqueOrThrow({ where: { id: brinco } })).subcategoriaId).toBe(outra);
  });
});

describe("T08 — filtros e busca no Catálogo e no Estoque (CA-08)", () => {
  let brincos: string;
  let colares: string;

  beforeEach(async () => {
    brincos = await subcategoria("Brincos");
    colares = await subcategoria("Colares");
    await subcategoria("Tornozeleiras"); // sem itens: não aparece no filtro do Estoque
    await item(produto("Argola dourada", { subcategoriaId: brincos }));
    await item(produto("Brinco de pérola", { subcategoriaId: brincos }));
    await item(produto("Choker", { subcategoriaId: colares }));
    await item(produto("Pulseira"));
    await item(produto("Vestido", { categoria: "VESTUARIO" }));
    await item({ tipo: "SERVICO", nome: "Banho de ouro", categoria: "ACESSORIOS", unidadeMedida: "atend", custoBase: "15", subcategoriaId: brincos, materiais: "[]" });
  });

  const nomes = (l: { nome: string }[]) => l.map((i) => i.nome);

  it("Catálogo: subcategoria (com a categoria), sem subcategoria e busca pelo nome da subcategoria", async () => {
    const c = depsDe().catalogo;
    expect(nomes(await c.listar({ categoria: "ACESSORIOS", subcategoria: brincos }))).toEqual(["Argola dourada", "Banho de ouro", "Brinco de pérola"]);
    expect(nomes(await c.listar({ categoria: "ACESSORIOS", subcategoria: "sem" }))).toEqual(["Pulseira"]);
    expect(nomes(await c.listar({ busca: "brinc" }))).toEqual(["Argola dourada", "Banho de ouro", "Brinco de pérola"]);
    expect(nomes(await c.listar({ busca: "CHOKER" }))).toEqual(["Choker"]);
    expect(nomes(await c.listar({ busca: "colar" }))).toEqual(["Choker"]);
    // Sem categoria, o filtro de subcategoria não vale (ele só aparece com a categoria escolhida).
    expect(await c.listar({ subcategoria: brincos })).toHaveLength(6);
    expect((await c.listar({ categoria: "ACESSORIOS", subcategoria: brincos }))[0].subcategoria).toEqual({ id: brincos, nome: "Brincos" });
  });

  it("Estoque: os mesmos filtros, só produtos; o filtro lista só subcategorias com produto ativo", async () => {
    const e = criarConsultasDoEstoque(cliente(), negocioA);
    expect(nomes(await e.listar({ categoria: "ACESSORIOS", subcategoria: brincos }, HOJE))).toEqual(["Argola dourada", "Brinco de pérola"]);
    expect(nomes(await e.listar({ categoria: "ACESSORIOS", subcategoria: "sem" }, HOJE))).toEqual(["Pulseira"]);
    expect(nomes(await e.listar({ busca: "brinc" }, HOJE))).toEqual(["Argola dourada", "Brinco de pérola"]);
    expect((await e.subcategoriasDosProdutos()).map((s) => s.nome)).toEqual(["Brincos", "Colares"]);
  });
});

describe("T09 — a subcategoria não muda a margem; Acessórios = 8% (INV-001, CA-01, CA-10)", () => {
  it("dois itens de Acessórios, com e sem subcategoria, recebem a mesma sugestão, com a fonte legal", async () => {
    await carregarParametros(base, validarParametros(JSON.parse(readFileSync(CAMINHO_DO_ARQUIVO, "utf-8"))));
    expect(await criarConsultasFiscais(base).margemPadrao("ACESSORIOS", HOJE)).toMatchObject({ margemPadrao: 8, vigenteDesde: "2018-01-01" });

    await base.negocio.update({ where: { id: negocioA }, data: { regimeTributario: "AUTONOMO", impostoPercentualManual: 6, faturamentoMensalEstimado: 5000 } });
    const brincos = await subcategoria("Brincos");
    const com = await item(produto("Argola", { subcategoriaId: brincos }));
    const sem = await item(produto("Pulseira"));
    const deps: calculadora.DependenciasDaCalculadora = {
      precificacao: criarConsultasDePrecificacao(cliente(), negocioA),
      catalogo: criarConsultasDoCatalogo(cliente(), negocioA),
      fiscais: criarConsultasFiscais(base),
      usuarioId: usuario,
      hoje: HOJE,
    };
    const margens = [];
    for (const id of [com, sem]) {
      const r = await calculadora.calcular(id, { margem: null, comissao: null }, deps);
      if (r.status !== "ok") throw new Error(r.mensagem);
      margens.push(r.margem);
    }
    expect(margens[0]).toEqual(margens[1]);
    expect(margens[0]).toMatchObject({ percentual: 8, sugerida: 8 });
    expect(margens[0].fonte.fonteLegal).toContain("Lei 9.249/1995");
  });
});

describe("T10 — exportação (RNF04, CA-13)", () => {
  it("o arquivo traz as subcategorias e a referência nos itens", async () => {
    await base.membroNegocio.create({ data: { usuarioId: usuario, negocioId: negocioA, papel: "DONO" } });
    const brincos = await subcategoria("Brincos");
    const id = await item(produto("Argola", { subcategoriaId: brincos }));
    const dados = await criarConsultasDaLgpd(base).dadosDoTitular(usuario, new Date());
    const loja = dados!.negociosComoDono.find((g) => g.negocio.id === negocioA)!;
    expect(loja.tabelas.subcategorias).toEqual([expect.objectContaining({ id: brincos, categoria: "ACESSORIOS", nome: "Brincos" })]);
    expect(loja.tabelas.itens).toEqual([expect.objectContaining({ id, subcategoriaId: brincos })]);
  });
});
