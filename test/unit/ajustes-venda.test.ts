import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { custoUnitarioComMateriais, MAX_MOTIVO_AJUSTE, materiaisPadraoDaLinha } from "@/lib/dominio/venda";
import { MENSAGENS_VENDA as M, validarCarrinho } from "@/lib/vendas/validacao";

// SPEC-017 — testes unitários (seção 12).

const HOJE = "2026-10-16";
const A = randomUUID();
const B = randomUUID();
const L = randomUUID();
const carrinho = (linhas: unknown[], extra: Record<string, unknown> = {}) => ({ id: randomUUID(), dia: HOJE, linhas, pagamentos: [{ forma: "PIX", valor: 10 }], ...extra });

describe("T01 — materiais padrão e custo da linha (INV-005)", () => {
  it("padrão = quantidade do catálogo × quantidade da linha, em milésimos", () => {
    expect(materiaisPadraoDaLinha([{ materialId: L, quantidade: 2 }], 3)).toEqual([{ materialId: L, quantidade: 6 }]);
    expect(materiaisPadraoDaLinha([{ materialId: L, quantidade: 0.05 }], 1.5)).toEqual([{ materialId: L, quantidade: 0.075 }]);
  });
  it("custo unitário = custo próprio + materiais usados na linha ÷ quantidade", () => {
    // Troca de lâmpadas: custo próprio 30, 6 lâmpadas de R$ 10 numa linha com quantidade 1.
    expect(custoUnitarioComMateriais(30, [{ custo: 10, quantidade: 6 }], 1)).toBe(90);
    // Quantidade 2 e 5 lâmpadas: 30 + 50 ÷ 2.
    expect(custoUnitarioComMateriais(30, [{ custo: 10, quantidade: 5 }], 2)).toBe(55);
    expect(custoUnitarioComMateriais(30, [{ custo: 10, quantidade: 0 }], 1)).toBe(30);
  });
});

describe("T02 — validação do carrinho com ajustes (5.3)", () => {
  it("linhas sem ajuste do mesmo item são somadas; com ajuste ficam separadas", () => {
    const v = validarCarrinho(
      carrinho([
        { itemId: A, quantidade: 1 },
        { itemId: A, quantidade: 2 },
        { itemId: A, quantidade: 1, materiais: [{ materialId: L, quantidade: 6 }] },
      ]),
      HOJE,
    );
    expect(v.ok && v.dados.linhas.map((l) => [l.itemId, l.quantidade, l.materiais ?? null])).toEqual([
      [A, 3, null],
      [A, 1, [{ materialId: L, quantidade: 6 }]],
    ]);
  });

  it("materiais: quantidade ≥ 0 com até 3 casas, sem repetir material", () => {
    expect(validarCarrinho(carrinho([{ itemId: A, quantidade: 1, materiais: [{ materialId: L, quantidade: 0 }] }]), HOJE).ok).toBe(true);
    expect(validarCarrinho(carrinho([{ itemId: A, quantidade: 1, materiais: [{ materialId: L, quantidade: -1 }] }]), HOJE)).toMatchObject({
      ok: false,
      erros: { [`materiais_${A}`]: M.quantidadeMaterialInvalida },
    });
    expect(validarCarrinho(carrinho([{ itemId: A, quantidade: 1, materiais: [{ materialId: L, quantidade: 1.0001 }] }]), HOJE).ok).toBe(false);
    expect(
      validarCarrinho(carrinho([{ itemId: A, quantidade: 1, materiais: [{ materialId: L, quantidade: 1 }, { materialId: L, quantidade: 2 }] }]), HOJE),
    ).toMatchObject({ ok: false, erros: { [`materiais_${A}`]: M.materiaisInvalidos } });
  });

  it("preço ajustado: > 0 com 2 casas e motivo obrigatório e curto (OPEN-006)", () => {
    const ok = validarCarrinho(carrinho([{ itemId: B, quantidade: 1, precoAjustado: "150,00", motivoAjuste: "  preço   combinado " }]), HOJE);
    expect(ok.ok && ok.dados.linhas[0].ajustePreco).toEqual({ precoCentavos: 15000, motivo: "preço combinado" });
    expect(validarCarrinho(carrinho([{ itemId: B, quantidade: 1, precoAjustado: 150 }]), HOJE)).toMatchObject({ ok: false, erros: { [`motivo_${B}`]: M.motivoAjusteObrigatorio } });
    expect(validarCarrinho(carrinho([{ itemId: B, quantidade: 1, precoAjustado: 150, motivoAjuste: "x".repeat(MAX_MOTIVO_AJUSTE + 1) }]), HOJE)).toMatchObject({
      ok: false,
      erros: { [`motivo_${B}`]: M.motivoAjusteLongo },
    });
    expect(validarCarrinho(carrinho([{ itemId: B, quantidade: 1, precoAjustado: 0, motivoAjuste: "x" }]), HOJE)).toMatchObject({ ok: false, erros: { [`preco_${B}`]: M.precoAjusteInvalido } });
    expect(validarCarrinho(carrinho([{ itemId: B, quantidade: 1, precoAjustado: "10,001", motivoAjuste: "x" }]), HOJE).ok).toBe(false);
  });

  it("na troca, ajustes são recusados (OPEN-008)", () => {
    expect(validarCarrinho(carrinho([{ itemId: B, quantidade: 1, precoAjustado: 5, motivoAjuste: "x" }]), HOJE, { troca: true })).toMatchObject({
      ok: false,
      erros: { itens: M.ajusteNaTroca },
    });
  });
});
