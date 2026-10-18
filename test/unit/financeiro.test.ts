import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decidirRota } from "@/lib/auth/rotas";
import { somarDias } from "@/lib/dominio/estoque";
import {
  competenciasDevidas,
  descricaoDaContaFixa,
  descricaoDoEstorno,
  estaAtrasada,
  MAX_COMPETENCIAS_POR_CONFERENCIA,
  primeiraCompetencia,
  saldo,
  situacaoPeloValor,
  somarMeses,
  vencimentoNaCompetencia,
} from "@/lib/dominio/financeiro";
import { MATRIZ_VAZIA, PREDEFINICOES, type Matriz } from "@/lib/dominio/permissoes";
import { menuDoMembro } from "@/lib/equipe/menu";
import { MENSAGENS_FINANCEIRO as M, validarConta, validarDespesa, validarLancamento, validarPagamento, validarSaldoInicial } from "@/lib/financeiro/validacao";
import { autorizacaoConfere, executarRotinaDiaria } from "@/lib/rotinas/diaria";

// SPEC-009 — testes unitários (seção 12).

const HOJE = "2026-10-09";

describe("T01 — saldo, situação, atrasada, competências e vencimentos", () => {
  it("saldo = entradas − saídas (RN14)", () => {
    expect(saldo([])).toBe(0);
    expect(
      saldo([
        { tipo: "ENTRADA", valorCentavos: 5000 },
        { tipo: "SAIDA", valorCentavos: 8000 },
        { tipo: "ENTRADA", valorCentavos: 100000 },
      ]),
    ).toBe(97000);
  });

  it("situação pelo valor pago (Diagrama 3)", () => {
    expect([situacaoPeloValor(30000, 0), situacaoPeloValor(30000, 10000), situacaoPeloValor(30000, 30000)]).toEqual(["ABERTA", "PARCIAL", "QUITADA"]);
  });

  it("atrasada: vencida antes de hoje, aberta ou parcial, com restante (CA-07)", () => {
    const c = { vencimento: "2026-10-08", status: "ABERTA" as const, totalCentavos: 100, pagoCentavos: 0 };
    expect(estaAtrasada(c, HOJE)).toBe(true);
    expect(estaAtrasada({ ...c, vencimento: HOJE }, HOJE)).toBe(false);
    expect(estaAtrasada({ ...c, status: "PARCIAL", pagoCentavos: 50 }, HOJE)).toBe(true);
    expect(estaAtrasada({ ...c, status: "QUITADA", pagoCentavos: 100 }, HOJE)).toBe(false);
    expect(estaAtrasada({ ...c, status: "CANCELADA" }, HOJE)).toBe(false);
  });

  it("vencimento na competência: último dia em meses curtos", () => {
    expect(vencimentoNaCompetencia("2026-10", 5)).toBe("2026-10-05");
    expect(vencimentoNaCompetencia("2027-02", 31)).toBe("2027-02-28");
    expect(vencimentoNaCompetencia("2028-02", 30)).toBe("2028-02-29");
    expect(vencimentoNaCompetencia("2026-04", 31)).toBe("2026-04-30");
  });

  it("primeira competência pelo OPEN-004 e competências devidas", () => {
    expect(primeiraCompetencia(HOJE, 5)).toBe("2026-11"); // dia 5 já passou
    expect(primeiraCompetencia(HOJE, 9)).toBe("2026-10"); // vence hoje: ainda conta
    expect(primeiraCompetencia(HOJE, 31)).toBe("2026-10");
    expect(primeiraCompetencia("2026-12-20", 10)).toBe("2027-01");
    expect(somarMeses("2026-12", 1)).toBe("2027-01");
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
    expect(competenciasDevidas("2026-11", "2027-01")).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(competenciasDevidas("2026-11", "2026-10")).toEqual([]);
    expect(competenciasDevidas("2020-01", "2026-10")).toHaveLength(MAX_COMPETENCIAS_POR_CONFERENCIA);
  });

  it("descrições geradas respeitam 120 caracteres", () => {
    expect(descricaoDaContaFixa("Aluguel", "2026-10")).toBe("Aluguel — 10/2026");
    expect(descricaoDaContaFixa("x".repeat(120), "2026-10")).toHaveLength(120);
    expect(descricaoDoEstorno("Compra de esmaltes")).toBe("Estorno de: Compra de esmaltes");
    expect(descricaoDoEstorno("y".repeat(120))).toHaveLength(120);
  });
});

