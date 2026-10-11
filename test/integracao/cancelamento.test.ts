import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasFinanceiras } from "@/lib/db/financeiro";
import { criarConsultasDePrecificacao } from "@/lib/db/precificacao";
import { criarConsultasDeVendas } from "@/lib/db/vendas";
import { hoje as hojeLocal, intervaloDaCompetencia } from "@/lib/dominio/datas";
import { competenciaDoDia, somarMeses } from "@/lib/dominio/financeiro";
import { vencimentoDaParcela } from "@/lib/dominio/venda";
import * as servicos from "@/lib/vendas/servicos";
import { MENSAGENS_FLUXO_VENDA as F } from "@/lib/vendas/servicos";
import { MENSAGENS_VENDA as M } from "@/lib/vendas/validacao";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-011 — testes de integração (seção 12): cancelamento e troca numa transação, com o
// estoque (SPEC-007), as contas e o caixa (SPEC-009) e o RBT12 (SPEC-010).

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();
const MES = competenciaDoDia(HOJE);

let usuario: string;
let negocioA: string;
let negocioB: string;

const cliente = (negocioId = negocioA) => comNegocio(base, { negocioId, usuarioId: usuario });
const deps = (negocioId = negocioA): servicos.DependenciasDaVenda => ({
  vendas: criarConsultasDeVendas(cliente(negocioId), negocioId),
  usuarioId: usuario,
  hoje: HOJE,
  agora: new Date(),
});
const fin = () => criarConsultasFinanceiras(cliente(), negocioA);
const saldoCaixa = async () => (await fin().fluxo({ mes: MES }, HOJE)).saldoAtualCentavos;
const estoque = async (id: string) => Number((await base.item.findUniqueOrThrow({ where: { id } })).quantidadeEstoque);

async function item(nome: string, extra: Record<string, unknown> = {}) {
  return (
    await base.item.create({
      data: { negocioId: negocioA, tipo: "PRODUTO_FISICO", nome, nomeChave: nome.toLowerCase(), categoria: "BELEZA", unidadeMedida: "un", custoBase: 5, precoAtual: 18, quantidadeEstoque: 10, ...extra },
    })
  ).id;
}

type Linha = { itemId: string; quantidade: number | string };
type Pag = { forma: string; valor: number | string; parcelas?: number };
const carrinho = (linhas: Linha[], pagamentos: Pag[], id = randomUUID()) => JSON.stringify({ id, linhas, pagamentos });

async function vender(linhas: Linha[], pagamentos: Pag[]) {
  const r = await servicos.registrarVenda({ carrinho: carrinho(linhas, pagamentos) }, deps());
  if (r.status !== "registrada") throw new Error(JSON.stringify(r));
  return r.vendaId;
}
const cancelar = (vendaId: string, campos: Record<string, string> = {}) => servicos.cancelarVenda(vendaId, { motivo: "DEVOLUCAO", formaReembolso: "PIX", ...campos }, deps());
const trocar = (vendaId: string, linhas: Linha[], pagamentos: Pag[], campos: Record<string, string> = {}, id = randomUUID()) =>
  servicos.trocarVenda(vendaId, { motivo: "TROCA", formaReembolso: "PIX", carrinho: carrinho(linhas, pagamentos, id), ...campos }, deps());
