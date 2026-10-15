import { describe, expect, it } from "vitest";
import { somarFormas } from "@/lib/dominio/relatorios";

// SPEC-016 (5.5): "Como os clientes pagam" nos Relatórios.
describe("somarFormas", () => {
  it("soma por forma só as vendas concluídas, sem o crédito de troca, na ordem fixa das cores", () => {
    const r = somarFormas([
      { status: "CONCLUIDA", pagamentos: [{ forma: "PIX", valorCentavos: 5000 }, { forma: "CREDITO", valorCentavos: 3000 }] },
      { status: "CANCELADA", pagamentos: [{ forma: "PIX", valorCentavos: 9999 }] },
      { status: "CONCLUIDA", pagamentos: [{ forma: "CREDITO_TROCA", valorCentavos: 2000 }, { forma: "DINHEIRO", valorCentavos: 1500 }] },
    ]);
    expect(r).toEqual([
      { nome: "PIX", valorCentavos: 5000 },
      { nome: "Dinheiro", valorCentavos: 1500 },
      { nome: "Crédito", valorCentavos: 3000 },
      { nome: "Débito", valorCentavos: 0 },
    ]);
  });
});
