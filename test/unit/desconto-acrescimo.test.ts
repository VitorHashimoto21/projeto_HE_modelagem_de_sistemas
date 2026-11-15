import { describe, expect, it } from "vitest";
import { abatidoDoPagamento, descontoDaTaxa, estaAtrasada, restanteDaConta } from "@/lib/dominio/financeiro";
import { MENSAGENS_FINANCEIRO as M, validarPagamento } from "@/lib/financeiro/validacao";
import type { ContaExportada } from "@/lib/db/relatorios";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { csvDaTabela, pdfDaTabela, quebrarTexto } from "@/lib/relatorios/arquivos";
import { tabelaDeContas } from "@/lib/relatorios/tabelas";

// SPEC-028 — T01 (etapas 1 e 2) e T06 (etapa 3): validação do pagamento com desconto e acréscimo, abatido e restante.

const HOJE = "2026-11-15";
const pagamento = (extra: Record<string, string> = {}) => validarPagamento({ valor: "194", data: HOJE, forma: "CREDITO", ...extra }, HOJE);

describe("T01 — validação do pagamento com desconto e acréscimo (CA-01, CA-02, CA-04 a CA-06, INV-004)", () => {
  it("aceita o recebimento com desconto e motivo (CA-01)", () => {
    expect(pagamento({ desconto: "6", motivoDesconto: "TAXA_MAQUININHA" })).toEqual({
      ok: true,
      dados: {
        valorCentavos: 19400,
        dia: HOJE,
        forma: "CREDITO",
        descontoCentavos: 600,
        acrescimoCentavos: 0,
        motivoDesconto: "TAXA_MAQUININHA",
        motivoAcrescimo: null,
        observacao: null,
      },
    });
  });

  it("aceita valores com vírgula, como o valor exato da maquininha (CA-02)", () => {
    const r = pagamento({ valor: "193,80", desconto: "6,20", motivoDesconto: "TAXA_MAQUININHA" });
    expect(r.ok && [r.dados.valorCentavos, r.dados.descontoCentavos]).toEqual([19380, 620]);
  });

  it("sem desconto nem acréscimo, como antes da SPEC-028; motivo sem valor é ignorado", () => {
    const r = pagamento({ motivoDesconto: "TAXA_MAQUININHA", motivoAcrescimo: "JUROS_MULTA" });
    expect(r.ok && r.dados).toMatchObject({ descontoCentavos: 0, acrescimoCentavos: 0, motivoDesconto: null, motivoAcrescimo: null });
  });

  it("acréscimo com o motivo Juros ou multa (CA-04)", () => {
    const r = pagamento({ valor: "102,50", acrescimo: "2,50", motivoAcrescimo: "JUROS_MULTA" });
    expect(r.ok && r.dados).toMatchObject({ valorCentavos: 10250, acrescimoCentavos: 250, motivoAcrescimo: "JUROS_MULTA" });
  });

  it("desconto ou acréscimo sem motivo é recusado (CA-06)", () => {
    expect(pagamento({ desconto: "6" })).toEqual({ ok: false, erros: { motivoDesconto: M.motivoDoDesconto } });
    expect(pagamento({ acrescimo: "2" })).toEqual({ ok: false, erros: { motivoAcrescimo: M.motivoDoAcrescimo } });
    expect(pagamento({ desconto: "6", motivoDesconto: "INVENTADO" })).toEqual({ ok: false, erros: { motivoDesconto: M.motivoDoDesconto } });
  });

  it("o motivo Outro pede a observação; a observação longa é recusada (CA-06)", () => {
    expect(pagamento({ desconto: "6", motivoDesconto: "OUTRO" })).toEqual({ ok: false, erros: { observacao: M.observacaoObrigatoria } });
    expect(pagamento({ acrescimo: "1", motivoAcrescimo: "OUTRO", observacao: "   " })).toEqual({ ok: false, erros: { observacao: M.observacaoObrigatoria } });
    const r = pagamento({ desconto: "6", motivoDesconto: "OUTRO", observacao: "  Arredondamento   do cliente " });
    expect(r.ok && r.dados.observacao).toBe("Arredondamento do cliente");
    expect(pagamento({ desconto: "6", motivoDesconto: "DESCONTO_COMBINADO", observacao: "x".repeat(121) })).toEqual({ ok: false, erros: { observacao: M.observacaoLonga } });
  });

  it("desconto e acréscimo negativos ou inválidos são recusados", () => {
    expect(pagamento({ desconto: "-6", motivoDesconto: "TAXA_MAQUININHA" })).toEqual({ ok: false, erros: { desconto: M.ajusteNegativo } });
    expect(pagamento({ acrescimo: "-1", motivoAcrescimo: "JUROS_MULTA" })).toEqual({ ok: false, erros: { acrescimo: M.ajusteNegativo } });
    expect(pagamento({ desconto: "seis", motivoDesconto: "TAXA_MAQUININHA" })).toEqual({ ok: false, erros: { desconto: M.ajusteInvalido } });
    expect(pagamento({ desconto: "6,001", motivoDesconto: "TAXA_MAQUININHA" })).toEqual({ ok: false, erros: { desconto: M.ajusteInvalido } });
  });

  it("o pagamento sempre abate mais que zero (INV-004)", () => {
    expect(pagamento({ valor: "10", acrescimo: "10", motivoAcrescimo: "JUROS_MULTA" })).toEqual({ ok: false, erros: { acrescimo: M.acrescimoAcimaDoAbatido } });
    expect(pagamento({ valor: "10", desconto: "1", motivoDesconto: "DESCONTO_COMBINADO", acrescimo: "10,99", motivoAcrescimo: "JUROS_MULTA" }).ok).toBe(true);
  });
});

