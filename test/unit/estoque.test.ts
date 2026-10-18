import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  consumoMedioDiario,
  dataPermitida,
  diasEntre,
  minimoEmVigor,
  situacaoDoEstoque,
  somarDias,
  sugestaoDeMinimo,
  type ResumoDoConsumo,
} from "@/lib/dominio/estoque";
import { PREDEFINICOES, pode } from "@/lib/dominio/permissoes";
import { menuDoMembro } from "@/lib/equipe/menu";
import { MENSAGENS_ESTOQUE as M, validarDiasCobertura, validarMinimo, validarMovimentacao } from "@/lib/estoque/validacao";

// SPEC-007 — testes unitários (seção 12).

const HOJE = "2026-10-09";

describe("T01 — validação das movimentações (CA-03, CA-14)", () => {
  it("aceita entrada e saída válidas, com vírgula e observação normalizada", () => {
    expect(validarMovimentacao({ quantidade: "1,5", data: HOJE }, "entrada", HOJE)).toEqual({
      ok: true,
      dados: { quantidade: 1.5, dia: HOJE, motivo: null, observacao: null },
    });
    expect(validarMovimentacao({ quantidade: "3", data: HOJE, motivo: "OUTRO", observacao: "  amostra   grátis " }, "saida", HOJE)).toMatchObject({
      ok: true,
      dados: { motivo: "OUTRO", observacao: "amostra grátis" },
    });
  });

  it.each<[string, Record<string, string>, "entrada" | "saida", string, string]>([
    ["sem quantidade", { quantidade: "", data: HOJE }, "entrada", "quantidade", M.quantidadeObrigatoria],
    ["quantidade zero", { quantidade: "0", data: HOJE }, "entrada", "quantidade", M.quantidadeInvalida],
    ["quantidade negativa", { quantidade: "-2", data: HOJE }, "entrada", "quantidade", M.quantidadeInvalida],
    ["4 casas decimais", { quantidade: "1,0005", data: HOJE }, "entrada", "quantidade", M.quantidadeInvalida],
    ["acima do limite", { quantidade: "10000000", data: HOJE }, "entrada", "quantidade", M.quantidadeInvalida],
    ["sem data", { quantidade: "1", data: "" }, "entrada", "data", M.dataObrigatoria],
    ["data futura", { quantidade: "1", data: "2026-10-10" }, "entrada", "data", M.dataInvalida],
    ["mais de 90 dias", { quantidade: "1", data: somarDias(HOJE, -91) }, "entrada", "data", M.dataInvalida],
    ["data inexistente", { quantidade: "1", data: "2026-02-30" }, "entrada", "data", M.dataInvalida],
    ["saída sem motivo", { quantidade: "1", data: HOJE }, "saida", "motivo", M.motivoObrigatorio],
    ["motivo inexistente", { quantidade: "1", data: HOJE, motivo: "ROUBO" }, "saida", "motivo", M.motivoObrigatorio],
    ["'Outro' sem observação", { quantidade: "1", data: HOJE, motivo: "OUTRO", observacao: " " }, "saida", "observacao", M.observacaoObrigatoria],
    ["observação longa", { quantidade: "1", data: HOJE, observacao: "x".repeat(201) }, "entrada", "observacao", M.observacaoLonga],
  ])("recusa %s", (_, campos, tipo, campo, mensagem) => {
    const r = validarMovimentacao(campos, tipo, HOJE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[campo]).toBe(mensagem);
  });

  it("90 dias atrás ainda vale; o motivo da entrada é ignorado", () => {
    expect(validarMovimentacao({ quantidade: "1", data: somarDias(HOJE, -90) }, "entrada", HOJE).ok).toBe(true);
    expect(validarMovimentacao({ quantidade: "1", data: HOJE, motivo: "PERDA" }, "entrada", HOJE)).toMatchObject({ ok: true, dados: { motivo: null } });
  });

  it("mínimo manual e dias de cobertura", () => {
    expect(validarMinimo({ estoqueMinimo: "" })).toEqual({ ok: true, dados: null });
    expect(validarMinimo({ estoqueMinimo: "2,5" })).toEqual({ ok: true, dados: 2.5 });
    expect(validarMinimo({ estoqueMinimo: "-1" }).ok).toBe(false);
    expect(validarDiasCobertura({ diasCoberturaEstoque: "14" })).toEqual({ ok: true, dados: 14 });
    for (const v of ["0", "91", "7,5", "", "abc"]) expect(validarDiasCobertura({ diasCoberturaEstoque: v }).ok).toBe(false);
  });
});

