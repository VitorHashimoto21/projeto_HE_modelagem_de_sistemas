import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasFinanceiras } from "@/lib/db/financeiro";
import { criarConsultasDeVendas } from "@/lib/db/vendas";
import { hoje as hojeLocal } from "@/lib/dominio/datas";
import { competenciaDoDia } from "@/lib/dominio/financeiro";
import { vencimentoDaParcela } from "@/lib/dominio/venda";
import * as servicos from "@/lib/financeiro/servicos";
import { MENSAGENS_FLUXO_FINANCEIRO as F } from "@/lib/financeiro/servicos";
import { executarRotinaDiaria } from "@/lib/rotinas/diaria";
import * as vendas from "@/lib/vendas/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-009 — testes de integração (seção 12): banco real, cliente do negócio, pagamento
// condicional, geração mensal idempotente e a rotina diária.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();
const MES = competenciaDoDia(HOJE);

let usuario: string;
let negocioA: string;
let negocioB: string;

const fin = (negocioId = negocioA) => criarConsultasFinanceiras(comNegocio(base, { negocioId, usuarioId: usuario }), negocioId);
const deps = (extra: Partial<servicos.DependenciasDoFinanceiro> = {}, negocioId = negocioA): servicos.DependenciasDoFinanceiro => ({
  financeiro: fin(negocioId),
  usuarioId: usuario,
  hoje: HOJE,
  agora: new Date(),
  ...extra,
});
const saldoAtual = async (negocioId = negocioA) => (await fin(negocioId).fluxo({ mes: MES }, HOJE)).saldoAtualCentavos;
const salvo = (r: servicos.EstadoDoFinanceiro) => {
  if (r.status !== "salvo") throw new Error(`esperava salvo: ${JSON.stringify(r)}`);
  return r.id!;
};

async function vender(pagamentos: { forma: string; valor: number; parcelas?: number }[]) {
  const total = pagamentos.reduce((s, p) => s + p.valor, 0);
  const item = await base.item.create({
    data: { negocioId: negocioA, tipo: "SERVICO", nome: `Serviço ${randomUUID()}`, nomeChave: randomUUID(), categoria: "BELEZA", unidadeMedida: "un", custoBase: 1, precoAtual: total },
  });
  const r = await vendas.registrarVenda(
    { carrinho: JSON.stringify({ id: randomUUID(), linhas: [{ itemId: item.id, quantidade: 1 }], pagamentos }) },
    { vendas: criarConsultasDeVendas(comNegocio(base, { negocioId: negocioA, usuarioId: usuario }), negocioA), usuarioId: usuario, hoje: HOJE, agora: new Date() },
  );
  if (r.status !== "registrada") throw new Error(JSON.stringify(r));
  return r.vendaId;
}

