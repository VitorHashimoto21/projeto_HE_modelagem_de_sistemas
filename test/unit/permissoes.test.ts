import { describe, expect, it } from "vitest";
import {
  ACOES,
  MATRIZ_COMPLETA,
  MATRIZ_VAZIA,
  MODULOS,
  PREDEFINICOES,
  campoDaPermissao,
  matrizDoFormulario,
  matrizParaGravar,
  permissoesEfetivas,
  pode,
  resumoDaMatriz,
  validarMatriz,
  veDashboardCompleto,
  type Matriz,
} from "@/lib/dominio/permissoes";

// SPEC-005 — T01 e T02: matriz módulo × ação, predefinições, resolução e validação.

const copia = (m: Matriz): Matriz => JSON.parse(JSON.stringify(m));

describe("T01 — predefinições e resolução (5.1)", () => {
  it("Dono e Gerente têm todos os módulos e ações", () => {
    expect(PREDEFINICOES.DONO).toEqual(MATRIZ_COMPLETA);
    expect(PREDEFINICOES.GERENTE).toEqual(MATRIZ_COMPLETA);
  });

  it("Colaborador padrão (OPEN-001): catálogo ver; estoque ver/criar; vendas ver/criar sem cancelar; dashboard restrito", () => {
    const c = PREDEFINICOES.COLABORADOR;
    expect(c.catalogo).toEqual({ ver: true, criar: false, editar: false, excluir: false });
    expect(c.estoque).toEqual({ ver: true, criar: true, editar: false, excluir: false });
    expect(c.vendas).toEqual({ ver: true, criar: true, editar: false, excluir: false });
    expect(c.calculadora).toEqual({ ver: false, criar: false, editar: false, excluir: false });
    expect(c.financeiro).toEqual({ ver: false, criar: false, editar: false, excluir: false });
    expect(c.dashboard.ver).toBe(true);
    expect(veDashboardCompleto(c)).toBe(false);
  });

  it("Dono sempre tem tudo, mesmo com matriz gravada", () => {
    expect(permissoesEfetivas("DONO", MATRIZ_VAZIA)).toEqual(MATRIZ_COMPLETA);
  });

  it("sem matriz customizada vale a predefinição; com matriz, vale a matriz inteira", () => {
    expect(permissoesEfetivas("COLABORADOR", null)).toEqual(PREDEFINICOES.COLABORADOR);
    const custom = copia(MATRIZ_VAZIA);
    custom.financeiro.criar = true;
    expect(permissoesEfetivas("COLABORADOR", custom)).toEqual(custom);
    expect(permissoesEfetivas("GERENTE", custom)).toEqual(custom);
  });

  it("matriz gravada inválida não concede nada (falha fechada)", () => {
    expect(permissoesEfetivas("GERENTE", { financeiro: { ver: true } })).toEqual(MATRIZ_VAZIA);
    expect(permissoesEfetivas("COLABORADOR", "lixo")).toEqual(MATRIZ_VAZIA);
  });

  it("CA-11 — Financeiro: criar sem ver; Dashboard sem a parte financeira (OPEN-003)", () => {
    const m = copia(PREDEFINICOES.COLABORADOR);
    m.financeiro.criar = true;
    expect(pode(m, "financeiro", "criar")).toBe(true);
    expect(pode(m, "financeiro", "ver")).toBe(false);
    expect(veDashboardCompleto(m)).toBe(false);
    expect(veDashboardCompleto(MATRIZ_COMPLETA)).toBe(true);
  });
});

describe("T02 — validação da matriz (INV-008)", () => {
  it("aceita uma matriz completa e coerente", () => {
    expect(validarMatriz(PREDEFINICOES.COLABORADOR)).toEqual({ ok: true, matriz: PREDEFINICOES.COLABORADOR });
  });

  it("recusa editar ou excluir sem ver", () => {
    for (const acao of ["editar", "excluir"] as const) {
      const m = copia(MATRIZ_VAZIA);
      m.estoque[acao] = true;
      expect(validarMatriz(m)).toMatchObject({ ok: false, erro: expect.stringMatching(/Estoque.*Ver/) });
    }
  });

  it("recusa matriz parcial, valores não booleanos e chaves desconhecidas", () => {
    expect(validarMatriz({ financeiro: { ver: false, criar: true } }).ok).toBe(false);
    const naoBool = copia(MATRIZ_VAZIA) as unknown as Record<string, Record<string, unknown>>;
    naoBool.vendas.ver = "sim";
    expect(validarMatriz(naoBool).ok).toBe(false);
    expect(validarMatriz({ ...copia(MATRIZ_VAZIA), configuracoes: { ver: true } }).ok).toBe(false);
    const acaoExtra = copia(MATRIZ_VAZIA) as unknown as Record<string, Record<string, unknown>>;
    acaoExtra.vendas.aprovar = true;
    expect(validarMatriz(acaoExtra).ok).toBe(false);
    expect(validarMatriz(null).ok).toBe(false);
    expect(validarMatriz([]).ok).toBe(false);
  });

  it("lê a matriz das caixas de seleção do formulário", () => {
    const campos = { [campoDaPermissao("vendas", "ver")]: "on", [campoDaPermissao("vendas", "excluir")]: "on", outro: "x" };
    const m = matrizDoFormulario(campos);
    expect(m.vendas).toEqual({ ver: true, criar: false, editar: false, excluir: true });
    expect(MODULOS.filter((mod) => ACOES.some((a) => m[mod][a]))).toEqual(["vendas"]);
  });

  it("matriz igual à predefinição é gravada como null (não fica “personalizado”)", () => {
    expect(matrizParaGravar("COLABORADOR", copia(PREDEFINICOES.COLABORADOR))).toBeNull();
    expect(matrizParaGravar("GERENTE", copia(PREDEFINICOES.COLABORADOR))).toEqual(PREDEFINICOES.COLABORADOR);
  });

  it("resumo legível por módulo", () => {
    expect(resumoDaMatriz(PREDEFINICOES.COLABORADOR)).toContain("Vendas: ver, criar");
    expect(resumoDaMatriz(PREDEFINICOES.COLABORADOR)).toContain("Financeiro: sem acesso");
  });
});