describe("T01 — abatido, restante e atraso (CA-05, INV-001)", () => {
  it("abatido = valor + desconto − acréscimo; restante = total − pago − descontos + acréscimos", () => {
    expect(abatidoDoPagamento({ valorCentavos: 15000, descontoCentavos: 3000, acrescimoCentavos: 0 })).toBe(18000);
    expect(abatidoDoPagamento({ valorCentavos: 10250, descontoCentavos: 0, acrescimoCentavos: 250 })).toBe(10000);
    expect(restanteDaConta({ totalCentavos: 30000, pagoCentavos: 15000, descontoCentavos: 3000 })).toBe(12000);
    expect(restanteDaConta({ totalCentavos: 10000, pagoCentavos: 10250, acrescimoCentavos: 250 })).toBe(0);
    expect(restanteDaConta({ totalCentavos: 30000, pagoCentavos: 10000 })).toBe(20000);
  });

  it("a conta paga com desconto não fica atrasada; a que ainda tem restante fica", () => {
    const c = { vencimento: "2026-11-01", status: "PARCIAL" as const, totalCentavos: 20000, pagoCentavos: 19400 };
    expect(estaAtrasada(c, HOJE)).toBe(true);
    expect(estaAtrasada({ ...c, descontoCentavos: 600 }, HOJE)).toBe(false);
  });
});

describe("T01 — desconto da taxa da maquininha (CA-01, CA-03, INV-005)", () => {
  it("restante × taxa, arredondado ao centavo", () => {
    expect(descontoDaTaxa(20000, 3)).toBe(600);
    expect(descontoDaTaxa(23500, 2.55)).toBe(599); // 5,9925 → 5,99
    expect(descontoDaTaxa(10000, 3.19)).toBe(319);
    expect(descontoDaTaxa(3333, 4.99)).toBe(166); // 1,663 → 1,66
    expect(descontoDaTaxa(1, 3)).toBe(0); // 0,03 centavo → 0
  });

  it("sem taxa, sem restante ou sem valor a receber, o desconto é zero", () => {
    expect(descontoDaTaxa(20000, 0)).toBe(0);
    expect(descontoDaTaxa(0, 3)).toBe(0);
    expect(descontoDaTaxa(100, 100)).toBe(0);
  });
});

