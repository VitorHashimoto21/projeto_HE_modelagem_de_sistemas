import { describe, expect, it } from "vitest";
import {
  calcularCompra,
  chaveDoDocumento,
  custoEscolhido,
  custosDaLinha,
  descricaoDaConta,
  MENSAGENS_COMPRA,
  podeRegistrarCompra,
  ratear,
  validarCompra,
  vencimentosSugeridos,
  type DadosDaCompra,
} from "@/lib/dominio/compras";
import { MATRIZ_COMPLETA, PREDEFINICOES, type Matriz } from "@/lib/dominio/permissoes";

// SPEC-027 — T01: validação da compra e das linhas, documento ou sem nota, total, rateio,
// entrada e parcelas, e os três custos (CA-03, CA-04, CA-05, CA-06, INV-002).

const HOJE = "2026-11-21";
const P = "11111111-1111-4111-8111-111111111111";
const G = "22222222-2222-4222-8222-222222222222";
const FORNECEDOR = "33333333-3333-4333-8333-333333333333";
const ID = "44444444-4444-4444-8444-444444444444";

const base = (extra: Record<string, unknown> = {}) => ({
  id: ID,
  fornecedorId: FORNECEDOR,
  numeroDocumento: "1234",
  dia: HOJE,
  linhas: [
    { itemId: P, quantidade: 100, custoUnitario: 1.2 },
    { itemId: G, quantidade: 50, custoUnitario: 2 },
  ],
  condicao: "A_PRAZO",
  parcelas: [{ vencimento: "2026-12-19" }],
  ...extra,
});

function dados(entrada: Record<string, unknown>): DadosDaCompra {
  const v = validarCompra(entrada, HOJE);
  if (!v.ok) throw new Error(JSON.stringify(v.erros));
  return v.dados;
}
function valores(entrada: Record<string, unknown>) {
  const v = calcularCompra(dados(entrada));
  if (!v.ok) throw new Error(JSON.stringify(v.erros));
  return v.dados;
}
const erros = (entrada: unknown) => {
  const v = validarCompra(entrada, HOJE);
  return v.ok ? {} : v.erros;
};

