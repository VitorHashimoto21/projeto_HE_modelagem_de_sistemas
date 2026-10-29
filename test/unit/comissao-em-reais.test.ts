import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calcularPreco, comissaoNoPreco, partesDoPrecoEmReais } from "@/lib/dominio/precificacao";

// SPEC-023 — testes unitários (seção 12).

// Exemplo da seção 1: semijoia de R$ 40,00, despesas fixas 15%, maquininha 3%, comissão 10%, MEI, margem 30%.
const EXEMPLO = { custoCentavos: 4000, despesasFixas: 15, taxaCartao: 3, comissao: 10, imposto: 0, margem: 30 };

let semente = 23;
const aleatorio = () => (semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const somaDasPartes = (p: ReturnType<typeof partesDoPrecoEmReais>) => Object.values(p).reduce((s, v) => s + v, 0);

describe("T01 — partes do preço em reais (CA-01, CA-02, INV-002, INV-003)", () => {
  it("exemplo da seção 1: R$ 95,24 = custo 40,00 + fixas 14,29 + maquininha 2,86 + comissão 9,52 + margem 28,57", () => {
    const r = calcularPreco(EXEMPLO);
    if (!r.ok) throw new Error("esperava viável");
    expect(r.precoCentavos).toBe(9524);
    expect(partesDoPrecoEmReais(r.precoCentavos, EXEMPLO)).toEqual({
      custoDoItem: 4000,
      despesasFixas: 1429,
      maquininha: 286,
      comissao: 952,
      imposto: 0,
      margem: 2857,
    });
  });

  it("comissão e imposto zerados viram partes de R$ 0,00", () => {
    const p = partesDoPrecoEmReais(10000, { despesasFixas: 10, taxaCartao: 0, comissao: 0, imposto: 0, margem: 20 });
    expect([p.maquininha, p.comissao, p.imposto]).toEqual([0, 0, 0]);
    expect(p.custoDoItem).toBe(7000);
  });

  it("INV-002: a soma é o preço e nenhuma parte é negativa, com valores aleatórios e custos de poucos centavos", () => {
    for (let i = 0; i < 5000; i++) {
      const c = {
        custoCentavos: i % 5 === 0 ? 1 + Math.floor(aleatorio() * 5) : 1 + Math.floor(aleatorio() * 10_000_000),
        despesasFixas: aleatorio() * 30,
        taxaCartao: aleatorio() * 10,
        comissao: aleatorio() * 15,
        imposto: aleatorio() * 20,
        margem: aleatorio() * 24,
      };
      const r = calcularPreco(c);
      if (!r.ok) throw new Error("esperava viável");
      const p = partesDoPrecoEmReais(r.precoCentavos, c);
      expect(somaDasPartes(p)).toBe(r.precoCentavos);
      for (const v of Object.values(p)) expect(v).toBeGreaterThanOrEqual(0);
      // O custo do item na barra difere do custo real só pelos centavos do arredondamento.
      expect(Math.abs(p.custoDoItem - c.custoCentavos)).toBeLessThanOrEqual(3);
    }
  });
});

describe("T02 — preço igual e custo sem a comissão (CA-03, INV-001, INV-004)", () => {
  it("o preço do CA-01 da SPEC-010 não muda: R$ 54,77", () => {
    expect(calcularPreco({ custoCentavos: 2300, despesasFixas: 15, taxaCartao: 3, comissao: 2, imposto: 6, margem: 32 })).toMatchObject({ ok: true, precoCentavos: 5477 });
  });

  it("a comissão aumenta o preço, mas não o custo do item: ela é uma parte própria", () => {
    const sem = calcularPreco({ ...EXEMPLO, comissao: 0 });
    const com = calcularPreco(EXEMPLO);
    if (!sem.ok || !com.ok) throw new Error("esperava viável");
    expect(com.precoCentavos).toBeGreaterThan(sem.precoCentavos);
    expect(partesDoPrecoEmReais(sem.precoCentavos, { ...EXEMPLO, comissao: 0 }).custoDoItem).toBe(4000);
    expect(partesDoPrecoEmReais(com.precoCentavos, EXEMPLO).custoDoItem).toBe(4000);
  });
});

describe("T03 — comissão no preço oficial (CA-06, INV-006)", () => {
  it("10% de R$ 95,24 = R$ 9,52; arredonda ao centavo", () => {
    expect(comissaoNoPreco(9524, 10)).toBe(952);
    expect(comissaoNoPreco(1020, 2.5)).toBe(26);
    expect(comissaoNoPreco(1010, 2.5)).toBe(25);
  });

  it("sem preço oficial ou com comissão 0 ou vazia: nada (só o percentual aparece)", () => {
    expect(comissaoNoPreco(null, 10)).toBeNull();
    expect(comissaoNoPreco(9524, 0)).toBeNull();
    expect(comissaoNoPreco(9524, null)).toBeNull();
  });
});

// T05 — paleta com seis cores (CA-07). As mesmas contas do validador da paleta (SPEC-016, INV-004):
// distância em OKLab ×100, sem e com a simulação de daltonismo de Machado, Oliveira e Fernandes (2009).
const MACHADO = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
} as const;
const linear = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
function oklab([r, g, b]: number[]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function distancia(a: string, b: string, tipo?: keyof typeof MACHADO) {
  const simula = (rgb: number[]) => (tipo ? MACHADO[tipo].map((linha) => Math.max(0, Math.min(1, linha[0] * rgb[0] + linha[1] * rgb[1] + linha[2] * rgb[2]))) : rgb);
  const [x, y] = [oklab(simula(linear(a))), oklab(simula(linear(b)))];
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
const luminancia = (hex: string) => {
  const [r, g, b] = linear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => {
  const [maior, menor] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (maior + 0.05) / (menor + 0.05);
};

function coresDoTema(seletor: ":root" | ".dark") {
  const css = readFileSync("src/app/globals.css", "utf8");
  const corpo = (seletor === ":root" ? /:root\s*\{([\s\S]*?)\n\}/ : /\.dark\s*\{([\s\S]*?)\n\}/).exec(css)?.[1] ?? "";
  const valor = (nome: string) => new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`).exec(corpo)?.[1] ?? "";
  return { series: [1, 2, 3, 4, 5, 6].map((n) => valor(`chart-${n}`)), cartao: valor("card") };
}

describe("T05 — 6ª cor da paleta, nos dois temas (CA-07)", () => {
  it.each([":root", ".dark"] as const)("%s: seis cores distintas e com contraste; a 6ª longe de todas as outras", (seletor) => {
    const { series, cartao } = coresDoTema(seletor);
    expect(series.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
    for (const c of series) expect(contraste(c, cartao)).toBeGreaterThanOrEqual(3);
    // As partes zeradas somem da barra: a 6ª pode encostar em qualquer outra, então a conta é contra todas.
    const sexta = series[5];
    for (const outra of series.slice(0, 5)) {
      expect(distancia(sexta, outra)).toBeGreaterThanOrEqual(15);
      expect(Math.min(distancia(sexta, outra, "protan"), distancia(sexta, outra, "deutan"))).toBeGreaterThanOrEqual(6);
    }
    // Vizinhas na ordem fixa, como no validador.
    for (let i = 0; i < 5; i++) {
      expect(distancia(series[i], series[i + 1])).toBeGreaterThanOrEqual(15);
      expect(Math.min(distancia(series[i], series[i + 1], "protan"), distancia(series[i], series[i + 1], "deutan"))).toBeGreaterThanOrEqual(6);
    }
  });
});