describe("T02 — consumo e sugestão (CA-07, CA-08, INV-007)", () => {
  const resumo = (r: Partial<ResumoDoConsumo>): ResumoDoConsumo => ({
    cicloCompleto: true,
    primeiroDia: somarDias(HOJE, -29),
    saidasNaJanela: 60,
    estornosNaJanela: 0,
    ...r,
  });

  it("CA-08: 60 saídas em 30 dias × 7 dias = ⌈14⌉ = 14; com 14 dias = 28", () => {
    expect(consumoMedioDiario(resumo({}), HOJE)).toBe(2);
    expect(sugestaoDeMinimo(resumo({}), 7, HOJE)).toBe(14);
    expect(sugestaoDeMinimo(resumo({}), 14, HOJE)).toBe(28);
  });

  it("arredonda para cima e desconta estornos, nunca abaixo de zero", () => {
    expect(sugestaoDeMinimo(resumo({ saidasNaJanela: 10 }), 7, HOJE)).toBe(3); // 10/30×7 = 2,33…
    expect(sugestaoDeMinimo(resumo({ saidasNaJanela: 10, estornosNaJanela: 4 }), 7, HOJE)).toBe(2); // 6/30×7 = 1,4
    expect(sugestaoDeMinimo(resumo({ saidasNaJanela: 2, estornosNaJanela: 5 }), 7, HOJE)).toBe(0);
  });

  it("dias com histórico: desde a primeira movimentação, no máximo 90, contando hoje (OPEN-004)", () => {
    expect(consumoMedioDiario(resumo({ primeiroDia: HOJE, saidasNaJanela: 3 }), HOJE)).toBe(3);
    expect(consumoMedioDiario(resumo({ primeiroDia: somarDias(HOJE, -400), saidasNaJanela: 90 }), HOJE)).toBe(1);
  });

  it("sem ciclo completo não há sugestão (RN07)", () => {
    expect(sugestaoDeMinimo(resumo({ cicloCompleto: false }), 7, HOJE)).toBeNull();
  });
});

describe("T03 — mínimo em vigor e situação (CA-09, CA-10, OPEN-003)", () => {
  it("o manual tem prioridade; sem os dois, nenhum", () => {
    expect(minimoEmVigor(10, 14)).toEqual({ valor: 10, origem: "manual" });
    expect(minimoEmVigor(null, 14)).toEqual({ valor: 14, origem: "sugerido" });
    expect(minimoEmVigor(0, null)).toEqual({ valor: 0, origem: "manual" });
    expect(minimoEmVigor(null, null)).toBeNull();
  });

  it("situações", () => {
    const m = { valor: 10, origem: "sugerido" as const };
    expect(situacaoDoEstoque(0, m)).toBe("SEM_ESTOQUE");
    expect(situacaoDoEstoque(10, m)).toBe("BAIXO");
    expect(situacaoDoEstoque(10.001, m)).toBe("NORMAL");
    expect(situacaoDoEstoque(2, null)).toBe("SEM_MINIMO");
    expect(situacaoDoEstoque(2, { valor: 5, origem: "manual" })).toBe("BAIXO"); // manual alerta antes do ciclo
  });

  it("datas locais", () => {
    expect(diasEntre("2026-09-30", "2026-10-09")).toBe(9);
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(dataPermitida(HOJE, HOJE)).toBe(true);
    expect(dataPermitida("2026-10-10", HOJE)).toBe(false);
  });
});

describe("T13 — permissões do estoque (SPEC-005, OPEN-001)", () => {
  const acoes = readFileSync("src/lib/estoque/acoes.ts", "utf-8");

  it.each([
    ["acaoRegistrarEntrada", "criar"],
    ["acaoRegistrarSaida", "criar"],
    ["acaoDefinirMinimo", "editar"],
  ])("%s exige Estoque — %s", (nome, acao) => {
    expect(acoes).toMatch(new RegExp(`export const ${nome} = acaoComPermissao\\("estoque", "${acao}"`));
  });

  it("dias de cobertura só pelo Dono", () => {
    expect(readFileSync("src/lib/negocio/acoes.ts", "utf-8")).toMatch(/export const acaoDefinirDiasCobertura = acaoDoDono\(/);
  });

  it("Colaborador predefinido vê e movimenta, mas não define o mínimo; menu (CA-13)", () => {
    const c = PREDEFINICOES.COLABORADOR;
    expect([pode(c, "estoque", "ver"), pode(c, "estoque", "criar"), pode(c, "estoque", "editar")]).toEqual([true, true, false]);
    expect(menuDoMembro("COLABORADOR", c).map((i) => i.rotulo)).toContain("Estoque");
    const sem = { ...c, estoque: { ver: false, criar: false, editar: false, excluir: false } };
    expect(menuDoMembro("COLABORADOR", sem).map((i) => i.rotulo)).not.toContain("Estoque");
  });
});
