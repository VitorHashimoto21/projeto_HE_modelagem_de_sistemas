import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import * as servicos from "@/lib/calculadora/servicos";
import { MENSAGENS_FLUXO_CALCULADORA as F } from "@/lib/calculadora/servicos";
import { criarConsultasDoCatalogo } from "@/lib/db/catalogo";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasFiscais } from "@/lib/db/parametros-fiscais";
import { criarConsultasDePrecificacao } from "@/lib/db/precificacao";
import { hoje as hojeLocal, intervaloDaCompetencia } from "@/lib/dominio/datas";
import { competenciaDoDia, somarMeses } from "@/lib/dominio/financeiro";
import { CAMINHO_DO_ARQUIVO, validarParametros } from "@/lib/fiscal/arquivo";
import { carregarParametros } from "../../scripts/fiscal/carga";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-010 — testes de integração (seção 12): banco real com os parâmetros fiscais oficiais.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();
const MES = competenciaDoDia(HOJE);

let usuario: string;
let negocioA: string;
let negocioB: string;
let numeroVenda = 1;

const deps = (negocioId = negocioA): servicos.DependenciasDaCalculadora => {
  const cliente = comNegocio(base, { negocioId, usuarioId: usuario });
  return {
    precificacao: criarConsultasDePrecificacao(cliente, negocioId),
    catalogo: criarConsultasDoCatalogo(cliente, negocioId),
    fiscais: criarConsultasFiscais(base),
    usuarioId: usuario,
    hoje: HOJE,
  };
};

const negocio = (dados: Record<string, unknown>, id = negocioA) => base.negocio.update({ where: { id }, data: dados });

/** Instante no meio da competência (dia 15, meio-dia local). */
const meioDoMes = (comp: string) => new Date(intervaloDaCompetencia(comp).inicio.getTime() + 14 * 86_400_000 + 12 * 3_600_000);

async function venda(data: Date, valor: number, extra: { custo?: number; status?: "CONCLUIDA" | "CANCELADA"; negocioId?: string; itemId?: string } = {}) {
  const negocioId = extra.negocioId ?? negocioA;
  const v = await base.venda.create({
    data: { negocioId, data, valorTotal: valor, numero: numeroVenda++, registradaPorId: usuario, status: extra.status ?? "CONCLUIDA" },
  });
  if (extra.itemId) {
    await base.itemVenda.create({ data: { negocioId, vendaId: v.id, itemId: extra.itemId, quantidade: 2, precoUnitario: valor / 2, custoUnitario: extra.custo ?? 0 } });
  }
  return v.id;
}

async function item(custoBase = 20, extra: Record<string, unknown> = {}) {
  return (
    await base.item.create({
      data: { negocioId: negocioA, tipo: "SERVICO", nome: `Item ${randomUUID()}`, nomeChave: randomUUID(), categoria: "BELEZA", unidadeMedida: "un", custoBase, ...extra },
    })
  ).id;
}

/** Serviço de custo 20 + material de custo 3 → custo total 23 (CA-01). */
async function servicoComMaterial() {
  const servico = await item(20, { comissaoPercentual: 2 });
  const material = await base.item.create({
    data: { negocioId: negocioA, tipo: "PRODUTO_FISICO", nome: `Material ${randomUUID()}`, nomeChave: randomUUID(), categoria: "BELEZA", unidadeMedida: "un", custoBase: 3 },
  });
  await base.materialServico.create({ data: { negocioId: negocioA, servicoId: servico, materialId: material.id, quantidade: 1 } });
  return servico;
}

