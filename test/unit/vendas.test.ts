import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { somarDias } from "@/lib/dominio/estoque";
import { PREDEFINICOES, pode } from "@/lib/dominio/permissoes";
import { dividirEmParcelas, subtotalEmCentavos, totalEmCentavos, troco, vencimentoDaParcela } from "@/lib/dominio/venda";
import { menuDoMembro } from "@/lib/equipe/menu";
import { MENSAGENS_VENDA as M, validarCarrinho, validarCliente } from "@/lib/vendas/validacao";

// SPEC-008 — testes unitários (seção 12).

const HOJE = "2026-10-09";
const ID = "11111111-1111-4111-8111-111111111111";
const ITEM = "22222222-2222-4222-8222-222222222222";
const ITEM2 = "33333333-3333-4333-8333-333333333333";

describe("T01 — total, parcelas, vencimentos e troco", () => {
  it("subtotal arredondado ao centavo por linha, com quantidades decimais", () => {
    expect(subtotalEmCentavos(1800, 2)).toBe(3600);
    expect(subtotalEmCentavos(1290, 1.833)).toBe(2365); // 23,6457 → 23,65
    expect(subtotalEmCentavos(1, 0.5)).toBe(1); // meio centavo arredonda para cima
    expect(subtotalEmCentavos(999_999_999, 9_999_999.999)).toBe(9_999_999_989_000_000); // sem perder precisão
    expect(totalEmCentavos([{ precoCentavos: 1800, quantidade: 2 }, { precoCentavos: 1290, quantidade: 1.833 }])).toBe(5965);
  });

  it("RN11: diferença de centavos na 1ª parcela (CA-04)", () => {
    expect(dividirEmParcelas(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(dividirEmParcelas(20000, 3)).toEqual([6668, 6666, 6666]);
    expect(dividirEmParcelas(1800, 1)).toEqual([1800]);
    expect(dividirEmParcelas(100, 12).reduce((a, b) => a + b, 0)).toBe(100);
    expect(() => dividirEmParcelas(100, 13)).toThrow();
    expect(() => dividirEmParcelas(100, 0)).toThrow();
  });

  it("vencimento: mesmo dia, k meses depois, fim de mês ajustado (OPEN-003)", () => {
    expect(vencimentoDaParcela("2026-10-09", 1)).toBe("2026-11-09");
    expect(vencimentoDaParcela("2026-10-09", 3)).toBe("2027-01-09");
    expect(vencimentoDaParcela("2026-01-31", 1)).toBe("2026-02-28");
    expect(vencimentoDaParcela("2028-01-31", 1)).toBe("2028-02-29");
    expect(vencimentoDaParcela("2026-03-31", 1)).toBe("2026-04-30");
    expect(vencimentoDaParcela("2026-12-15", 12)).toBe("2027-12-15");
  });

  it("troco só quando o recebido cobre o valor em dinheiro (OPEN-004)", () => {
    expect(troco(5000, 3600)).toBe(1400);
    expect(troco(3600, 3600)).toBe(0);
    expect(troco(2000, 3600)).toBeNull();
  });
});

describe("T02 — validação do carrinho (CA-05)", () => {
  const valido = { id: ID, linhas: [{ itemId: ITEM, quantidade: "2" }], pagamentos: [{ forma: "PIX", valor: "36,00" }] };

  it("aceita e normaliza; linhas do mesmo item são somadas; data padrão hoje", () => {
    const r = validarCarrinho({ ...valido, linhas: [{ itemId: ITEM, quantidade: "0,5" }, { itemId: ITEM, quantidade: 1.25, precoVisto: 18 }] }, HOJE);
    expect(r).toEqual({
      ok: true,
      dados: { id: ID, dia: HOJE, clienteId: null, linhas: [{ itemId: ITEM, quantidade: 1.75, precoVistoCentavos: 1800 }], pagamentos: [{ forma: "PIX", valorCentavos: 3600, parcelas: 1 }] },
    });
  });

  it.each<[string, Record<string, unknown>, string, string]>([
    ["sem itens", { ...valido, linhas: [] }, "itens", M.carrinhoVazio],
    ["quantidade zero", { ...valido, linhas: [{ itemId: ITEM, quantidade: "0" }] }, `quantidade_${ITEM}`, M.quantidadeInvalida],
    ["quantidade com 4 casas", { ...valido, linhas: [{ itemId: ITEM, quantidade: "1,0001" }] }, `quantidade_${ITEM}`, M.quantidadeInvalida],
    ["sem pagamento", { ...valido, pagamentos: [] }, "pagamentos", M.semPagamento],
    ["forma inexistente", { ...valido, pagamentos: [{ forma: "BOLETO", valor: 36 }] }, "pagamentos", M.formaInvalida],
    ["crédito de troca (só SPEC-011)", { ...valido, pagamentos: [{ forma: "CREDITO_TROCA", valor: 36 }] }, "pagamentos", M.formaInvalida],
    ["valor zero", { ...valido, pagamentos: [{ forma: "PIX", valor: 0 }] }, "pagamentos", M.valorInvalido],
    ["valor com 3 casas", { ...valido, pagamentos: [{ forma: "PIX", valor: "36,001" }] }, "pagamentos", M.valorInvalido],
    ["parcelas no PIX", { ...valido, pagamentos: [{ forma: "PIX", valor: 36, parcelas: 2 }] }, "pagamentos", M.parcelasInvalidas],
    ["13 parcelas", { ...valido, pagamentos: [{ forma: "CREDITO", valor: 36, parcelas: 13 }] }, "pagamentos", M.parcelasInvalidas],
    ["data futura", { ...valido, dia: "2026-10-10" }, "dia", M.dataInvalida],
    ["data com mais de 7 dias", { ...valido, dia: somarDias(HOJE, -8) }, "dia", M.dataInvalida],
    ["cliente inválido", { ...valido, clienteId: "x" }, "cliente", M.clienteInvalido],
    ["carrinho sem id", { ...valido, id: "abc" }, "carrinho", M.carrinhoInvalido],
  ])("recusa %s", (_, carrinho, campo, mensagem) => {
    const r = validarCarrinho(carrinho, HOJE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[campo]).toBe(mensagem);
  });

  it("crédito em 12x e data de 7 dias atrás são aceitos", () => {
    expect(validarCarrinho({ ...valido, dia: somarDias(HOJE, -7), linhas: [{ itemId: ITEM2, quantidade: 1 }], pagamentos: [{ forma: "CREDITO", valor: 36, parcelas: 12 }] }, HOJE).ok).toBe(true);
  });

  it("cliente rápido: nome obrigatório e normalizado", () => {
    expect(validarCliente({ nome: "  Ana   Maria ", contato: "" })).toEqual({ ok: true, dados: { nome: "Ana Maria", contato: null } });
    expect(validarCliente({ nome: " " })).toMatchObject({ ok: false, erros: { nome: M.nomeObrigatorio } });
  });
});

describe("T13 — permissões da venda (SPEC-005)", () => {
  const acoes = readFileSync("src/lib/vendas/acoes.ts", "utf-8");
  it.each(["acaoRegistrarVenda", "acaoCadastrarCliente"])("%s exige Vendas — criar", (nome) => {
    expect(acoes).toMatch(new RegExp(`export const ${nome} = acaoComPermissao\\("vendas", "criar"`));
  });

  it("Colaborador predefinido vende e vê o histórico; menu (CA-12)", () => {
    const c = PREDEFINICOES.COLABORADOR;
    expect([pode(c, "vendas", "ver"), pode(c, "vendas", "criar"), pode(c, "vendas", "excluir")]).toEqual([true, true, false]);
    expect(menuDoMembro("COLABORADOR", c).map((i) => i.rotulo)).toEqual(expect.arrayContaining(["Nova venda", "Vendas"]));
    const soVer = { ...c, vendas: { ver: true, criar: false, editar: false, excluir: false } };
    expect(menuDoMembro("COLABORADOR", soVer).map((i) => i.rotulo)).not.toContain("Nova venda");
  });
});
