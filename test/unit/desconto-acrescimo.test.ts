import { describe, expect, it } from "vitest";
import { abatidoDoPagamento, descontoDaTaxa, estaAtrasada, restanteDaConta } from "@/lib/dominio/financeiro";
import { MENSAGENS_FINANCEIRO as M, validarPagamento } from "@/lib/financeiro/validacao";

// SPEC-028 — T01 (etapas 1 e 2): validação do pagamento com desconto e acréscimo, abatido e restante.

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
