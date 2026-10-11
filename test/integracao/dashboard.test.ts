import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { analisarNegocio, MENSAGENS_FLUXO_CALCULADORA as C } from "@/lib/calculadora/servicos";
import * as dash from "@/lib/dashboard/servicos";
import { criarConsultasDoCatalogo } from "@/lib/db/catalogo";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDoDashboard } from "@/lib/db/dashboard";
import { criarConsultasFinanceiras } from "@/lib/db/financeiro";
import { criarConsultasFiscais } from "@/lib/db/parametros-fiscais";
import { criarConsultasDePrecificacao } from "@/lib/db/precificacao";
import { criarConsultasDeVendas } from "@/lib/db/vendas";
import { hoje as hojeLocal, intervaloDaCompetencia, intervaloDoDia } from "@/lib/dominio/datas";
import { somarDias } from "@/lib/dominio/estoque";
import { competenciaDoDia, somarMeses, vencimentoNaCompetencia } from "@/lib/dominio/financeiro";
import * as financeiro from "@/lib/financeiro/servicos";
import { CAMINHO_DO_ARQUIVO, validarParametros } from "@/lib/fiscal/arquivo";
import * as vendas from "@/lib/vendas/servicos";
import { carregarParametros } from "../../scripts/fiscal/carga";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-012 — testes de integração (seção 12): banco real, cliente do negócio, parâmetros
// fiscais oficiais; as mesmas fontes do Financeiro, das Vendas e da Calculadora (INV-001).

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();
const MES = competenciaDoDia(HOJE);

let usuario: string;
let negocioA: string;
let negocioB: string;
let numeroVenda = 1;

const cliente = (negocioId = negocioA) => comNegocio(base, { negocioId, usuarioId: usuario });
const fin = (negocioId = negocioA) => criarConsultasFinanceiras(cliente(negocioId), negocioId);
const deps = (negocioId = negocioA): dash.DependenciasDoDashboard => ({
  dashboard: criarConsultasDoDashboard(cliente(negocioId), negocioId),
  saldoAtual: (h) => fin(negocioId).saldoAtual(h),
  calculadora: {
    precificacao: criarConsultasDePrecificacao(cliente(negocioId), negocioId),
    catalogo: criarConsultasDoCatalogo(cliente(negocioId), negocioId),
    fiscais: criarConsultasFiscais(base),
    usuarioId: usuario,
    hoje: HOJE,
  },
  hoje: HOJE,
});
const depsFin = (negocioId = negocioA): financeiro.DependenciasDoFinanceiro => ({ financeiro: fin(negocioId), usuarioId: usuario, hoje: HOJE, agora: new Date() });

/** Instante ao meio-dia (São Paulo) do dia local. */
const meioDia = (dia: string) => new Date(intervaloDoDia(dia).inicio.getTime() + 12 * 3_600_000);

async function venda(data: Date, valor: number, extra: { status?: "CONCLUIDA" | "CANCELADA"; negocioId?: string } = {}) {
  await base.venda.create({
    data: {
      negocioId: extra.negocioId ?? negocioA,
      data,
      valorTotal: valor,
      numero: numeroVenda++,
      registradaPorId: usuario,
      status: extra.status ?? "CONCLUIDA",
      ...(extra.status === "CANCELADA" ? { canceladaEm: data, canceladaPorId: usuario, motivoCancelamento: "Erro no registro" } : {}),
    },
  });
}

/** Venda pela frente de caixa (SPEC-008): pagamentos, parcelas e lançamentos de verdade. */
async function vender(pagamentos: { forma: string; valor: number; parcelas?: number }[]) {
  const total = pagamentos.reduce((s, p) => s + p.valor, 0);
  const item = await base.item.create({
    data: { negocioId: negocioA, tipo: "SERVICO", nome: `Serviço ${randomUUID()}`, nomeChave: randomUUID(), categoria: "BELEZA", unidadeMedida: "un", custoBase: 1, precoAtual: total },
  });
  const r = await vendas.registrarVenda(
    { carrinho: JSON.stringify({ id: randomUUID(), linhas: [{ itemId: item.id, quantidade: 1 }], pagamentos }) },
    { vendas: criarConsultasDeVendas(cliente(), negocioA), usuarioId: usuario, hoje: HOJE, agora: new Date() },
  );
  if (r.status !== "registrada") throw new Error(JSON.stringify(r));
}

