import { describe, expect, it } from "vitest";
import { escalaAmigavel, participacoes, posicoesDoMedidor, proporcao, saudacao } from "@/lib/dominio/graficos";
import { saudeDoSemaforo } from "@/lib/dashboard/servicos";

// SPEC-016 — T03: escalas e proporções dos componentes de gráfico.

describe("T03 — gráficos (SPEC-016, 5.5)", () => {
  it("escala amigável: teto redondo e 3 linhas de grade", () => {
    expect(escalaAmigavel(31000)).toEqual({ teto: 37500, grade: [12500, 25000, 37500] });
    expect(escalaAmigavel(30000)).toEqual({ teto: 30000, grade: [10000, 20000, 30000] });
    expect(escalaAmigavel(362000)).toEqual({ teto: 375000, grade: [125000, 250000, 375000] });
    expect(escalaAmigavel(0)).toEqual({ teto: 3, grade: [1, 2, 3] });
    expect(escalaAmigavel(5000, 2)).toEqual({ teto: 5000, grade: [2500, 5000] });
  });

  it("proporção limitada a 0–1", () => {
    expect(proporcao(50, 200)).toBe(0.25);
    expect(proporcao(300, 200)).toBe(1);
    expect(proporcao(-5, 200)).toBe(0);
    expect(proporcao(5, 0)).toBe(0);
  });

  it("medidor: escala até a meta (ou o equilíbrio sem meta); ritmo hachurado e se passa do fim", () => {
    expect(posicoesDoMedidor({ faturadoCentavos: 225000, equilibrioCentavos: 211436, metaCentavos: 302376, ritmoCentavos: 536538 })).toEqual({
      faturado: 225000 / 302376,
      ritmo: 1,
      equilibrio: 211436 / 302376,
      meta: 1,
      ritmoPassa: true,
    });
    expect(posicoesDoMedidor({ faturadoCentavos: 100000, equilibrioCentavos: 200000, metaCentavos: null, ritmoCentavos: null })).toEqual({
      faturado: 0.5,
      ritmo: null,
      equilibrio: 1,
      meta: null,
      ritmoPassa: false,
    });
  });

  it("participações somam 100 e o maior resto leva o arredondamento", () => {
    expect(participacoes([1, 1, 1])).toEqual([34, 33, 33]);
    expect(participacoes([4800, 2200, 1800, 1200])).toEqual([48, 22, 18, 12]);
    expect(participacoes([0, 0])).toEqual([0, 0]);
    expect(participacoes([5000, 0])).toEqual([100, 0]);
  });

  it("saudação pela hora de São Paulo", () => {
    expect(saudacao(new Date("2026-10-13T12:00:00Z"))).toBe("Bom dia"); // 09h
    expect(saudacao(new Date("2026-10-13T18:00:00Z"))).toBe("Boa tarde"); // 15h
    expect(saudacao(new Date("2026-10-14T00:30:00Z"))).toBe("Boa noite"); // 21h30
  });

  it("saúde da faixa do caixa vem do semáforo (nunca só cor: sempre um rótulo)", () => {
    const s = (cor: "vermelho" | "amarelo" | "verde" | "equilibrio") =>
      saudeDoSemaforo({ status: "ok", margemMeta: 20, semaforo: { cor } as never });
    expect(s("vermelho")).toEqual({ tom: "perigo", rotulo: "Déficit no mês" });
    expect(s("amarelo")).toEqual({ tom: "atencao", rotulo: "Atenção no mês" });
    expect(s("verde")).toEqual({ tom: "ok", rotulo: "Saudável no mês" });
    expect(s("equilibrio")).toEqual({ tom: "ok", rotulo: "Equilíbrio atingido" });
    expect(saudeDoSemaforo({ status: "indisponivel", motivo: "sem-cmv", mensagem: "" })).toEqual({ tom: "neutro", rotulo: "Saúde indisponível" });
  });
});
