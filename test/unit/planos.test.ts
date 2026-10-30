import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { menuDoMembro } from "@/lib/equipe/menu";
import { MATRIZ_COMPLETA, MATRIZ_VAZIA, PREDEFINICOES, type Matriz } from "@/lib/dominio/permissoes";
import { inicioDoHistorico, limitarCompetencia, limitarDia, planejarVoltaAoGratuito, podeNoPlano } from "@/lib/dominio/planos";
import { calcularRentabilidade, gerarCsv, lerPeriodo, nomeDoArquivo, valorParaPlanilha, type LinhaVendida } from "@/lib/dominio/relatorios";
import { csvDaTabela, pdfDaTabela, textoParaPdf } from "@/lib/relatorios/arquivos";
import { conferirAcesso, podeVerRelatorio, relatoriosPermitidos } from "@/lib/relatorios/servicos";
import { tabelaDeRentabilidade, tabelaDeVendas, type Tabela } from "@/lib/relatorios/tabelas";

// SPEC-013 — testes unitários (seção 12).

describe("T01 — funcionalidades por plano e histórico de 12 meses (RF45, RN18)", () => {
  it("relatórios, histórico completo e equipe maior só no pago", () => {
    for (const f of ["relatorios", "historicoCompleto", "multiplosColaboradores"] as const) {
      expect(podeNoPlano("GRATUITO", f)).toBe(false);
      expect(podeNoPlano("PAGO", f)).toBe(true);
    }
  });

  it("gratuito: do dia 1º do mês atual − 11 até hoje; pago: sem limite", () => {
    expect(inicioDoHistorico("GRATUITO", "2026-10-11")).toBe("2025-11-01");
    expect(inicioDoHistorico("GRATUITO", "2026-01-31")).toBe("2025-02-01");
    expect(inicioDoHistorico("PAGO", "2026-10-11")).toBeNull();
    expect(limitarDia("2025-08-01", "2025-11-01")).toEqual({ dia: "2025-11-01", ajustado: true });
    expect(limitarDia("2026-01-01", "2025-11-01")).toEqual({ dia: "2026-01-01", ajustado: false });
    expect(limitarDia("2020-01-01", null)).toEqual({ dia: "2020-01-01", ajustado: false });
    expect(limitarCompetencia("2025-10", "2025-11-01")).toEqual({ comp: "2025-11", ajustado: true });
    expect(limitarCompetencia("2025-11", "2025-11-01")).toEqual({ comp: "2025-11", ajustado: false });
  });

  it("volta ao gratuito (OPEN-001): fica o escolhido, os outros são suspensos; escolha de fora é recusada", () => {
    const c = [
      { id: "a", papel: "GERENTE" as const },
      { id: "b", papel: "COLABORADOR" as const },
      { id: "c", papel: "COLABORADOR" as const },
    ];
    expect(planejarVoltaAoGratuito(c, "b")).toEqual({ ok: true, manter: "b", suspender: ["a", "c"] });
    expect(planejarVoltaAoGratuito(c, null)).toEqual({ ok: true, manter: null, suspender: ["a", "b", "c"] });
    expect(planejarVoltaAoGratuito(c, "x")).toEqual({ ok: false, erro: "EscolhaInvalida" });
    expect(planejarVoltaAoGratuito([], null)).toEqual({ ok: true, manter: null, suspender: [] });
  });
});