describe("validação da compra (CA-06)", () => {
  it("aceita o exemplo da seção 1 e devolve os dados normalizados", () => {
    const d = dados(base({ numeroDocumento: "  NF  1234 ", observacao: "  Nota da semana " }));
    expect(d).toMatchObject({
      id: ID,
      fornecedorId: FORNECEDOR,
      numeroDocumento: "NF 1234",
      semNotaFiscal: false,
      dia: HOJE,
      observacao: "Nota da semana",
      freteCentavos: 0,
      outrasDespesasCentavos: 0,
      descontoCentavos: 0,
      condicao: "A_PRAZO",
      entradaCentavos: null,
      vencimentos: ["2026-12-19"],
    });
    expect(d.linhas).toEqual([
      { itemId: P, quantidade: 100, custoUnitarioCentavos: 120, escolhaCusto: "MEDIO" },
      { itemId: G, quantidade: 50, custoUnitarioCentavos: 200, escolhaCusto: "MEDIO" },
    ]);
  });

  it("recusa com as mensagens da seção 5.11", () => {
    expect(erros(base({ fornecedorId: "" })).fornecedor).toBe("Escolha o fornecedor.");
    expect(erros(base({ numeroDocumento: "  " })).documento).toBe('Informe o nº do documento ou marque "Compra sem nota fiscal".');
    expect(erros(base({ linhas: [] })).itens).toBe("Adicione pelo menos um produto.");
    expect(erros(base({ linhas: [{ itemId: P, quantidade: 0, custoUnitario: 1 }] }))[`quantidade_${P}`]).toBe("Informe uma quantidade maior que zero.");
    expect(erros(base({ linhas: [{ itemId: P, quantidade: -2, custoUnitario: 1 }] }))[`quantidade_${P}`]).toBe("Informe uma quantidade maior que zero.");
    expect(erros(base({ linhas: [{ itemId: P, quantidade: 1, custoUnitario: -0.01 }] }))[`custo_${P}`]).toBe("O custo não pode ser negativo.");
    expect(erros(base({ dia: "2026-08-22" })).dia).toBe("Use uma data entre hoje e 90 dias atrás.");
    expect(erros(base({ dia: "2026-11-22" })).dia).toBe("Use uma data entre hoje e 90 dias atrás.");
    expect(erros(base({ parcelas: [{ vencimento: "2026-11-20" }] })).vencimento_0).toBe("O vencimento não pode ser antes da data da compra.");
  });

  it("aceita a data de 90 dias atrás e o vencimento no próprio dia da compra", () => {
    expect(dados(base({ dia: "2026-08-23", parcelas: [{ vencimento: "2026-08-23" }] })).dia).toBe("2026-08-23");
  });

  it("formato: quantidade com até 3 casas, custo com até 2, até 100 linhas, sem produto repetido", () => {
    expect(erros(base({ linhas: [{ itemId: P, quantidade: 1.2345, custoUnitario: 1 }] }))[`quantidade_${P}`]).toBe(MENSAGENS_COMPRA.quantidadeCasas);
    expect(erros(base({ linhas: [{ itemId: P, quantidade: 1, custoUnitario: 1.234 }] }))[`custo_${P}`]).toBe(MENSAGENS_COMPRA.custoInvalido);
    expect(erros(base({ linhas: [{ itemId: P, quantidade: 1 }] }))[`custo_${P}`]).toBe(MENSAGENS_COMPRA.custoInvalido);
    expect(dados(base({ linhas: [{ itemId: P, quantidade: "1,5", custoUnitario: "0" }], frete: 5 })).linhas[0]).toMatchObject({ quantidade: 1.5, custoUnitarioCentavos: 0 });
    const repetido = [
      { itemId: P, quantidade: 1, custoUnitario: 1 },
      { itemId: P, quantidade: 2, custoUnitario: 1 },
    ];
    expect(erros(base({ linhas: repetido })).itens).toBe(MENSAGENS_COMPRA.compraInvalida);
    const muitas = Array.from({ length: 101 }, (_, i) => ({ itemId: `${String(i).padStart(8, "0")}-0000-4000-8000-000000000000`, quantidade: 1, custoUnitario: 1 }));
    expect(erros(base({ linhas: muitas })).itens).toBe(`Use no máximo 100 produtos por compra.`);
  });

  it("documento: até 40 caracteres; a compra sem nota fiscal não tem nº (OPEN-002)", () => {
    expect(erros(base({ numeroDocumento: "x".repeat(41) })).documento).toBe(MENSAGENS_COMPRA.documentoLongo);
    const semNota = dados(base({ semNotaFiscal: true, numeroDocumento: "ignorado" }));
    expect(semNota).toMatchObject({ semNotaFiscal: true, numeroDocumento: null });
    expect(chaveDoDocumento("  nf-1234  a ")).toBe("NF-1234 A");
  });

  it("escolha do custo: o médio vem marcado; outra escolha só entre as três", () => {
    const d = dados(base({ linhas: [{ itemId: P, quantidade: 1, custoUnitario: 1, escolhaCusto: "COMPRA" }] }));
    expect(d.linhas[0].escolhaCusto).toBe("COMPRA");
    expect(erros(base({ linhas: [{ itemId: P, quantidade: 1, custoUnitario: 1, escolhaCusto: "OUTRA" }] })).itens).toBe(MENSAGENS_COMPRA.compraInvalida);
  });

  it("forma de pagar: à vista sem parcelas; a prazo de 1 a 12 parcelas, com vencimento", () => {
    expect(dados(base({ condicao: "A_VISTA", parcelas: undefined })).vencimentos).toEqual([]);
    expect(erros(base({ condicao: "A_VISTA" })).condicao).toBe(MENSAGENS_COMPRA.compraInvalida);
    expect(erros(base({ condicao: "PIX" })).condicao).toBe(MENSAGENS_COMPRA.compraInvalida);
    expect(erros(base({ parcelas: [] })).parcelas).toBe("Use de 1 a 12 parcelas.");
    expect(erros(base({ parcelas: vencimentosSugeridos(HOJE, 13).map((v) => ({ vencimento: v })) })).parcelas).toBe("Use de 1 a 12 parcelas.");
    expect(erros(base({ parcelas: [{ vencimento: "" }] })).vencimento_0).toBe(MENSAGENS_COMPRA.semVencimento);
  });

  it("entrada: maior que zero e menor que o total (CA-03)", () => {
    expect(erros(base({ entrada: 0 })).entrada).toBe("A entrada precisa ser maior que zero e menor que o total da compra.");
    expect(erros(base({ entrada: 220 })).entrada).toBe("A entrada precisa ser maior que zero e menor que o total da compra.");
    expect(dados(base({ entrada: "219,99" })).entradaCentavos).toBe(21999);
  });

  it("total: maior que zero; o desconto não passa dos produtos (CA-06)", () => {
    const umProduto = { linhas: [{ itemId: P, quantidade: 1, custoUnitario: 0 }] };
    expect(erros(base(umProduto)).total).toBe("O total da compra precisa ser maior que zero.");
    expect(dados(base({ ...umProduto, frete: 10 })).freteCentavos).toBe(1000);
    expect(erros(base({ desconto: 320.01, frete: 500 })).desconto).toBe("O desconto não pode passar do valor dos produtos.");
    expect(erros(base({ frete: -1 })).frete).toBe(MENSAGENS_COMPRA.valorInvalido);
    expect(erros(base({ linhas: [{ itemId: P, quantidade: 9_999_999, custoUnitario: 99_999 }] }))[`custo_${P}`]).toBe(MENSAGENS_COMPRA.valorAlto);
  });

  it("compra ilegível: sem id de formulário", () => {
    expect(erros({ ...base(), id: "x" }).compra).toBe(MENSAGENS_COMPRA.compraInvalida);
    expect(erros(null).compra).toBe(MENSAGENS_COMPRA.compraInvalida);
  });
});

