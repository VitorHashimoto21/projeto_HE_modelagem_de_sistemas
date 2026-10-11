import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MENSAGENS_CALCULADORA as M, validarConfirmacao, validarOpcoes, validarParametros } from "@/lib/calculadora/validacao";
import {
  anexoEfetivo,
  arredondarParaCimaAoReal,
  calcularPreco,
  calcularRbt12,
  despesasFixasPercentual,
  janelaDoRbt12,
  maiorParcela,
  pontoDeEquilibrio,
} from "@/lib/dominio/precificacao";
import { MATRIZ_VAZIA, PREDEFINICOES, type Matriz } from "@/lib/dominio/permissoes";
import { menuDoMembro } from "@/lib/equipe/menu";

// SPEC-010 — testes unitários (seção 12).

describe("T01 — markup completo, arredondamento e inviabilidade", () => {
  const base = { custoCentavos: 2300, despesasFixas: 15, taxaCartao: 3, comissao: 2, imposto: 6, margem: 32 };

  it("CA-01: 23 ÷ (1 − 0,58) = R$ 54,77 (para cima); arredondado ao real: R$ 55,00", () => {
    expect(calcularPreco(base)).toMatchObject({ ok: true, despesasVariaveis: 5, precoCentavos: 5477, arredondadoCentavos: 5500 });
    expect(arredondarParaCimaAoReal(5500)).toBe(5500);
    expect(arredondarParaCimaAoReal(5501)).toBe(5600);
  });

  it("INV-001: preço × (1 − soma) ≥ custo para combinações aleatórias", () => {
    let semente = 42;
    const aleatorio = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let i = 0; i < 2000; i++) {
      const c = {
        custoCentavos: 1 + Math.floor(aleatorio() * 10_000_000),
        despesasFixas: aleatorio() * 30,
        taxaCartao: aleatorio() * 10,
        comissao: aleatorio() * 10,
        imposto: aleatorio() * 20,
        margem: aleatorio() * 29,
      };
      const r = calcularPreco(c);
      if (!r.ok) throw new Error("esperava viável");
      const soma = c.despesasFixas + c.taxaCartao + c.comissao + c.imposto + c.margem;
      expect(r.precoCentavos * (1 - soma / 100)).toBeGreaterThanOrEqual(c.custoCentavos - 1e-6);
      expect(r.precoCentavos - r.precoExato).toBeLessThan(1);
      expect(r.arredondadoCentavos).toBeGreaterThanOrEqual(r.precoCentavos);
    }
  });

  it("RN19/INV-002: soma ≥ 100% é inviável; a maior parcela explica", () => {
    expect(calcularPreco({ ...base, margem: 74 })).toMatchObject({ ok: false, motivo: "inviavel", soma: 100 });
    expect(calcularPreco({ ...base, margem: 73.99 }).ok).toBe(true);
    expect(calcularPreco({ ...base, despesasFixas: Infinity })).toMatchObject({ ok: false });
    expect(maiorParcela({ despesasFixas: 15, taxaCartao: 3, comissao: 2, imposto: 6, margem: 80 })).toBe("margem");
    expect(maiorParcela({ despesasFixas: 70, taxaCartao: 3, comissao: 2, imposto: 6, margem: 30 })).toBe("despesasFixas");
  });
});

