import { describe, expect, it } from "vitest";
import { MENSAGENS_CATALOGO as M, validarItem } from "@/lib/catalogo/validacao";
import { codigoExatoPrimeiro, codigoValido, itemPeloCodigo, MAX_CODIGO, normalizarCodigo } from "@/lib/dominio/catalogo";
import { calcularRentabilidade } from "@/lib/dominio/relatorios";
import { csvDaTabela } from "@/lib/relatorios/arquivos";
import { tabelaDeRentabilidade } from "@/lib/relatorios/tabelas";

// SPEC-024 — testes unitários (seção 12): T01, T02 e T07.

const produto = (codigo: string | undefined) => ({ tipo: "PRODUTO_FISICO", nome: "Brinco argola dourado M", categoria: "ACESSORIOS", unidadeMedida: "un", custoBase: "12", ...(codigo === undefined ? {} : { codigo }) });
const servico = (codigo: string) => ({ tipo: "SERVICO", nome: "Manicure", categoria: "BELEZA", unidadeMedida: "atend", custoBase: "20", codigo });

describe("T01 — normalização e validação do código (CA-01, CA-03, INV-002)", () => {
  it("tira os espaços das pontas e passa para maiúsculas", () => {
    expect(normalizarCodigo("  br-015 ")).toBe("BR-015");
    expect(validarItem(produto("br-015 "), { tipo: "criar" })).toMatchObject({ ok: true, dados: { codigo: "BR-015" } });
  });

  it("vazio é item sem código, nos dois tipos", () => {
    expect(validarItem(produto(undefined), { tipo: "criar" })).toMatchObject({ ok: true, dados: { codigo: null } });
    expect(validarItem(produto("   "), { tipo: "criar" })).toMatchObject({ ok: true, dados: { codigo: null } });
    expect(validarItem(servico("man-01"), { tipo: "criar" })).toMatchObject({ ok: true, dados: { codigo: "MAN-01" } });
  });

  it("aceita letras sem acento, números, hífen, ponto, barra e sublinhado, até 20 caracteres", () => {
    for (const c of ["A", "BR-015", "CO.007", "AN/12", "KIT_3", "0001", "A".repeat(MAX_CODIGO)]) expect(codigoValido(c)).toBe(true);
    expect(validarItem(produto("abc.1/2_3-4"), { tipo: "editar", tipoDoItem: "PRODUTO_FISICO" })).toMatchObject({ ok: true, dados: { codigo: "ABC.1/2_3-4" } });
  });

  it("recusa espaço no meio, acento, outros símbolos e mais de 20 caracteres, com a mensagem de formato", () => {
    for (const c of ["BR 015", "BRÍ-1", "ção", "BR#1", "BR,1", "A".repeat(MAX_CODIGO + 1)]) {
      const v = validarItem(produto(c), { tipo: "criar" });
      expect(v.ok, c).toBe(false);
      if (!v.ok) expect(v.erros.codigo).toBe(M.codigoInvalido);
    }
    expect(codigoValido("")).toBe(false);
    expect(codigoValido("br-015")).toBe(false); // o banco só aceita maiúsculas (CHECK), por isso a normalização vem antes
  });
});

describe("T02 — item pelo código exato (CA-07, INV-005)", () => {
  const itens = [
    { id: "1", nome: "Brinco argola dourado M", codigo: "BR-015" },
    { id: "2", nome: "Brinco argola dourado G", codigo: "BR-0150" },
    { id: "3", nome: "Colar 015 cm", codigo: null },
  ];

  it("encontra o código exato, sem diferenciar maiúsculas e com espaços nas pontas", () => {
    expect(itemPeloCodigo("br-015", itens)?.id).toBe("1");
    expect(itemPeloCodigo("  BR-0150 ", itens)?.id).toBe("2");
  });

  it("parte do código, nome, vazio ou código de item fora da lista não encontram nada", () => {
    for (const t of ["br-01", "015", "Colar 015 cm", "", "   ", "BR-999"]) expect(itemPeloCodigo(t, itens), t).toBeNull();
    // Item não vendável (sem preço) nem chega à lista da Nova venda: o Enter não o encontra.
    expect(itemPeloCodigo("BR-015", itens.slice(1))).toBeNull();
  });

  it("o código exato vem primeiro; os outros mantêm a ordem", () => {
    const filtrados = [itens[2], itens[1], itens[0]];
    expect(codigoExatoPrimeiro(filtrados, "br-015").map((i) => i.id)).toEqual(["1", "3", "2"]);
    expect(codigoExatoPrimeiro(filtrados, "015").map((i) => i.id)).toEqual(["3", "2", "1"]);
    expect(codigoExatoPrimeiro(filtrados, undefined).map((i) => i.id)).toEqual(["3", "2", "1"]);
  });
});

describe("T07 — rentabilidade com a coluna Código (CA-10)", () => {
  const r = calcularRentabilidade([
    { itemId: "a", nome: "Brinco argola dourado M", codigo: "BR-015", arquivado: false, quantidade: 2, faturamentoCentavos: 15980, custoCentavos: 4000, linhasSemCusto: 0 },
    { itemId: "b", nome: "Colar antigo", codigo: "CO-001", arquivado: true, quantidade: 1, faturamentoCentavos: 5000, custoCentavos: 2000, linhasSemCusto: 0 },
    { itemId: "c", nome: "Manicure", codigo: null, arquivado: false, quantidade: 1, faturamentoCentavos: 3000, custoCentavos: 500, linhasSemCusto: 0 },
  ]);
  const t = tabelaDeRentabilidade(r);

  it("primeira coluna é o código, vazia sem código; o arquivado mantém o código", () => {
    expect(t.colunas.map((c) => c.titulo)).toEqual(["Código", "Item", "Quantidade", "Faturamento", "Custo", "Margem", "Margem %", "Observação"]);
    // Em ordem de margem (SPEC-013): 119,80, 30,00 e 25,00.
    expect(t.linhas.map((l) => [l[0], l[1]])).toEqual([
      ["BR-015", "Brinco argola dourado M"],
      ["CO-001", "Colar antigo (arquivado)"],
      ["", "Manicure"],
    ]);
    expect(t.totais).toHaveLength(t.colunas.length);
    expect(t.colunas.reduce((s, c) => s + c.largura, 0)).toBeCloseTo(1, 5);
  });

  it("CSV com o cabeçalho e o código de cada item", () => {
    const linhas = csvDaTabela(t).split("\r\n");
    expect(linhas[0].replace(/^﻿/, "")).toBe("Código;Item;Quantidade;Faturamento;Custo;Margem;Margem %;Observação");
    expect(linhas[1].startsWith("BR-015;Brinco argola dourado M;")).toBe(true);
    expect(linhas[3].startsWith(";Manicure;")).toBe(true);
  });
});
