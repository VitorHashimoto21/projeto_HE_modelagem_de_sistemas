import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { CompraNaoEncontrada, criarConsultasDeCompras } from "@/lib/db/compras";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasFinanceiras } from "@/lib/db/financeiro";
import { FORNECEDOR_SEM_DADOS } from "@/lib/db/fornecedores";
import { validarCompra, type DadosDaCompra } from "@/lib/dominio/compras";
import { hoje as hojeLocal } from "@/lib/dominio/datas";
import { somarDias } from "@/lib/dominio/estoque";
import * as financeiro from "@/lib/financeiro/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-027 (etapa 2b) — o detalhe da compra no banco (5.6, contrato "Detalhar compra"): os dados, os
// produtos com os custos, as contas com os pagamentos, as entradas, quem registrou, o cancelamento,
// o nome mascarado no modo suporte e outro negócio fora (INV-010).

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();

let usuario: string;
let negocioA: string;
let negocioB: string;
let fornecedor: string;
let embalagemP: string;
let embalagemG: string;

const cliente = (negocioId = negocioA, suporte = false) => comNegocio(base, { negocioId, usuarioId: usuario, modoSuporte: suporte });
const compras = (negocioId = negocioA, suporte = false) => criarConsultasDeCompras(cliente(negocioId, suporte), negocioId, { mascararNomes: suporte });
const depsFin = (): financeiro.DependenciasDoFinanceiro => ({ financeiro: criarConsultasFinanceiras(cliente(), negocioA), usuarioId: usuario, hoje: HOJE, agora: new Date() });

async function produto(nome: string, custo: number, saldo: number) {
  const i = await base.item.create({
    data: { negocioId: negocioA, tipo: "PRODUTO_FISICO", nome, nomeChave: nome.toLowerCase(), categoria: "PRODUTOS", unidadeMedida: "un", custoBase: custo, quantidadeEstoque: saldo },
  });
  await base.historicoCusto.create({ data: { negocioId: negocioA, itemId: i.id, custo, vigenteDesde: new Date(Date.now() - 86_400_000) } });
  return i.id;
}

/** 100 Embalagens P a R$ 1,20 (médio) e 50 G a R$ 2,00, com frete de R$ 20 e desconto de R$ 10: R$ 230,00, entrada de R$ 30 e 2 parcelas. */
function compraComEntrada(): DadosDaCompra {
  const v = validarCompra(
    {
      id: randomUUID(),
      fornecedorId: fornecedor,
      numeroDocumento: "NF 77",
      dia: HOJE,
      observacao: "Entrega na loja",
      linhas: [
        { itemId: embalagemP, quantidade: 100, custoUnitario: 1.2 },
        { itemId: embalagemG, quantidade: 50, custoUnitario: 2, escolhaCusto: "ATUAL" },
      ],
      frete: 20,
      desconto: 10,
      condicao: "A_PRAZO",
      entrada: 30,
      parcelas: [{ vencimento: somarDias(HOJE, 30) }, { vencimento: somarDias(HOJE, 60) }],
    },
    HOJE,
  );
  if (!v.ok) throw new Error(JSON.stringify(v.erros));
  return v.dados;
}

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

