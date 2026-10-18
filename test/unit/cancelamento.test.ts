import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PREDEFINICOES, pode } from "@/lib/dominio/permissoes";
import { acertoDoCancelamento } from "@/lib/dominio/venda";
import { MENSAGENS_VENDA as M, validarCancelamento, validarCarrinho } from "@/lib/vendas/validacao";

// SPEC-011 — testes unitários (seção 12).

describe("T01 — recebido, crédito de troca e reembolso (INV-004)", () => {
  it.each<[string, number, number | null, { creditoCentavos: number; reembolsoCentavos: number; restanteCentavos: number }]>([
    ["sem troca: devolve tudo", 10000, null, { creditoCentavos: 0, reembolsoCentavos: 10000, restanteCentavos: 0 }],
    ["sem troca e nada recebido", 0, null, { creditoCentavos: 0, reembolsoCentavos: 0, restanteCentavos: 0 }],
    ["troca menor (Diagrama 4): crédito 70, devolve 30", 10000, 7000, { creditoCentavos: 7000, reembolsoCentavos: 3000, restanteCentavos: 0 }],
    ["troca igual: nada a devolver", 10000, 10000, { creditoCentavos: 10000, reembolsoCentavos: 0, restanteCentavos: 0 }],
    ["recebido menor que a troca (RN26): restante a pagar", 10000, 25000, { creditoCentavos: 10000, reembolsoCentavos: 0, restanteCentavos: 15000 }],
    ["crédito sem nada recebido: troca paga inteira", 0, 25000, { creditoCentavos: 0, reembolsoCentavos: 0, restanteCentavos: 25000 }],
  ])("%s", (_, recebido, troca, esperado) => {
    const a = acertoDoCancelamento(recebido, troca);
    expect(a).toEqual(esperado);
    expect(a.creditoCentavos).toBeLessThanOrEqual(Math.max(0, recebido));
    expect(a.creditoCentavos + a.reembolsoCentavos).toBe(Math.max(0, recebido));
  });
});

describe("T02 — validação (5.3)", () => {
  it("motivo da lista + detalhe; 'Outro' exige detalhe; forma do reembolso", () => {
    expect(validarCancelamento({ motivo: "DEVOLUCAO", detalhe: "", formaReembolso: "PIX" })).toEqual({ ok: true, dados: { motivo: "Devolução", formaReembolso: "PIX" } });
    expect(validarCancelamento({ motivo: "OUTRO", detalhe: " cliente   mudou de ideia " })).toEqual({ ok: true, dados: { motivo: "Outro: cliente mudou de ideia", formaReembolso: null } });
    expect(validarCancelamento({ motivo: "" })).toMatchObject({ ok: false, erros: { motivo: M.motivoObrigatorio } });
    expect(validarCancelamento({ motivo: "OUTRO" })).toMatchObject({ ok: false, erros: { detalhe: M.detalheObrigatorio } });
    expect(validarCancelamento({ motivo: "TROCA", detalhe: "a".repeat(201) })).toMatchObject({ ok: false, erros: { detalhe: M.detalheLongo } });
    expect(validarCancelamento({ motivo: "TROCA", formaReembolso: "CHEQUE" })).toMatchObject({ ok: false, erros: { formaReembolso: M.formaReembolsoInvalida } });
  });

  it("carrinho da troca: data sempre hoje e pagamentos podem ficar vazios (crédito cobre tudo)", () => {
    const c = { id: "11111111-1111-4111-8111-111111111111", dia: "2026-10-01", linhas: [{ itemId: "22222222-2222-4222-8222-222222222222", quantidade: 1 }], pagamentos: [] };
    expect(validarCarrinho(c, "2026-10-09")).toMatchObject({ ok: false, erros: { pagamentos: M.semPagamento } });
    expect(validarCarrinho(c, "2026-10-09", { troca: true })).toMatchObject({ ok: true, dados: { dia: "2026-10-09", pagamentos: [] } });
    expect(validarCarrinho({ ...c, pagamentos: [{ forma: "CREDITO_TROCA", valor: 10 }] }, "2026-10-09", { troca: true })).toMatchObject({ ok: false, erros: { pagamentos: M.formaInvalida } });
  });
});

describe("T11 — permissões (OPEN-005, CA-10)", () => {
  const acoes = readFileSync("src/lib/vendas/acoes.ts", "utf-8");
  it("cancelar exige Vendas — excluir; trocar exige excluir e também criar", () => {
    expect(acoes).toMatch(/export const acaoCancelarVenda = acaoComPermissao\("vendas", "excluir"/);
    expect(acoes).toMatch(/export const acaoTrocarVenda = acaoComPermissao\("vendas", "excluir", async \(membro[\s\S]*?if \(!pode\(membro\.permissoes, "vendas", "criar"\)\) redirect\(ROTA_SEM_ACESSO\)/);
  });

  it("páginas: cancelar exige excluir; trocar exige excluir + criar; o botão só aparece com excluir", () => {
    expect(readFileSync("src/app/(app)/vendas/[id]/cancelar/page.tsx", "utf-8")).toMatch(/exigirPermissao\("vendas", "excluir"\)/);
    const trocar = readFileSync("src/app/(app)/vendas/[id]/trocar/page.tsx", "utf-8");
    expect(trocar).toMatch(/exigirPermissao\("vendas", "excluir"\)/);
    expect(trocar).toMatch(/pode\(membro\.permissoes, "vendas", "criar"\)\) redirect\(ROTA_SEM_ACESSO\)/);
    expect(readFileSync("src/app/(app)/vendas/[id]/page.tsx", "utf-8")).toMatch(/pode\(membro\.permissoes, "vendas", "excluir"\) && v\.status === "CONCLUIDA"/);
  });

  it("Colaborador predefinido não cancela (RF65); Dono e Gerente cancelam", () => {
    expect(pode(PREDEFINICOES.COLABORADOR, "vendas", "excluir")).toBe(false);
    expect(pode(PREDEFINICOES.GERENTE, "vendas", "excluir")).toBe(true);
  });
});
