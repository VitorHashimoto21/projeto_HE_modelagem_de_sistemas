import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CARTOES_FINANCEIROS,
  cartoesPermitidos,
  competenciasDaProjecao,
  montarProjecao,
  semaforo,
  serieDiaria,
  serieMensal,
  type ContaParaProjecao,
  type DespesaParaProjecao,
} from "@/lib/dominio/dashboard";
import { PREDEFINICOES, MATRIZ_VAZIA, pode, type Matriz } from "@/lib/dominio/permissoes";

// SPEC-012 — testes unitários (seção 12): séries, semáforo, projeção e cartões por permissão.

describe("T01 — séries do gráfico (RF43)", () => {
  it("30 dias até hoje, dias sem venda com zero, atravessando o mês; total e maior valor (CA-04)", () => {
    const s = serieDiaria("2026-03-05", { "2026-02-04": 1000, "2026-02-03": 99999, "2026-02-28": 500, "2026-03-05": 2500 });
    expect(s.pontos).toHaveLength(30);
    expect(s.pontos[0]).toEqual({ periodo: "2026-02-04", totalCentavos: 1000 });
    expect(s.pontos[29]).toEqual({ periodo: "2026-03-05", totalCentavos: 2500 });
    expect(s.pontos.filter((p) => p.totalCentavos === 0)).toHaveLength(27);
    expect(s.totalCentavos).toBe(4000); // 03/02 (31 dias atrás) fica fora
    expect(s.maiorCentavos).toBe(2500);
  });

  it("ano bissexto: 29/02 aparece na série", () => {
    const s = serieDiaria("2028-03-01", {});
    expect(s.pontos.map((p) => p.periodo)).toContain("2028-02-29");
    expect(s.pontos[0].periodo).toBe("2028-02-01"); // fevereiro com 29 dias
  });

  it("12 meses até o atual, atravessando o ano; sem vendas → zeros (CA-05)", () => {
    const s = serieMensal("2026-02-10", { "2025-03": 100, "2025-02": 999, "2026-02": 50 });
    expect(s.pontos.map((p) => p.periodo)).toEqual([
      "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02",
    ]);
    expect(s.totalCentavos).toBe(150);
    expect(serieMensal("2026-02-10", {}).maiorCentavos).toBe(0);
  });
});

describe("T02 — semáforo (RF57, OPEN-003)", () => {
  const pe = 500000;
  const meta = 800000;
  it("PE R$ 5.000 e meta R$ 8.000: R$ 4.000 vermelho, R$ 5.000 amarelo, R$ 8.000 verde (CA-06)", () => {
    const v = semaforo({ faturamentoCentavos: 400000, pontoDeEquilibrioCentavos: pe, metaCentavos: meta, hoje: "2026-10-15" });
    expect(v).toMatchObject({ cor: "vermelho", faltaParaPeCentavos: 100000, faltaParaMetaCentavos: 400000, progresso: 0.5, marcaDoPe: 0.625 });
    expect(semaforo({ faturamentoCentavos: 500000, pontoDeEquilibrioCentavos: pe, metaCentavos: meta, hoje: "2026-10-15" })).toMatchObject({ cor: "amarelo", faltaParaPeCentavos: 0, faltaParaMetaCentavos: 300000 });
    expect(semaforo({ faturamentoCentavos: 800000, pontoDeEquilibrioCentavos: pe, metaCentavos: meta, hoje: "2026-10-15" })).toMatchObject({ cor: "verde", faltaParaMetaCentavos: 0, progresso: 1 });
    expect(semaforo({ faturamentoCentavos: 900000, pontoDeEquilibrioCentavos: pe, metaCentavos: meta, hoje: "2026-10-15" }).progresso).toBe(1);
  });

  it("sem meta: só abaixo do PE ou PE atingido, com o progresso até o PE (CA-07)", () => {
    expect(semaforo({ faturamentoCentavos: 250000, pontoDeEquilibrioCentavos: pe, metaCentavos: null, hoje: "2026-10-15" })).toMatchObject({
      cor: "vermelho",
      faltaParaMetaCentavos: null,
      progresso: 0.5,
      marcaDoPe: null,
    });
    expect(semaforo({ faturamentoCentavos: 500000, pontoDeEquilibrioCentavos: pe, metaCentavos: null, hoje: "2026-10-15" }).cor).toBe("equilibrio");
  });

  it("ritmo: média por dia × dias do mês; não muda a cor; sem ritmo no último dia ou sem vendas", () => {
    const s = semaforo({ faturamentoCentavos: 100000, pontoDeEquilibrioCentavos: pe, metaCentavos: meta, hoje: "2026-10-03" });
    expect(s.ritmoCentavos).toBe(1033333); // R$ 1.000 em 3 dias → × 31
    expect(s.cor).toBe("vermelho");
    expect(semaforo({ faturamentoCentavos: 100000, pontoDeEquilibrioCentavos: pe, metaCentavos: meta, hoje: "2026-02-28" }).ritmoCentavos).toBeNull();
    expect(semaforo({ faturamentoCentavos: 0, pontoDeEquilibrioCentavos: pe, metaCentavos: meta, hoje: "2026-10-10" }).ritmoCentavos).toBeNull();
  });
});