/** Autônomo com 6%, faturamento estimado R$ 5.000, despesas fixas R$ 750 (15%), cartão 3%. */
async function cenarioCa01() {
  await negocio({ regimeTributario: "AUTONOMO", impostoPercentualManual: 6, faturamentoMensalEstimado: 5000, taxaCartaoMedia: 3 });
  await base.despesaFixa.create({ data: { negocioId: negocioA, descricao: "Aluguel", valorMensal: 750, diaVencimento: 5, geraDesde: new Date(`${MES}-01`) } });
  return servicoComMaterial();
}

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await carregarParametros(base, validarParametros(JSON.parse(readFileSync(CAMINHO_DO_ARQUIVO, "utf-8"))));
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Gisele", email: "gisele@exemplo.com" } })).id;
  negocioA = (await base.negocio.create({ data: { nome: "Studio A" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Studio B" } })).id;
  numeroVenda = 1;
});

afterAll(async () => {
  await base.$disconnect();
});

describe("histórico e RBT12", () => {
  it("T05 — competências no fuso de São Paulo, canceladas fora, CMV% pelo custo gravado e folha com estornos (INV-005)", async () => {
    const anterior = somarMeses(MES, -1);
    const fimDoAnterior = intervaloDaCompetencia(MES).inicio; // 00:00 local do dia 1º do mês atual
    const prod = await item(5);
    await venda(new Date(fimDoAnterior.getTime() - 30 * 60_000), 1000, { itemId: prod, custo: 100 }); // 23:30 do último dia → mês anterior
    await venda(new Date(fimDoAnterior.getTime() + 30 * 60_000), 5000); // 00:30 do dia 1º → mês atual, fora
    await venda(meioDoMes(anterior), 9999, { status: "CANCELADA" });
    await venda(meioDoMes(anterior), 300, { negocioId: negocioB });
    await base.lancamentoFinanceiro.createMany({
      data: [
        { negocioId: negocioA, origem: "AVULSO", tipo: "SAIDA", categoria: "SALARIO", valor: 1000, data: meioDoMes(anterior) },
        { negocioId: negocioA, origem: "AVULSO", tipo: "SAIDA", categoria: "FORNECEDORES", valor: 500, data: meioDoMes(anterior) },
        { negocioId: negocioA, origem: "AVULSO", tipo: "SAIDA", categoria: "SALARIO", valor: 700, data: meioDoMes(MES) },
      ],
    });
    const original = await base.lancamentoFinanceiro.findFirstOrThrow({ where: { categoria: "SALARIO", valor: 1000 } });
    await base.lancamentoFinanceiro.create({ data: { negocioId: negocioA, origem: "ESTORNO", estornoDeId: original.id, tipo: "ENTRADA", categoria: "SALARIO", valor: 200, data: meioDoMes(anterior) } });

    const h = await deps().precificacao.historico(MES);
    expect(h).toEqual({ porCompetencia: { [anterior]: 100000 }, custoVendidoCentavos: 20000, primeiraCompetencia: anterior, folhaCentavos: 80000 });
  });

  it("CA-02 — 4 meses desde a primeira venda: R$ 40.000 → RBT12 R$ 120.000; MEI acima do limite é alertado (CA-06)", async () => {
    await negocio({ regimeTributario: "MEI", atividadeMei: "SERVICOS" });
    for (const k of [4, 3, 1]) await venda(meioDoMes(somarMeses(MES, -k)), k === 1 ? 20000 : 10000); // mês −2 sem vendas conta como zero
    await venda(meioDoMes(MES), 50000); // mês atual fora
    const b = await servicos.baseDoNegocio(deps());
    if ("status" in b) throw new Error(b.mensagem);
    expect(b.rbt12).toEqual({ rbt12Centavos: 12000000, realCentavos: 4000000, mesesConsiderados: 4, origem: "proporcional" });
    expect(b.faturamentoMedioCentavos).toBe(1000000);
    expect(b.imposto.percentual).toBe(0);
    expect(b.despesasFixas).toMatchObject({ dasCentavos: 8605, totalCentavos: 8605 });
    expect(b.limiteMei).toMatchObject({ limiteCentavos: 8100000, acima: true });
  });

  it("CA-03 — sem histórico nem estimativa: pede os parâmetros; com 100 × R$ 50, RBT12 = R$ 60.000", async () => {
    await negocio({ regimeTributario: "AUTONOMO", impostoPercentualManual: 6 });
    const id = await item();
    expect(await servicos.calcular(id, { margem: null, comissao: null }, deps())).toMatchObject({ status: "bloqueado", motivo: "sem-faturamento", mensagem: F.semFaturamento });
    expect(await servicos.salvarParametros({ taxaCartao: "3", capacidadeMensal: "100", unidadeCapacidade: "atendimentos", ticketMedio: "50", faturamentoEstimado: "" }, deps())).toEqual({
      status: "salvo",
      mensagem: F.parametrosSalvos,
    });
    const b = await servicos.baseDoNegocio(deps());
    if ("status" in b) throw new Error(b.mensagem);
    expect(b.rbt12).toMatchObject({ rbt12Centavos: 6000000, origem: "estimado" });
    expect((await deps(negocioB).precificacao.parametros()).faturamentoEstimadoCentavos).toBeNull(); // isolamento
  });
});

describe("imposto por regime", () => {
  it("T06/CA-04 — Simples, Anexo III, RBT12 R$ 300.000 → 8,08% com fonte e vigência", async () => {
    await negocio({ regimeTributario: "SIMPLES_NACIONAL", anexoSimples: "III", faturamentoMensalEstimado: 25000 });
    const b = await servicos.baseDoNegocio(deps());
    if ("status" in b) throw new Error(b.mensagem);
    expect(b.imposto.percentual).toBeCloseTo(8.08, 10);
    expect(b.imposto).toMatchObject({ anexoEfetivo: "III", faixa: 2, fatorR: null, fonte: { fonteLegal: expect.stringContaining("Anexo III"), vigenteDesde: "2018-01-01" } });
  });

  it("T06/CA-05 — Fator R: 30% → III; 20% → V; sem vendas → V", async () => {
    await negocio({ regimeTributario: "SIMPLES_NACIONAL", anexoSimples: "V", sujeitoFatorR: true, faturamentoMensalEstimado: 25000 });
    let b = await servicos.baseDoNegocio(deps());
    if ("status" in b) throw new Error(b.mensagem);
    expect([b.imposto.anexoEfetivo, b.imposto.fatorR]).toEqual(["V", null]);

    for (let k = 1; k <= 12; k++) await venda(meioDoMes(somarMeses(MES, -k)), 25000);
    await base.lancamentoFinanceiro.create({ data: { negocioId: negocioA, origem: "AVULSO", tipo: "SAIDA", categoria: "SALARIO", valor: 90000, data: meioDoMes(somarMeses(MES, -2)) } });
    b = await servicos.baseDoNegocio(deps());
    if ("status" in b) throw new Error(b.mensagem);
    expect(b.imposto.anexoEfetivo).toBe("III");
    expect(b.imposto.fatorR).toBeCloseTo(30, 10);

    await base.lancamentoFinanceiro.create({ data: { negocioId: negocioA, origem: "AVULSO", tipo: "ENTRADA", categoria: "SALARIO", valor: 30000, data: meioDoMes(somarMeses(MES, -2)) } }); // entrada que não é estorno: ignorada
    const original = await base.lancamentoFinanceiro.findFirstOrThrow({ where: { valor: 90000 } });
    await base.lancamentoFinanceiro.create({ data: { negocioId: negocioA, origem: "ESTORNO", estornoDeId: original.id, tipo: "ENTRADA", categoria: "SALARIO", valor: 90000, data: meioDoMes(somarMeses(MES, -2)) } });
    await base.lancamentoFinanceiro.create({ data: { negocioId: negocioA, origem: "AVULSO", tipo: "SAIDA", categoria: "SALARIO", valor: 60000, data: meioDoMes(somarMeses(MES, -3)) } });
    b = await servicos.baseDoNegocio(deps());
    if ("status" in b) throw new Error(b.mensagem);
    expect(b.imposto.anexoEfetivo).toBe("V");
    expect(b.imposto.fatorR).toBeCloseTo(20, 10);
  });

  it("T06/CA-07 — Autônomo usa o percentual do cadastro; sem ele, bloqueia", async () => {
    await negocio({ regimeTributario: "AUTONOMO", faturamentoMensalEstimado: 5000 });
    expect(await servicos.baseDoNegocio(deps())).toMatchObject({ status: "bloqueado", motivo: "imposto-nao-informado" });
    await negocio({ impostoPercentualManual: 11 });
    const b = await servicos.baseDoNegocio(deps());
    expect("status" in b ? null : b.imposto.percentual).toBe(11);
  });

  it("Simples acima de R$ 4,8 milhões: bloqueado", async () => {
    await negocio({ regimeTributario: "SIMPLES_NACIONAL", anexoSimples: "III", faturamentoMensalEstimado: 500000 });
    expect(await servicos.baseDoNegocio(deps())).toMatchObject({ status: "bloqueado", motivo: "acima-do-simples", mensagem: F.acimaDoSimples });
  });
});

describe("cálculo e confirmação", () => {
  it("T07/CA-01, CA-09 — markup completo, memória, confirmação exata e arredondada, preço mudou, inviável", async () => {
    const id = await cenarioCa01();
    const r = await servicos.calcular(id, { margem: null, comissao: null }, deps());
    if (r.status !== "ok") throw new Error(r.mensagem);
    expect([r.item.custoTotalCentavos, r.margem.percentual, r.comissao.percentual, r.despesasVariaveis, r.precoCentavos, r.arredondadoCentavos]).toEqual([2300, 32, 2, 5, 5477, 5500]);
    expect(r.despesasFixasPercentual).toBeCloseTo(15, 10);
    expect(r.soma).toBeCloseTo(58, 10);
    expect(r.margem.fonte.fonteLegal).toContain("Lei 9.249/1995");

    // Simular outra comissão não muda a confirmação (só a do item vale).
    const simulada = await servicos.calcular(id, { margem: null, comissao: 10 }, deps());
    expect(simulada).toMatchObject({ status: "ok", comissao: { percentual: 10, doItem: 2, simulada: true } });

    expect(await servicos.confirmar(id, { margem: "", arredondar: "exato", precoVisto: "5477" }, deps())).toEqual({ status: "confirmado", mensagem: F.confirmado(5477) });
    let h = await base.historicoPreco.findFirstOrThrow({ where: { itemId: id }, orderBy: { dataConfirmacao: "desc" } });
    expect(h).toMatchObject({ origem: "CALCULADORA", usuarioId: usuario, regimeTributario: "AUTONOMO" });
    expect([Number(h.preco), Number(h.precoSugerido), Number(h.margemAplicada), Number(h.custoConsiderado), Number(h.despesasFixasPercentual), Number(h.despesasVariaveisPercentual), Number(h.impostoAplicado)]).toEqual([
      54.77, 54.77, 32, 23, 15, 5, 6,
    ]);
    expect(h.memoriaCalculo).toMatchObject({ versao: 1, precoSugeridoCentavos: 5477, regime: "AUTONOMO", rbt12: { origem: "estimado" }, item: { custoTotalCentavos: 2300 } });
    expect(Number((await base.item.findUniqueOrThrow({ where: { id } })).precoAtual)).toBe(54.77);

    // Mesmo preço também é registrado; arredondado para cima ao real guarda o exato.
    expect(await servicos.confirmar(id, { margem: "32", arredondar: "real", precoVisto: "5500" }, deps())).toMatchObject({ status: "confirmado" });
    h = await base.historicoPreco.findFirstOrThrow({ where: { itemId: id }, orderBy: { dataConfirmacao: "desc" } });
    expect([Number(h.preco), Number(h.precoSugerido)]).toEqual([55, 54.77]);
    expect(await base.historicoPreco.count({ where: { itemId: id } })).toBe(2);

    // O custo mudou entre a simulação e a confirmação: nada é gravado (INV-003).
    await base.item.update({ where: { id }, data: { custoBase: 30 } });
    expect(await servicos.confirmar(id, { margem: "", arredondar: "exato", precoVisto: "5477" }, deps())).toEqual({ status: "mudou", mensagem: F.precoMudou(7858), precoCentavos: 7858 });
    expect(await base.historicoPreco.count({ where: { itemId: id } })).toBe(2);

    // Inviável (RN19): margem 80% → soma 126%.
    const inviavel = await servicos.calcular(id, { margem: 80, comissao: null }, deps());
    expect(inviavel).toMatchObject({ status: "bloqueado", motivo: "inviavel" });
    expect(inviavel.status === "bloqueado" && inviavel.mensagem).toContain("a margem");
    expect(await servicos.confirmar(id, { margem: "80", arredondar: "exato", precoVisto: "100" }, deps())).toMatchObject({ status: "erro", mensagem: expect.stringContaining("inviável") });
    expect(await base.historicoPreco.count({ where: { itemId: id } })).toBe(2);
  });

  it("item sem custo, arquivado ou de outro negócio", async () => {
    await negocio({ regimeTributario: "AUTONOMO", impostoPercentualManual: 6, faturamentoMensalEstimado: 5000 });
    expect(await servicos.calcular(await item(0), { margem: null, comissao: null }, deps())).toMatchObject({ status: "bloqueado", motivo: "sem-custo", mensagem: F.semCusto });
    const arquivado = await item(10, { arquivadoEm: new Date(), nomeChave: null });
    expect(await servicos.calcular(arquivado, { margem: null, comissao: null }, deps())).toMatchObject({ motivo: "item-nao-encontrado" });
    expect(await servicos.calcular(await item(10), { margem: null, comissao: null }, deps(negocioB))).toMatchObject({ motivo: "item-nao-encontrado" });
  });

  it("T08 — aviso quando o Anexo efetivo muda em relação ao último preço confirmado (OPEN-008)", async () => {
    await negocio({ regimeTributario: "SIMPLES_NACIONAL", anexoSimples: "V", sujeitoFatorR: true });
    for (let k = 1; k <= 12; k++) await venda(meioDoMes(somarMeses(MES, -k)), 25000);
    await base.lancamentoFinanceiro.create({ data: { negocioId: negocioA, origem: "AVULSO", tipo: "SAIDA", categoria: "SALARIO", valor: 90000, data: meioDoMes(somarMeses(MES, -2)) } });
    const id = await item(20);
    const r = await servicos.calcular(id, { margem: null, comissao: null }, deps());
    if (r.status !== "ok") throw new Error(r.mensagem);
    expect([r.base.imposto.anexoEfetivo, r.base.avisoAnexo]).toEqual(["III", null]);
    await servicos.confirmar(id, { margem: "", arredondar: "exato", precoVisto: String(r.precoCentavos) }, deps());

    await venda(meioDoMes(somarMeses(MES, -1)), 300000); // a receita dobra: Fator R cai para 15%
    const b = await servicos.baseDoNegocio(deps());
    if ("status" in b) throw new Error(b.mensagem);
    expect(b.imposto.anexoEfetivo).toBe("V");
    expect(b.avisoAnexo).toMatch(/mudou de III para V \(Fator R = 15,00%\)/);
  });
});

describe("ponto de equilíbrio e meta", () => {
  it("CA-10 — PE R$ 5.000, meta R$ 7.500 e alerta abaixo do equilíbrio", async () => {
    await negocio({ regimeTributario: "AUTONOMO", impostoPercentualManual: 6, taxaCartaoMedia: 4, cmvEstimado: 30, margemLucroMeta: 20, faturamentoMensalEstimado: 4000 });
    await base.despesaFixa.create({ data: { negocioId: negocioA, descricao: "Aluguel", valorMensal: 3000, diaVencimento: 5, geraDesde: new Date(`${MES}-01`) } });
    await base.despesaFixa.create({ data: { negocioId: negocioA, descricao: "Antiga", valorMensal: 999, diaVencimento: 5, ativo: false, geraDesde: new Date(`${MES}-01`) } });
    const a = await servicos.analisarNegocio(deps());
    expect(a).toMatchObject({ status: "ok", pontoDeEquilibrioCentavos: 500000, metaCentavos: 750000, abaixoDoEquilibrio: true, base: { cmv: { percentual: 30, origem: "estimado" } } });
  });
});

describe("T11 — desempenho (RNF06)", () => {
  it("cálculo com 10.000 vendas e 30.000 itens vendidos em menos de 2 s", async () => {
    await negocio({ regimeTributario: "SIMPLES_NACIONAL", anexoSimples: "V", sujeitoFatorR: true });
    const prod = await item(5);
    const vendas = Array.from({ length: 10_000 }, (_, i) => ({
      id: randomUUID(),
      negocioId: negocioA,
      data: meioDoMes(somarMeses(MES, -1 - (i % 12))),
      valorTotal: 30,
      numero: 1000 + i,
      registradaPorId: usuario,
    }));
    await base.venda.createMany({ data: vendas });
    await base.itemVenda.createMany({
      data: vendas.flatMap((v) => [1, 2, 3].map(() => ({ negocioId: negocioA, vendaId: v.id, itemId: prod, quantidade: 1, precoUnitario: 10, custoUnitario: 4 }))),
    });
    const id = await item(20);
    const t = performance.now();
    const r = await servicos.calcular(id, { margem: null, comissao: null }, deps());
    expect(performance.now() - t).toBeLessThan(2000);
    expect(r.status).toBe("ok");
    expect(r.status === "ok" && r.base.cmv).toMatchObject({ origem: "apurado" });
    expect(r.status === "ok" && r.base.cmv.percentual).toBeCloseTo(40, 10);
  }, 60_000);
});