async function conta(tipo: "PAGAR" | "RECEBER", valor: string, vencimento: string, negocioId = negocioA) {
  const r = await financeiro.criarConta({ tipo, descricao: `Conta ${valor}`, categoria: tipo === "PAGAR" ? "FORNECEDORES" : "VENDAS", valor, vencimento }, depsFin(negocioId));
  if (r.status !== "salvo") throw new Error(JSON.stringify(r));
}

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await carregarParametros(base, validarParametros(JSON.parse(readFileSync(CAMINHO_DO_ARQUIVO, "utf-8"))));
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Gisele", email: "gisele@exemplo.com" } })).id;
  negocioA = (await base.negocio.create({ data: { nome: "Studio A" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Studio B" } })).id;
  await base.membroNegocio.create({ data: { negocioId: negocioA, usuarioId: usuario, papel: "DONO" } });
  numeroVenda = 1000; // as vendas da frente de caixa usam a numeração do negócio (1, 2, ...)
});

afterAll(async () => {
  await base.$disconnect();
});

describe("resumo do dia", () => {
  it("T04 — CA-01: 3 vendas de hoje (R$ 50, 30, 20); cancelada, de ontem e do outro negócio fora (INV-002, INV-006)", async () => {
    for (const v of [50, 30, 20]) await venda(new Date(), v);
    await venda(new Date(), 999, { status: "CANCELADA" });
    await venda(meioDia(somarDias(HOJE, -1)), 777);
    await venda(new Date(), 555, { negocioId: negocioB });
    expect(await dash.carregarVendasDoDia(deps())).toEqual({ quantidade: 3, totalCentavos: 10000, ticketMedioCentavos: 3333 });
    expect(await dash.carregarVendasDoDia(deps(negocioB))).toEqual({ quantidade: 1, totalCentavos: 55500, ticketMedioCentavos: 55500 });
  });

  it("T04 — CA-02: 23h30 de São Paulo conta no próprio dia e no próprio mês (INV-003)", async () => {
    const ontem = somarDias(HOJE, -1);
    await venda(new Date(intervaloDoDia(ontem).fim.getTime() - 30 * 60_000), 100); // 23:30 de ontem
    await venda(new Date(intervaloDoDia(ontem).fim.getTime() + 30 * 60_000), 200); // 00:30 de hoje
    const fimDoMesPassado = intervaloDaCompetencia(MES).inicio;
    await venda(new Date(fimDoMesPassado.getTime() - 30 * 60_000), 400); // 23:30 do último dia do mês passado
    const porDia = await deps().dashboard.vendasPorDia(HOJE);
    const viraMes = competenciaDoDia(ontem) !== MES; // hoje é dia 1º: as duas vendas de 23h30 são do mesmo dia
    expect(porDia[ontem]).toBe(10000 + (viraMes ? 40000 : 0));
    expect(porDia[HOJE]).toBe(20000);
    const porMes = await deps().dashboard.vendasPorMes(HOJE);
    expect(porMes[somarMeses(MES, -1)]).toBe(40000 + (viraMes ? 10000 : 0));
    expect((await dash.carregarVendasDoDia(deps())).totalCentavos).toBe(20000);
  });

  it("T05 — CA-03: saldo igual ao 'Saldo atual' do Financeiro (INV-001)", async () => {
    await vender([{ forma: "PIX", valor: 50 }]);
    await vender([{ forma: "CREDITO", valor: 300, parcelas: 3 }]);
    expect(await financeiro.informarSaldoInicial({ valor: "1234.56", data: HOJE }, depsFin())).toMatchObject({ status: "salvo" });
    const fluxo = await fin().fluxo({ mes: MES }, HOJE);
    expect(await deps().saldoAtual(HOJE)).toBe(fluxo.saldoAtualCentavos);
    expect(fluxo.saldoAtualCentavos).toBe(123456 + 5000);
  });
});

describe("gráfico e semáforo", () => {
  it("T06 — série mensal igual ao histórico da Calculadora; crédito parcelado inteiro no mês da venda (CA-04, CA-05, INV-001)", async () => {
    const anterior = somarMeses(MES, -1);
    await venda(meioDia(`${anterior}-15`), 1000);
    await venda(meioDia(`${anterior}-16`), 500, { status: "CANCELADA" });
    await venda(meioDia(`${somarMeses(MES, -12)}-15`), 9999); // 13 meses atrás: fora
    await vender([{ forma: "CREDITO", valor: 300, parcelas: 3 }]);
    const porMes = await deps().dashboard.vendasPorMes(HOJE);
    const historico = await deps().calculadora.precificacao.historico(MES);
    expect(porMes[anterior]).toBe(historico.porCompetencia[anterior]);
    expect(porMes[MES]).toBe(30000);
    const s = await dash.carregarGrafico("meses", deps());
    expect(s.pontos).toHaveLength(12);
    expect(s.totalCentavos).toBe(130000);
    const d = await dash.carregarGrafico("dias", deps());
    expect(d.pontos).toHaveLength(30);
    expect(d.pontos[29]).toEqual({ periodo: HOJE, totalCentavos: 30000 });
  });

  it("T07 — CA-06: PE e meta iguais aos da Calculadora; faturamento do mês = mês atual do gráfico (INV-001)", async () => {
    await base.negocio.update({
      where: { id: negocioA },
      data: { regimeTributario: "AUTONOMO", impostoPercentualManual: 6, faturamentoMensalEstimado: 5000, taxaCartaoMedia: 3, cmvEstimado: 30, margemLucroMeta: 10 },
    });
    await base.despesaFixa.create({ data: { negocioId: negocioA, descricao: "Aluguel", valorMensal: 1000, diaVencimento: 5, geraDesde: new Date(`${MES}-01`) } });
    await vender([{ forma: "PIX", valor: 800 }]);
    const analise = await analisarNegocio(deps().calculadora);
    if (analise.status !== "ok") throw new Error(analise.mensagem);
    const e = await dash.carregarSemaforo(deps());
    if (e.status !== "ok") throw new Error(e.mensagem);
    expect(e.semaforo.pontoDeEquilibrioCentavos).toBe(analise.pontoDeEquilibrioCentavos);
    expect(e.semaforo.metaCentavos).toBe(analise.metaCentavos);
    expect(e.semaforo.faturamentoCentavos).toBe((await deps().dashboard.vendasPorMes(HOJE))[MES]);
    // 1000 ÷ (1 − 0,30 − 0,06 − 0,03) = R$ 1.639,34; meta com 10%: 1000 ÷ 0,51 = R$ 1.960,78
    expect(e.semaforo).toMatchObject({ pontoDeEquilibrioCentavos: 163934, metaCentavos: 196078, cor: "vermelho", faltaParaPeCentavos: 83934 });
    expect(e.margemMeta).toBe(10);
  });

  it("T07 — CA-07/CA-08: sem meta só o PE; sem histórico nem estimativa, indisponível com a mensagem da Calculadora; sem CMV, indisponível", async () => {
    expect(await dash.carregarSemaforo(deps())).toEqual({ status: "indisponivel", motivo: "sem-faturamento", mensagem: C.semFaturamento });
    await base.negocio.update({ where: { id: negocioA }, data: { regimeTributario: "AUTONOMO", impostoPercentualManual: 6, faturamentoMensalEstimado: 5000 } });
    expect(await dash.carregarSemaforo(deps())).toMatchObject({ status: "indisponivel", motivo: "sem-cmv" });
    await base.negocio.update({ where: { id: negocioA }, data: { cmvEstimado: 30 } });
    const e = await dash.carregarSemaforo(deps());
    expect(e).toMatchObject({ status: "ok", margemMeta: null, semaforo: { metaCentavos: null, cor: "equilibrio" } }); // sem despesas: PE = 0
  });
});

describe("projeção de caixa", () => {
  it("T08 — CA-09/CA-10: saldo, conta gerada da despesa, despesas estimadas, contas manuais e atrasada no mês atual", async () => {
    await financeiro.informarSaldoInicial({ valor: "1000", data: HOJE }, depsFin());
    await base.despesaFixa.create({ data: { negocioId: negocioA, descricao: "Aluguel", valorMensal: 500, diaVencimento: 5, geraDesde: new Date(`${MES}-01`) } });
    await fin().conferir(HOJE); // gera a conta do aluguel do mês atual
    await conta("RECEBER", "100", vencimentoNaCompetencia(somarMeses(MES, 1), 11));
    await conta("RECEBER", "100", vencimentoNaCompetencia(somarMeses(MES, 2), 11));
    await conta("PAGAR", "200", vencimentoNaCompetencia(somarMeses(MES, 3), 20));
    await conta("PAGAR", "80", vencimentoNaCompetencia(somarMeses(MES, -1), 20)); // atrasada
    await conta("PAGAR", "9999", vencimentoNaCompetencia(somarMeses(MES, 2), 1), negocioB); // outro negócio

    const p = await dash.carregarProjecao(deps());
    expect(p.saldoAtualCentavos).toBe(100000);
    expect(p.meses.map((m) => m.competencia)).toEqual([0, 1, 2, 3, 4, 5].map((i) => somarMeses(MES, i)));
    expect(p.meses.map((m) => m.saldoProjetadoCentavos)).toEqual([42000, 2000, -38000, -108000, -158000, -208000]);
    expect(p.meses.map((m) => m.saidasEstimadasCentavos)).toEqual([0, 50000, 50000, 50000, 50000, 50000]); // o do mês atual vem da conta
    const aluguelAtrasado = vencimentoNaCompetencia(MES, 5) < HOJE;
    expect(p.atrasadas).toEqual({ entradasCentavos: 0, saidasCentavos: 8000 + (aluguelAtrasado ? 50000 : 0), quantidade: aluguelAtrasado ? 2 : 1 });
  });

  it("T08 — MEI: o DAS dos meses futuros vem do parâmetro vigente; parcela recebida pela metade entra pelo restante", async () => {
    await base.negocio.update({ where: { id: negocioA }, data: { regimeTributario: "MEI", atividadeMei: "SERVICOS" } });
    await fin().conferir(HOJE); // cria o DAS e a conta do mês
    const dasDoMes = await fin().dasVigente(HOJE);
    expect(dasDoMes).toBeGreaterThan(0);
    await conta("RECEBER", "300", vencimentoNaCompetencia(somarMeses(MES, 1), 10));
    const c = await base.contaPagarReceber.findFirstOrThrow({ where: { negocioId: negocioA, tipo: "RECEBER" } });
    expect(await financeiro.registrarPagamento(c.id, { valor: "100", data: HOJE }, depsFin())).toMatchObject({ status: "salvo" });

    const dasDoProximo = await fin().dasVigente(vencimentoNaCompetencia(somarMeses(MES, 1), 20)); // muda em janeiro
    const p = await dash.carregarProjecao(deps());
    expect(p.meses[0].saidasEstimadasCentavos).toBe(0);
    expect(p.meses[1]).toMatchObject({ entradasCentavos: 20000, saidasEstimadasCentavos: dasDoProximo });
    expect(p.meses[0].saidasCentavos).toBe(dasDoMes);
  });
});

describe("desempenho", () => {
  it("T11 — CA-13: 10 mil vendas em 12 meses e 500 contas: Dashboard completo em menos de 2 s (RNF06)", async () => {
    await base.negocio.update({ where: { id: negocioA }, data: { regimeTributario: "AUTONOMO", impostoPercentualManual: 6, cmvEstimado: 30, margemLucroMeta: 10 } });
    const inicio = intervaloDaCompetencia(somarMeses(MES, -11)).inicio.getTime();
    const passo = Math.floor((Date.now() - inicio) / 10_000);
    await base.venda.createMany({
      data: Array.from({ length: 10_000 }, (_, i) => ({ negocioId: negocioA, data: new Date(inicio + i * passo), valorTotal: 50, numero: i + 1, registradaPorId: usuario })),
    });
    await base.contaPagarReceber.createMany({
      data: Array.from({ length: 500 }, (_, i) => ({
        negocioId: negocioA,
        tipo: i % 2 ? ("PAGAR" as const) : ("RECEBER" as const),
        categoria: "OUTROS" as const,
        descricao: `Conta ${i}`,
        valorTotal: 10,
        vencimento: meioDia(somarDias(HOJE, (i % 200) - 30)),
      })),
    });
    const t0 = performance.now();
    const d = deps();
    const [dia, , , semaforo, projecao] = await Promise.all([
      dash.carregarVendasDoDia(d),
      dash.carregarGrafico("dias", d),
      dash.carregarGrafico("meses", d),
      dash.carregarSemaforo(d),
      dash.carregarProjecao(d),
      d.saldoAtual(HOJE),
    ]);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(2000);
    expect(dia.quantidade).toBeGreaterThanOrEqual(0);
    expect(semaforo.status).toBe("ok");
    expect(projecao.meses).toHaveLength(6);
  });
});