describe("Detalhar compra (5.6)", () => {
  it("os dados, os produtos com os custos, as contas com os pagamentos, as entradas e quem registrou", async () => {
    const d = compraComEntrada();
    const r = await compras().registrar(d, usuario);
    const entrada = await base.contaPagarReceber.findFirstOrThrow({ where: { compraId: r.id, descricao: { contains: "entrada" } } });
    expect(await financeiro.registrarPagamento(entrada.id, { valor: "30", data: HOJE, forma: "PIX" }, depsFin())).toMatchObject({ status: "salvo" });

    const c = await compras().detalhar(r.id, HOJE);
    expect(c).toMatchObject({
      id: r.id,
      numero: 1,
      data: HOJE,
      fornecedor: { id: fornecedor, nome: "Embalagens Exemplo Ltda" },
      numeroDocumento: "NF 77",
      semNotaFiscal: false,
      observacao: "Entrega na loja",
      valorProdutosCentavos: 22000,
      freteCentavos: 2000,
      outrasDespesasCentavos: 0,
      descontoCentavos: 1000,
      totalCentavos: 23000,
      condicao: "A_PRAZO",
      entradaCentavos: 3000,
      situacao: "REGISTRADA",
      pagamento: "PARCIAL",
      registradaPor: "Gisele",
      cancelamento: null,
      pagoCentavos: 3000,
      emAbertoCentavos: 20000,
    });
    // Produtos em ordem de nome; a G manteve o custo, a P ficou com o médio.
    expect(c.produtos.map((p) => [p.nome, p.quantidade, p.custoUnitarioCentavos, p.totalLinhaCentavos, p.escolhaCusto, p.custoAnteriorCentavos, p.custoNovoCentavos === p.custoAnteriorCentavos])).toEqual([
      ["Embalagem G", 50, 200, 10000, "ATUAL", 200, true],
      ["Embalagem P", 100, 120, 12000, "MEDIO", 100, false],
    ]);
    // O frete menos o desconto (R$ 10) entra no custo com rateio, pelo valor de cada linha.
    expect(c.produtos.find((p) => p.nome === "Embalagem P")!.custoComRateioCentavos).toBeGreaterThan(120);
    // A entrada e as duas parcelas, pela data de vencimento; a entrada paga em Pix.
    expect(c.contas.map((k) => [k.descricao, k.totalCentavos, k.status, k.pagamentos.map((g) => [g.valorCentavos, g.forma, g.estornado])])).toEqual([
      ["Compra nº 1 — entrada", 3000, "QUITADA", [[3000, "PIX", false]]],
      ["Compra nº 1 — parcela 1/2", 10000, "ABERTA", []],
      ["Compra nº 1 — parcela 2/2", 10000, "ABERTA", []],
    ]);
    expect(c.contas[1]).toMatchObject({ vencimento: somarDias(HOJE, 30), atrasada: false, restanteCentavos: 10000, pagoCentavos: 0 });
    expect(c.entradas.map((m) => [m.nome, m.tipo, m.quantidade, m.saldoAnterior, m.saldoPosterior]).sort()).toEqual([
      ["Embalagem G", "ENTRADA", 50, 0, 50],
      ["Embalagem P", "ENTRADA", 100, 20, 120],
    ]);
  });

  it("a compra cancelada mostra quem cancelou, quando e o motivo, sem a situação das contas", async () => {
    const r = await compras().registrar(compraComEntrada(), usuario);
    // O cancelamento é da etapa 3; aqui, gravado direto no banco, como ele vai ficar.
    await base.contaPagarReceber.updateMany({ where: { compraId: r.id }, data: { status: "CANCELADA" } });
    await base.compra.update({ where: { id: r.id }, data: { situacao: "CANCELADA", documentoChave: null, canceladaPorId: usuario, canceladaEm: new Date(), motivoCancelamento: "Registrada em dobro" } });
    const c = await compras().detalhar(r.id, HOJE);
    expect(c).toMatchObject({ situacao: "CANCELADA", pagamento: null, cancelamento: { por: "Gisele", motivo: "Registrada em dobro" }, pagoCentavos: 0, emAbertoCentavos: 0 });
    expect(c.contas.every((k) => k.status === "CANCELADA" && k.restanteCentavos === 0)).toBe(true);
  });

  it("modo suporte: o fornecedor mascarado e sem o link do cadastro", async () => {
    const r = await compras().registrar(compraComEntrada(), usuario);
    const c = await compras(negocioA, true).detalhar(r.id, HOJE);
    expect(c.fornecedor).toEqual({ id: null, nome: "E*** E*** L***" });
  });

  it("fornecedor anonimizado: o nome do cadastro anonimizado, sem o link", async () => {
    const r = await compras().registrar(compraComEntrada(), usuario);
    await base.fornecedor.update({ where: { id: fornecedor }, data: { ...FORNECEDOR_SEM_DADOS, anonimizadoEm: new Date() } });
    expect((await compras().detalhar(r.id, HOJE)).fornecedor).toEqual({ id: null, nome: "Fornecedor anonimizado" });
  });

  it("CompraNaoEncontrada: id inválido, inexistente ou de outro negócio (INV-010)", async () => {
    const r = await compras().registrar(compraComEntrada(), usuario);
    await expect(compras().detalhar("nao-e-uuid", HOJE)).rejects.toBeInstanceOf(CompraNaoEncontrada);
    await expect(compras().detalhar(randomUUID(), HOJE)).rejects.toBeInstanceOf(CompraNaoEncontrada);
    await expect(compras(negocioB).detalhar(r.id, HOJE)).rejects.toBeInstanceOf(CompraNaoEncontrada);
  });
});
