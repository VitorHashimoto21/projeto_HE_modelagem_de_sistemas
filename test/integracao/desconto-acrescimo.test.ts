import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDoDashboard } from "@/lib/db/dashboard";
import { criarConsultasFinanceiras } from "@/lib/db/financeiro";
import { criarConsultasDeFornecedores } from "@/lib/db/fornecedores";
import { hoje as hojeLocal } from "@/lib/dominio/datas";
import { competenciaDoDia } from "@/lib/dominio/financeiro";
import * as servicos from "@/lib/financeiro/servicos";
import { MENSAGENS_FLUXO_FINANCEIRO as F } from "@/lib/financeiro/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-028 — etapa 1: pagamento com desconto e acréscimo no banco real (T02 e T09, parte).

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
