import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { AcimaDoLimiteDoSimples, criarConsultasFiscais, ParametroAusente } from "@/lib/db/parametros-fiscais";
import { aliquotaEfetiva, RbtInvalido } from "@/lib/dominio/fiscal";
import { CAMINHO_DO_ARQUIVO, validarParametros, type ParametrosFiscais } from "@/lib/fiscal/arquivo";
import { carregarParametros, ConflitoDeVigencia } from "../../scripts/fiscal/carga";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-003 — testes de integração (seção 12), no PostgreSQL local de teste.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const consultas = criarConsultasFiscais(base);
const arquivo = (): ParametrosFiscais => validarParametros(JSON.parse(readFileSync(CAMINHO_DO_ARQUIVO, "utf-8")));

const contar = async () => ({
  faixas: await base.faixaTributaria.count(),
  cnaes: await base.cnaeAnexo.count(),
  mei: await base.parametroMei.count(),
  fatorR: await base.parametroFatorR.count(),
  margens: await base.margemPadraoCategoria.count(),
});

beforeEach(async () => {
  await base.$executeRawUnsafe(
    'TRUNCATE "FaixaTributaria", "CnaeAnexo", "ParametroMei", "ParametroFatorR", "MargemPadraoCategoria"',
  );
});

afterAll(async () => {
  await base.$disconnect();
});

describe("carga", () => {
  it("T05 — carga inicial preenche as cinco tabelas (CA-01)", async () => {
    const r = await carregarParametros(base, arquivo());
    expect(r.gravado).toBe(true);
    expect(await contar()).toEqual({ faixas: 30, cnaes: 12, mei: 3, fatorR: 1, margens: 9 });
  });

  it("T06 — segunda carga sem mudanças (CA-02, INV-005)", async () => {
    await carregarParametros(base, arquivo());
    const r = await carregarParametros(base, arquivo());
    expect(r.gravado).toBe(false);
    expect(Object.values(r.resumo).every((l) => l.criados === 0 && l.novasVersoes === 0 && l.corrigidos === 0)).toBe(true);
  });

  it("simulação não grava nada", async () => {
    const r = await carregarParametros(base, arquivo(), { simular: true });
    expect(r.resumo.faixaTributaria.criados).toBe(30);
    expect((await contar()).faixas).toBe(0);
  });

  it("T07 — nova vigência do DAS preserva a anterior; consultas por data (CA-03, INV-004)", async () => {
    await carregarParametros(base, arquivo());
    const novo = arquivo();
    novo.parametroMei.push({ ...novo.parametroMei[0], valorDasMensal: 90.5, vigenteDesde: "2027-01-01" });

    const r = await carregarParametros(base, novo);
    expect(r.resumo.parametroMei).toEqual({ criados: 0, novasVersoes: 1, inalterados: 3, corrigidos: 0 });
    expect((await consultas.parametroMei("COMERCIO_INDUSTRIA", "2026-12-31")).valorDasMensal).toBe(82.05);
    expect(await consultas.parametroMei("COMERCIO_INDUSTRIA", "2027-01-01")).toMatchObject({ valorDasMensal: 90.5, vigenteDesde: "2027-01-01" });
  });

  it("T08 — conflito de vigência é recusado sem gravar nada (CA-05); --corrigir substitui", async () => {
    await carregarParametros(base, arquivo());
    const errado = arquivo();
    errado.parametroMei[0].valorDasMensal = 80;
    errado.cnaeAnexo.push({ ...errado.cnaeAnexo[0], cnae: "0000-0/01" }); // mudança que não pode entrar junto

    await expect(carregarParametros(base, errado)).rejects.toThrow(ConflitoDeVigencia);
    expect((await contar()).cnaes).toBe(12);
    expect((await consultas.parametroMei("COMERCIO_INDUSTRIA", "2026-06-01")).valorDasMensal).toBe(82.05);

    const r = await carregarParametros(base, errado, { corrigir: true });
    expect(r.resumo.parametroMei.corrigidos).toBe(1);
    expect((await consultas.parametroMei("COMERCIO_INDUSTRIA", "2026-06-01")).valorDasMensal).toBe(80);
    expect((await base.parametroMei.count())).toBe(3);
  });

  it("T09 — falha no meio da gravação desfaz tudo (CA-06, INV-005)", async () => {
    const quebrado = arquivo();
    // Margem acima do que a coluna Decimal(5,2) aceita: falha só na última tabela, depois das faixas.
    quebrado.margemPadraoCategoria[0].margemPadrao = 123456;
    await expect(carregarParametros(base, quebrado)).rejects.toThrow();
    expect(await contar()).toEqual({ faixas: 0, cnaes: 0, mei: 0, fatorR: 0, margens: 0 });
  });
});

describe("consultas", () => {
  beforeEach(async () => {
    await carregarParametros(base, arquivo());
  });

  it("T10 — faixa pelo RBT12 nas fronteiras, inválido e acima do teto (CA-07)", async () => {
    expect((await consultas.faixaDoSimples("III", 180_000, "2026-06-01")).faixaOrdem).toBe(1);
    expect((await consultas.faixaDoSimples("III", 180_000.01, "2026-06-01")).faixaOrdem).toBe(2);
    expect((await consultas.faixaDoSimples("III", 4_800_000, "2026-06-01")).faixaOrdem).toBe(6);
    await expect(consultas.faixaDoSimples("III", 0, "2026-06-01")).rejects.toThrow(RbtInvalido);
    await expect(consultas.faixaDoSimples("III", 4_800_000.01, "2026-06-01")).rejects.toThrow(AcimaDoLimiteDoSimples);
  });

  it("CA-08 — alíquota efetiva com a faixa vinda do banco", async () => {
    const faixa = await consultas.faixaDoSimples("III", 240_000, "2026-06-01");
    expect(faixa).toMatchObject({ faixaOrdem: 2, aliquota: 11.2, parcelaDeduzir: 9360, vigenteDesde: "2018-01-01" });
    expect(faixa.fonteLegal).toMatch(/LC 123\/2006/);
    expect(aliquotaEfetiva(faixa, 240_000)).toBeCloseTo(7.3, 10);
  });

  it("T11 — CNAE em qualquer formato, MEI, Fator R e margem (CA-09)", async () => {
    for (const codigo of ["8650-0/03", "8650003", "8650-003", 8650003]) {
      expect(await consultas.anexoDoCnae(codigo)).toMatchObject({ anexo: "V", sujeitoFatorR: true });
    }
    expect(await consultas.anexoDoCnae("0000-0/00")).toBeNull();
    expect(await consultas.anexoDoCnae("invalido")).toBeNull();
    expect(await consultas.parametroMei("SERVICOS", "2026-06-01")).toMatchObject({ valorDasMensal: 86.05, limiteFaturamentoAnual: 81000 });
    expect(await consultas.regraFatorR("2026-06-01")).toMatchObject({ limiteMinimo: 28, anexoSeAtingir: "III", anexoSeNaoAtingir: "V" });
    expect(await consultas.margemPadrao("BELEZA", "2026-06-01")).toMatchObject({ margemPadrao: 32 });
    expect(await consultas.margemPadrao("VESTUARIO", "2026-06-01")).toMatchObject({ margemPadrao: 8 });
  });

  it("antes da primeira vigência não há parâmetro: erro claro, nunca um valor inventado", async () => {
    await expect(consultas.parametroMei("SERVICOS", "2025-12-31")).rejects.toThrow(ParametroAusente);
    await expect(consultas.faixaDoSimples("I", 1000, "2017-12-31")).rejects.toThrow(ParametroAusente);
  });
});
