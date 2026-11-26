import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { NegocioDivergente } from "@/lib/db/erros";
import { ContaNaoEditavel, criarConsultasFinanceiras } from "@/lib/db/financeiro";
import { SEM_FILTROS } from "@/lib/dominio/contas";
import { hoje as hojeLocal } from "@/lib/dominio/datas";
import * as financeiro from "@/lib/financeiro/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-027 (etapa 1a) — testes de integração do banco das compras: T04 (INV-004, INV-010, INV-011 na
// gravação direta) e as contas da compra no Financeiro (5.7), com banco real, o cliente do negócio
// (SPEC-001) e a migração 20261122120000_compras. A gravação pela compra entra na etapa 1b.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();

let usuario: string;
let negocioA: string;
let negocioB: string;
let fornecedor: string;
let embalagemP: string;
let embalagemG: string;

const cliente = (negocioId = negocioA) => comNegocio(base, { negocioId, usuarioId: usuario });
const fin = (negocioId = negocioA) => criarConsultasFinanceiras(cliente(negocioId), negocioId);
const depsFin = (): financeiro.DependenciasDoFinanceiro => ({ financeiro: fin(), usuarioId: usuario, hoje: HOJE, agora: new Date() });

async function produto(nome: string, custo: number, saldo: number, negocioId = negocioA, extra: { tipo?: "SERVICO"; precoAtual?: number } = {}) {
  const i = await base.item.create({
    data: {
      negocioId,
      tipo: extra.tipo ?? "PRODUTO_FISICO",
      nome,
      nomeChave: nome.toLowerCase(),
      categoria: "PRODUTOS",
      unidadeMedida: "un",
      custoBase: custo,
      quantidadeEstoque: saldo,
      precoAtual: extra.precoAtual ?? null,
    },
  });
  await base.historicoCusto.create({ data: { negocioId, itemId: i.id, custo, vigenteDesde: new Date(Date.now() - 86_400_000) } });
  return i.id;
}

