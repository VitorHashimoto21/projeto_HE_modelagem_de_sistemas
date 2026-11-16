import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDoDashboard } from "@/lib/db/dashboard";
import { criarConsultasFinanceiras } from "@/lib/db/financeiro";
import { criarConsultasDeFornecedores } from "@/lib/db/fornecedores";
import { criarConsultasDeVendas } from "@/lib/db/vendas";
import { criarConsultasDeRelatorios } from "@/lib/db/relatorios";
import { hoje as hojeLocal } from "@/lib/dominio/datas";
import { competenciaDoDia } from "@/lib/dominio/financeiro";
import * as servicos from "@/lib/financeiro/servicos";
import { MENSAGENS_FLUXO_FINANCEIRO as F } from "@/lib/financeiro/servicos";
import * as vendas from "@/lib/vendas/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-028 — etapa 1: pagamento com desconto e acréscimo no banco real (T02 e T09, parte); etapa 2: taxa
// sugerida, recebimento automático com a taxa e estorno do pagamento (T03, T04, T07); etapa 3: totais da
// lista e relatório de Contas (T05, T06).

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();
const MES = competenciaDoDia(HOJE);

let usuario: string;
let negocioA: string;
let negocioB: string;

const cliente = (negocioId = negocioA) => comNegocio(base, { negocioId, usuarioId: usuario });
const fin = (negocioId = negocioA) => criarConsultasFinanceiras(cliente(negocioId), negocioId);
const deps = (negocioId = negocioA): servicos.DependenciasDoFinanceiro => ({ financeiro: fin(negocioId), usuarioId: usuario, hoje: HOJE, agora: new Date() });
const saldoAtual = async () => (await fin().fluxo({ mes: MES }, HOJE)).saldoAtualCentavos;
const salvo = (r: servicos.EstadoDoFinanceiro) => {
  if (r.status !== "salvo") throw new Error(`esperava salvo: ${JSON.stringify(r)}`);
  return r.id!;
};
const conta = (tipo: "PAGAR" | "RECEBER", valor: string, extra: Record<string, string> = {}) =>
  servicos.criarConta({ tipo, descricao: `Conta ${valor}`, categoria: tipo === "PAGAR" ? "FORNECEDORES" : "VENDAS", valor, vencimento: HOJE, ...extra }, deps()).then(salvo);
const pagar = (contaId: string, campos: Record<string, string>, negocioId = negocioA) =>
  servicos.registrarPagamento(contaId, { data: HOJE, forma: "PIX", ...campos }, deps(negocioId));

const depsDaVenda = () => ({ vendas: criarConsultasDeVendas(cliente(), negocioA), usuarioId: usuario, hoje: HOJE, agora: new Date() });

