import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MENSAGENS_CATALOGO as M, validarItem, validarPreco } from "@/lib/catalogo/validacao";
import { custoTotal, lerNumero, normalizarNome, precoAbaixoDoCusto } from "@/lib/dominio/catalogo";
import { PREDEFINICOES, pode } from "@/lib/dominio/permissoes";
import { menuDoMembro } from "@/lib/equipe/menu";

// SPEC-006 — testes unitários (seção 12).

const MATERIAL = "11111111-1111-4111-8111-111111111111";
const produto = { tipo: "PRODUTO_FISICO", nome: "Esmalte", categoria: "BELEZA", unidadeMedida: "un", custoBase: "8,50" };
const servico = { tipo: "SERVICO", nome: "Manicure", categoria: "BELEZA", unidadeMedida: "atend", custoBase: "20" };
const criar = { tipo: "criar" } as const;

describe("T01 — validação do item (CA-05)", () => {
  it("aceita produto e serviço, lendo valores em reais com vírgula", () => {
    expect(validarItem({ ...produto, comissaoPercentual: "5,5", estoqueMinimo: "2,5", preco: "R$ 1.234,56" }, criar)).toMatchObject({
      ok: true,
      dados: { custoBase: 8.5, comissaoPercentual: 5.5, estoqueMinimo: 2.5, precoInicial: 1234.56, nomeChave: "esmalte", materiais: [] },
    });
    expect(
      validarItem({ ...servico, materiais: JSON.stringify([{ materialId: MATERIAL, quantidade: "0,25" }]) }, criar),
    ).toMatchObject({ ok: true, dados: { materiais: [{ materialId: MATERIAL, quantidade: 0.25 }] } });
  });

  it.each<[string, Record<string, string>, string, string]>([
    ["sem tipo", { ...produto, tipo: "" }, "tipo", M.tipoObrigatorio],
    ["sem nome", { ...produto, nome: "  " }, "nome", M.nomeObrigatorio],
    ["nome longo", { ...produto, nome: "x".repeat(121) }, "nome", M.nomeLongo],
    ["sem categoria", { ...produto, categoria: "" }, "categoria", M.categoriaObrigatoria],
    ["categoria inexistente", { ...produto, categoria: "ARMAS" }, "categoria", M.categoriaObrigatoria],
    ["unidade fora da lista (OPEN-002)", { ...produto, unidadeMedida: "unid." }, "unidadeMedida", M.unidadeObrigatoria],
    ["sem custo", { ...produto, custoBase: "" }, "custoBase", M.custoObrigatorio],
    ["custo negativo", { ...produto, custoBase: "-1" }, "custoBase", M.valorInvalido],
    ["custo com 3 casas", { ...produto, custoBase: "1,005" }, "custoBase", M.valorInvalido],
    ["comissão de 100%", { ...produto, comissaoPercentual: "100" }, "comissaoPercentual", M.comissaoInvalida],
    ["estoque mínimo em serviço", { ...servico, estoqueMinimo: "2" }, "estoqueMinimo", M.estoqueSoProduto],
    ["preço zero", { ...produto, preco: "0" }, "preco", M.precoInvalido],
    ["materiais em produto", { ...produto, materiais: JSON.stringify([{ materialId: MATERIAL, quantidade: 1 }]) }, "materiais", M.materiaisSoServico],
    ["material repetido", { ...servico, materiais: JSON.stringify([{ materialId: MATERIAL, quantidade: 1 }, { materialId: MATERIAL, quantidade: 2 }]) }, "materiais", M.materialRepetido],
    ["quantidade zero", { ...servico, materiais: JSON.stringify([{ materialId: MATERIAL, quantidade: 0 }]) }, "materiais", M.quantidadeInvalida],
    ["materiais malformados", { ...servico, materiais: "{x" }, "materiais", M.materiaisInvalidos],
  ])("recusa %s", (_, campos, campo, mensagem) => {
    const r = validarItem(campos, criar);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[campo]).toBe(mensagem);
  });

  it("na edição o tipo vem do item gravado e o preço é ignorado (INV-002, 5.3)", () => {
    const r = validarItem({ ...produto, tipo: "SERVICO", preco: "10" }, { tipo: "editar", tipoDoItem: "PRODUTO_FISICO" });
    expect(r).toMatchObject({ ok: true, dados: { tipo: "PRODUTO_FISICO", precoInicial: null } });
  });

  it("preço manual (5.4)", () => {
    expect(validarPreco({ preco: "55,00" })).toEqual({ ok: true, dados: 55 });
    expect(validarPreco({ preco: "-1" }).ok).toBe(false);
    expect(validarPreco({ preco: "10000000" }).ok).toBe(false);
  });
});

describe("T02/T03 — domínio do catálogo", () => {
  it("lê números em formato brasileiro", () => {
    expect(lerNumero("12,50")).toBe(12.5);
    expect(lerNumero("1.234,56")).toBe(1234.56);
    expect(lerNumero("1.234.567")).toBe(1234567);
    expect(lerNumero("12.5")).toBe(12.5);
    expect(lerNumero("R$ 30")).toBe(30);
    expect(lerNumero("abc")).toBeNull();
    expect(lerNumero("")).toBeNull();
  });

  it("custo total do serviço e aviso de preço abaixo do custo (CA-03, CA-07)", () => {
    expect(custoTotal(20, [{ custo: 8, quantidade: 0.25 }, { custo: 0.5, quantidade: 2 }])).toBe(23);
    expect(custoTotal(0.1, [{ custo: 0.2, quantidade: 1 }])).toBe(0.3);
    expect(precoAbaixoDoCusto(25, 30)).toBe(true);
    expect(precoAbaixoDoCusto(30, 30)).toBe(false);
  });

  it("nome normalizado (OPEN-003)", () => {
    expect(normalizarNome("  Esmalte   VERMELHO ")).toBe("esmalte vermelho");
    expect(normalizarNome("Ação Única")).toBe("ação única");
  });
});

describe("T13 — permissões do catálogo (SPEC-005; OPEN-004)", () => {
  const acoes = readFileSync("src/lib/catalogo/acoes.ts", "utf-8");

  it.each([
    ["acaoCriarItem", "criar"],
    ["acaoEditarItem", "editar"],
    ["acaoDefinirPreco", "editar"],
    ["acaoArquivarItem", "excluir"],
  ])("%s exige Catálogo — %s", (nome, acao) => {
    expect(acoes).toMatch(new RegExp(`export const ${nome} = acaoComPermissao\\("catalogo", "${acao}"`));
  });

  it("Colaborador predefinido só vê o catálogo; o menu mostra Catálogo para quem pode ver (CA-12)", () => {
    const c = PREDEFINICOES.COLABORADOR;
    expect([pode(c, "catalogo", "ver"), pode(c, "catalogo", "criar"), pode(c, "catalogo", "editar"), pode(c, "catalogo", "excluir")]).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(menuDoMembro("COLABORADOR", c).map((i) => i.rotulo)).toContain("Catálogo");
    const semCatalogo = { ...c, catalogo: { ver: false, criar: false, editar: false, excluir: false } };
    expect(menuDoMembro("COLABORADOR", semCatalogo).map((i) => i.rotulo)).not.toContain("Catálogo");
  });
});
