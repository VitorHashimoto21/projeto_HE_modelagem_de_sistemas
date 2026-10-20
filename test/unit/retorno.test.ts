import { describe, expect, it } from "vitest";
import { comRetorno, retornoSeguro, rotuloDoRetorno } from "@/lib/estrutura/retorno";

// SPEC-020 — correção da homologação (T12): o "voltar" do detalhe leva à lista de origem, com os
// filtros, e só aceita caminhos internos do Catálogo e do Estoque.

describe("retornoSeguro", () => {
  it.each([
    ["/catalogo?categoria=ACESSORIOS&subcategoria=8f6f2c1e-3b5a-4f5e-9c1d-2a7b6c5d4e3f", "/catalogo?categoria=ACESSORIOS&subcategoria=8f6f2c1e-3b5a-4f5e-9c1d-2a7b6c5d4e3f"],
    ["/catalogo?arquivados=1", "/catalogo?arquivados=1"],
    ["/catalogo/subcategorias", "/catalogo/subcategorias"],
    ["/estoque?situacao=baixo&busca=brinc", "/estoque?situacao=baixo&busca=brinc"],
    ["/estoque/8f6f2c1e-3b5a-4f5e-9c1d-2a7b6c5d4e3f", "/estoque/8f6f2c1e-3b5a-4f5e-9c1d-2a7b6c5d4e3f"],
  ])("aceita %s", (valor, esperado) => {
    expect(retornoSeguro(valor, "/catalogo")).toBe(esperado);
  });

  it.each([
    "https://malicioso.com/catalogo",
    "//malicioso.com/catalogo",
    "/\\malicioso.com",
    "javascript:alert(1)",
    "catalogo",
    "/catalogos",
    "/vendas",
    "/negocio/equipe",
    "/catalogo\n/x",
    "",
    undefined,
    null,
    42,
    ["/catalogo"],
    `/catalogo?busca=${"x".repeat(600)}`,
  ])("recusa %s e usa o padrão", (valor) => {
    expect(retornoSeguro(valor, "/estoque")).toBe("/estoque");
  });

  it("descarta o fragmento (#) e mantém só caminho e filtros", () => {
    expect(retornoSeguro("/catalogo?tipo=SERVICO#topo", "/catalogo")).toBe("/catalogo?tipo=SERVICO");
  });
});

describe("comRetorno", () => {
  it("acrescenta voltar codificado, com ? ou &, e nada quando não há retorno", () => {
    expect(comRetorno("/catalogo/1", "/catalogo?categoria=ACESSORIOS&subcategoria=s")).toBe("/catalogo/1?voltar=%2Fcatalogo%3Fcategoria%3DACESSORIOS%26subcategoria%3Ds");
    expect(comRetorno("/catalogo/1?salvo=1", "/estoque")).toBe("/catalogo/1?salvo=1&voltar=%2Festoque");
    expect(comRetorno("/catalogo/1", null)).toBe("/catalogo/1");
    expect(comRetorno("/catalogo/1", "")).toBe("/catalogo/1");
  });

  it("o caminho com voltar volta igual depois de lido pela página", () => {
    const retorno = "/catalogo?busca=anel s&categoria=ACESSORIOS";
    const lido = new URL(comRetorno("/catalogo/1", retorno), "http://x").searchParams.get("voltar");
    expect(retornoSeguro(lido, "/catalogo")).toBe("/catalogo?busca=anel%20s&categoria=ACESSORIOS");
  });
});

describe("rotuloDoRetorno", () => {
  it("nomeia a lista de destino; o detalhe de outro item vira 'Voltar'", () => {
    expect(rotuloDoRetorno("/catalogo")).toBe("Catálogo");
    expect(rotuloDoRetorno("/catalogo?categoria=ACESSORIOS")).toBe("Catálogo");
    expect(rotuloDoRetorno("/catalogo?arquivados=1")).toBe("Itens arquivados");
    expect(rotuloDoRetorno("/catalogo/subcategorias")).toBe("Subcategorias");
    expect(rotuloDoRetorno("/estoque?situacao=baixo")).toBe("Estoque");
    expect(rotuloDoRetorno("/catalogo/8f6f2c1e-3b5a-4f5e-9c1d-2a7b6c5d4e3f")).toBe("Voltar");
    expect(rotuloDoRetorno("/estoque/8f6f2c1e-3b5a-4f5e-9c1d-2a7b6c5d4e3f")).toBe("Voltar");
  });
});