const ok = (r: servicos.EstadoDoCancelamento) => {
  if (r.status !== "cancelada") throw new Error(`esperava cancelada: ${JSON.stringify(r)}`);
  return r;
};

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Gisele", email: "gisele@exemplo.com" } })).id;
  negocioA = (await base.negocio.create({ data: { nome: "Studio A" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Studio B" } })).id;
});

afterAll(async () => {
  await base.$disconnect();
});

describe("cancelar", () => {
  it("T03/CA-01 — à vista: auditoria, estoque de volta, reembolso e caixa zerado; banco recusa alterar a cancelada", async () => {
    const esmalte = await item("Esmalte");
    const vendaId = await vender([{ itemId: esmalte, quantidade: 2 }], [{ forma: "PIX", valor: 36 }]);
    expect([await estoque(esmalte), await saldoCaixa()]).toEqual([8, 3600]);

    expect(await cancelar(vendaId, { formaReembolso: "" })).toEqual({ status: "erro", erros: { formaReembolso: F.formaReembolso(3600) } });
    expect(await base.venda.findUniqueOrThrow({ where: { id: vendaId } })).toMatchObject({ status: "CONCLUIDA" }); // nada mudou
    expect(await cancelar(vendaId, { motivo: "OUTRO", detalhe: "" })).toEqual({ status: "erro", erros: { detalhe: M.detalheObrigatorio } });

    const r = ok(await cancelar(vendaId, { detalhe: "  esmalte  com defeito " }));
    expect(r).toMatchObject({ numero: 1, reembolsoCentavos: 3600, creditoCentavos: 0, trocaId: null });
    const v = await base.venda.findUniqueOrThrow({ where: { id: vendaId } });
    expect(v).toMatchObject({ status: "CANCELADA", canceladaPorId: usuario, motivoCancelamento: "Devolução: esmalte com defeito" });
    expect(v.canceladaEm).toBeInstanceOf(Date);
    expect(await estoque(esmalte)).toBe(10);
    const movs = await base.movimentacaoEstoque.findMany({ where: { vendaId }, orderBy: { registradoEm: "asc" } });
    expect(movs.map((m) => [m.tipo, Number(m.quantidade), Number(m.saldoAnterior), Number(m.saldoPosterior)])).toEqual([
      ["SAIDA_VENDA", 2, 10, 8],
      ["ENTRADA_ESTORNO", 2, 8, 10],
    ]);
    const reembolso = await base.lancamentoFinanceiro.findFirstOrThrow({ where: { vendaId, tipo: "SAIDA" } });
    expect(reembolso).toMatchObject({ origem: "ESTORNO", estorno: true, categoria: "VENDAS", descricao: "Reembolso da venda nº 1 — PIX", usuarioId: usuario });
    expect(Number(reembolso.valor)).toBe(36);
    expect(await saldoCaixa()).toBe(0); // INV-005

    expect(await cancelar(vendaId)).toEqual({ status: "erro", mensagem: F.jaCancelada });
    await expect(base.$executeRawUnsafe(`UPDATE "Venda" SET "motivoCancelamento" = 'x' WHERE id = '${vendaId}'`)).rejects.toThrow(/he_venda_cancelada_imutavel/);
    await expect(base.$executeRawUnsafe(`UPDATE "Venda" SET status = 'CANCELADA' WHERE status = 'CONCLUIDA'`)).resolves.toBe(0); // nenhuma concluída sobrando
    // Isolamento: outro negócio não encontra a venda.
    expect(await servicos.cancelarVenda(vendaId, { motivo: "DEVOLUCAO" }, deps(negocioB))).toEqual({ status: "erro", mensagem: F.naoEncontrada });
  });

  it("T04/CA-02 — serviço com materiais: volta exatamente o baixado, mesmo com receita alterada e material arquivado (INV-002)", async () => {
    const esmalte = await item("Esmalte", { quantidadeEstoque: 1, custoBase: 8 });
    const algodao = await item("Algodão", { quantidadeEstoque: 10, custoBase: 0.5 });
    const manicure = await item("Manicure", { tipo: "SERVICO", precoAtual: 40, custoBase: 20, quantidadeEstoque: 0 });
    await base.materialServico.createMany({
      data: [
        { negocioId: negocioA, servicoId: manicure, materialId: esmalte, quantidade: 0.25 },
        { negocioId: negocioA, servicoId: manicure, materialId: algodao, quantidade: 1 },
      ],
    });
    const vendaId = await vender([{ itemId: manicure, quantidade: 2 }], [{ forma: "DINHEIRO", valor: 80 }]);
    expect([await estoque(esmalte), await estoque(algodao)]).toEqual([0.5, 8]);
    await base.materialServico.updateMany({ where: { materialId: algodao }, data: { quantidade: 5 } });
    await base.item.update({ where: { id: algodao }, data: { arquivadoEm: new Date(), nomeChave: null } });
    ok(await cancelar(vendaId, { formaReembolso: "DINHEIRO" }));
    expect([await estoque(esmalte), await estoque(algodao), await estoque(manicure)]).toEqual([1, 10, 0]);
  });

  it("T05/CA-03 — crédito 3x com a 1ª recebida: abertas canceladas, reembolso R$ 100, rotina não recebe mais (INV-003)", async () => {
    const prod = await item("Kit", { precoAtual: 300 });
    const vendaId = await vender([{ itemId: prod, quantidade: 1 }], [{ forma: "CREDITO", valor: 300, parcelas: 3 }]);
    const v1 = vencimentoDaParcela(HOJE, 1);
    expect((await fin().conferir(v1)).parcelasRecebidas).toBe(1);

    const previa = await deps().vendas.previaDoCancelamento(vendaId);
    expect(previa).toMatchObject({ recebidoCentavos: 10000, contasAbertas: { quantidade: 2, restanteCentavos: 20000 }, devolucoes: [{ itemId: prod, quantidade: 1 }] });

    expect(ok(await cancelar(vendaId, { formaReembolso: "ESTORNO_CARTAO" }))).toMatchObject({ reembolsoCentavos: 10000 });
    const contas = await base.contaPagarReceber.findMany({ orderBy: { vencimento: "asc" } });
    expect(contas.map((c) => c.status)).toEqual(["QUITADA", "CANCELADA", "CANCELADA"]);
    expect(await fin().conferir(vencimentoDaParcela(HOJE, 3))).toEqual({ contasCriadas: 0, parcelasRecebidas: 0 });
    expect((await base.lancamentoFinanceiro.findFirstOrThrow({ where: { vendaId, tipo: "SAIDA" } })).descricao).toBe("Reembolso da venda nº 1 — Estorno no cartão");
  });

  it("venda no crédito sem nada recebido: cancela sem reembolso e sem pedir a forma", async () => {
    const prod = await item("Kit", { precoAtual: 300 });
    const vendaId = await vender([{ itemId: prod, quantidade: 1 }], [{ forma: "CREDITO", valor: 300, parcelas: 2 }]);
    expect(ok(await cancelar(vendaId, { formaReembolso: "" }))).toMatchObject({ reembolsoCentavos: 0 });
    expect(await base.lancamentoFinanceiro.count({ where: { vendaId, tipo: "SAIDA" } })).toBe(0);
  });
});

describe("trocar", () => {
  it("T06/CA-04 — R$ 100 no PIX trocado por R$ 70: crédito sem lançamento, reembolso R$ 30, caixa R$ 70 (INV-005)", async () => {
    const caro = await item("Kit grande", { precoAtual: 100 });
    const barato = await item("Kit pequeno", { precoAtual: 70 });
    const vendaId = await vender([{ itemId: caro, quantidade: 1 }], [{ forma: "PIX", valor: 100 }]);
    const r = ok(await trocar(vendaId, [{ itemId: barato, quantidade: 1 }], []));
    expect(r).toMatchObject({ numero: 1, trocaNumero: 2, creditoCentavos: 7000, reembolsoCentavos: 3000 });
    const nova = await base.venda.findUniqueOrThrow({ where: { id: r.trocaId! }, include: { pagamentos: true, lancamentos: true } });
    expect(nova).toMatchObject({ status: "CONCLUIDA", vendaOrigemId: vendaId, numero: 2 });
    expect(nova.pagamentos.map((p) => [p.forma, Number(p.valor)])).toEqual([["CREDITO_TROCA", 70]]);
    expect(nova.lancamentos).toEqual([]);
    expect(await saldoCaixa()).toBe(7000);
    expect([await estoque(caro), await estoque(barato)]).toEqual([10, 9]);
    const detalhe = await deps().vendas.detalhar(vendaId);
    expect(detalhe).toMatchObject({ trocadaPor: { id: r.trocaId, numero: 2 }, cancelamento: { motivo: "Troca", reembolso: { valor: 30 } } });
    expect((await deps().vendas.detalhar(r.trocaId!)).trocaDe).toEqual({ id: vendaId, numero: 1 });
  });

  it("T06/CA-05 — crédito limitado ao recebido: R$ 100 de crédito + R$ 150 no PIX; restante errado é recusado", async () => {
    const kit = await item("Kit", { precoAtual: 300 });
    const outro = await item("Outro", { precoAtual: 250 });
    const vendaId = await vender([{ itemId: kit, quantidade: 1 }], [{ forma: "CREDITO", valor: 300, parcelas: 3 }]);
    await fin().conferir(vencimentoDaParcela(HOJE, 1));
    expect(await trocar(vendaId, [{ itemId: outro, quantidade: 1 }], [{ forma: "PIX", valor: 250 }])).toEqual({ status: "erro", mensagem: F.restanteDaTroca(15000, 10000) });
    expect((await base.venda.findUniqueOrThrow({ where: { id: vendaId } })).status).toBe("CONCLUIDA");
    const r = ok(await trocar(vendaId, [{ itemId: outro, quantidade: 1 }], [{ forma: "PIX", valor: 150 }], { formaReembolso: "" }));
    expect(r).toMatchObject({ creditoCentavos: 10000, reembolsoCentavos: 0 });
    const pags = await base.pagamento.findMany({ where: { vendaId: r.trocaId! } });
    expect(pags.map((p) => `${p.forma} ${Number(p.valor)}`).sort()).toEqual(["CREDITO_TROCA 100", "PIX 150"]);
  });

  it("T06/CA-06 e T07/CA-07 — troca maior ou sem estoque: recusada e nada muda (INV-001)", async () => {
    const kit = await item("Kit", { precoAtual: 100 });
    const caro = await item("Caro", { precoAtual: 120 });
    const semEstoque = await item("Sem estoque", { precoAtual: 50, quantidadeEstoque: 0 });
    const vendaId = await vender([{ itemId: kit, quantidade: 1 }], [{ forma: "PIX", valor: 100 }]);
    expect(await trocar(vendaId, [{ itemId: caro, quantidade: 1 }], [])).toEqual({ status: "erro", mensagem: F.trocaAcima(10000) });
    expect(await trocar(vendaId, [{ itemId: semEstoque, quantidade: 1 }], [])).toEqual({ status: "erro", mensagem: F.estoque("Sem estoque", 0, "un") });
    expect((await base.venda.findUniqueOrThrow({ where: { id: vendaId } })).status).toBe("CONCLUIDA");
    expect(await base.movimentacaoEstoque.count({ where: { tipo: "ENTRADA_ESTORNO" } })).toBe(0);
    expect(await base.lancamentoFinanceiro.count({ where: { tipo: "SAIDA" } })).toBe(0);
    expect([await estoque(kit), await base.venda.count(), (await base.negocio.findUniqueOrThrow({ where: { id: negocioA } })).proximoNumeroVenda]).toEqual([9, 1, 2]);
  });

  it("troca do mesmo item: o estoque devolvido já vale para a baixa da troca", async () => {
    const ultimo = await item("Último", { precoAtual: 50, quantidadeEstoque: 1 });
    const vendaId = await vender([{ itemId: ultimo, quantidade: 1 }], [{ forma: "DINHEIRO", valor: 50 }]);
    expect(await estoque(ultimo)).toBe(0);
    ok(await trocar(vendaId, [{ itemId: ultimo, quantidade: 1 }], []));
    expect(await estoque(ultimo)).toBe(0);
  });

  it("T10 — cancelar a venda de troca devolve também o crédito de troca (OPEN-006)", async () => {
    const kit = await item("Kit", { precoAtual: 100 });
    const outro = await item("Outro", { precoAtual: 80 });
    const vendaId = await vender([{ itemId: kit, quantidade: 1 }], [{ forma: "PIX", valor: 100 }]);
    const r = ok(await trocar(vendaId, [{ itemId: outro, quantidade: 1 }], []));
    expect(await saldoCaixa()).toBe(8000);
    expect((await deps().vendas.previaDoCancelamento(r.trocaId!)).recebidoCentavos).toBe(8000);
    expect(ok(await cancelar(r.trocaId!))).toMatchObject({ reembolsoCentavos: 8000 });
    expect(await saldoCaixa()).toBe(0);
    expect([await estoque(kit), await estoque(outro)]).toEqual([10, 10]);
  });
});

describe("concorrência e números", () => {
  it("T08/CA-08 — dois cancelamentos simultâneos: um só; a mesma troca duas vezes: uma venda (INV-006)", async () => {
    const kit = await item("Kit", { precoAtual: 100 });
    const a = await vender([{ itemId: kit, quantidade: 1 }], [{ forma: "PIX", valor: 100 }]);
    const rs = await Promise.all([cancelar(a), cancelar(a)]);
    expect(rs.filter((r) => r.status === "cancelada")).toHaveLength(1);
    expect(rs.find((r) => r.status === "erro")).toEqual({ status: "erro", mensagem: F.jaCancelada });
    expect([await estoque(kit), await base.lancamentoFinanceiro.count({ where: { tipo: "SAIDA" } })]).toEqual([10, 1]);

    const b = await vender([{ itemId: kit, quantidade: 1 }], [{ forma: "PIX", valor: 100 }]);
    const idTroca = randomUUID();
    const ts = await Promise.all([1, 2, 3].map(() => trocar(b, [{ itemId: kit, quantidade: 1 }], [], {}, idTroca)));
    const trocas = ts.map((t) => (t.status === "cancelada" ? t.trocaId : JSON.stringify(t)));
    expect(new Set(trocas)).toEqual(new Set([idTroca]));
    expect(await base.venda.count({ where: { vendaOrigemId: b } })).toBe(1);
  });

  it("T09/CA-09 — canceladas fora do histórico, do RBT12 e do CMV% (INV-007)", async () => {
    const kit = await item("Kit", { precoAtual: 100 });
    const a = await vender([{ itemId: kit, quantidade: 1 }], [{ forma: "PIX", valor: 100 }]);
    await vender([{ itemId: kit, quantidade: 1 }], [{ forma: "PIX", valor: 100 }]);
    ok(await cancelar(a));
    const dia = intervaloDaCompetencia(MES);
    expect((await deps().vendas.listar(dia.inicio, dia.fim)).totalConcluidas).toBe(100);
    // Venda do mês anterior cancelada: some do RBT12 e do custo vendido.
    const anterior = new Date(intervaloDaCompetencia(somarMeses(MES, -1)).inicio.getTime() + 15 * 86_400_000);
    const antiga = await base.venda.create({ data: { negocioId: negocioA, data: anterior, valorTotal: 500, numero: 99, registradaPorId: usuario } });
    await base.itemVenda.create({ data: { negocioId: negocioA, vendaId: antiga.id, itemId: kit, quantidade: 1, precoUnitario: 500, custoUnitario: 200 } });
    const prec = criarConsultasDePrecificacao(cliente(), negocioA);
    expect((await prec.historico(MES)).porCompetencia[somarMeses(MES, -1)]).toBe(50000);
    ok(await cancelar(antiga.id));
    expect(await prec.historico(MES)).toMatchObject({ porCompetencia: {}, custoVendidoCentavos: 0 });
  });

  it("T12 — cancelar uma venda de 20 linhas com materiais em menos de 2 s (RNF06)", async () => {
    const material = await item("Material", { quantidadeEstoque: 1000 });
    const linhas: Linha[] = [];
    for (let i = 0; i < 20; i++) {
      const s = await item(`Serviço ${i}`, { tipo: "SERVICO", precoAtual: 10, quantidadeEstoque: 0 });
      await base.materialServico.create({ data: { negocioId: negocioA, servicoId: s, materialId: material, quantidade: 1 } });
      linhas.push({ itemId: s, quantidade: 1 });
    }
    const vendaId = await vender(linhas, [{ forma: "DINHEIRO", valor: 200 }]);
    const t = performance.now();
    ok(await cancelar(vendaId, { formaReembolso: "DINHEIRO" }));
    expect(performance.now() - t).toBeLessThan(2000);
    expect(await estoque(material)).toBe(1000);
  });
});