const contasDa = (compraId: string) =>
  base.contaPagarReceber.findMany({ where: { compraId }, orderBy: { vencimento: "asc" }, select: { tipo: true, categoria: true, descricao: true, valorTotal: true, vencimento: true, status: true, fornecedorId: true, numeroDocumento: true, valorPago: true } });

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Gisele", email: "gisele@exemplo.com", consentimentoLgpdEm: new Date(), versaoTermosAceita: "2026-11-01" } })).id;
  negocioA = (await base.negocio.create({ data: { nome: "Loja A" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Loja B" } })).id;
  await base.membroNegocio.create({ data: { negocioId: negocioA, usuarioId: usuario, papel: "DONO" } });
  fornecedor = (await base.fornecedor.create({ data: { negocioId: negocioA, tipo: "PESSOA_JURIDICA", nome: "Embalagens Exemplo Ltda" } })).id;
  embalagemP = await produto("Embalagem P", 1, 20);
  embalagemG = await produto("Embalagem G", 2, 0);
});

afterAll(async () => {
  await base.$disconnect();
});

/** Compra gravada direto no banco, sem a gravação da etapa 1b. */
async function compraDireta(extra: Record<string, unknown> = {}) {
  return base.compra.create({
    data: {
      negocioId: negocioA,
      numero: 99,
      fornecedorId: fornecedor,
      numeroDocumento: "D-1",
      documentoChave: "D-1",
      data: new Date(`${HOJE}T00:00:00Z`),
      valorProdutos: 10,
      total: 10,
      condicao: "A_VISTA",
      registradaPorId: usuario,
      ...extra,
    },
  });
}

describe("T04 — o banco recusa a gravação direta fora das regras (INV-004, INV-010)", () => {
  const itemDireto = (compraId: string, itemId: string, negocioId = negocioA) =>
    base.itemCompra.create({ data: { negocioId, compraId, itemId, quantidade: 1, custoUnitario: 10, totalLinha: 10, custoComRateio: 10, escolhaCusto: "ATUAL", custoAnterior: 1, custoNovo: 1 } });

  it("fornecedor e produto de outro negócio; serviço e produto arquivado", async () => {
    const fornecedorB = (await base.fornecedor.create({ data: { negocioId: negocioB, tipo: "PESSOA_FISICA", nome: "Outro" } })).id;
    await expect(compraDireta({ fornecedorId: fornecedorB })).rejects.toThrow(/he_negocio_divergente/);
    const c = await compraDireta();
    await expect(itemDireto(c.id, await produto("Embalagem B", 1, 0, negocioB))).rejects.toThrow(/he_negocio_divergente/);
    await expect(itemDireto(c.id, await produto("Corte", 1, 0, negocioA, { tipo: "SERVICO" }))).rejects.toThrow(/he_produto_da_compra/);
    await base.item.update({ where: { id: embalagemG }, data: { arquivadoEm: new Date(), nomeChave: null } });
    await expect(itemDireto(c.id, embalagemG)).rejects.toThrow(/he_produto_da_compra/);
    await expect(itemDireto(c.id, embalagemP)).resolves.toBeTruthy();
    // Os produtos da compra nunca mudam; a compra nunca é apagada.
    await expect(base.$executeRawUnsafe(`UPDATE "ItemCompra" SET quantidade = 2`)).rejects.toThrow(/he_somente_insercao/);
    await expect(base.$executeRawUnsafe(`DELETE FROM "ItemCompra"`)).rejects.toThrow(/he_somente_insercao/);
    await expect(base.$executeRawUnsafe(`DELETE FROM "Compra"`)).rejects.toThrow(/he_somente_insercao/);
    await expect(base.compra.update({ where: { id: c.id }, data: { negocioId: negocioB } })).rejects.toThrow(/he_negocio_imutavel|he_negocio_divergente/);
    // Pelo cliente do negócio B, a compra de A não existe.
    expect(await cliente(negocioB).compra.findFirst({ where: { id: c.id } })).toBeNull();
    await expect(cliente(negocioB).itemCompra.create({ data: { negocioId: negocioA, compraId: c.id, itemId: embalagemP, quantidade: 1, custoUnitario: 1, totalLinha: 1, custoComRateio: 1, escolhaCusto: "ATUAL", custoAnterior: 1, custoNovo: 1 } })).rejects.toBeInstanceOf(NegocioDivergente);
  });

  it("CHECKs: total, desconto, documento, entrada, cancelamento, ligações", async () => {
    await expect(compraDireta({ total: 11 })).rejects.toThrow(/Compra_total/);
    await expect(compraDireta({ valorProdutos: 0, total: 0, frete: 0 })).rejects.toThrow(/Compra_total/);
    await expect(compraDireta({ desconto: 11, frete: 11 })).rejects.toThrow(/Compra_desconto/);
    await expect(compraDireta({ numeroDocumento: null, documentoChave: null })).rejects.toThrow(/Compra_documento/);
    await expect(compraDireta({ semNotaFiscal: true })).rejects.toThrow(/Compra_documento/);
    await expect(compraDireta({ documentoChave: null })).rejects.toThrow(/Compra_documento_chave/);
    await expect(compraDireta({ valorEntrada: 5 })).rejects.toThrow(/Compra_entrada/);
    await expect(compraDireta({ condicao: "A_PRAZO", valorEntrada: 10 })).rejects.toThrow(/Compra_entrada/);
    await expect(compraDireta({ situacao: "CANCELADA", documentoChave: null })).rejects.toThrow(/Compra_cancelamento/);
    const c = await compraDireta();
    await expect(base.contaPagarReceber.create({ data: { negocioId: negocioA, compraId: c.id, tipo: "RECEBER", categoria: "VENDAS", valorTotal: 10, vencimento: new Date() } })).rejects.toThrow(/ContaPagarReceber_compra_a_pagar/);
    await expect(
      base.movimentacaoEstoque.create({ data: { negocioId: negocioA, itemId: embalagemP, compraId: c.id, tipo: "SAIDA_MANUAL", motivo: "PERDA", quantidade: 1, saldoAnterior: 20, saldoPosterior: 19, usuarioId: usuario } }),
    ).rejects.toThrow(/MovimentacaoEstoque_compra/);
  });
});

describe("contas da compra no Financeiro (5.7, OPEN-004)", () => {
  it("origem Compra, fora das manuais; não são editadas, canceladas nem corrigidas pelo Financeiro", async () => {
    const compra = await compraDireta({ numero: 1, numeroDocumento: "1234", documentoChave: "1234" });
    const contaId = (
      await base.contaPagarReceber.create({
        data: { negocioId: negocioA, compraId: compra.id, tipo: "PAGAR", categoria: "FORNECEDORES", descricao: "Compra nº 1 — parcela 1/1", valorTotal: 10, vencimento: new Date(), fornecedorId: fornecedor, numeroDocumento: "1234" },
      })
    ).id;
    const manual = await financeiro.criarConta({ tipo: "PAGAR", descricao: "Luz", categoria: "OUTROS", valor: "80", vencimento: HOJE }, depsFin());
    expect(manual.status).toBe("salvo");

    const listar = (origem: "manual" | "compra" | null) => fin().listarContas({ tipo: "PAGAR", situacao: "todas", filtros: { ...SEM_FILTROS, origem } }, HOJE);
    expect((await listar("compra")).contas.map((c) => [c.id, c.origem])).toEqual([[contaId, "compra"]]);
    expect((await listar("manual")).contas.map((c) => c.descricao)).toEqual(["Luz"]);
    expect((await fin().detalharConta(contaId, HOJE)).origem).toBe("compra");

    await expect(fin().cancelarConta(contaId)).rejects.toEqual(new ContaNaoEditavel("compra"));
    await expect(fin().editarConta(contaId, { tipo: "PAGAR", descricao: "x", categoria: "OUTROS", valorCentavos: 100, vencimento: HOJE })).rejects.toEqual(new ContaNaoEditavel("compra"));
    await expect(fin().corrigirVinculo(contaId, { pessoaId: null, numeroDocumento: "9999" })).rejects.toEqual(new ContaNaoEditavel("compra"));
    expect(await financeiro.cancelarConta(contaId, depsFin())).toMatchObject({ status: "erro", mensagem: financeiro.MENSAGENS_FLUXO_FINANCEIRO.contaNaoEditavel.compra });
    expect((await contasDa(compra.id))[0]).toMatchObject({ status: "ABERTA", numeroDocumento: "1234", descricao: "Compra nº 1 — parcela 1/1" });
    // O pagamento continua pelo Financeiro.
    expect(await financeiro.registrarPagamento(contaId, { valor: "10", data: HOJE, forma: "PIX" }, depsFin())).toMatchObject({ status: "salvo" });
  });
});
