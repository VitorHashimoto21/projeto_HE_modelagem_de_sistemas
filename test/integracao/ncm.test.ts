import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import * as calculadora from "@/lib/calculadora/servicos";
import * as servicos from "@/lib/catalogo/servicos";
import { MENSAGENS_CATALOGO as M } from "@/lib/catalogo/validacao";
import { criarConsultasDoCatalogo } from "@/lib/db/catalogo";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { SomenteLeituraNoSuporte } from "@/lib/db/erros";
import { criarConsultasDoEstoque } from "@/lib/db/estoque";
import { criarConsultasDaLgpd } from "@/lib/db/lgpd";
import { criarConsultasDeNegocios } from "@/lib/db/negocios";
import { criarConsultasFiscais } from "@/lib/db/parametros-fiscais";
import { criarConsultasDePrecificacao } from "@/lib/db/precificacao";
import { criarConsultasDeVendas } from "@/lib/db/vendas";
import { hoje as hojeLocal } from "@/lib/dominio/datas";
import { CAMINHO_DO_ARQUIVO, validarParametros } from "@/lib/fiscal/arquivo";
import { CAMINHO_DA_TABELA_NCM, lerTabelaNcm } from "@/lib/ncm/arquivo";
import * as vendas from "@/lib/vendas/servicos";
import { carregarParametros } from "../../scripts/fiscal/carga";
import { carregarTabelaNcm } from "../../scripts/ncm/carga";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-021 — testes de integração (seção 12): banco real, cliente do negócio (SPEC-001) e a tabela
// NCM montada no formato do arquivo do Classif (e, num teste, o arquivo oficial inteiro).

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();
const brasileiro = (dia: string) => dia.split("-").reverse().join("/");
const somarDias = (dia: string, n: number) => new Date(new Date(`${dia}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

let usuario: string;
let negocioA: string;
let negocioB: string;

const cliente = (negocioId = negocioA) => comNegocio(base, { negocioId, usuarioId: usuario });
const catalogoDe = (negocioId = negocioA) => criarConsultasDoCatalogo(cliente(negocioId), negocioId);
const depsDe = (negocioId = negocioA) => ({ catalogo: catalogoDe(negocioId), usuarioId: usuario });

/** Tabela no formato do Classif: capítulo 71 (com um código encerrado e um futuro) e o 33. */
function tabela({ atualizadaEm = HOJE, sem = [] as string[] } = {}) {
  const n = (Codigo: string, Descricao: string, extra: object = {}) => ({
    Codigo,
    Descricao,
    Data_Inicio: "01/04/2022",
    Data_Fim: "31/12/9999",
    Tipo_Ato_Ini: "Res Gecex",
    Numero_Ato_Ini: "272",
    Ano_Ato_Ini: "2021",
    ...extra,
  });
  const nomenclaturas = [
    n("71", "Pérolas naturais ou cultivadas, pedras preciosas…; bijuterias; moedas."),
    n("71.13", "Artigos de joalheria e suas partes, de metais preciosos ou de metais folheados ou chapeados de metais preciosos (plaquê)."),
    n("7113.20.00", "- De metais comuns folheados ou chapeados de metais preciosos (plaquê)"),
    n("71.17", "Bijuterias."),
    n("7117.1", "- De metais comuns, mesmo prateados, dourados ou platinados:"),
    n("7117.11.00", "-- Abotoaduras (botões de punho) e artigos semelhantes"),
    n("7117.19.00", "-- Outras"),
    n("7117.90", "- Outras:"),
    n("7117.90.00", "-- Outras"),
    n("7117.90.10", "-- Encerrada", { Data_Fim: "31/12/2023" }),
    n("7117.90.20", "-- Futura", { Data_Inicio: "01/01/2099" }),
    n("33", "Óleos essenciais e resinoides; produtos de perfumaria ou de toucador preparados e preparações cosméticas."),
    n("33.04", "Produtos de beleza ou de maquiagem preparados e preparações para conservação ou cuidados da pele."),
    n("3304.99", "-- Outros:"),
    n("3304.99.90", "--- Outros"),
  ].filter((x) => !sem.includes(x.Codigo.replace(/\./g, "")));
  return lerTabelaNcm({ Data_Ultima_Atualizacao_NCM: `Vigente em ${brasileiro(atualizadaEm)}`, Ato: "Resolução Gecex nº 926/2026", Nomenclaturas: nomenclaturas });
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

async function subcategoria(nome: string, negocioId = negocioA) {
  const r = await servicos.criarSubcategoria({ categoria: "ACESSORIOS", nome }, depsDe(negocioId));
  if (r.status !== "salvo") throw new Error(`esperava salvo: ${JSON.stringify(r)}`);
  return r.subcategoria.id;
}

/** NCM gravado direto no banco (ex.: um código que saiu da tabela depois do cadastro). */
const gravarNcm = (id: string, ncm: string | null) => base.item.update({ where: { id }, data: { ncm } });
const ncmDe = async (id: string) => (await base.item.findUniqueOrThrow({ where: { id }, select: { ncm: true } })).ncm;
const nomes = (l: { nome: string }[]) => l.map((i) => i.nome).sort();

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Lia", email: "lia@exemplo.com" } })).id;
  negocioA = (await base.negocio.create({ data: { nome: "Semijoias da Lia" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Outra loja" } })).id;
  await carregarTabelaNcm(base, tabela());
});

afterAll(async () => {
  await base.$disconnect();
});

describe("T03 — carga da tabela (5.1, INV-003, INV-006, CA-14)", () => {
  it("idempotente; o código que sai do arquivo recebe fim no dia anterior à atualização; nenhum item muda", async () => {
    expect(await base.ncm.count()).toBe(7);
    expect(await base.tabelaNcm.findUniqueOrThrow({ where: { id: 1 } })).toMatchObject({ ato: "Resolução Gecex nº 926/2026" });
    expect(await carregarTabelaNcm(base, tabela())).toEqual({ inseridos: 0, alterados: 0, encerrados: 0, versao: false });

    const abotoadura = await item(produto("Abotoadura", { ncm: "7117.11.00" }));
    const antes = await base.item.findUniqueOrThrow({ where: { id: abotoadura } });

    expect(await carregarTabelaNcm(base, tabela({ sem: ["71171100"] }))).toEqual({ inseridos: 0, alterados: 0, encerrados: 1, versao: false });
    const linha = await base.ncm.findFirstOrThrow({ where: { codigo: "71171100" } });
    expect(linha.vigenteAte!.toISOString().slice(0, 10)).toBe(somarDias(HOJE, -1));
    expect(await base.item.findUniqueOrThrow({ where: { id: abotoadura } })).toEqual(antes);
    expect((await catalogoDe().detalhar(abotoadura)).ncm).toEqual({
      codigo: "71171100",
      descricao: "Bijuterias › De metais comuns, mesmo prateados, dourados ou platinados › Abotoaduras (botões de punho) e artigos semelhantes",
      vigente: false,
    });
    // De volta no arquivo: volta a ser vigente; uma nova atualização só troca a versão.
    expect(await carregarTabelaNcm(base, tabela())).toEqual({ inseridos: 0, alterados: 1, encerrados: 0, versao: false });
    expect(await carregarTabelaNcm(base, tabela({ atualizadaEm: somarDias(HOJE, -2) }))).toMatchObject({ versao: true });
    expect(await base.ncm.count()).toBe(7);
  });

  it("o arquivo oficial inteiro carrega uma vez e depois não muda nada; a busca acha 7117.19.00 por palavra e por código", async () => {
    const oficial = lerTabelaNcm(JSON.parse(readFileSync(CAMINHO_DA_TABELA_NCM, "utf-8")));
    await base.ncm.deleteMany();
    expect(await carregarTabelaNcm(base, oficial)).toMatchObject({ inseridos: oficial.codigos.length, encerrados: 0 });
    expect(await carregarTabelaNcm(base, oficial)).toEqual({ inseridos: 0, alterados: 0, encerrados: 0, versao: false });

    const c = catalogoDe();
    const porPalavra = await c.buscarNcm("bijuterias metais comuns", oficial.atualizadaEm);
    expect(porPalavra).toMatchObject({ status: "ok", atualizadaEm: oficial.atualizadaEm });
    if (porPalavra.status !== "ok") throw new Error();
    expect(porPalavra.resultados).toContainEqual({ codigo: "71171900", descricao: "Bijuterias › De metais comuns, mesmo prateados, dourados ou platinados › Outras" });
    const muitos = await c.buscarNcm("outras", oficial.atualizadaEm);
    expect(muitos).toMatchObject({ status: "ok", maisResultados: true });
    if (muitos.status === "ok") expect(muitos.resultados).toHaveLength(20);
  });
});

describe("T04 — busca na tabela vigente (5.2, CA-01, CA-02)", () => {
  it("palavras sem acento ou começo do código; só vigentes; em ordem de código; texto curto recusado", async () => {
    const c = catalogoDe();
    const codigos = async (t: string) => {
      const r = await c.buscarNcm(t);
      if (r.status !== "ok") throw new Error(JSON.stringify(r));
      return r.resultados.map((x) => x.codigo);
    };
    expect(await codigos("bijut")).toEqual(["71171100", "71171900", "71179000"]);
    expect(await codigos("71.17")).toEqual(["71171100", "71171900", "71179000"]);
    expect(await codigos("7117 19")).toEqual(["71171900"]);
    expect(await codigos("PLAQUE")).toEqual(["71132000"]);
    expect(await codigos("maquiagem outros")).toEqual(["33049990"]);
    expect(await codigos("joalheria bijuterias")).toEqual([]);
    expect(await c.buscarNcm("ab")).toEqual({ status: "curta" });
    expect(await c.buscarNcm("7")).toEqual({ status: "curta" });
    const r = await c.buscarNcm("7117.19");
    expect(r).toEqual({
      status: "ok",
      resultados: [{ codigo: "71171900", descricao: "Bijuterias › De metais comuns, mesmo prateados, dourados ou platinados › Outras" }],
      maisResultados: false,
      atualizadaEm: HOJE,
    });
    expect(await c.conferirCodigoNcm("71179010")).toMatchObject({ vigente: false });
    expect(await c.conferirCodigoNcm("12345678")).toBeNull();
  });
});

describe("T05 — gravar o NCM do item (5.7, INV-001, INV-002, CA-03, CA-04, CA-08)", () => {
  it("cadastro: vigente grava os 8 dígitos; inexistente, encerrado ou futuro é recusado; serviço com NCM é recusado", async () => {
    const id = await item(produto("Argola", { ncm: "7117.19.00" }));
    expect(await ncmDe(id)).toBe("71171900");
    expect(await ncmDe(await item(produto("Pulseira")))).toBeNull();
    for (const ncm of ["71179999", "71179010", "71179020"]) {
      expect(await servicos.criarItem(produto(`Peça ${ncm}`, { ncm }), depsDe())).toEqual({ status: "erro", erros: { ncm: M.ncmForaDaTabela } });
    }
    expect(await servicos.criarItem({ ...produto("Limpeza"), tipo: "SERVICO", unidadeMedida: "atend", ncm: "71171900" }, depsDe())).toEqual({
      status: "erro",
      erros: { ncm: M.ncmSoProduto },
    });
  });

  it("edição: o código gravado que saiu da tabela fica; trocar exige vigente; limpar é permitido", async () => {
    const id = await item(produto("Argola", { ncm: "71171900" }));
    await gravarNcm(id, "71179010"); // encerrado depois do cadastro
    const editar = (ncm: string) => servicos.editarItem(id, produto("Argola dourada", { ncm }), depsDe());
    expect(await editar("7117.90.10")).toEqual({ status: "salvo", itemId: id });
    expect(await ncmDe(id)).toBe("71179010");
    expect(await editar("71179020")).toEqual({ status: "erro", erros: { ncm: M.ncmForaDaTabela } });
    expect(await editar("71132000")).toEqual({ status: "salvo", itemId: id });
    expect(await editar("")).toEqual({ status: "salvo", itemId: id });
    expect(await ncmDe(id)).toBeNull();
  });

  it("o banco garante o formato e que só produto físico tem NCM", async () => {
    const id = await item(produto("Argola"));
    await expect(gravarNcm(id, "7117")).rejects.toThrow(/Item_ncm_formato/);
    const servico = await item({ ...produto("Limpeza"), tipo: "SERVICO", unidadeMedida: "atend" });
    await expect(gravarNcm(servico, "71171900")).rejects.toThrow(/Item_ncm_so_produto/);
  });
});

describe("T06 — sugestão pela subcategoria (OPEN-004, INV-003, INV-005, CA-05, CA-06, CA-13)", () => {
  it("o mais usado entre os outros produtos ativos da subcategoria, só vigentes, só do negócio; empate → menor código", async () => {
    const brincos = await subcategoria("Brincos");
    const colares = await subcategoria("Colares");
    const a = await item(produto("Argola", { subcategoriaId: brincos, ncm: "71171900" }));
    await item(produto("Ear cuff", { subcategoriaId: brincos, ncm: "71171900" }));
    await item(produto("Brinco plaquê", { subcategoriaId: brincos, ncm: "71132000" }));
    for (const n of ["Arquivado 1", "Arquivado 2", "Arquivado 3"]) {
      const id = await item(produto(n, { subcategoriaId: brincos, ncm: "71132000" }));
      await catalogoDe().arquivar(id, true);
    }
    for (const n of ["Antigo 1", "Antigo 2", "Antigo 3"]) await gravarNcm(await item(produto(n, { subcategoriaId: brincos })), "71179010");
    await item(produto("Colar 1", { subcategoriaId: colares, ncm: "71171900" }));
    await item(produto("Colar 2", { subcategoriaId: colares, ncm: "71132000" }));
    const doB = await subcategoria("Brincos", negocioB);
    for (const n of ["B1", "B2", "B3", "B4"]) await item(produto(n, { subcategoriaId: doB, ncm: "71179000" }), negocioB);

    const bijuteria = "Bijuterias › De metais comuns, mesmo prateados, dourados ou platinados › Outras";
    const plaque = "Artigos de joalheria e suas partes, de metais preciosos ou de metais folheados ou chapeados de metais preciosos (plaquê) › De metais comuns folheados ou chapeados de metais preciosos (plaquê)";
    expect(await catalogoDe().sugestoesDeNcm()).toEqual({
      [brincos]: { ncm: "71171900", descricao: bijuteria, itens: 2 },
      [colares]: { ncm: "71132000", descricao: plaque, itens: 1 },
    });
    // Editando a própria argola, ela não conta: empate 1 × 1 → o menor código.
    expect((await catalogoDe().sugestoesDeNcm(a))[brincos]).toMatchObject({ ncm: "71132000", itens: 1 });
    expect(Object.keys(await catalogoDe(negocioB).sugestoesDeNcm())).toEqual([doB]);
    // A sugestão nunca grava: um produto novo na subcategoria nasce sem NCM.
    expect(await ncmDe(await item(produto("Novo brinco", { subcategoriaId: brincos })))).toBeNull();
  });
});

describe("T07 — Catálogo e Estoque: contagens, filtros e busca pelo código (5.5, CA-09, CA-10, CA-11)", () => {
  it("sem NCM e fora da tabela contam só produtos ativos; os filtros e a busca acham os mesmos", async () => {
    const semNcm = await item(produto("Sem código"));
    await item(produto("Com código", { ncm: "71171900" }));
    const fora = await item(produto("Código antigo"));
    await gravarNcm(fora, "71179010");
    const arquivado = await item(produto("Arquivado sem código"));
    await catalogoDe().arquivar(arquivado, true);
    await item({ ...produto("Limpeza"), tipo: "SERVICO", unidadeMedida: "atend" });

    const c = catalogoDe();
    expect(await c.contagensDoNcm()).toEqual({ semNcm: 1, foraDaTabela: 1 });
    expect(nomes(await c.listar({ ncm: "sem" }))).toEqual(["Sem código"]);
    expect(nomes(await c.listar({ ncm: "revisar" }))).toEqual(["Código antigo"]);
    expect(nomes(await c.listar({ busca: "7117" }))).toEqual(["Com código", "Código antigo"]);
    expect(nomes(await c.listar({ busca: "7117.19" }))).toEqual(["Com código"]);
    expect(nomes(await criarConsultasDoEstoque(cliente(), negocioA).listar({ busca: "7117 19" }, HOJE))).toEqual(["Com código"]);
    expect(await catalogoDe(negocioB).contagensDoNcm()).toEqual({ semNcm: 0, foraDaTabela: 0 });
    expect((await c.detalhar(semNcm)).ncm).toBeNull();
  });

  it("o modo suporte lê o NCM, mas não grava", async () => {
    const id = await item(produto("Argola", { ncm: "71171900" }));
    const doSuporte = criarConsultasDoCatalogo(comNegocio(base, { negocioId: negocioA, modoSuporte: true }), negocioA);
    expect((await doSuporte.detalhar(id)).ncm).toMatchObject({ codigo: "71171900", vigente: true });
    expect(await doSuporte.contagensDoNcm()).toEqual({ semNcm: 0, foraDaTabela: 0 });
    const r = await servicos.editarItem(id, produto("Argola", { ncm: "71132000" }), { catalogo: doSuporte, usuarioId: usuario });
    expect(r.status).toBe("erro");
    await expect(doSuporte.editar(id, { ...(await validados("Argola", "71132000")) })).rejects.toBeInstanceOf(SomenteLeituraNoSuporte);
    expect(await ncmDe(id)).toBe("71171900");
  });
});

/** Dados já validados de um produto (para chamar a camada de dados direto). */
async function validados(nome: string, ncm: string) {
  const { validarItem } = await import("@/lib/catalogo/validacao");
  const v = validarItem(produto(nome, { ncm }), { tipo: "editar", tipoDoItem: "PRODUTO_FISICO" });
  if (!v.ok) throw new Error(JSON.stringify(v.erros));
  return v.dados;
}

describe("T09 — o NCM não muda preço nem margem (RN34, INV-004, CA-15)", () => {
  it("dois produtos iguais, com e sem NCM, recebem o mesmo preço sugerido", async () => {
    await carregarParametros(base, validarParametros(JSON.parse(readFileSync(CAMINHO_DO_ARQUIVO, "utf-8"))));
    await base.negocio.update({ where: { id: negocioA }, data: { regimeTributario: "AUTONOMO", impostoPercentualManual: 6, faturamentoMensalEstimado: 5000 } });
    const com = await item(produto("Argola", { ncm: "71171900" }));
    const sem = await item(produto("Argola lisa"));
    const deps: calculadora.DependenciasDaCalculadora = {
      precificacao: criarConsultasDePrecificacao(cliente(), negocioA),
      catalogo: criarConsultasDoCatalogo(cliente(), negocioA),
      fiscais: criarConsultasFiscais(base),
      usuarioId: usuario,
      hoje: HOJE,
    };
    const resultados = [];
    for (const id of [com, sem]) {
      const r = await calculadora.calcular(id, { margem: null, comissao: null }, deps);
      if (r.status !== "ok") throw new Error(r.mensagem);
      resultados.push({ margem: r.margem, preco: r.precoCentavos, soma: r.soma });
    }
    expect(resultados[0]).toEqual(resultados[1]);
  });
});

describe("T10 — exportação, migração e isolamento (RNF04, INV-005, INV-008, CA-16)", () => {
  it("o arquivo traz o NCM nos itens e a opção no negócio; negócio novo nasce com a opção desligada", async () => {
    await base.membroNegocio.create({ data: { usuarioId: usuario, negocioId: negocioA, papel: "DONO" } });
    const id = await item(produto("Argola", { ncm: "71171900" }));
    const dados = await criarConsultasDaLgpd(base).dadosDoTitular(usuario, new Date());
    const loja = dados!.negociosComoDono.find((g) => g.negocio.id === negocioA)!;
    expect(loja.tabelas.itens).toEqual([expect.objectContaining({ id, ncm: "71171900" })]);
    expect(loja.negocio).toMatchObject({ emiteNotaDeProduto: false });
  });

  it("Ncm e TabelaNcm têm RLS ligado e nenhuma política (só o servidor lê)", async () => {
    const rls = await base.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('Ncm', 'TabelaNcm') ORDER BY relname`;
    expect(rls).toEqual([
      { relname: "Ncm", relrowsecurity: true },
      { relname: "TabelaNcm", relrowsecurity: true },
    ]);
    const politicas = await base.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM pg_policies WHERE tablename IN ('Ncm', 'TabelaNcm')`;
    expect(Number(politicas[0].n)).toBe(0);
  });
});

describe("T11 — opção de nota fiscal ligada (RN35, OPEN-005, OPEN-006, INV-009, CA-19, CA-20, CA-21)", () => {
  const vendasDe = (negocioId = negocioA) => criarConsultasDeVendas(cliente(negocioId), negocioId);
  const depsDaVenda = (): vendas.DependenciasDaVenda => ({ vendas: vendasDe(), usuarioId: usuario, hoje: HOJE, agora: new Date() });
  const carrinho = (linhas: { itemId: string; quantidade: number }[], valor: number) =>
    JSON.stringify({ id: randomUUID(), linhas, pagamentos: [{ forma: "PIX", valor }] });
  const vender = (linhas: { itemId: string; quantidade: number }[], valor: number) => vendas.registrarVenda({ carrinho: carrinho(linhas, valor) }, depsDaVenda());
  const comEstoque = (id: string) => base.item.update({ where: { id }, data: { quantidadeEstoque: 10 } });

  it("cadastro e edição exigem o NCM do produto físico; o código antigo fora da tabela continua aceito", async () => {
    const antigo = await item(produto("Antigo sem código"));
    const foraDaTabela = await item(produto("Código antigo"));
    await gravarNcm(foraDaTabela, "71179010");
    await criarConsultasDeNegocios(base).definirNotaFiscalDeProduto(negocioA, true);

    expect(await servicos.criarItem(produto("Novo"), depsDe())).toEqual({ status: "erro", erros: { ncm: M.ncmObrigatorio } });
    expect((await servicos.criarItem(produto("Novo", { ncm: "71171900" }), depsDe())).status).toBe("salvo");
    expect((await servicos.criarItem({ ...produto("Limpeza"), tipo: "SERVICO", unidadeMedida: "atend" }, depsDe())).status).toBe("salvo");
    expect(await servicos.editarItem(antigo, produto("Antigo sem código"), depsDe())).toEqual({ status: "erro", erros: { ncm: M.ncmObrigatorio } });
    expect(await servicos.editarItem(antigo, produto("Antigo sem código", { ncm: "71132000" }), depsDe())).toEqual({ status: "salvo", itemId: antigo });
    expect(await servicos.editarItem(foraDaTabela, produto("Código antigo", { ncm: "71179010" }), depsDe())).toEqual({ status: "salvo", itemId: foraDaTabela });
    // Só no negócio que ligou a opção.
    expect((await servicos.criarItem(produto("Sem código"), depsDe(negocioB))).status).toBe("salvo");
  });

  it("produto sem NCM sai da venda e da troca; NCM fora da tabela e material de serviço não bloqueiam; desligar devolve", async () => {
    const semNcm = await item(produto("Brinco sem código", { preco: "50" }));
    const comNcm = await item(produto("Brinco com código", { ncm: "71171900", preco: "50" }));
    const antigo = await item(produto("Brinco antigo", { preco: "50" }));
    await gravarNcm(antigo, "71179010");
    const limpeza = await item({
      ...produto("Limpeza de joias"),
      tipo: "SERVICO",
      unidadeMedida: "atend",
      preco: "30",
      materiais: JSON.stringify([{ materialId: semNcm, quantidade: 1 }]),
    });
    for (const id of [semNcm, comNcm, antigo]) await comEstoque(id);
    const vendaAntes = await vender([{ itemId: comNcm, quantidade: 1 }], 50);
    if (vendaAntes.status !== "registrada") throw new Error(JSON.stringify(vendaAntes));

    await criarConsultasDeNegocios(base).definirNotaFiscalDeProduto(negocioA, true);
    expect(nomes(await vendasDe().itensVendaveis())).toEqual(["Brinco antigo", "Brinco com código", "Limpeza de joias"]);
    expect(await vendasDe().foraDaVendaPorFaltaDeNcm()).toBe(1);
    expect(await vender([{ itemId: semNcm, quantidade: 1 }], 50)).toEqual({ status: "erro", mensagem: "Brinco sem código está sem NCM. Cadastre o NCM para vender." });
    expect((await vender([{ itemId: antigo, quantidade: 1 }], 50)).status).toBe("registrada");
    expect((await vender([{ itemId: limpeza, quantidade: 1 }], 30)).status).toBe("registrada");
    const troca = await vendas.trocarVenda(
      vendaAntes.vendaId,
      { motivo: "TROCA", formaReembolso: "PIX", carrinho: carrinho([{ itemId: semNcm, quantidade: 1 }], 50) },
      depsDaVenda(),
    );
    expect(troca).toEqual({ status: "erro", mensagem: "Brinco sem código está sem NCM. Cadastre o NCM para vender." });

    await criarConsultasDeNegocios(base).definirNotaFiscalDeProduto(negocioA, false);
    expect(await vendasDe().foraDaVendaPorFaltaDeNcm()).toBe(0);
    expect(nomes(await vendasDe().itensVendaveis())).toContain("Brinco sem código");
    expect((await vender([{ itemId: semNcm, quantidade: 1 }], 50)).status).toBe("registrada");
    expect(await ncmDe(comNcm)).toBe("71171900");
  });
});

describe("T12 — a opção do negócio (OPEN-005, INV-008, INV-010, CA-18)", () => {
  it("nasce desligada; liga e desliga só no próprio negócio; a contagem do diálogo vem do Catálogo", async () => {
    const n = criarConsultasDeNegocios(base);
    expect(await n.notaFiscalDeProduto(negocioA)).toBe(false);
    await item(produto("Sem código 1"));
    await item(produto("Sem código 2"));
    expect((await catalogoDe().contagensDoNcm()).semNcm).toBe(2);
    await n.definirNotaFiscalDeProduto(negocioA, true);
    expect(await n.notaFiscalDeProduto(negocioA)).toBe(true);
    expect(await n.notaFiscalDeProduto(negocioB)).toBe(false);
    expect(await catalogoDe().emiteNotaDeProduto()).toBe(true);
    expect(await catalogoDe(negocioB).emiteNotaDeProduto()).toBe(false);
  });
});
