import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aliquotaEfetiva, faixaContem, normalizarCnae, RbtInvalido } from "@/lib/dominio/fiscal";
import { ArquivoInvalido, avisosDosParametros, CAMINHO_DO_ARQUIVO, validarParametros, type ParametrosFiscais, type TabelaFiscal } from "@/lib/fiscal/arquivo";
import { planejarCarga, resumirPlano, type Registro } from "@/lib/fiscal/plano";

// SPEC-003 — testes unitários (seção 12).

const original = () => JSON.parse(readFileSync(CAMINHO_DO_ARQUIVO, "utf-8"));
type Bruto = ReturnType<typeof original>;

function problemasDe(mudar: (d: Bruto) => void): string[] {
  const d = original();
  mudar(d);
  try {
    validarParametros(d);
  } catch (e) {
    if (e instanceof ArquivoInvalido) return e.problemas;
    throw e;
  }
  return [];
}
const faixa = (d: Bruto, anexo: string, ordem: number) =>
  d.faixaTributaria.find((f: { anexo: string; faixaOrdem: number }) => f.anexo === anexo && f.faixaOrdem === ordem);

describe("T01 — o arquivo conferido é válido (INV-002, INV-003, INV-007, INV-008)", () => {
  it("passa na validação, com as quantidades esperadas", () => {
    const p = validarParametros(original());
    expect(p.faixaTributaria).toHaveLength(30);
    expect(p.cnaeAnexo).toHaveLength(12);
    expect(p.parametroMei).toHaveLength(3);
    expect(p.parametroFatorR).toHaveLength(1);
    expect(p.margemPadraoCategoria).toHaveLength(9);
  });

  it("ignora as chaves de comentário (começam com _)", () => {
    expect(problemasDe((d) => (d.parametroMei[0]._outroComentario = "x"))).toEqual([]);
  });
});

describe("T02 — arquivos com erro são recusados com a mensagem certa (CA-04)", () => {
  it.each<[string, (d: Bruto) => void, RegExp]>([
    ["buraco entre faixas", (d) => (faixa(d, "III", 3).rbt12De = 360000.01), /Anexo III.*faixa 3: rbt12De 360000\.01 ≠ rbt12Ate da faixa 2/],
    ["faixa 1 sem começar em 0", (d) => (faixa(d, "I", 1).rbt12De = 1), /Anexo I.*faixa 1: rbt12De deve ser 0/],
    ["alíquota digitada errada", (d) => (faixa(d, "II", 3).aliquota = 1.5), /Anexo II.*imposto descontínuo entre as faixas 2 e 3/],
    ["faixa faltando", (d) => d.faixaTributaria.splice(d.faixaTributaria.indexOf(faixa(d, "V", 4)), 1), /Anexo V.*deve ter as faixas 1 a 6/],
    ["Anexo inexistente", (d) => (faixa(d, "I", 1).anexo = "VI"), /faixaTributaria\.0\.anexo/],
    ["fonte legal vazia", (d) => (d.margemPadraoCategoria[0].fonteLegal = " "), /fonte legal vazia/],
    ["categoria sem margem", (d) => d.margemPadraoCategoria.pop(), /margemPadraoCategoria: falta OUTROS/],
    ["atividade do MEI faltando", (d) => d.parametroMei.pop(), /parametroMei: falta COMERCIO_E_SERVICOS/],
    ["data inexistente", (d) => (d.parametroMei[0].vigenteDesde = "2026-02-30"), /data inexistente/],
    ["sem data de vigência", (d) => delete d.cnaeAnexo[0].vigenteDesde, /cnaeAnexo\.0\.vigenteDesde/],
    ["campo com nome errado", (d) => (d.parametroFatorR[0].limiteMinim = 28), /limiteMinim/],
    ["CNAE fora do formato", (d) => (d.cnaeAnexo[0].cnae = "4772500"), /formato 0000-0\/00/],
    ["registro repetido", (d) => d.cnaeAnexo.push({ ...d.cnaeAnexo[0] }), /CNAE 4772-5\/00.*repetido/],
  ])("%s", (_, mudar, mensagem) => {
    const problemas = problemasDe(mudar);
    expect(problemas.join("\n")).toMatch(mensagem);
  });

  it("aceita uma nova vigência completa de um Anexo", () => {
    expect(
      problemasDe((d) => {
        const novas = d.faixaTributaria.filter((f: { anexo: string }) => f.anexo === "III").map((f: object) => ({ ...f, vigenteDesde: "2027-01-01" }));
        d.faixaTributaria.push(...novas);
      }),
    ).toEqual([]);
  });
});

