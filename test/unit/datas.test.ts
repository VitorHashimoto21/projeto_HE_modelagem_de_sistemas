import { describe, expect, it } from "vitest";
import {
  competencia,
  DataInvalida,
  diaLocal,
  intervaloDaCompetencia,
  intervaloDoDia,
} from "@/lib/dominio/datas";

// T07 — CA-09, INV-007 (RN29)
describe("utilitário de datas (America/Sao_Paulo)", () => {
  it("2026-10-01T02:30:00Z pertence ao dia 30/09/2026 e à competência 2026-09", () => {
    const instante = new Date("2026-10-01T02:30:00Z");
    expect(diaLocal(instante)).toBe("2026-09-30");
    expect(competencia(instante)).toBe("2026-09");
  });

  it("03:00Z é meia-noite em Brasília e já é o novo dia", () => {
    expect(diaLocal(new Date("2026-10-01T02:59:59Z"))).toBe("2026-09-30");
    expect(diaLocal(new Date("2026-10-01T03:00:00Z"))).toBe("2026-10-01");
  });

  it("intervalo do mês de setembro/2026 vai de 01/09 03:00Z (inclusivo) a 01/10 03:00Z (exclusivo)", () => {
    const { inicio, fim } = intervaloDaCompetencia("2026-09");
    expect(inicio.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("virada de ano: dezembro termina no 1º de janeiro local", () => {
    const { inicio, fim } = intervaloDaCompetencia("2026-12");
    expect(inicio.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2027-01-01T03:00:00.000Z");
    expect(competencia(new Date("2027-01-01T02:00:00Z"))).toBe("2026-12");
  });

  it("intervalo do dia local, inclusive no último dia do mês", () => {
    const { inicio, fim } = intervaloDoDia("2026-09-30");
    expect(inicio.toISOString()).toBe("2026-09-30T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("usa a base de fusos: em 2018 Brasília tinha horário de verão (UTC−2)", () => {
    const { inicio } = intervaloDoDia("2018-12-15");
    expect(inicio.toISOString()).toBe("2018-12-15T02:00:00.000Z");
  });

  it("recusa datas e competências inválidas", () => {
    expect(() => diaLocal(new Date("x"))).toThrow(DataInvalida);
    expect(() => intervaloDoDia("2026-02-30")).toThrow(DataInvalida);
    expect(() => intervaloDaCompetencia("2026-13")).toThrow(DataInvalida);
  });
});