describe("T02 — RBT12, faturamento médio e despesas fixas %", () => {
  const MES = "2026-10";
  const janela = janelaDoRbt12(MES);

  it("janela: as 12 competências anteriores ao mês do cálculo", () => {
    expect([janela[0], janela[11], janela.length]).toEqual(["2025-10", "2026-09", 12]);
  });

  it("12 meses → soma real; 4 meses desde a 1ª venda (com mês parado) → proporcional (OPEN-005)", () => {
    const cheio = Object.fromEntries(janela.map((c) => [c, 100000]));
    expect(calcularRbt12({ compAtual: MES, porCompetencia: cheio, primeiraCompetencia: "2020-01", faturamentoEstimadoCentavos: null })).toEqual({
      rbt12Centavos: 1200000,
      realCentavos: 1200000,
      mesesConsiderados: 12,
      origem: "real",
    });
    const quatro = { "2026-06": 1000000, "2026-07": 1000000, "2026-09": 2000000, "2026-10": 9999999 };
    expect(calcularRbt12({ compAtual: MES, porCompetencia: quatro, primeiraCompetencia: "2026-06", faturamentoEstimadoCentavos: 1 })).toEqual({
      rbt12Centavos: 12000000,
      realCentavos: 4000000,
      mesesConsiderados: 4,
      origem: "proporcional",
    });
  });

  it("vendas antigas fora da janela contam a janela inteira; sem vendas anteriores → estimado; sem nada → sem dados", () => {
    expect(calcularRbt12({ compAtual: MES, porCompetencia: { "2026-09": 120000 }, primeiraCompetencia: "2023-05", faturamentoEstimadoCentavos: null })).toMatchObject({
      rbt12Centavos: 120000,
      mesesConsiderados: 12,
      origem: "real",
    });
    expect(calcularRbt12({ compAtual: MES, porCompetencia: { "2026-10": 5000 }, primeiraCompetencia: "2026-10", faturamentoEstimadoCentavos: 500000 })).toMatchObject({
      rbt12Centavos: 6000000,
      origem: "estimado",
    });
    expect(calcularRbt12({ compAtual: MES, porCompetencia: {}, primeiraCompetencia: null, faturamentoEstimadoCentavos: null })).toMatchObject({ rbt12Centavos: 0, origem: "sem-dados" });
  });

  it("despesas fixas %: total ÷ faturamento médio; sem faturamento → infinito", () => {
    expect(despesasFixasPercentual(75000, 500000)).toBeCloseTo(15, 10);
    expect(despesasFixasPercentual(75000, 0)).toBe(Infinity);
  });
});

describe("T03 — Anexo efetivo, Fator R, ponto de equilíbrio e meta", () => {
  const regra = { limiteMinimo: 28, anexoSeAtingir: "III" as const, anexoSeNaoAtingir: "V" as const };

  it("Fator R: ≥ 28% → III; abaixo → V; sem receita → V; não sujeito → o do cadastro (RF69, RN28)", () => {
    expect(anexoEfetivo({ sujeitoFatorR: true, anexoCadastro: "V", folhaCentavos: 9000000, receitaRealCentavos: 30000000, regra })).toEqual({ anexo: "III", fatorR: 30 });
    expect(anexoEfetivo({ sujeitoFatorR: true, anexoCadastro: "V", folhaCentavos: 8400000, receitaRealCentavos: 30000000, regra }).anexo).toBe("III"); // exatamente 28%
    expect(anexoEfetivo({ sujeitoFatorR: true, anexoCadastro: "III", folhaCentavos: 6000000, receitaRealCentavos: 30000000, regra })).toEqual({ anexo: "V", fatorR: 20 });
    expect(anexoEfetivo({ sujeitoFatorR: true, anexoCadastro: "III", folhaCentavos: 100, receitaRealCentavos: 0, regra })).toEqual({ anexo: "V", fatorR: null });
    expect(anexoEfetivo({ sujeitoFatorR: false, anexoCadastro: "I", folhaCentavos: 0, receitaRealCentavos: 1, regra: null })).toEqual({ anexo: "I", fatorR: null });
  });

  it("CA-10: PE R$ 5.000 e meta R$ 7.500; denominador ≤ 0 → sem valor", () => {
    const e = { despesasFixasCentavos: 300000, cmv: 30, imposto: 6, taxaCartao: 4 };
    expect(pontoDeEquilibrio(e)).toBe(500000);
    expect(pontoDeEquilibrio({ ...e, margemMeta: 20 })).toBe(750000);
    expect(pontoDeEquilibrio({ ...e, cmv: 90 })).toBeNull();
  });
});