describe("T03 — alíquota efetiva (RF38, CA-08)", () => {
  it("Anexo III, faixa 2, RBT12 de R$ 240 mil → 7,30%", () => {
    expect(aliquotaEfetiva({ aliquota: 11.2, parcelaDeduzir: 9360 }, 240_000)).toBeCloseTo(7.3, 10);
  });

  it("na faixa 1 a efetiva é a nominal", () => {
    expect(aliquotaEfetiva({ aliquota: 6, parcelaDeduzir: 0 }, 100_000)).toBe(6);
  });

  it("RBT12 zero, negativo ou inválido é recusado", () => {
    for (const r of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => aliquotaEfetiva({ aliquota: 6, parcelaDeduzir: 0 }, r)).toThrow(RbtInvalido);
    }
  });

  it("fronteiras: rbt12De < RBT12 ≤ rbt12Ate (OPEN-16)", () => {
    const f = { rbt12De: 180_000, rbt12Ate: 360_000 };
    expect(faixaContem(f, 180_000)).toBe(false);
    expect(faixaContem(f, 180_000.01)).toBe(true);
    expect(faixaContem(f, 360_000)).toBe(true);
  });
});

describe("T04 — normalização do CNAE (CA-09)", () => {
  it.each(["8650-0/03", "8650003", "8650-003", "8650.0-03", 8650003])("%s → 8650-0/03", (codigo) => {
    expect(normalizarCnae(codigo)).toBe("8650-0/03");
  });

  it.each(["865000", "86500031", "", "abc"])("%s não é CNAE", (codigo) => {
    expect(normalizarCnae(codigo)).toBeNull();
  });
});

describe("plano de carga", () => {
  const p = (): ParametrosFiscais => validarParametros(original());
  type NoBanco = Record<TabelaFiscal, Registro[]>;
  const vazio: NoBanco = { faixaTributaria: [], cnaeAnexo: [], parametroMei: [], parametroFatorR: [], margemPadraoCategoria: [] };
  const comoBanco = (x: ParametrosFiscais): NoBanco =>
    Object.fromEntries(Object.entries(x).map(([t, l]) => [t, (l as Registro[]).map((r) => ({ ...r }))])) as NoBanco;

  it("banco vazio: tudo é criado", () => {
    const r = resumirPlano(planejarCarga(p(), vazio));
    expect(r.faixaTributaria).toEqual({ criados: 30, novasVersoes: 0, inalterados: 0, corrigidos: 0 });
  });

  it("valores do banco como texto decimal (\"7.30\") contam como iguais", () => {
    const banco = comoBanco(p());
    banco.faixaTributaria = banco.faixaTributaria.map((f) => ({ ...f, aliquota: Number(f.aliquota).toFixed(2) }));
    expect(planejarCarga(p(), banco).operacoes.every((op) => op.tipo === "inalterado")).toBe(true);
  });

  it("mesma vigência com outro valor: conflito; com --corrigir: correção (OPEN-002)", () => {
    const banco = comoBanco(p());
    banco.parametroMei[0] = { ...banco.parametroMei[0], valorDasMensal: 80 };
    const plano = planejarCarga(p(), banco);
    expect(plano.conflitos).toHaveLength(1);
    expect(plano.conflitos[0]).toMatch(/parametroMei, atividade COMERCIO_INDUSTRIA, vigência 2026-01-01: valorDasMensal/);
    expect(planejarCarga(p(), banco, { corrigir: true }).operacoes.filter((op) => op.tipo === "corrigir")).toHaveLength(1);
  });

  it("versão no banco que saiu do arquivo é mantida e avisada", () => {
    const banco = comoBanco(p());
    banco.parametroFatorR.push({ ...banco.parametroFatorR[0], vigenteDesde: "2010-01-01" });
    expect(planejarCarga(p(), banco).somenteNoBanco).toEqual(["parametroFatorR, vigência 2010-01-01"]);
  });
});

describe("aviso do DAS anual (OPEN-006)", () => {
  it("avisa quando o DAS mais novo é de um ano anterior, sem falhar", () => {
    expect(avisosDosParametros(validarParametros(original()), new Date("2026-06-01T12:00:00Z"))).toEqual([]);
    expect(avisosDosParametros(validarParametros(original()), new Date("2027-01-15T12:00:00Z"))[0]).toMatch(/DAS do MEI mais recente é de 2026/);
  });
});

// T12 (INV-001) e T13 (INV-006): nada de valor fiscal fixo no código, e escrita só em scripts/.
describe("parâmetros só como configuração", () => {
  const arquivosDoApp = execFileSync("git", ["ls-files", "src"], { encoding: "utf-8" })
    .split(/\r?\n/)
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith("src/generated/"));

  it("T12 — nenhum valor do seed aparece fixo no código da aplicação", () => {
    const valores = ["82.05", "86.05", "87.05", "81000", "180000", "3600000", "4800000", "9360", "11.2", "28.0"];
    const achados = arquivosDoApp.flatMap((f) => {
      const texto = readFileSync(f, "utf-8");
      return valores.filter((v) => new RegExp(`(^|[^\\d.])${v.replace(".", "\\.")}(?![\\d])`).test(texto)).map((v) => `${f}: ${v}`);
    });
    expect(achados).toEqual([]);
  });

  it("T13 — a aplicação não escreve nas tabelas fiscais", () => {
    const escrita = /\b(faixaTributaria|cnaeAnexo|parametroMei|parametroFatorR|margemPadraoCategoria)\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/;
    expect(arquivosDoApp.filter((f) => escrita.test(readFileSync(f, "utf-8")))).toEqual([]);
  });
});
