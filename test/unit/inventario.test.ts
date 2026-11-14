import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { intervaloDoDia } from "@/lib/dominio/datas";
import {
  custoNaData,
  dataPadraoDoInventario,
  lerDataDoInventario,
  MENSAGENS_INVENTARIO as M,
  montarInventario,
  notasDoInventario,
  observacaoDaLinha,
  quantidadeNaData,
  type ProdutoNaData,
} from "@/lib/dominio/inventario";
import { MATRIZ_COMPLETA, MATRIZ_VAZIA } from "@/lib/dominio/permissoes";
import { podeVerInventario } from "@/lib/estoque/inventario";
import { csvDaTabela } from "@/lib/relatorios/arquivos";
import { tabelaDoInventario } from "@/lib/relatorios/tabelas";

// SPEC-025 — testes unitários (seção 12): T01 a T04 e a guarda das rotas (T07, parte estática).

describe("T01 — quantidade numa data (CA-01 a CA-04, CA-09, INV-001, INV-002)", () => {
  it("sem movimentações posteriores, é o saldo atual", () => {
    expect(quantidadeNaData(10, { entradas: 0, saidas: 0 })).toBe(10);
  });

  it("desfaz entradas e estornos (subtrai) e saídas por venda e manuais (soma)", () => {
    // Saldo de hoje 10; depois da data: entrada de 5 e estorno de 1; vendas de 2 e saída manual de 4.
    expect(quantidadeNaData(10, { entradas: 6, saidas: 6 })).toBe(10);
    expect(quantidadeNaData(10, { entradas: 0, saidas: 2 })).toBe(12);
    expect(quantidadeNaData(10, { entradas: 5, saidas: 0 })).toBe(5);
  });

  it("frações sem resíduo de ponto flutuante", () => {
    expect(quantidadeNaData(1.3, { entradas: 0.1, saidas: 0.2 })).toBe(1.4);
  });

  it("uma saída com data anterior à entrada deixa a quantidade negativa naquele dia", () => {
    expect(quantidadeNaData(0, { entradas: 5, saidas: 0 })).toBe(-5);
  });

  it("o fim do dia é o do horário do negócio (23h59 conta; 00h00 do dia seguinte não)", () => {
    const fim = intervaloDoDia("2026-10-31").fim;
    expect(fim.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });
});

describe("T02 — custo numa data (CA-05, CA-06, INV-003)", () => {
  const historico = [
    { custoCentavos: 1200, vigenteDesde: new Date("2026-11-16T13:00:00Z") },
    { custoCentavos: 1000, vigenteDesde: new Date("2026-11-05T12:00:00Z") },
  ];
  const fim = (dia: string) => intervaloDoDia(dia).fim;

  it("usa o último registro vigente até o fim do dia, em qualquer ordem", () => {
    expect(custoNaData(historico, fim("2026-11-15"), 1200)).toEqual({ custoCentavos: 1000, doInicio: false });
    expect(custoNaData(historico, fim("2026-11-16"), 1200)).toEqual({ custoCentavos: 1200, doInicio: false });
    expect(custoNaData(historico, fim("2026-12-31"), 1200)).toEqual({ custoCentavos: 1200, doInicio: false });
  });

  it("antes do início do histórico, vale o primeiro registro, marcado", () => {
    expect(custoNaData(historico, fim("2026-10-31"), 1200)).toEqual({ custoCentavos: 1000, doInicio: true });
  });

  it("sem histórico, vale o custo atual, marcado", () => {
    expect(custoNaData([], fim("2026-10-31"), 850)).toEqual({ custoCentavos: 850, doInicio: true });
  });
});

describe("T03 — data padrão e data recusada (CA-11)", () => {
  it("último dia do mês anterior, inclusive na virada do ano e em fevereiro", () => {
    expect(dataPadraoDoInventario("2026-11-01")).toBe("2026-10-31");
    expect(dataPadraoDoInventario("2026-11-30")).toBe("2026-10-31");
    expect(dataPadraoDoInventario("2027-01-15")).toBe("2026-12-31");
    expect(dataPadraoDoInventario("2028-03-02")).toBe("2028-02-29");
  });

  it("vazia vira a padrão; hoje e datas passadas valem; futura e inválida são recusadas", () => {
    expect(lerDataDoInventario(undefined, "2026-11-01")).toEqual({ ok: true, data: "2026-10-31" });
    expect(lerDataDoInventario("2026-11-01", "2026-11-01")).toEqual({ ok: true, data: "2026-11-01" });
    expect(lerDataDoInventario("2024-01-31", "2026-11-01")).toEqual({ ok: true, data: "2024-01-31" });
    expect(lerDataDoInventario("2026-11-02", "2026-11-01")).toEqual({ ok: false, erro: M.dataFutura });
    expect(lerDataDoInventario("2026-02-30", "2026-11-01")).toEqual({ ok: false, erro: M.dataInvalida });
    expect(lerDataDoInventario("31/10/2026", "2026-11-01")).toEqual({ ok: false, erro: M.dataInvalida });
  });
});

describe("T04 — inventário, tabela e CSV (CA-07 a CA-10, INV-006, INV-008)", () => {
  const p = (nome: string, extra: Partial<ProdutoNaData>): ProdutoNaData => ({
    itemId: nome,
    codigo: "X-1",
    nome,
    arquivado: false,
    unidade: "un",
    ncm: "71171900",
    quantidade: 1,
    custoCentavos: 1000,
    custoDoInicio: false,
    ...extra,
  });
  const inv = montarInventario("2026-10-31", [
    p("Colar riviera", { codigo: "CO-007", quantidade: 1.5, custoCentavos: 3333 }),
    p("Brinco argola dourado M", { codigo: "BR-015", unidade: "par", quantidade: 12, custoCentavos: 1850, custoDoInicio: true }),
    p("Zerado", { quantidade: 0 }),
    p("Anel antigo", { arquivado: true, codigo: null, ncm: null, quantidade: 2, custoCentavos: 0 }),
    p("Pulseira", { quantidade: -1, custoCentavos: 500 }),
  ]);

  it("só quantidade diferente de zero, em ordem de descrição; valor arredondado por linha; total = soma", () => {
    expect(inv.linhas.map((l) => l.nome)).toEqual(["Anel antigo", "Brinco argola dourado M", "Colar riviera", "Pulseira"]);
    expect(inv.linhas.map((l) => l.valorCentavos)).toEqual([null, 22200, 5000, -500]);
    expect(inv.totalCentavos).toBe(22200 + 5000 - 500);
  });

  it("avisos: sem custo, código e NCM; custo do início; quantidade negativa", () => {
    expect(inv.avisos).toEqual({ semCusto: 1, semCodigo: 1, semNcm: 1, custoDoInicio: 1, negativos: 1 });
    const notas = notasDoInventario(inv.avisos);
    expect(notas[0]).toBe("1 produto usa o custo do início do histórico: o HE ainda não guardava o custo nesta data.");
    expect(notas).toContain("Produtos com dados faltando: 1 sem custo, 1 sem código, 1 sem NCM.");
    expect(notas[notas.length - 1]).toMatch(/data retroativa/);
  });

  it("tabela com as colunas pedidas, campos vazios sem custo, observações e total", () => {
    const t = tabelaDoInventario(inv);
    expect(t.colunas.map((c) => c.titulo)).toEqual(["Código", "Descrição", "Unidade", "NCM", "Quantidade", "Custo unitário", "Valor total", "Observação"]);
    expect(t.colunas.reduce((s, c) => s + c.largura, 0)).toBeCloseTo(1, 5);
    expect(t.linhas).toEqual([
      ["", "Anel antigo (arquivado)", "UN", "", "2", "", "", "Sem custo"],
      ["BR-015", "Brinco argola dourado M", "PAR", "71171900", "12", "18,50", "222,00", "Custo do início do histórico"],
      ["CO-007", "Colar riviera", "UN", "71171900", "1,5", "33,33", "50,00", ""],
      ["X-1", "Pulseira", "UN", "71171900", "-1", "5,00", "-5,00", "Quantidade negativa nesta data"],
    ]);
    expect(t.totais).toEqual(["Total", "", "", "", "", "", "267,00", ""]);
  });

  it("observações juntas, sem o separador do CSV", () => {
    const l = { ...inv.linhas[3], custoDoInicio: true };
    expect(observacaoDaLinha(l)).toBe("Quantidade negativa nesta data · Custo do início do histórico");
  });

  it("CSV no padrão brasileiro dos Relatórios", () => {
    const linhas = csvDaTabela(tabelaDoInventario(inv)).replace(/^﻿/, "").split("\r\n");
    expect(linhas[0]).toBe("Código;Descrição;Unidade;NCM;Quantidade;Custo unitário;Valor total;Observação");
    expect(linhas[2]).toBe("BR-015;Brinco argola dourado M;PAR;71171900;12;18,50;222,00;Custo do início do histórico");
    expect(linhas[5]).toBe("Total;;;;;;267,00;");
  });

  it("sem produtos, o inventário fica vazio com total zero", () => {
    expect(montarInventario("2026-10-31", [p("Zerado", { quantidade: 0 })])).toMatchObject({ linhas: [], totalCentavos: 0 });
  });
});

describe("T07 — permissão e guarda das rotas (CA-12)", () => {
  it("exige ver o Estoque e o Catálogo", () => {
    expect(podeVerInventario(MATRIZ_COMPLETA)).toBe(true);
    expect(podeVerInventario({ ...MATRIZ_COMPLETA, catalogo: { ...MATRIZ_COMPLETA.catalogo, ver: false } })).toBe(false);
    expect(podeVerInventario({ ...MATRIZ_COMPLETA, estoque: { ...MATRIZ_COMPLETA.estoque, ver: false } })).toBe(false);
    expect(podeVerInventario(MATRIZ_VAZIA)).toBe(false);
  });

  it("a tela e os arquivos recusam o modo suporte e conferem a permissão no servidor", () => {
    for (const arquivo of ["src/app/(app)/estoque/inventario/page.tsx", "src/app/(app)/estoque/inventario/exportar/route.ts"]) {
      const codigo = readFileSync(arquivo, "utf-8");
      expect(codigo, arquivo).toMatch(/await exigirMembroForaDoSuporte\(\)/);
      expect(codigo, arquivo).toMatch(/if \(!podeVerInventario\(membro\.permissoes\)\) redirect\(ROTA_SEM_ACESSO\)/);
    }
  });
});