describe("T06 (unitário) — relatório de Contas com descontos, acréscimos e estornos (CA-10)", () => {
  const conta = (extra: Partial<ContaExportada>): ContaExportada => ({
    tipo: "RECEBER",
    descricao: "Venda nº 901",
    categoria: "VENDAS",
    vencimento: new Date("2026-11-13T15:00:00Z"),
    status: "QUITADA",
    totalCentavos: 20000,
    pagoCentavos: 19400,
    descontoCentavos: 600,
    acrescimoCentavos: 0,
    pessoa: null,
    numeroDocumento: null,
    pagamentos: [{ data: new Date("2026-11-13T15:00:00Z"), forma: "CREDITO", valorCentavos: 19400, descontoCentavos: 600, motivoDesconto: "TAXA_MAQUININHA" }],
    ...extra,
  });

  it("colunas Descontos e Acréscimos; cada pagamento com o motivo e o estorno marcado", () => {
    const boleto = conta({
      tipo: "PAGAR",
      descricao: "Boleto",
      categoria: "FORNECEDORES",
      totalCentavos: 10000,
      pagoCentavos: 10250,
      descontoCentavos: 0,
      acrescimoCentavos: 250,
      pagamentos: [
        { data: new Date("2026-11-10T15:00:00Z"), forma: "PIX", valorCentavos: 4000, estornadoEm: new Date("2026-11-11T15:00:00Z") },
        { data: new Date("2026-11-12T15:00:00Z"), forma: "BOLETO", valorCentavos: 10250, acrescimoCentavos: 250, motivoAcrescimo: "JUROS_MULTA" },
      ],
    });
    const t = tabelaDeContas([conta({}), boleto]);
    expect(t.tamanho).toBe(7);
    expect(t.colunas.reduce((s, c) => s + c.largura, 0)).toBeCloseTo(1, 5);
    expect(t.linhas[0].slice(7, 13)).toEqual(["200,00", "194,00", "6,00", "0,00", "0,00", "13/11/2026 Cartão de crédito 194,00, desconto 6,00 (Taxa da maquininha)"]);
    expect(t.linhas[1].slice(7, 13)).toEqual([
      "100,00",
      "102,50",
      "0,00",
      "2,50",
      "0,00",
      "10/11/2026 Pix 40,00 [estornado em 11/11/2026] + 12/11/2026 Boleto 102,50, acréscimo 2,50 (Juros ou multa)",
    ]);
    const csv = csvDaTabela(t).replace(/^\uFEFF/, "").split("\r\n");
    expect(csv[0]).toBe("Tipo;Descrição;Fornecedor/Cliente;Nº do documento;Categoria;Vencimento;Situação;Total;Pago;Descontos;Acréscimos;Restante;Pagamentos");
  });

  it("no PDF, os pagamentos quebram em linhas, sem perder o desconto, o motivo nem o estorno", async () => {
    const fonte = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    const largura = 0.115 * 770 - 6; // a coluna Pagamentos na fonte de 7 pt
    const texto = "10/11/2026 Pix 40,00 [estornado em 11/11/2026] + 12/11/2026 Boleto 102,50, acréscimo 2,50 (Juros ou multa)";
    const linhas = quebrarTexto(texto, fonte, 7, largura);
    expect(linhas.length).toBeGreaterThan(1);
    expect(linhas.every((l) => fonte.widthOfTextAtSize(l, 7) <= largura)).toBe(true);
    expect(linhas.join(" ")).toBe(texto);
    // Depois do máximo de linhas, a última termina com reticências; uma palavra maior que a coluna é cortada.
    const curtas = quebrarTexto(texto, fonte, 7, largura, 2);
    expect(curtas).toHaveLength(2);
    expect(curtas[1].endsWith("…")).toBe(true);
    expect(quebrarTexto("Pagamento-sem-espaços-maior-que-a-coluna-inteira", fonte, 7, 40)[0].endsWith("…")).toBe(true);
    expect(quebrarTexto("", fonte, 7, largura)).toEqual([""]);
    expect(tabelaDeContas([]).colunas.filter((c) => c.quebrar).map((c) => c.titulo)).toEqual(["Pagamentos"]);
  });

  it("no PDF, as linhas altas passam para a página seguinte", async () => {
    const pagamentos = Array.from({ length: 3 }, (_, i) => ({ data: new Date(`2026-11-1${i}T15:00:00Z`), forma: "PIX" as const, valorCentavos: 4000, descontoCentavos: 100, motivoDesconto: "DESCONTO_COMBINADO" as const }));
    const contas = Array.from({ length: 30 }, () => conta({ pagamentos }));
    const cabecalho = { negocio: "Negócio de teste", periodo: "01/11/2026 a 15/11/2026", geradoEm: "15/11/2026 10:00" };
    const altas = await PDFDocument.load(await pdfDaTabela(tabelaDeContas(contas), cabecalho));
    const simples = await PDFDocument.load(await pdfDaTabela(tabelaDeContas(contas.map((c) => ({ ...c, pagamentos: [] }))), cabecalho));
    expect(simples.getPageCount()).toBe(2);
    expect(altas.getPageCount()).toBeGreaterThan(simples.getPageCount());
  });
});