describe("T02 — validação (5.7)", () => {
  const avulso = { tipo: "SAIDA", valor: "1.234,56", categoria: "FORNECEDORES", descricao: "  Compra   de esmaltes ", data: HOJE };

  it("aceita e normaliza o avulso", () => {
    expect(validarLancamento(avulso, HOJE)).toEqual({
      ok: true,
      dados: { tipo: "SAIDA", valorCentavos: 123456, categoria: "FORNECEDORES", descricao: "Compra de esmaltes", dia: HOJE },
    });
  });

  it.each<[string, Record<string, string>, string, string]>([
    ["tipo inválido", { ...avulso, tipo: "X" }, "tipo", M.tipoInvalido],
    ["valor vazio", { ...avulso, valor: "" }, "valor", M.valorObrigatorio],
    ["valor zero", { ...avulso, valor: "0" }, "valor", M.valorInvalido],
    ["valor negativo", { ...avulso, valor: "-5" }, "valor", M.valorInvalido],
    ["valor com 3 casas", { ...avulso, valor: "1,234" }, "valor", M.valorInvalido],
    ["valor acima do máximo", { ...avulso, valor: "10.000.000,00" }, "valor", M.valorInvalido],
    ["categoria inexistente", { ...avulso, categoria: "ALUGUEL" }, "categoria", M.categoriaInvalida],
    ["sem descrição", { ...avulso, descricao: " " }, "descricao", M.descricaoObrigatoria],
    ["descrição longa", { ...avulso, descricao: "a".repeat(121) }, "descricao", M.descricaoLonga],
    ["data futura", { ...avulso, data: "2026-10-10" }, "data", M.dataInvalida],
    ["data com mais de 90 dias", { ...avulso, data: somarDias(HOJE, -91) }, "data", M.dataInvalida],
    ["data inexistente", { ...avulso, data: "2026-02-30" }, "data", M.dataInvalida],
  ])("avulso: recusa %s", (_, campos, campo, mensagem) => {
    const r = validarLancamento(campos, HOJE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[campo]).toBe(mensagem);
  });

  it("90 dias atrás é aceito (OPEN-007)", () => {
    expect(validarLancamento({ ...avulso, data: somarDias(HOJE, -90) }, HOJE).ok).toBe(true);
  });

  it("saldo inicial, pagamento, conta e despesa", () => {
    expect(validarSaldoInicial({ valor: "1000", data: HOJE }, HOJE)).toEqual({ ok: true, dados: { valorCentavos: 100000, dia: HOJE } });
    expect(validarPagamento({ valor: "100", data: "" }, HOJE)).toMatchObject({ ok: false, erros: { data: M.dataObrigatoria } });
    const conta = { tipo: "PAGAR", descricao: "Fornecedor", categoria: "FORNECEDORES", valor: "300", vencimento: "2027-03-01" };
    expect(validarConta(conta, HOJE)).toMatchObject({ ok: true, dados: { valorCentavos: 30000, vencimento: "2027-03-01" } });
    expect(validarConta({ ...conta, vencimento: "2020-01-01" }, HOJE).ok).toBe(true); // passada é aceita
    expect(validarConta({ ...conta, vencimento: "2050-01-01" }, HOJE)).toMatchObject({ ok: false, erros: { vencimento: M.vencimentoInvalido } });
    expect(validarConta({ ...conta, tipo: "X" }, HOJE)).toMatchObject({ ok: false, erros: { tipo: M.tipoContaInvalido } });
    expect(validarDespesa({ descricao: "Aluguel", valor: "1200", diaVencimento: "5" })).toEqual({
      ok: true,
      dados: { descricao: "Aluguel", valorCentavos: 120000, diaVencimento: 5, categoria: "OUTROS" },
    });
    for (const dia of ["0", "32", "1.5", "", "a"]) {
      expect(validarDespesa({ descricao: "A", valor: "1", diaVencimento: dia })).toMatchObject({ ok: false, erros: { diaVencimento: M.diaInvalido } });
    }
  });
});