describe("T02 — rentabilidade (RF70)", () => {
  const linhas: LinhaVendida[] = [
    { itemId: "e", nome: "Esmalte", codigo: "ESM-01", arquivado: false, quantidade: 2, faturamentoCentavos: 3600, custoCentavos: 1600, linhasSemCusto: 0 },
    { itemId: "m", nome: "Manicure", codigo: null, arquivado: false, quantidade: 3, faturamentoCentavos: 15000, custoCentavos: 3600, linhasSemCusto: 0 },
    { itemId: "b", nome: "Brinde", codigo: null, arquivado: true, quantidade: 1, faturamentoCentavos: 0, custoCentavos: 500, linhasSemCusto: 0 },
  ];

  it("CA-08: Manicure R$ 150, custo R$ 36, margem R$ 114 (76%); Esmalte R$ 36, custo R$ 16, margem R$ 20 (55,56%)", () => {
    const r = calcularRentabilidade(linhas);
    expect(r.itens.map((i) => [i.nome, i.margemCentavos, i.margemPercentual])).toEqual([
      ["Manicure", 11400, 76],
      ["Esmalte", 2000, 55.56],
      ["Brinde", -500, null],
    ]);
    expect(r.totais).toEqual({ quantidade: 6, faturamentoCentavos: 18600, custoCentavos: 5700, margemCentavos: 12900, margemPercentual: 69.35 });
  });

  it("ordenação por faturamento e por quantidade", () => {
    expect(calcularRentabilidade(linhas, "faturamento").itens.map((i) => i.nome)).toEqual(["Manicure", "Esmalte", "Brinde"]);
    expect(calcularRentabilidade(linhas, "quantidade").itens.map((i) => i.nome)).toEqual(["Manicure", "Esmalte", "Brinde"]);
    expect(calcularRentabilidade([], "margem").totais.margemPercentual).toBeNull();
  });

  it("período: atalhos, datas, datas futuras viram hoje, inválidas e acima de 5 anos recusadas", () => {
    const hoje = "2026-10-11";
    expect(lerPeriodo({}, hoje)).toEqual({ ok: true, de: "2026-10-01", ate: hoje, chave: "mes" });
    expect(lerPeriodo({ periodo: "mesPassado" }, hoje)).toEqual({ ok: true, de: "2026-09-01", ate: "2026-09-30", chave: "mesPassado" });
    expect(lerPeriodo({ periodo: "12meses" }, hoje)).toMatchObject({ de: "2025-11-01", ate: hoje });
    expect(lerPeriodo({ de: "2026-01-01", ate: "2027-01-01" }, hoje)).toEqual({ ok: true, de: "2026-01-01", ate: hoje, chave: "datas" });
    expect(lerPeriodo({ de: "2026-02-30", ate: hoje }, hoje).ok).toBe(false);
    expect(lerPeriodo({ de: "2026-10-05", ate: "2026-10-01" }, hoje).ok).toBe(false);
    expect(lerPeriodo({ de: "2020-01-01", ate: hoje }, hoje).ok).toBe(false);
  });
});