describe("T03 — projeção de caixa (RF68, OPEN-004)", () => {
  const HOJE = "2026-10-11";
  const aluguel: DespesaParaProjecao = {
    id: "aluguel",
    primeiraCompetencia: "2026-01",
    valorPorCompetencia: Object.fromEntries(competenciasDaProjecao(HOJE).map((c) => [c, 50000])),
  };

  it("mês atual + 5 seguintes", () => {
    expect(competenciasDaProjecao("2026-10-11")).toEqual(["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"]);
  });

  it("CA-09: saldo R$ 1.000, parcelas, aluguel (conta do mês gerada) e conta avulsa → saldos acumulados, sem duplicar o aluguel", () => {
    const contas: ContaParaProjecao[] = [
      { tipo: "PAGAR", vencimento: "2026-10-05", restanteCentavos: 50000 }, // aluguel do mês (gerado)
      { tipo: "RECEBER", vencimento: "2026-11-11", restanteCentavos: 10000 },
      { tipo: "RECEBER", vencimento: "2026-12-11", restanteCentavos: 10000 },
      { tipo: "PAGAR", vencimento: "2027-01-20", restanteCentavos: 20000 },
    ];
    const p = montarProjecao({ hoje: HOJE, saldoAtualCentavos: 100000, contas, despesas: [aluguel], competenciasGeradas: new Set(["aluguel|2026-10"]) });
    expect(p.meses.map((m) => m.saldoProjetadoCentavos)).toEqual([50000, 10000, -30000, -100000, -150000, -200000]);
    expect(p.meses.map((m) => m.negativo)).toEqual([false, false, true, true, true, true]);
    expect(p.meses[0]).toMatchObject({ entradasCentavos: 0, saidasCentavos: 50000, saidasEstimadasCentavos: 0 });
    expect(p.meses[1]).toMatchObject({ entradasCentavos: 10000, saidasCentavos: 50000, saidasEstimadasCentavos: 50000 });
    expect(p.meses[3]).toMatchObject({ saidasCentavos: 70000, saidasEstimadasCentavos: 50000 });
    expect(p.atrasadas).toEqual({ entradasCentavos: 0, saidasCentavos: 50000, quantidade: 1 }); // venceu dia 5
  });

  it("CA-10: vencida no mês passado entra no mês atual como atrasada; depois do último mês fica fora", () => {
    const p = montarProjecao({
      hoje: HOJE,
      saldoAtualCentavos: 0,
      contas: [
        { tipo: "PAGAR", vencimento: "2026-09-20", restanteCentavos: 8000 },
        { tipo: "RECEBER", vencimento: "2026-08-01", restanteCentavos: 3000 },
        { tipo: "RECEBER", vencimento: "2027-04-01", restanteCentavos: 99999 },
        { tipo: "PAGAR", vencimento: "2026-10-30", restanteCentavos: 0 },
      ],
      despesas: [],
      competenciasGeradas: new Set(),
    });
    expect(p.meses[0]).toMatchObject({ entradasCentavos: 3000, saidasCentavos: 8000, saldoProjetadoCentavos: -5000 });
    expect(p.atrasadas).toEqual({ entradasCentavos: 3000, saidasCentavos: 8000, quantidade: 2 });
    expect(p.meses[5].saldoProjetadoCentavos).toBe(-5000);
  });

  it("INV-005: competência com conta gerada (quitada ou cancelada) não usa a despesa; geraDesde e DAS sem valor respeitados", () => {
    const comps = competenciasDaProjecao(HOJE);
    const p = montarProjecao({
      hoje: HOJE,
      saldoAtualCentavos: 0,
      contas: [],
      despesas: [
        { ...aluguel, primeiraCompetencia: "2026-12" },
        { id: "das", primeiraCompetencia: "2026-01", valorPorCompetencia: { ...Object.fromEntries(comps.map((c) => [c, 8605])), "2027-01": 9100, "2027-02": null } },
      ],
      competenciasGeradas: new Set(["das|2026-10", "aluguel|2026-12"]),
    });
    expect(p.meses.map((m) => m.saidasEstimadasCentavos)).toEqual([0, 8605, 8605, 50000 + 9100, 50000, 50000 + 8605]);
  });
});

describe("T09 — cartões por permissão (RF63, SPEC-005 OPEN-003)", () => {
  const de = (m: Matriz) => cartoesPermitidos({ dashboard: pode(m, "dashboard", "ver"), estoque: pode(m, "estoque", "ver"), financeiro: pode(m, "financeiro", "ver") });
  const semFinanceiro = (m: Matriz): Matriz => ({ ...m, financeiro: { ver: false, criar: true, editar: false, excluir: false } });

  it("Dono e Gerente: todos, na ordem da lista", () => {
    expect(de(PREDEFINICOES.DONO)).toEqual(["vendasDoDia", "saldo", "estoque", "semaforo", "grafico", "projecao"]);
    expect(de(PREDEFINICOES.GERENTE)).toEqual(de(PREDEFINICOES.DONO));
  });

  it("CA-11: Colaborador e Gerente sem Financeiro — ver: só o restrito, nenhum cartão financeiro", () => {
    expect(de(PREDEFINICOES.COLABORADOR)).toEqual(["vendasDoDia", "estoque"]);
    expect(de(semFinanceiro(PREDEFINICOES.GERENTE))).toEqual(["vendasDoDia", "estoque"]);
    for (const c of de(semFinanceiro(PREDEFINICOES.GERENTE))) expect(CARTOES_FINANCEIROS).not.toContain(c);
  });

  it("CA-12: sem Dashboard — ver, nenhum cartão (mesmo com Financeiro)", () => {
    expect(de({ ...PREDEFINICOES.GERENTE, dashboard: { ver: false, criar: false, editar: false, excluir: false } })).toEqual([]);
    expect(de(MATRIZ_VAZIA)).toEqual([]);
  });

  it("INV-004: a página só chama os carregadores financeiros para os cartões permitidos", () => {
    const pagina = readFileSync("src/app/(app)/painel/page.tsx", "utf-8");
    for (const c of ["saldo", "semaforo", "grafico", "projecao"]) expect(pagina).toMatch(new RegExp(`tem\\("${c}"\\) \\? cartaoSeguro\\("${c}"`));
  });
});
