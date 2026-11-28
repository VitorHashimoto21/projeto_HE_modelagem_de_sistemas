import { describe, expect, it } from "vitest";
import { podeVerCompras } from "@/lib/dominio/compras";
import {
  lerFiltrosDasCompras,
  numeroDaBusca,
  pagamentoDaCompra,
  parametrosDosFiltrosDaCompra,
  quantidadeDeFiltrosDaCompra,
  SEM_FILTROS_DE_COMPRA,
} from "@/lib/dominio/lista-de-compras";
import { menuDoMembro, menuDoSuporte } from "@/lib/equipe/menu";
import { MATRIZ_COMPLETA, PREDEFINICOES, type Matriz } from "@/lib/dominio/permissoes";
import { descreverTela, matrizDoSuporte } from "@/lib/dominio/suporte";

// SPEC-027 (etapa 2a) — a lista de compras: filtros do endereço, situação das contas, quem vê
// (OPEN-007, CA-13) e o item "Compras" no menu (OPEN-008), inclusive no modo suporte (5.9).

const FORNECEDOR = "6f1c0a52-8a0e-4d39-9a3b-2b9d6c2f1e01";

const com = (alterar: (m: Matriz) => void): Matriz => {
  const m = structuredClone(MATRIZ_COMPLETA);
  alterar(m);
  return m;
};

describe("lerFiltrosDasCompras", () => {
  it("lê a busca, o período, o fornecedor e a situação do endereço", () => {
    expect(lerFiltrosDasCompras({ busca: "  nota   1234 ", de: "2026-10-01", ate: "2026-10-31", fornecedor: FORNECEDOR.toUpperCase(), situacao: "CANCELADA" })).toEqual({
      filtros: { busca: "nota 1234", de: "2026-10-01", ate: "2026-10-31", fornecedorId: FORNECEDOR, situacao: "CANCELADA" },
      erro: null,
    });
    expect(lerFiltrosDasCompras({})).toEqual({ filtros: SEM_FILTROS_DE_COMPRA, erro: null });
  });

  it("ignora valores desconhecidos e recusa o período inválido ou invertido, sem filtrar por ele", () => {
    expect(lerFiltrosDasCompras({ fornecedor: "abc", situacao: "PAGA", busca: ["x"] }).filtros).toEqual(SEM_FILTROS_DE_COMPRA);
    expect(lerFiltrosDasCompras({ de: "2026-02-30" })).toEqual({ filtros: SEM_FILTROS_DE_COMPRA, erro: "Data inválida." });
    expect(lerFiltrosDasCompras({ de: "2026-11-02", ate: "2026-11-01", situacao: "REGISTRADA" })).toEqual({
      filtros: { ...SEM_FILTROS_DE_COMPRA, situacao: "REGISTRADA" },
      erro: "A data final precisa ser igual ou posterior à inicial.",
    });
    expect(lerFiltrosDasCompras({ busca: "x".repeat(150) }).filtros.busca).toHaveLength(100);
  });

  it("conta os filtros do painel (o período conta como um; a situação tem botões próprios) e os devolve para o endereço", () => {
    const f = { busca: "nota", de: "2026-10-01", ate: null, fornecedorId: FORNECEDOR, situacao: "CANCELADA" as const };
    expect(quantidadeDeFiltrosDaCompra(f)).toBe(3);
    expect(quantidadeDeFiltrosDaCompra({ ...SEM_FILTROS_DE_COMPRA, situacao: "REGISTRADA" })).toBe(0);
    expect(parametrosDosFiltrosDaCompra(f)).toEqual({ busca: "nota", de: "2026-10-01", fornecedor: FORNECEDOR, situacao: "CANCELADA" });
  });
});

describe("numeroDaBusca", () => {
  it("reconhece o nº da compra com ou sem prefixo", () => {
    expect(numeroDaBusca("12")).toBe(12);
    expect(numeroDaBusca("nº 12")).toBe(12);
    expect(numeroDaBusca("N°12")).toBe(12);
    expect(numeroDaBusca("no. 7")).toBe(7);
    expect(numeroDaBusca("#3")).toBe(3);
    expect(numeroDaBusca("NF-12")).toBeNull();
    expect(numeroDaBusca("1234567890")).toBeNull();
  });
});

describe("pagamentoDaCompra (5.6)", () => {
  it("a pagar, paga em parte e paga, sem contar as contas canceladas", () => {
    expect(pagamentoDaCompra(["ABERTA", "ABERTA"])).toBe("A_PAGAR");
    expect(pagamentoDaCompra(["QUITADA", "ABERTA"])).toBe("PARCIAL");
    expect(pagamentoDaCompra(["PARCIAL"])).toBe("PARCIAL");
    expect(pagamentoDaCompra(["QUITADA", "QUITADA"])).toBe("PAGA");
    expect(pagamentoDaCompra(["QUITADA", "CANCELADA"])).toBe("PAGA");
    expect(pagamentoDaCompra([])).toBe("A_PAGAR");
  });
});

describe("quem vê as compras (OPEN-007, CA-13) e o menu (OPEN-008)", () => {
  it("ver exige Estoque — ver e Financeiro — ver; o Colaborador padrão não vê", () => {
    expect(podeVerCompras({ permissoes: MATRIZ_COMPLETA })).toBe(true);
    expect(podeVerCompras({ permissoes: PREDEFINICOES.COLABORADOR })).toBe(false);
    expect(podeVerCompras({ permissoes: com((m) => (m.financeiro.ver = false)) })).toBe(false);
    expect(podeVerCompras({ permissoes: com((m) => (m.estoque.ver = false)) })).toBe(false);
  });

  it('"Compras" fica logo abaixo de "Vendas", só para quem vê as compras', () => {
    const hrefs = (m: Matriz) => menuDoMembro("GERENTE", m).map((i) => i.href);
    expect(hrefs(MATRIZ_COMPLETA).slice(3, 6)).toEqual(["/vendas/nova", "/vendas", "/compras"]);
    expect(menuDoMembro("COLABORADOR", PREDEFINICOES.COLABORADOR).map((i) => i.href)).not.toContain("/compras");
    expect(hrefs(com((m) => (m.financeiro.ver = false)))).not.toContain("/compras");
  });

  it("no modo suporte, entra só com o Estoque e o Financeiro liberados", () => {
    expect(menuDoSuporte(matrizDoSuporte(["estoque", "financeiro"])).map((i) => i.href)).toEqual(["/estoque", "/compras", "/financeiro"]);
    expect(menuDoSuporte(matrizDoSuporte(["estoque", "vendas"])).map((i) => i.href)).toEqual(["/estoque", "/vendas"]);
  });

  it("as telas de compra entram no registro do suporte com o próprio nome", () => {
    expect(descreverTela("/compras?situacao=CANCELADA")).toEqual({ modulo: null, descricao: "Compras" });
    // Etapa 2b: o detalhe traz o id, para o registro completar com o nº da compra.
    expect(descreverTela(`/compras/${FORNECEDOR}`)).toEqual({ modulo: null, descricao: "Compras — compra", detalhe: { tipo: "compra", id: FORNECEDOR } });
    expect(descreverTela("/compras/nova")).toEqual({ modulo: null, descricao: "Compras" });
  });
});