describe("total, rateio e contas (INV-002)", () => {
  it("CA-05: R$ 200,00 em produtos, frete R$ 20,00 e desconto R$ 10,00 → total R$ 210,00; rateio R$ 6,00 e R$ 4,00", () => {
    const v = valores(
      base({
        linhas: [
          { itemId: P, quantidade: 100, custoUnitario: 1.2 },
          { itemId: G, quantidade: 40, custoUnitario: 2 },
        ],
        frete: 20,
        desconto: 10,
      }),
    );
    expect(v.valorProdutosCentavos).toBe(20000);
    expect(v.totalCentavos).toBe(21000);
    expect(v.linhas.map((l) => l.rateioCentavos)).toEqual([600, 400]);
    expect(v.linhas.map((l) => l.custoComRateioCentavos)).toEqual([126, 210]);
  });

  it("o rateio fecha ao centavo, pelo maior resto, também com valor negativo", () => {
    expect(ratear(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(ratear(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
    expect(ratear(1, [100, 200])).toEqual([0, 1]);
    expect(ratear(0, [5, 5])).toEqual([0, 0]);
    // Todas as linhas a custo zero: reparte pela quantidade.
    expect(ratear(1000, [0, 0], [1000, 3000])).toEqual([250, 750]);
    for (const valor of [7, -7, 12345, -999]) expect(ratear(valor, [3, 0, 11, 7]).reduce((s, p) => s + p, 0)).toBe(valor);
  });

  it("CA-01: a prazo em 1 parcela, R$ 220,00 com o vencimento informado", () => {
    expect(valores(base()).contas).toEqual([{ tipo: "PARCELA", parcela: 1, deParcelas: 1, valorCentavos: 22000, vencimento: "2026-12-19" }]);
  });

  it("CA-02: à vista, uma conta com o total e vencimento na data da compra", () => {
    expect(valores(base({ condicao: "A_VISTA", parcelas: undefined, dia: "2026-11-10" })).contas).toEqual([
      { tipo: "A_VISTA", parcela: 0, deParcelas: 0, valorCentavos: 22000, vencimento: "2026-11-10" },
    ]);
  });

  it("CA-03: R$ 100,00 em 3 parcelas → 33,34 + 33,33 + 33,33, sugeridas a 30, 60 e 90 dias", () => {
    const venc = vencimentosSugeridos(HOJE, 3);
    expect(venc).toEqual(["2026-12-21", "2027-01-20", "2027-02-19"]);
    const v = valores(base({ linhas: [{ itemId: P, quantidade: 100, custoUnitario: 1 }], parcelas: venc.map((vencimento) => ({ vencimento })) }));
    expect(v.contas.map((c) => c.valorCentavos)).toEqual([3334, 3333, 3333]);
    expect(v.contas.map((c) => c.vencimento)).toEqual(venc);
  });

  it("CA-03: R$ 300,00 com entrada de R$ 100,00 e 2 parcelas → entrada na data da compra e duas de R$ 100,00", () => {
    const v = valores(
      base({
        linhas: [{ itemId: P, quantidade: 3, custoUnitario: 100 }],
        entrada: 100,
        parcelas: vencimentosSugeridos(HOJE, 2).map((vencimento) => ({ vencimento })),
      }),
    );
    expect(v.contas).toEqual([
      { tipo: "ENTRADA", parcela: 0, deParcelas: 0, valorCentavos: 10000, vencimento: HOJE },
      { tipo: "PARCELA", parcela: 1, deParcelas: 2, valorCentavos: 10000, vencimento: "2026-12-21" },
      { tipo: "PARCELA", parcela: 2, deParcelas: 2, valorCentavos: 10000, vencimento: "2027-01-20" },
    ]);
    expect(v.contas.reduce((s, c) => s + c.valorCentavos, 0)).toBe(v.totalCentavos);
  });

  it("descrições das contas (5.4)", () => {
    expect(descricaoDaConta(7, { tipo: "A_VISTA", parcela: 0, deParcelas: 0 })).toBe("Compra nº 7 — à vista");
    expect(descricaoDaConta(7, { tipo: "ENTRADA", parcela: 0, deParcelas: 0 })).toBe("Compra nº 7 — entrada");
    expect(descricaoDaConta(7, { tipo: "PARCELA", parcela: 2, deParcelas: 3 })).toBe("Compra nº 7 — parcela 2/3");
  });
});

describe("os três custos (CA-04, OPEN-001)", () => {
  it("exemplo da seção 1: 20 a R$ 1,00 + 100 a R$ 1,20 → atual 1,00, desta compra 1,20, médio 1,17", () => {
    const [p] = valores(base()).linhas;
    const c = custosDaLinha({ saldoAntes: 20, custoAtualCentavos: 100, quantidade: p.quantidade, totalComRateioCentavos: p.totalComRateioCentavos, custoComRateioCentavos: p.custoComRateioCentavos });
    expect(c).toEqual({ atualCentavos: 100, compraCentavos: 120, medioCentavos: 117 });
    expect(custoEscolhido("MEDIO", c)).toBe(117);
    expect(custoEscolhido("COMPRA", c)).toBe(120);
    expect(custoEscolhido("ATUAL", c)).toBe(100);
  });

  it("saldo antes zero ou negativo: o médio é o custo desta compra", () => {
    const linha = { custoAtualCentavos: 100, quantidade: 10, totalComRateioCentavos: 1500, custoComRateioCentavos: 150 };
    expect(custosDaLinha({ ...linha, saldoAntes: 0 }).medioCentavos).toBe(150);
    expect(custosDaLinha({ ...linha, saldoAntes: -2 }).medioCentavos).toBe(150);
  });

  it("o médio usa o total da linha com o rateio e saldo fracionado, ao centavo", () => {
    // (2,5 × 3,00 + 7,77) ÷ (2,5 + 1,5) = 15,27 ÷ 4 = 3,8175 → 3,82
    expect(custosDaLinha({ saldoAntes: 2.5, custoAtualCentavos: 300, quantidade: 1.5, totalComRateioCentavos: 777, custoComRateioCentavos: 518 }).medioCentavos).toBe(382);
  });
});

describe("quem pode registrar (CA-13, OPEN-007)", () => {
  const com = (m: Matriz, ajuste: (m: Matriz) => void) => {
    const copia = structuredClone(m);
    ajuste(copia);
    return copia;
  };

  it("exige Estoque — criar e Financeiro — criar; o suporte nunca registra", () => {
    expect(podeRegistrarCompra({ permissoes: MATRIZ_COMPLETA })).toBe(true);
    expect(podeRegistrarCompra({ permissoes: PREDEFINICOES.DONO })).toBe(true);
    // O Colaborador padrão (Estoque: ver e criar, sem Financeiro) não registra.
    expect(podeRegistrarCompra({ permissoes: PREDEFINICOES.COLABORADOR })).toBe(false);
    expect(podeRegistrarCompra({ permissoes: com(MATRIZ_COMPLETA, (m) => (m.financeiro.criar = false)) })).toBe(false);
    expect(podeRegistrarCompra({ permissoes: com(MATRIZ_COMPLETA, (m) => (m.estoque.criar = false)) })).toBe(false);
    expect(podeRegistrarCompra({ permissoes: MATRIZ_COMPLETA, modoSuporte: true })).toBe(false);
  });
});