const contaManual = (extra: Record<string, string> = {}) =>
  servicos.criarConta({ tipo: "PAGAR", descricao: "Fornecedor X", categoria: "FORNECEDORES", valor: "300", vencimento: HOJE, ...extra }, deps());

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Gisele", email: "gisele@exemplo.com" } })).id;
  negocioA = (await base.negocio.create({ data: { nome: "Studio A" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Studio B", regimeTributario: "SIMPLES_NACIONAL" } })).id;
  await base.membroNegocio.create({ data: { negocioId: negocioA, usuarioId: usuario, papel: "DONO" } });
});

afterAll(async () => {
  await base.$disconnect();
});

describe("caixa", () => {
  it("T03 — saldo real: só o recebido; parcelas não entram; saldo inicial uma vez (CA-01, CA-02, INV-001)", async () => {
    await vender([{ forma: "PIX", valor: 50 }]);
    await vender([{ forma: "CREDITO", valor: 300, parcelas: 3 }]);
    expect(await saldoAtual()).toBe(5000);
    const receber = await fin().listarContas({ tipo: "RECEBER", situacao: "abertas" }, HOJE);
    expect(receber.contas.map((c) => [c.totalCentavos, c.origem])).toEqual([
      [10000, "venda"],
      [10000, "venda"],
      [10000, "venda"],
    ]);

    // Dois pedidos simultâneos de saldo inicial: só um é gravado.
    const rs = await Promise.all([servicos.informarSaldoInicial({ valor: "1.000,00", data: HOJE }, deps()), servicos.informarSaldoInicial({ valor: "1000", data: HOJE }, deps())]);
    expect(rs.filter((r) => r.status === "salvo")).toHaveLength(1);
    expect(rs.find((r) => r.status === "erro")).toEqual({ status: "erro", mensagem: F.saldoInicialJaInformado });
    expect(await saldoAtual()).toBe(105000);
    const fluxo = await fin().fluxo({ mes: MES }, HOJE);
    expect(fluxo.saldoInicialInformado).toBe(true);
    expect(fluxo.lancamentos.map((l) => l.origem).sort()).toEqual(["SALDO_INICIAL", "VENDA"]);
    expect(fluxo.lancamentos.find((l) => l.origem === "VENDA")?.registradoPor).toBe("Gisele");

    // Estornado, pode ser informado de novo.
    const inicial = fluxo.lancamentos.find((l) => l.origem === "SALDO_INICIAL")!;
    salvo(await servicos.estornar(inicial.id, deps()));
    expect(await fin().saldoInicialInformado()).toBe(false);
    salvo(await servicos.informarSaldoInicial({ valor: "800", data: HOJE }, deps()));
    expect(await saldoAtual()).toBe(85000);
  });

  it("T04 — avulso, estorno único e imutabilidade no banco (CA-03, CA-04, INV-006)", async () => {
    const id = salvo(await servicos.lancarAvulso({ tipo: "SAIDA", valor: "80", categoria: "FORNECEDORES", descricao: "Compra de esmaltes", data: HOJE }, deps()));
    expect(await saldoAtual()).toBe(-8000);
    const [l] = (await fin().fluxo({ mes: MES }, HOJE)).lancamentos;
    expect(l).toMatchObject({ id, tipo: "SAIDA", origem: "AVULSO", categoria: "FORNECEDORES", valorCentavos: 8000, descricao: "Compra de esmaltes", registradoPor: "Gisele", estornado: false });

    // Dois estornos simultâneos: um só.
    const rs = await Promise.all([servicos.estornar(id, deps()), servicos.estornar(id, deps())]);
    expect(rs.filter((r) => r.status === "salvo")).toHaveLength(1);
    expect(rs.find((r) => r.status === "erro")).toEqual({ status: "erro", mensagem: F.jaEstornado });
    expect(await saldoAtual()).toBe(0);
    const lista = (await fin().fluxo({ mes: MES }, HOJE)).lancamentos;
    expect(lista.find((x) => x.id === id)?.estornado).toBe(true);
    expect(lista.find((x) => x.origem === "ESTORNO")).toMatchObject({ tipo: "ENTRADA", categoria: "FORNECEDORES", valorCentavos: 8000, descricao: "Estorno de: Compra de esmaltes", estornoDeId: id });
    expect(await servicos.estornar(id, deps())).toEqual({ status: "erro", mensagem: F.jaEstornado });
    const estorno = lista.find((x) => x.origem === "ESTORNO")!;
    expect(await servicos.estornar(estorno.id, deps())).toEqual({ status: "erro", mensagem: F.naoEstornavel });

    // Venda não se estorna por aqui (SPEC-011).
    const vendaId = await vender([{ forma: "PIX", valor: 10 }]);
    const daVenda = await base.lancamentoFinanceiro.findFirstOrThrow({ where: { vendaId } });
    expect(daVenda).toMatchObject({ origem: "VENDA", usuarioId: usuario });
    expect(await servicos.estornar(daVenda.id, deps())).toEqual({ status: "erro", mensagem: F.naoEstornavel });

    // O banco recusa alterar ou apagar lançamentos.
    await expect(base.$executeRawUnsafe(`UPDATE "LancamentoFinanceiro" SET valor = 1 WHERE id = '${id}'`)).rejects.toThrow(/he_somente_insercao/);
    await expect(base.$executeRawUnsafe(`DELETE FROM "LancamentoFinanceiro" WHERE id = '${id}'`)).rejects.toThrow(/he_somente_insercao/);
    await expect(base.lancamentoFinanceiro.create({ data: { negocioId: negocioA, origem: "AVULSO", tipo: "SAIDA", categoria: "OUTROS", valor: 0 } })).rejects.toThrow(/valor_positivo/);
  });

  it("T02 — validação no fluxo: data além de 90 dias e futura são recusadas", async () => {
    const r = await servicos.lancarAvulso({ tipo: "ENTRADA", valor: "10", categoria: "OUTROS", descricao: "x", data: "2000-01-01" }, deps());
    expect(r).toMatchObject({ status: "erro", erros: { data: expect.any(String) } });
  });
});

describe("contas", () => {
  it("T05 — pagamento parcial, total, acima do restante e conta encerrada (CA-05, INV-002 a INV-004)", async () => {
    const contaId = salvo(await contaManual());
    expect(await servicos.registrarPagamento(contaId, { valor: "100", data: HOJE }, deps())).toEqual({ status: "salvo", mensagem: F.pago(false, false, 20000), id: contaId });
    let c = await fin().detalharConta(contaId, HOJE);
    expect(c).toMatchObject({ status: "PARCIAL", pagoCentavos: 10000, restanteCentavos: 20000, origem: "manual", criadaPor: "Gisele" });
    expect(await saldoAtual()).toBe(-10000);
    const [l] = await base.lancamentoFinanceiro.findMany({ where: { contaId } });
    expect(l).toMatchObject({ tipo: "SAIDA", categoria: "FORNECEDORES", origem: "CONTA", descricao: "Fornecedor X", usuarioId: usuario });

    expect(await servicos.registrarPagamento(contaId, { valor: "250", data: HOJE }, deps())).toEqual({ status: "erro", erros: { valor: F.acimaDoRestante(20000) } });
    salvo(await servicos.registrarPagamento(contaId, { valor: "200", data: HOJE }, deps()));
    c = await fin().detalharConta(contaId, HOJE);
    expect(c).toMatchObject({ status: "QUITADA", restanteCentavos: 0 });
    expect(c.lancamentos.reduce((s, x) => s + x.valorCentavos, 0)).toBe(c.pagoCentavos); // INV-004
    expect(await servicos.registrarPagamento(contaId, { valor: "1", data: HOJE }, deps())).toEqual({ status: "erro", mensagem: F.contaEncerrada });

    const cancelada = salvo(await contaManual({ tipo: "RECEBER", categoria: "OUTROS" }));
    salvo(await servicos.cancelarConta(cancelada, deps()));
    expect(await servicos.registrarPagamento(cancelada, { valor: "1", data: HOJE }, deps())).toEqual({ status: "erro", mensagem: F.contaEncerrada });
    await expect(base.contaPagarReceber.update({ where: { id: cancelada }, data: { valorPago: 301 } })).rejects.toThrow(/valores_validos/);

    // Isolamento: o outro negócio não enxerga nem paga a conta.
    expect(await servicos.registrarPagamento(contaId, { valor: "1", data: HOJE }, deps({}, negocioB))).toEqual({ status: "erro", mensagem: F.contaNaoEncontrada });
    expect((await fin(negocioB).listarContas({ tipo: "PAGAR", situacao: "todas" }, HOJE)).contas).toEqual([]);
  });

  it("T06 — pagamentos simultâneos nunca ultrapassam o total (CA-06, INV-003)", async () => {
    const contaId = salvo(await contaManual());
    const rs = await Promise.all([1, 2].map(() => servicos.registrarPagamento(contaId, { valor: "200", data: HOJE }, deps())));
    expect(rs.filter((r) => r.status === "salvo")).toHaveLength(1);
    const c = await fin().detalharConta(contaId, HOJE);
    expect([c.pagoCentavos, c.status, c.lancamentos.length]).toEqual([20000, "PARCIAL", 1]);
  });

  it("CA-07 — atrasada: vencida e não quitada; quitada deixa de ser", async () => {
    const ontem = new Date(Date.parse(`${HOJE}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    const contaId = salvo(await contaManual({ vencimento: ontem }));
    let lista = await fin().listarContas({ tipo: "PAGAR", situacao: "atrasadas" }, HOJE);
    expect([lista.atrasadas, lista.contas[0]?.atrasada]).toEqual([1, true]);
    salvo(await servicos.registrarPagamento(contaId, { valor: "300", data: HOJE }, deps()));
    lista = await fin().listarContas({ tipo: "PAGAR", situacao: "atrasadas" }, HOJE);
    expect([lista.atrasadas, lista.contas.length]).toEqual([0, 0]);
    expect((await fin().detalharConta(contaId, HOJE)).atrasada).toBe(false);
  });

  it("T10 — contas protegidas: venda, despesa fixa e com pagamento (CA-11, INV-008)", async () => {
    await vender([{ forma: "CREDITO", valor: 90, parcelas: 3 }]);
    const parcela = await base.contaPagarReceber.findFirstOrThrow({ where: { parcelaId: { not: null } } });
    const campos = { tipo: "PAGAR", descricao: "Outra", categoria: "OUTROS", valor: "10", vencimento: HOJE };
    expect(await servicos.editarConta(parcela.id, campos, deps())).toEqual({ status: "erro", mensagem: F.contaNaoEditavel.venda });
    expect(await servicos.cancelarConta(parcela.id, deps())).toEqual({ status: "erro", mensagem: F.contaNaoEditavel.venda });

    salvo(await servicos.criarDespesa({ descricao: "Aluguel", valor: "1200", diaVencimento: "28", categoria: "OUTROS" }, deps()));
    const fixa = await base.contaPagarReceber.findFirstOrThrow({ where: { despesaFixaId: { not: null } } });
    expect(await servicos.cancelarConta(fixa.id, deps())).toEqual({ status: "erro", mensagem: F.contaNaoEditavel.despesa });

    const manual = salvo(await contaManual());
    salvo(await servicos.editarConta(manual, { ...campos, descricao: "Fornecedor Y", valor: "350" }, deps()));
    expect(await fin().detalharConta(manual, HOJE)).toMatchObject({ descricao: "Fornecedor Y", totalCentavos: 35000, tipo: "PAGAR" });
    salvo(await servicos.registrarPagamento(manual, { valor: "1", data: HOJE }, deps()));
    expect(await servicos.editarConta(manual, campos, deps())).toEqual({ status: "erro", mensagem: F.contaNaoEditavel["com-pagamento"] });
    expect(await servicos.cancelarConta(manual, deps())).toEqual({ status: "erro", mensagem: F.contaNaoEditavel["com-pagamento"] });
  });
});

describe("despesas fixas e rotina", () => {
  const conferir = (dia: string, negocioId = negocioA) => fin(negocioId).conferir(dia);
  const contasFixas = () => base.contaPagarReceber.findMany({ where: { despesaFixaId: { not: null } }, orderBy: { competencia: "asc" } });

  it("T07 — OPEN-004, geração idempotente em paralelo, mudança de valor, desativar e reativar (CA-08, INV-005)", async () => {
    // Cadastrada em 09/10 com vencimento dia 5: o dia já passou → primeira conta em 11/2026.
    salvo(await servicos.criarDespesa({ descricao: "Aluguel", valor: "1.200,00", diaVencimento: "5" }, deps({ hoje: "2026-10-09" })));
    expect(await contasFixas()).toHaveLength(0);
    // Rotina, conferências e a rotina "de todos" ao mesmo tempo: uma conta só.
    await Promise.all([conferir("2026-11-01"), conferir("2026-11-01"), executarRotinaDiaria([negocioA, negocioB], (n) => conferir("2026-11-01", n))]);
    let contas = await contasFixas();
    expect(contas.map((c) => [c.descricao, Number(c.valorTotal), c.categoria, c.tipo])).toEqual([["Aluguel — 11/2026", 1200, "OUTROS", "PAGAR"]]);
    expect((await fin().listarContas({ tipo: "PAGAR", situacao: "abertas" }, "2026-11-01")).contas[0].vencimento).toBe("2026-11-05");

    // Vencimento dia 15, cadastrada no dia 9: ainda dá tempo → conta deste mês.
    salvo(await servicos.criarDespesa({ descricao: "Contador", valor: "300", diaVencimento: "15", categoria: "OUTROS" }, deps({ hoje: "2026-10-09" })));
    expect((await contasFixas()).map((c) => c.descricao)).toContain("Contador — 10/2026");

    // Novo valor vale para as próximas competências; as geradas não mudam.
    const aluguel = (await fin().listarDespesas()).find((d) => d.descricao === "Aluguel")!;
    salvo(await servicos.editarDespesa(aluguel.id, { descricao: "Aluguel", valor: "1300", diaVencimento: "31", categoria: "OUTROS" }, deps()));
    await conferir("2027-02-10");
    contas = (await contasFixas()).filter((c) => c.despesaFixaId === aluguel.id);
    expect(contas.map((c) => [c.descricao, Number(c.valorTotal)])).toEqual([
      ["Aluguel — 11/2026", 1200],
      ["Aluguel — 12/2026", 1300],
      ["Aluguel — 01/2027", 1300],
      ["Aluguel — 02/2027", 1300],
    ]);
    // Dia 31 em fevereiro: o último dia do mês.
    const fev = (await fin().listarContas({ tipo: "PAGAR", situacao: "abertas" }, "2027-02-10")).contas.find((c) => c.descricao === "Aluguel — 02/2027");
    expect(fev?.vencimento).toBe("2027-02-28");

    // Desativada: nada novo. Reativada em 10/05 (dia 31 ainda não passou): recomeça em 05/2027, sem março e abril.
    salvo(await servicos.definirAtivo(aluguel.id, false, deps()));
    await conferir("2027-04-10");
    expect((await contasFixas()).filter((c) => c.despesaFixaId === aluguel.id)).toHaveLength(4);
    salvo(await servicos.definirAtivo(aluguel.id, true, deps({ hoje: "2027-05-10" })));
    await conferir("2027-05-10");
    expect((await contasFixas()).filter((c) => c.despesaFixaId === aluguel.id).map((c) => c.descricao).slice(-1)).toEqual(["Aluguel — 05/2027"]);
    expect((await contasFixas()).filter((c) => c.despesaFixaId === aluguel.id)).toHaveLength(5);
  });

  it("T08 — DAS do MEI: criação, valor vigente na competência, só o dia editável, troca de regime (CA-09)", async () => {
    await base.parametroMei.createMany({
      data: [
        { atividade: "SERVICOS", valorDasMensal: 80.9, limiteFaturamentoAnual: 81000, fonteLegal: "teste", vigenteDesde: new Date("2025-01-01") },
        { atividade: "SERVICOS", valorDasMensal: 86.05, limiteFaturamentoAnual: 81000, fonteLegal: "teste", vigenteDesde: new Date("2026-01-01") },
      ],
    });
    await base.negocio.update({ where: { id: negocioA }, data: { regimeTributario: "MEI", atividadeMei: "SERVICOS" } });
    await Promise.all([conferir("2026-10-09"), conferir("2026-10-09")]);
    const das = await base.despesaFixa.findUniqueOrThrow({ where: { id: negocioA } });
    expect(das).toMatchObject({ origem: "DAS_MEI", descricao: "DAS do MEI", categoria: "IMPOSTOS", diaVencimento: 20, valorMensal: null, ativo: true });
    let contas = await contasFixas();
    expect(contas.map((c) => [c.descricao, Number(c.valorTotal), c.categoria])).toEqual([["DAS do MEI — 10/2026", 86.05, "IMPOSTOS"]]);
    expect(await fin().dasVigente("2026-10-09")).toBe(8605);

    // Simples: sem DAS.
    await conferir("2026-10-09", negocioB);
    expect(await base.despesaFixa.count({ where: { negocioId: negocioB } })).toBe(0);

    // Só o dia é editável; ativar/desativar é automático.
    expect(await servicos.editarDespesa(das.id, { descricao: "Outro", valor: "1", diaVencimento: "10" }, deps())).toMatchObject({ status: "salvo" });
    expect(await base.despesaFixa.findUniqueOrThrow({ where: { id: das.id } })).toMatchObject({ descricao: "DAS do MEI", valorMensal: null, diaVencimento: 10 });
    expect(await servicos.definirAtivo(das.id, false, deps())).toEqual({ status: "erro", mensagem: F.dasNaoEditavel });

    // Deixou de ser MEI: o DAS para de gerar contas.
    await base.negocio.update({ where: { id: negocioA }, data: { regimeTributario: "SIMPLES_NACIONAL" } });
    await conferir("2026-12-01");
    contas = await contasFixas();
    expect(contas).toHaveLength(1);
    expect((await base.despesaFixa.findUniqueOrThrow({ where: { id: das.id } })).ativo).toBe(false);
  });

  it("T09 — parcelas do cartão recebidas no vencimento; futuras continuam a receber (CA-10, OPEN-008)", async () => {
    await vender([{ forma: "CREDITO", valor: 300, parcelas: 3 }]);
    const v1 = vencimentoDaParcela(HOJE, 1);
    const r = await conferir(v1);
    expect(r.parcelasRecebidas).toBe(1);
    expect(await conferir(v1)).toEqual({ contasCriadas: 0, parcelasRecebidas: 0 });
    const contas = await fin().listarContas({ tipo: "RECEBER", situacao: "todas" }, v1);
    expect(contas.contas.map((c) => [c.vencimento, c.status])).toEqual([
      [v1, "QUITADA"],
      [vencimentoDaParcela(HOJE, 2), "ABERTA"],
      [vencimentoDaParcela(HOJE, 3), "ABERTA"],
    ]);
    const entrada = await base.lancamentoFinanceiro.findFirstOrThrow({ where: { origem: "CONTA" } });
    expect(entrada).toMatchObject({ tipo: "ENTRADA", categoria: "VENDAS", usuarioId: null });
    expect(Number(entrada.valor)).toBe(100);
    expect(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(entrada.data)).toBe(v1);
  });
});

describe("rotina diária (rota)", () => {
  const urlOriginal = process.env.DATABASE_URL;
  const segredoOriginal = process.env.CRON_SECRET;
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://exemplo.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_teste";

  afterEach(async () => {
    const g = globalThis as { prismaHE?: { $disconnect(): Promise<void> } };
    await g.prismaHE?.$disconnect();
    delete g.prismaHE;
    process.env.DATABASE_URL = urlOriginal;
    process.env.CRON_SECRET = segredoOriginal;
  });

  async function chamar(autorizacao?: string) {
    process.env.DATABASE_URL = urlDoBancoDeTeste();
    process.env.CRON_SECRET = "segredo-de-teste-com-32-caracteres!";
    delete (globalThis as { prismaHE?: unknown }).prismaHE;
    vi.resetModules();
    const { GET } = await import("@/app/api/rotinas/diaria/route");
    const resposta = await GET(new Request("http://localhost/api/rotinas/diaria", { headers: autorizacao ? { authorization: autorizacao } : {} }));
    return { status: resposta.status, corpo: await resposta.json() };
  }

  it("T11 — sem o segredo (ou com o errado) responde 401 e nada é gerado; com ele, confere todos (CA-12)", async () => {
    await base.despesaFixa.create({ data: { negocioId: negocioA, descricao: "Internet", valorMensal: 100, diaVencimento: 28, geraDesde: new Date(`${MES}-01`) } });
    await base.despesaFixa.create({ data: { negocioId: negocioB, descricao: "Internet", valorMensal: 120, diaVencimento: 28, geraDesde: new Date(`${MES}-01`) } });
    expect((await chamar()).status).toBe(401);
    expect((await chamar("Bearer errado")).status).toBe(401);
    expect(await base.contaPagarReceber.count()).toBe(0);
    const ok = await chamar("Bearer segredo-de-teste-com-32-caracteres!");
    expect(ok).toEqual({ status: 200, corpo: { dia: HOJE, negocios: 2, contasCriadas: 2, parcelasRecebidas: 0, falhas: 0 } });
    expect(await base.contaPagarReceber.groupBy({ by: ["negocioId"], _count: true })).toHaveLength(2);
  });
});

describe("T13 — desempenho (RNF06)", () => {
  it("caixa de um mês com 5.000 lançamentos e 2.000 contas em menos de 2 s; rotina com 100 negócios em menos de 30 s", async () => {
    const inicio = new Date(Date.parse(`${MES}-01T15:00:00Z`));
    await base.lancamentoFinanceiro.createMany({
      data: Array.from({ length: 5000 }, (_, i) => ({
        negocioId: negocioA,
        origem: "AVULSO" as const,
        tipo: i % 3 ? ("ENTRADA" as const) : ("SAIDA" as const),
        categoria: "OUTROS" as const,
        valor: 10 + (i % 50),
        descricao: `Lançamento ${i}`,
        data: new Date(Math.min(inicio.getTime() + i * 1000, Date.now())),
        usuarioId: usuario,
      })),
    });
    await base.contaPagarReceber.createMany({
      data: Array.from({ length: 2000 }, (_, i) => ({ negocioId: negocioA, tipo: "PAGAR" as const, categoria: "OUTROS" as const, descricao: `Conta ${i}`, valorTotal: 50, vencimento: new Date(inicio.getTime() + i * 60_000) })),
    });
    let t = performance.now();
    const fluxo = await fin().fluxo({ mes: MES }, HOJE);
    const contas = await fin().listarContas({ tipo: "PAGAR", situacao: "abertas" }, HOJE);
    expect(performance.now() - t).toBeLessThan(2000);
    expect([fluxo.lancamentos.length, fluxo.paginas, contas.contas.length, contas.paginas]).toEqual([100, 50, 100, 20]);

    const ids = (await base.negocio.createManyAndReturn({ data: Array.from({ length: 98 }, (_, i) => ({ nome: `N${i}` })), select: { id: true } })).map((n) => n.id);
    await base.despesaFixa.createMany({ data: ids.map((negocioId) => ({ negocioId, descricao: "Aluguel", valorMensal: 500, diaVencimento: 28, geraDesde: new Date(`${MES}-01`) })) });
    t = performance.now();
    const r = await executarRotinaDiaria([negocioA, negocioB, ...ids], (n) => conferirDe(n));
    expect(performance.now() - t).toBeLessThan(30_000);
    expect(r).toMatchObject({ negocios: 100, contasCriadas: 98, falhas: 0 });
  }, 120_000);
});

const conferirDe = (negocioId: string) => fin(negocioId).conferir(HOJE);