/** Venda de R$ {valor} no cartão de crédito à vista: uma conta a receber de venda (parcela). */
async function vendaNoCartao(valor: number) {
  const item = await base.item.create({
    data: { negocioId: negocioA, tipo: "SERVICO", nome: `Serviço ${randomUUID()}`, nomeChave: randomUUID(), categoria: "BELEZA", unidadeMedida: "un", custoBase: 1, precoAtual: valor },
  });
  const r = await vendas.registrarVenda(
    { carrinho: JSON.stringify({ id: randomUUID(), linhas: [{ itemId: item.id, quantidade: 1 }], pagamentos: [{ forma: "CREDITO", valor, parcelas: 1 }] }) },
    depsDaVenda(),
  );
  if (r.status !== "registrada") throw new Error(JSON.stringify(r));
  const conta = await base.contaPagarReceber.findFirstOrThrow({ where: { parcela: { pagamento: { vendaId: r.vendaId } } } });
  return { vendaId: r.vendaId, contaId: conta.id };
}
const vencerOntem = (contaId: string) => base.contaPagarReceber.update({ where: { id: contaId }, data: { vencimento: new Date(Date.now() - 86_400_000) } });
const taxaDe = (taxa: number) => base.negocio.update({ where: { id: negocioA }, data: { taxaCartaoMedia: taxa } });
const lancamentosDa = (contaId: string) => base.lancamentoFinanceiro.findMany({ where: { contaId }, orderBy: { data: "asc" } });

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Gisele", email: "gisele@exemplo.com" } })).id;
  negocioA = (await base.negocio.create({ data: { nome: "Studio A" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Studio B" } })).id;
  await base.membroNegocio.create({ data: { negocioId: negocioA, usuarioId: usuario, papel: "DONO" } });
});

afterAll(async () => {
  await base.$disconnect();
});

describe("T02 — pagamento com desconto e acréscimo no banco", () => {
  it("recebimento com a taxa da maquininha quita a conta, e o caixa recebe o valor real (CA-01, INV-001, INV-002)", async () => {
    const id = await conta("RECEBER", "200");
    expect(await pagar(id, { valor: "194", forma: "CREDITO", desconto: "6", motivoDesconto: "TAXA_MAQUININHA" })).toEqual({
      status: "salvo",
      mensagem: F.pago(true, true, 0),
      id,
    });
    const c = await fin().detalharConta(id, HOJE);
    expect(c).toMatchObject({ status: "QUITADA", totalCentavos: 20000, pagoCentavos: 19400, descontoCentavos: 600, acrescimoCentavos: 0, restanteCentavos: 0, atrasada: false });
    expect(c.lancamentos).toEqual([
      expect.objectContaining({ valorCentavos: 19400, forma: "CREDITO", descontoCentavos: 600, acrescimoCentavos: 0, motivoDesconto: "TAXA_MAQUININHA", motivoAcrescimo: null, observacao: null }),
    ]);
    expect(await saldoAtual()).toBe(19400);
    // INV-002: a soma dos lançamentos da conta é o pago (dinheiro), sem o desconto.
    expect(c.lancamentos.reduce((s, l) => s + l.valorCentavos, 0)).toBe(c.pagoCentavos);
  });

  it("valor exato da maquininha (CA-02)", async () => {
    const id = await conta("RECEBER", "200");
    salvo(await pagar(id, { valor: "193,80", forma: "CREDITO", desconto: "6,20", motivoDesconto: "TAXA_MAQUININHA" }));
    expect(await fin().detalharConta(id, HOJE)).toMatchObject({ status: "QUITADA", pagoCentavos: 19380, descontoCentavos: 620, restanteCentavos: 0 });
  });

  it("boleto pago com juros: sem acréscimo é recusado; com acréscimo, quita (CA-04)", async () => {
    const id = await conta("PAGAR", "100");
    expect(await pagar(id, { valor: "102,50", forma: "BOLETO" })).toEqual({ status: "erro", erros: { valor: F.acimaDoRestante(10000, false) } });
    expect(await base.lancamentoFinanceiro.count({ where: { contaId: id } })).toBe(0);
    salvo(await pagar(id, { valor: "102,50", forma: "BOLETO", acrescimo: "2,50", motivoAcrescimo: "JUROS_MULTA" }));
    expect(await fin().detalharConta(id, HOJE)).toMatchObject({ status: "QUITADA", pagoCentavos: 10250, acrescimoCentavos: 250, restanteCentavos: 0 });
    expect(await saldoAtual()).toBe(-10250);
  });

  it("desconto combinado num pagamento parcial; totais, Painel e fornecedor pelo restante (CA-05, CA-11)", async () => {
    const fornecedor = await base.fornecedor.create({ data: { negocioId: negocioA, tipo: "PESSOA_JURIDICA", nome: "Embalagens Exemplo" } });
    const id = await conta("PAGAR", "300", { pessoa: fornecedor.id });
    expect(await pagar(id, { valor: "150", desconto: "30", motivoDesconto: "DESCONTO_COMBINADO" })).toEqual({ status: "salvo", mensagem: F.pago(false, false, 12000), id });
    expect(await fin().detalharConta(id, HOJE)).toMatchObject({ status: "PARCIAL", pagoCentavos: 15000, descontoCentavos: 3000, restanteCentavos: 12000 });

    const lista = await fin().listarContas({ tipo: "PAGAR", situacao: "abertas" }, HOJE);
    expect(lista.totais).toMatchObject({ quantidade: 1, totalCentavos: 30000, pagoCentavos: 15000, emAbertoCentavos: 12000 });
    expect(lista.contas[0]).toMatchObject({ restanteCentavos: 12000, descontoCentavos: 3000 });

    const projecao = await criarConsultasDoDashboard(cliente(), negocioA).insumosDaProjecao(HOJE);
    expect(projecao.contas.reduce((s, c) => s + c.restanteCentavos, 0)).toBe(12000);

    const detalhe = await criarConsultasDeFornecedores(cliente(), negocioA, "completa").detalhar(fornecedor.id, HOJE);
    expect([detalhe.pagoCentavos, detalhe.emAbertoCentavos]).toEqual([15000, 12000]);

    // Acima do restante com acréscimo: a mensagem cita os três valores.
    expect(await pagar(id, { valor: "125", acrescimo: "2", motivoAcrescimo: "JUROS_MULTA" })).toEqual({ status: "erro", erros: { valor: F.acimaDoRestante(12000, true) } });
    salvo(await pagar(id, { valor: "120" }));
    expect(await fin().detalharConta(id, HOJE)).toMatchObject({ status: "QUITADA", restanteCentavos: 0 });
  });

  it("observação com o motivo Outro fica no pagamento (CA-06)", async () => {
    const id = await conta("RECEBER", "50");
    expect(await pagar(id, { valor: "49", desconto: "1", motivoDesconto: "OUTRO" })).toEqual({ status: "erro", erros: { observacao: "Descreva o motivo." } });
    salvo(await pagar(id, { valor: "49", desconto: "1", motivoDesconto: "OUTRO", observacao: "Arredondamento" }));
    const [l] = (await fin().detalharConta(id, HOJE)).lancamentos;
    expect(l).toMatchObject({ motivoDesconto: "OUTRO", observacao: "Arredondamento" });
  });

  it("pagamentos simultâneos com desconto nunca passam do restante (INV-003)", async () => {
    const id = await conta("PAGAR", "120");
    const rs = await Promise.all([1, 2].map(() => pagar(id, { valor: "100", desconto: "20", motivoDesconto: "DESCONTO_COMBINADO" })));
    expect(rs.filter((r) => r.status === "salvo")).toHaveLength(1);
    expect(await fin().detalharConta(id, HOJE)).toMatchObject({ status: "QUITADA", pagoCentavos: 10000, descontoCentavos: 2000, restanteCentavos: 0 });
  });

  it("o outro negócio não paga a conta (INV-008)", async () => {
    const id = await conta("PAGAR", "100");
    expect(await pagar(id, { valor: "90", desconto: "10", motivoDesconto: "DESCONTO_COMBINADO" }, negocioB)).toEqual({ status: "erro", mensagem: F.contaNaoEncontrada });
  });
});

describe("T09 — o banco recusa desconto e acréscimo fora das regras (INV-001, INV-004)", () => {
  const lancamento = (contaId: string | null, extra: Record<string, unknown>) =>
    base.lancamentoFinanceiro.create({
      data: { negocioId: negocioA, contaId, tipo: "SAIDA", categoria: "FORNECEDORES", valor: 10, origem: contaId ? "CONTA" : "AVULSO", ...extra },
    });

  it("motivo, observação e valores", async () => {
    const id = await conta("PAGAR", "100");
    await expect(lancamento(id, { desconto: 1 })).rejects.toThrow(/motivo_do_desconto/);
    await expect(lancamento(id, { motivoDesconto: "TAXA_MAQUININHA" })).rejects.toThrow(/motivo_do_desconto/);
    await expect(lancamento(id, { acrescimo: 1 })).rejects.toThrow(/motivo_do_acrescimo/);
    await expect(lancamento(id, { desconto: 1, motivoDesconto: "OUTRO" })).rejects.toThrow(/observacao_do_pagamento/);
    await expect(lancamento(id, { observacaoPagamento: "  " })).rejects.toThrow(/observacao_do_pagamento/);
    await expect(lancamento(id, { desconto: -1, motivoDesconto: "TAXA_MAQUININHA" })).rejects.toThrow(/desconto_acrescimo_validos/);
    await expect(lancamento(id, { acrescimo: 10, motivoAcrescimo: "JUROS_MULTA" })).rejects.toThrow(/desconto_acrescimo_validos/);
    await expect(lancamento(null, { desconto: 1, motivoDesconto: "TAXA_MAQUININHA" })).rejects.toThrow(/ajuste_so_de_conta/);
    await expect(lancamento(id, { desconto: 1, motivoDesconto: "OUTRO", observacaoPagamento: "Ok" })).resolves.toBeTruthy();
  });

  it("a conta nunca abate mais que o total nem fica negativa", async () => {
    const id = await conta("PAGAR", "100");
    await expect(base.contaPagarReceber.update({ where: { id }, data: { valorPago: 95, valorDesconto: 6 } })).rejects.toThrow(/valores_validos/);
    await expect(base.contaPagarReceber.update({ where: { id }, data: { valorAcrescimo: 1 } })).rejects.toThrow(/valores_validos/);
    await expect(base.contaPagarReceber.update({ where: { id }, data: { valorPago: 102.5, valorAcrescimo: 2.5 } })).resolves.toBeTruthy();
  });
});

describe("T03 — taxa sugerida e recebimento automático com a taxa (CA-01, CA-03, CA-08, INV-005)", () => {
  it("a conta de venda no cartão sugere a taxa; as outras não", async () => {
    await taxaDe(3);
    const { contaId } = await vendaNoCartao(200);
    expect((await fin().detalharConta(contaId, HOJE)).taxaSugerida).toEqual({ taxa: 3, descontoCentavos: 600 });
    expect((await fin().detalharConta(await conta("RECEBER", "200"), HOJE)).taxaSugerida).toBeNull();
    await taxaDe(0);
    expect((await fin().detalharConta(contaId, HOJE)).taxaSugerida).toBeNull();
  });

  it("no vencimento, a parcela é recebida com o desconto da taxa (CA-03)", async () => {
    await taxaDe(3);
    const { contaId } = await vendaNoCartao(200);
    await vencerOntem(contaId);
    expect((await fin().conferir(HOJE)).parcelasRecebidas).toBe(1);
    const c = await fin().detalharConta(contaId, HOJE);
    expect(c).toMatchObject({ status: "QUITADA", pagoCentavos: 19400, descontoCentavos: 600, restanteCentavos: 0, taxaSugerida: null });
    expect(c.lancamentos).toEqual([expect.objectContaining({ valorCentavos: 19400, forma: "CREDITO", registradoPor: null, descontoCentavos: 600, motivoDesconto: "TAXA_MAQUININHA" })]);
  });

  it("sem taxa informada, o recebimento automático é pelo valor cheio, como antes", async () => {
    const { contaId } = await vendaNoCartao(200);
    await vencerOntem(contaId);
    await fin().conferir(HOJE);
    expect(await fin().detalharConta(contaId, HOJE)).toMatchObject({ status: "QUITADA", pagoCentavos: 20000, descontoCentavos: 0 });
  });

  it("a conta com pagamento estornado sai do recebimento automático (CA-08)", async () => {
    await taxaDe(3);
    const { contaId } = await vendaNoCartao(200);
    salvo(await pagar(contaId, { valor: "100", forma: "CREDITO" }));
    const [l] = await lancamentosDa(contaId);
    salvo(await servicos.estornar(l.id, deps()));
    await vencerOntem(contaId);
    expect((await fin().conferir(HOJE)).parcelasRecebidas).toBe(0);
    expect(await fin().detalharConta(contaId, HOJE)).toMatchObject({ status: "ABERTA", restanteCentavos: 20000 });
    salvo(await pagar(contaId, { valor: "193,80", forma: "CREDITO", desconto: "6,20", motivoDesconto: "TAXA_MAQUININHA" }));
    expect(await fin().detalharConta(contaId, HOJE)).toMatchObject({ status: "QUITADA", restanteCentavos: 0 });
  });
});

describe("T04 — estorno do pagamento de conta (CA-07, CA-09, CA-12, INV-001, INV-006)", () => {
  it("estorna o pagamento com desconto: lançamento contrário, conta reaberta, nada apagado (CA-07)", async () => {
    const id = await conta("PAGAR", "300");
    salvo(await pagar(id, { valor: "150", desconto: "30", motivoDesconto: "DESCONTO_COMBINADO" }));
    const [pagamento] = await lancamentosDa(id);
    expect(await saldoAtual()).toBe(-15000);

    expect(await servicos.estornar(pagamento.id, deps())).toEqual({ status: "salvo", mensagem: F.pagamentoEstornado(true), id });
    expect(await fin().detalharConta(id, HOJE)).toMatchObject({ status: "ABERTA", pagoCentavos: 0, descontoCentavos: 0, restanteCentavos: 30000 });
    expect(await saldoAtual()).toBe(0);
    const [original, estorno] = await lancamentosDa(id);
    expect(original.id).toBe(pagamento.id);
    expect(estorno).toMatchObject({ origem: "ESTORNO", tipo: "ENTRADA", contaId: id, estornoDeId: pagamento.id, usuarioId: usuario, formaPagamento: null });
    expect(Number(estorno.valor)).toBe(150);

    // O detalhe mostra só o pagamento, marcado como estornado.
    const c = await fin().detalharConta(id, HOJE);
    expect(c.lancamentos).toEqual([expect.objectContaining({ id: pagamento.id, valorCentavos: 15000, estorno: expect.objectContaining({ registradoPor: "Gisele" }) })]);

    // Um segundo estorno do mesmo pagamento é recusado.
    expect(await servicos.estornar(pagamento.id, deps())).toEqual({ status: "erro", mensagem: F.jaEstornado });

    // A conta manual sem pagamento válido volta a ser editável e cancelável (5.5, item 6).
    salvo(await servicos.editarConta(id, { tipo: "PAGAR", descricao: "Conta corrigida", categoria: "FORNECEDORES", valor: "280", vencimento: HOJE }, deps()));
    salvo(await servicos.cancelarConta(id, deps()));
  });

  it("o estorno tem a data do pagamento original e guarda quando foi feito (etapa 4, OPEN-009)", async () => {
    // O caso da homologação: recebido dias antes e estornado hoje.
    const antes = new Date(Date.parse(`${HOJE}T12:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
    const id = await conta("RECEBER", "200");
    salvo(await pagar(id, { valor: "194", data: antes, forma: "CREDITO" }));
    const [original] = await lancamentosDa(id);
    const agora = new Date();
    salvo(await servicos.estornar(original.id, { ...deps(), agora }));

    const [, estorno] = await lancamentosDa(id);
    expect(estorno.origem).toBe("ESTORNO");
    expect(estorno.data.getTime()).toBe(original.data.getTime());
    expect(estorno.registradoEm?.getTime()).toBe(agora.getTime());
    // O pagamento foi registrado agora pelo banco; o detalhe e o relatório dizem quando o estorno foi feito.
    expect(original.registradoEm).toBeInstanceOf(Date);
    const c = await fin().detalharConta(id, HOJE);
    expect(c.lancamentos[0].estorno?.data.getTime()).toBe(agora.getTime());
    const [exportada] = await criarConsultasDeRelatorios(cliente(), negocioA).contas(antes, HOJE);
    expect(exportada.pagamentos[0].estornadoEm?.getTime()).toBe(agora.getTime());
  });

  it("com dois pagamentos, estornar um deixa a conta parcial", async () => {
    const id = await conta("PAGAR", "100");
    salvo(await pagar(id, { valor: "40" }));
    salvo(await pagar(id, { valor: "62,50", acrescimo: "2,50", motivoAcrescimo: "JUROS_MULTA" }));
    expect(await fin().detalharConta(id, HOJE)).toMatchObject({ status: "QUITADA" });
    const [, segundo] = await lancamentosDa(id);
    expect(await servicos.estornar(segundo.id, deps())).toEqual({ status: "salvo", mensagem: F.pagamentoEstornado(false), id });
    expect(await fin().detalharConta(id, HOJE)).toMatchObject({ status: "PARCIAL", pagoCentavos: 4000, acrescimoCentavos: 0, restanteCentavos: 6000 });
  });

  it("estornos simultâneos do mesmo pagamento: só um vale (INV-006)", async () => {
    const id = await conta("RECEBER", "200");
    salvo(await pagar(id, { valor: "194", desconto: "6", motivoDesconto: "TAXA_MAQUININHA" }));
    const [l] = await lancamentosDa(id);
    const rs = await Promise.all([1, 2].map(() => servicos.estornar(l.id, deps())));
    expect(rs.filter((r) => r.status === "salvo")).toHaveLength(1);
    expect(rs.find((r) => r.status === "erro")).toEqual({ status: "erro", mensagem: F.jaEstornado });
    expect(await fin().detalharConta(id, HOJE)).toMatchObject({ status: "ABERTA", pagoCentavos: 0, descontoCentavos: 0 });
    expect(await saldoAtual()).toBe(0);
  });

  it("conta antiga parcial por causa da taxa: estornar e receber de novo com o desconto (CA-09)", async () => {
    const id = await conta("RECEBER", "200");
    salvo(await pagar(id, { valor: "194" }));
    expect(await fin().detalharConta(id, HOJE)).toMatchObject({ status: "PARCIAL", restanteCentavos: 600 });
    const [l] = await lancamentosDa(id);
    salvo(await servicos.estornar(l.id, deps()));
    salvo(await pagar(id, { valor: "194", desconto: "6", motivoDesconto: "TAXA_MAQUININHA" }));
    expect(await fin().detalharConta(id, HOJE)).toMatchObject({ status: "QUITADA", pagoCentavos: 19400, restanteCentavos: 0 });
    expect(await saldoAtual()).toBe(19400);
  });

  it("venda cancelada: o pagamento da conta não é estornado (CA-12)", async () => {
    const { vendaId, contaId } = await vendaNoCartao(200);
    salvo(await pagar(contaId, { valor: "194", forma: "CREDITO", desconto: "6", motivoDesconto: "TAXA_MAQUININHA" }));
    const r = await vendas.cancelarVenda(vendaId, { motivo: "ERRO_REGISTRO", formaReembolso: "ESTORNO_CARTAO" }, depsDaVenda());
    expect(r.status).toBe("cancelada");
    // O reembolso é do valor recebido, sem o desconto.
    const reembolso = await base.lancamentoFinanceiro.findFirstOrThrow({ where: { vendaId, estorno: true } });
    expect(Number(reembolso.valor)).toBe(194);
    const [l] = await lancamentosDa(contaId);
    expect(await servicos.estornar(l.id, deps())).toEqual({ status: "erro", mensagem: F.estornoNaoPermitido });
    expect((await fin().detalharConta(contaId, HOJE)).estornavel).toBe(false);
  });

  it("o pagamento estornado sai dos filtros de forma e de data do pagamento (5.5, item 7)", async () => {
    const id = await conta("PAGAR", "100");
    salvo(await pagar(id, { valor: "100", forma: "BOLETO" }));
    const filtro = { busca: null, vencimentoDe: null, vencimentoAte: null, pagamentoDe: HOJE, pagamentoAte: HOJE, pessoaId: null, forma: "BOLETO" as const, categoria: null, origem: null };
    let lista = await fin().listarContas({ tipo: "PAGAR", situacao: "todas", filtros: filtro }, HOJE);
    expect([lista.contas.length, lista.totais.pagoCentavos]).toEqual([1, 10000]);
    const [l] = await lancamentosDa(id);
    salvo(await servicos.estornar(l.id, deps()));
    lista = await fin().listarContas({ tipo: "PAGAR", situacao: "todas", filtros: filtro }, HOJE);
    expect([lista.contas.length, lista.totais.pagoCentavos]).toEqual([0, 0]);
    const semForma = { ...filtro, forma: null };
    lista = await fin().listarContas({ tipo: "PAGAR", situacao: "todas", filtros: semForma }, HOJE);
    expect([lista.contas.length, lista.totais.pagoCentavos]).toEqual([0, 0]);
  });

  it("o outro negócio não estorna o pagamento (INV-008)", async () => {
    const id = await conta("PAGAR", "100");
    salvo(await pagar(id, { valor: "100" }));
    const [l] = await lancamentosDa(id);
    expect(await servicos.estornar(l.id, deps(negocioB))).toEqual({ status: "erro", mensagem: F.lancamentoNaoEncontrado });
    expect(await fin().detalharConta(id, HOJE)).toMatchObject({ status: "QUITADA" });
  });
});

describe("T05 e T06 — totais da lista e relatório de Contas (CA-10, INV-007 da SPEC-026)", () => {
  async function cenario() {
    const receber = await conta("RECEBER", "200");
    salvo(await pagar(receber, { valor: "194", forma: "CREDITO", desconto: "6", motivoDesconto: "TAXA_MAQUININHA" }));
    const boleto = await conta("PAGAR", "100");
    salvo(await pagar(boleto, { valor: "40", forma: "PIX" }));
    const [errado] = await lancamentosDa(boleto);
    salvo(await servicos.estornar(errado.id, deps()));
    salvo(await pagar(boleto, { valor: "102,50", forma: "BOLETO", acrescimo: "2,50", motivoAcrescimo: "JUROS_MULTA" }));
    const parcial = await conta("PAGAR", "300");
    salvo(await pagar(parcial, { valor: "150", forma: "PIX", desconto: "30", motivoDesconto: "DESCONTO_COMBINADO" }));
    return { receber, boleto, parcial };
  }

  it("os totais somam descontos e acréscimos; com filtro de pagamento, só os pagamentos do filtro (CA-10)", async () => {
    await cenario();
    const aReceber = await fin().listarContas({ tipo: "RECEBER", situacao: "todas" }, HOJE);
    expect(aReceber.totais).toEqual({ quantidade: 1, totalCentavos: 20000, pagoCentavos: 19400, descontoCentavos: 600, acrescimoCentavos: 0, emAbertoCentavos: 0 });
    const aPagar = await fin().listarContas({ tipo: "PAGAR", situacao: "todas" }, HOJE);
    expect(aPagar.totais).toEqual({ quantidade: 2, totalCentavos: 40000, pagoCentavos: 25250, descontoCentavos: 3000, acrescimoCentavos: 250, emAbertoCentavos: 12000 });

    // Filtro de forma: só o pagamento por boleto (o Pix estornado e o Pix da conta parcial ficam de fora do Boleto).
    const filtro = { busca: null, vencimentoDe: null, vencimentoAte: null, pagamentoDe: null, pagamentoAte: null, pessoaId: null, forma: "BOLETO" as const, categoria: null, origem: null };
    const soBoleto = await fin().listarContas({ tipo: "PAGAR", situacao: "todas", filtros: filtro }, HOJE);
    expect(soBoleto.totais).toMatchObject({ quantidade: 1, pagoCentavos: 10250, descontoCentavos: 0, acrescimoCentavos: 250 });
    const soPix = await fin().listarContas({ tipo: "PAGAR", situacao: "todas", filtros: { ...filtro, forma: "PIX" } }, HOJE);
    expect(soPix.totais).toMatchObject({ quantidade: 1, pagoCentavos: 15000, descontoCentavos: 3000, acrescimoCentavos: 0 });
  });

  it("o relatório traz o desconto, o acréscimo e o motivo de cada pagamento, com o estorno marcado (CA-10)", async () => {
    const { receber, boleto } = await cenario();
    const ontem = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const lista = await criarConsultasDeRelatorios(cliente(), negocioA).contas(ontem, amanha);
    const r = lista.find((c) => c.descricao === "Conta 200")!;
    expect(r).toMatchObject({ descontoCentavos: 600, acrescimoCentavos: 0, pagamentos: [expect.objectContaining({ valorCentavos: 19400, descontoCentavos: 600, motivoDesconto: "TAXA_MAQUININHA", estornadoEm: null })] });
    const b = lista.find((c) => c.descricao === "Conta 100")!;
    expect(b.pagamentos).toEqual([
      expect.objectContaining({ forma: "PIX", valorCentavos: 4000, estornadoEm: expect.any(Date) }),
      expect.objectContaining({ forma: "BOLETO", valorCentavos: 10250, acrescimoCentavos: 250, motivoAcrescimo: "JUROS_MULTA", estornadoEm: null }),
    ]);
    expect([receber, boleto]).toHaveLength(2);
  });
});