describe("T03 — CSV e PDF (OPEN-002, OPEN-006)", () => {
  it("CSV brasileiro: BOM, ponto e vírgula, vírgula decimal, aspas, CRLF e proteção contra fórmula", () => {
    const csv = gerarCsv(["Descrição", "Valor"], [["Aluguel; sala 2", valorParaPlanilha(-8000)], ['Diz "oi"', valorParaPlanilha(123456)], ["=HYPERLINK(1)", "1,00"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿Descrição;Valor\r\n"Aluguel; sala 2";-80,00\r\n"Diz ""oi""";1234,56\r\n\'=HYPERLINK(1);1,00\r\n');
    expect(valorParaPlanilha(5)).toBe("0,05");
    expect(nomeDoArquivo("fluxo", "2026-10-01", "2026-10-11", "csv")).toBe("he-fluxo-2026-10-01-a-2026-10-11.csv");
  });

  it("vendas: canceladas marcadas e fora do total; totais no fim", () => {
    const t = tabelaDeVendas([
      { numero: 1, data: new Date("2026-10-10T15:00:00Z"), status: "CONCLUIDA", totalCentavos: 5000, pagamentos: [{ forma: "PIX", valorCentavos: 5000, parcelas: 1 }], itens: [{ nome: "Manicure", quantidade: 1 }], registradaPor: "Gisele" },
      { numero: 2, data: new Date("2026-10-10T16:00:00Z"), status: "CANCELADA", totalCentavos: 3600, pagamentos: [{ forma: "CREDITO", valorCentavos: 3600, parcelas: 3 }], itens: [{ nome: "Esmalte", quantidade: 2 }], registradaPor: "Gisele" },
    ]);
    expect(t.linhas[1].slice(0, 5)).toEqual(["2", "10/10/2026", "Cancelada", "36,00", "Crédito 3x 36,00"]);
    expect(t.totais.slice(0, 4)).toEqual(["", "1 concluídas", "1 canceladas", "50,00"]);
    expect(csvDaTabela(t).split("\r\n")).toHaveLength(5); // cabeçalho, 2 linhas, totais e a quebra final
  });

  it("PDF: arquivo válido, com várias páginas e caracteres fora da fonte trocados", async () => {
    const r = calcularRentabilidade(
      Array.from({ length: 120 }, (_, i) => ({ itemId: String(i), nome: `Item ${i} − ção`, codigo: `IT-${i}`, arquivado: false, quantidade: 1, faturamentoCentavos: 1000, custoCentavos: 400, linhasSemCusto: 0 })),
    );
    const bytes = await pdfDaTabela(tabelaDeRentabilidade(r), { negocio: "Studio Gisele", periodo: "01/10/2026 a 11/10/2026", geradoEm: "11/10/2026 10:00" });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(2);
    expect(textoParaPdf("A − B → ✓ 😀 ção")).toBe("A - B -> v ? ção");
    const vazio: Tabela = { titulo: "Vendas", colunas: [{ titulo: "Nº", largura: 1 }], linhas: [], totais: [""] };
    expect((await PDFDocument.load(await pdfDaTabela(vazio, { negocio: "X", periodo: "-", geradoEm: "-" }))).getPageCount()).toBe(1);
  });
});

describe("T04 — sem trava de volume; um só ponto de troca de plano (INV-001, INV-003)", () => {
  const arquivos = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
  const fontes = arquivos("src").filter((p) => !p.includes("generated"));

  it("produto, venda, lançamento e conta nunca consultam o plano", () => {
    for (const f of ["src/lib/db/catalogo.ts", "src/lib/db/estoque.ts", "src/lib/db/vendas.ts", "src/lib/db/financeiro.ts", "src/lib/vendas/servicos.ts", "src/lib/financeiro/servicos.ts", "src/lib/catalogo/servicos.ts", "src/lib/estoque/servicos.ts"]) {
      const t = readFileSync(f, "utf8");
      expect(t, f).not.toMatch(/podeNoPlano|planoDoNegocio|planoDoMembro|"plano"|plano:/);
    }
  });

  it("Negocio.plano e o HistoricoPlano só são escritos por alterarPlano (src/lib/db/planos.ts)", () => {
    const escreve = fontes.filter((f) => /planoAlteradoEm\s*:|historicoPlano\.create|data:\s*\{\s*plano\s*:/.test(readFileSync(f, "utf8")));
    expect(escreve.map((f) => f.replace(/\\/g, "/"))).toEqual(["src/lib/db/planos.ts"]);
  });
});

describe("permissões dos relatórios e menu (OPEN-003, OPEN-004)", () => {
  const com = (vendas: boolean, financeiro: boolean): Matriz => ({
    ...MATRIZ_VAZIA,
    vendas: { ver: vendas, criar: false, editar: false, excluir: false },
    financeiro: { ver: financeiro, criar: false, editar: false, excluir: false },
  });

  it("rentabilidade = Vendas e Financeiro; vendas = Vendas; fluxo e contas = Financeiro", () => {
    expect(relatoriosPermitidos(com(true, true))).toEqual(["rentabilidade", "vendas", "fluxo", "contas"]);
    expect(relatoriosPermitidos(com(true, false))).toEqual(["vendas"]);
    expect(relatoriosPermitidos(com(false, true))).toEqual(["fluxo", "contas"]);
    expect(relatoriosPermitidos(PREDEFINICOES.COLABORADOR)).toEqual(["vendas"]);
    expect(podeVerRelatorio(com(true, false), "rentabilidade")).toBe(false);
  });

  it("gratuito recusa pelo plano antes da permissão; pago recusa pela permissão", () => {
    expect(conferirAcesso("GRATUITO", MATRIZ_COMPLETA, "vendas")?.motivo).toBe("plano");
    expect(conferirAcesso("PAGO", com(false, true), "vendas")?.motivo).toBe("permissao");
    expect(conferirAcesso("PAGO", MATRIZ_COMPLETA, "rentabilidade")).toBeNull();
  });

  it("menu: Relatórios com o selo no gratuito; Plano só para o Dono; sem Vendas nem Financeiro, sem Relatórios", () => {
    const relatorios = (m: ReturnType<typeof menuDoMembro>) => m.find((i) => i.href === "/relatorios");
    expect(relatorios(menuDoMembro("GERENTE", MATRIZ_COMPLETA, "GRATUITO"))).toEqual({ rotulo: "Relatórios", href: "/relatorios", selo: "Plano pago" });
    expect(relatorios(menuDoMembro("GERENTE", MATRIZ_COMPLETA, "PAGO"))).toEqual({ rotulo: "Relatórios", href: "/relatorios" });
    expect(relatorios(menuDoMembro("COLABORADOR", MATRIZ_VAZIA, "PAGO"))).toBeUndefined();
    expect(menuDoMembro("GERENTE", MATRIZ_COMPLETA).map((i) => i.href)).not.toContain("/negocio/plano");
    expect(menuDoMembro("DONO", MATRIZ_COMPLETA).map((i) => i.href)).toContain("/negocio/plano");
  });
});