describe("T04 — validação (5.5)", () => {
  it("opções: vazias → sugeridas; margem até 99,99", () => {
    expect(validarOpcoes({ margem: "", comissao: "" })).toEqual({ ok: true, dados: { margem: null, comissao: null } });
    expect(validarOpcoes({ margem: "32,5", comissao: "2" })).toEqual({ ok: true, dados: { margem: 32.5, comissao: 2 } });
    for (const margem of ["100", "-1", "1,234", "abc"]) expect(validarOpcoes({ margem })).toMatchObject({ ok: false, erros: { margem: M.margemInvalida } });
  });

  it("confirmação: arredondamento e preço visto", () => {
    expect(validarConfirmacao({ margem: "", arredondar: "real", precoVisto: "5500" })).toEqual({ ok: true, dados: { margem: null, arredondar: true, precoVistoCentavos: 5500 } });
    expect(validarConfirmacao({ arredondar: "x", precoVisto: "1.5" })).toMatchObject({ ok: false, erros: { arredondar: M.arredondamentoInvalido, preco: M.precoVistoInvalido } });
  });

  it("parâmetros: faturamento sugerido = capacidade × ticket; faixas (CA-11)", () => {
    expect(validarParametros({ taxaCartao: "3,5", capacidadeMensal: "100", unidadeCapacidade: " atendimentos ", ticketMedio: "50", faturamentoEstimado: "", cmvEstimado: "30", margemMeta: "20" })).toEqual({
      ok: true,
      dados: { taxaCartao: 3.5, capacidadeMensal: 100, unidadeCapacidade: "atendimentos", ticketMedioCentavos: 5000, faturamentoEstimadoCentavos: 500000, cmvEstimado: 30, margemMeta: 20 },
    });
    expect(validarParametros({ faturamentoEstimado: "7.000,00", capacidadeMensal: "100", ticketMedio: "50" })).toMatchObject({ ok: true, dados: { faturamentoEstimadoCentavos: 700000, taxaCartao: 0 } });
    expect(validarParametros({ taxaCartao: "31", capacidadeMensal: "0", ticketMedio: "-1", cmvEstimado: "96", margemMeta: "x", unidadeCapacidade: "a".repeat(31) })).toEqual({
      ok: false,
      erros: { taxaCartao: M.taxaInvalida, capacidadeMensal: M.capacidadeInvalida, ticketMedio: M.valorInvalido, cmvEstimado: M.percentualInvalido, margemMeta: M.percentualInvalido, unidadeCapacidade: M.unidadeLonga },
    });
  });
});

describe("T10 — permissões da Calculadora (OPEN-003, CA-12)", () => {
  const acoes = readFileSync("src/lib/calculadora/acoes.ts", "utf-8");
  it.each([
    ["acaoConfirmarPreco", "criar"],
    ["acaoSalvarParametros", "editar"],
  ])("%s exige Calculadora — %s", (nome, acao) => {
    expect(acoes).toMatch(new RegExp(`export const ${nome} = acaoComPermissao\\("calculadora", "${acao}"`));
  });

  it("páginas exigem Calculadora — ver; o atalho do Catálogo também", () => {
    for (const p of ["src/app/(app)/calculadora/page.tsx", "src/app/(app)/calculadora/parametros/page.tsx"]) expect(readFileSync(p, "utf-8")).toMatch(/exigirPermissao\("calculadora", "ver"\)/);
    expect(readFileSync("src/app/(app)/catalogo/[id]/page.tsx", "utf-8")).toMatch(/pode\(membro\.permissoes, "calculadora", "ver"\)/);
  });

  it("menu: 'Calculadora' só com ver; Colaborador predefinido não tem", () => {
    const comCalc = (calculadora: Matriz["calculadora"]): Matriz => ({ ...MATRIZ_VAZIA, calculadora });
    expect(menuDoMembro("COLABORADOR", comCalc({ ver: true, criar: false, editar: false, excluir: false })).map((i) => i.rotulo)).toContain("Calculadora");
    expect(menuDoMembro("COLABORADOR", PREDEFINICOES.COLABORADOR).map((i) => i.rotulo)).not.toContain("Calculadora");
  });
});