describe("T12 — permissões do Financeiro (OPEN-006, CA-13)", () => {
  const acoes = readFileSync("src/lib/financeiro/acoes.ts", "utf-8");
  it.each([
    ["acaoLancarAvulso", "criar"],
    ["acaoInformarSaldoInicial", "criar"],
    ["acaoCriarConta", "criar"],
    ["acaoRegistrarPagamento", "criar"],
    ["acaoCriarDespesa", "criar"],
    ["acaoEditarConta", "editar"],
    ["acaoEditarDespesa", "editar"],
    ["acaoDefinirAtivo", "editar"],
    ["acaoEstornar", "excluir"],
    ["acaoCancelarConta", "excluir"],
  ])("%s exige Financeiro — %s", (nome, acao) => {
    expect(acoes).toMatch(new RegExp(`export const ${nome} = acaoComPermissao\\("financeiro", "${acao}"`));
  });

  const comFinanceiro = (financeiro: Matriz["financeiro"]): Matriz => ({ ...PREDEFINICOES.COLABORADOR, financeiro });
  const rotulos = (m: Matriz) => menuDoMembro("COLABORADOR", m).map((i) => i.rotulo);

  it("menu: só criar → 'Lançar despesa'; ver → 'Financeiro'; nada → nenhum", () => {
    expect(rotulos(comFinanceiro({ ver: false, criar: true, editar: false, excluir: false }))).toEqual(expect.arrayContaining(["Lançar despesa"]));
    expect(rotulos(comFinanceiro({ ver: false, criar: true, editar: false, excluir: false }))).not.toContain("Financeiro");
    expect(rotulos(comFinanceiro({ ver: true, criar: true, editar: false, excluir: false }))).toContain("Financeiro");
    expect(rotulos(comFinanceiro({ ver: true, criar: true, editar: false, excluir: false }))).not.toContain("Lançar despesa");
    expect(rotulos(PREDEFINICOES.COLABORADOR)).not.toEqual(expect.arrayContaining(["Financeiro"]));
    expect(menuDoMembro("DONO", PREDEFINICOES.DONO).map((i) => i.rotulo)).toContain("Financeiro");
    expect(menuDoMembro("COLABORADOR", MATRIZ_VAZIA).map((i) => i.rotulo)).toEqual(["Painel"]);
  });

  it("páginas do caixa exigem 'ver'; a de lançar exige 'criar'", () => {
    for (const pagina of ["page.tsx", "contas/page.tsx", "contas/[id]/page.tsx", "despesas-fixas/page.tsx", "despesas-fixas/[id]/page.tsx"]) {
      expect(readFileSync(`src/app/(app)/financeiro/${pagina}`, "utf-8"), pagina).toMatch(/exigirPermissao\("financeiro", "ver"\)/);
    }
    expect(readFileSync("src/app/(app)/financeiro/lancar/page.tsx", "utf-8")).toMatch(/exigirPermissao\("financeiro", "criar"\)/);
    expect(readFileSync("src/app/(app)/financeiro/contas/nova/page.tsx", "utf-8")).toMatch(/exigirPermissao\("financeiro", "criar"\)/);
  });
});

describe("rotina diária (CA-12, INV-007)", () => {
  const SEGREDO = "um-segredo-longo-de-teste-123456";

  it("só o cabeçalho exato passa; sem segredo ou com segredo curto, nada passa", () => {
    expect(autorizacaoConfere(`Bearer ${SEGREDO}`, SEGREDO)).toBe(true);
    expect(autorizacaoConfere(SEGREDO, SEGREDO)).toBe(false);
    expect(autorizacaoConfere(`Bearer ${SEGREDO}x`, SEGREDO)).toBe(false);
    expect(autorizacaoConfere(null, SEGREDO)).toBe(false);
    expect(autorizacaoConfere("Bearer ", "")).toBe(false);
    expect(autorizacaoConfere("Bearer undefined", undefined)).toBe(false);
    expect(autorizacaoConfere("Bearer curto", "curto")).toBe(false);
  });

  it("a rota não exige sessão (o proxy deixa passar; ela exige o segredo)", () => {
    expect(decidirRota("/api/rotinas/diaria", "", false)).toEqual({ tipo: "seguir" });
  });

  it("a falha de um negócio não impede os demais", async () => {
    const r = await executarRotinaDiaria(["a", "b", "c"], async (n) => {
      if (n === "b") throw new Error("falhou");
      return { contasCriadas: 1, parcelasRecebidas: 2 };
    });
    expect(r).toEqual({ negocios: 3, contasCriadas: 2, parcelasRecebidas: 4, falhas: 1 });
    expect(await executarRotinaDiaria([], async () => ({ contasCriadas: 1, parcelasRecebidas: 0 }))).toEqual({ negocios: 0, contasCriadas: 0, parcelasRecebidas: 0, falhas: 0 });
  });

  it("vercel.json agenda a rotina uma vez por dia (plano gratuito)", () => {
    const v = JSON.parse(readFileSync("vercel.json", "utf-8"));
    expect(v.crons).toEqual([{ path: "/api/rotinas/diaria", schedule: "0 9 * * *" }]);
  });
});
