import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { comNegocio, type ClienteDoNegocio } from "@/lib/db/cliente-do-negocio";
import { criarConsultasDeCompras, DocumentoDaCompraRepetido, ProdutoIndisponivel, type CompraRegistrada } from "@/lib/db/compras";
import { criarConsultasDoCatalogo } from "@/lib/db/catalogo";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { NegocioDivergente, NegocioSuspenso, SomenteLeituraNoSuporte } from "@/lib/db/erros";
import { ContaNaoEditavel, criarConsultasFinanceiras } from "@/lib/db/financeiro";
import { FornecedorNaoEncontrado } from "@/lib/db/fornecedores";
import { criarConsultasDeVendas } from "@/lib/db/vendas";
import { MENSAGENS_COMPRA, validarCompra, vencimentosSugeridos, type DadosDaCompra } from "@/lib/dominio/compras";
import { SEM_FILTROS } from "@/lib/dominio/contas";
import { hoje as hojeLocal, intervaloDoDia } from "@/lib/dominio/datas";
import { somarDias } from "@/lib/dominio/estoque";
import { MENSAGENS_CATALOGO } from "@/lib/catalogo/validacao";
import * as fluxo from "@/lib/compras/servicos";
import * as financeiro from "@/lib/financeiro/servicos";
import * as vendas from "@/lib/vendas/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-027 (etapa 1) — testes de integração: T04 e as contas da compra no Financeiro (1a); T02, T03 e
// T09, com INV-005, INV-007, INV-009 (registrar) e INV-010 (1b). Banco real, o cliente do negócio
// (SPEC-001) e a migração 20261122120000_compras.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();

let usuario: string;
let negocioA: string;
let negocioB: string;
let fornecedor: string;
let embalagemP: string;
let embalagemG: string;

const cliente = (negocioId = negocioA, suporte = false) => comNegocio(base, { negocioId, usuarioId: usuario, modoSuporte: suporte });
const compras = (negocioId = negocioA, suporte = false) => criarConsultasDeCompras(cliente(negocioId, suporte), negocioId);
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

/** A compra do exemplo da seção 1: 100 Embalagens P a R$ 1,20 e 50 G a R$ 2,00, nota 1234, a prazo em 1 parcela. */
function exemplo(extra: Record<string, unknown> = {}): DadosDaCompra {
  const v = validarCompra(
    {
      id: randomUUID(),
      fornecedorId: fornecedor,
      numeroDocumento: "1234",
      dia: HOJE,
      linhas: [
        { itemId: embalagemP, quantidade: 100, custoUnitario: 1.2 },
        { itemId: embalagemG, quantidade: 50, custoUnitario: 2 },
      ],
      condicao: "A_PRAZO",
      parcelas: [{ vencimento: somarDias(HOJE, 28) }],
      ...extra,
    },
    HOJE,
  );
  if (!v.ok) throw new Error(JSON.stringify(v.erros));
  return v.dados;
}

const saldo = async (id: string) => Number((await base.item.findUniqueOrThrow({ where: { id } })).quantidadeEstoque);
const custo = async (id: string) => Number((await base.item.findUniqueOrThrow({ where: { id } })).custoBase);
const caixa = () => fin().saldoAtual(HOJE);
const contasDa = (compraId: string) =>
  base.contaPagarReceber.findMany({ where: { compraId }, orderBy: { vencimento: "asc" }, select: { tipo: true, categoria: true, descricao: true, valorTotal: true, vencimento: true, status: true, fornecedorId: true, numeroDocumento: true, valorPago: true } });
/** Dia da data (@db.Date) ou do vencimento (meio-dia local, ainda no mesmo dia em UTC). */
const diaDe = (d: Date) => d.toISOString().slice(0, 10);

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

describe("T02 — registrar compra no banco (CA-01, CA-02, CA-04, INV-002, INV-003, INV-006, INV-007)", () => {
  it("CA-01: a prazo — estoque, conta a pagar com a fornecedora e o nº, custo médio com histórico, caixa igual", async () => {
    const antes = await caixa();
    const d = exemplo();
    const r = await compras().registrar(d, usuario);
    expect(r).toEqual({ id: d.id, numero: 1, jaExistia: false, custosNovos: [{ itemId: embalagemP, nome: "Embalagem P" }] });

    expect(await saldo(embalagemP)).toBe(120);
    expect(await saldo(embalagemG)).toBe(50);
    const c = await base.compra.findUniqueOrThrow({ where: { id: r.id }, include: { itens: true } });
    expect(c).toMatchObject({ numero: 1, fornecedorId: fornecedor, numeroDocumento: "1234", documentoChave: "1234", semNotaFiscal: false, condicao: "A_PRAZO", valorEntrada: null, situacao: "REGISTRADA", registradaPorId: usuario });
    expect(Number(c.valorProdutos)).toBe(220);
    expect(Number(c.total)).toBe(220);
    expect(diaDe(c.data)).toBe(HOJE);

    const contas = await contasDa(r.id);
    expect(contas).toHaveLength(1);
    expect(contas[0]).toMatchObject({ tipo: "PAGAR", categoria: "FORNECEDORES", descricao: "Compra nº 1 — parcela 1/1", status: "ABERTA", fornecedorId: fornecedor, numeroDocumento: "1234" });
    expect(Number(contas[0].valorTotal)).toBe(220);
    expect(contas[0].vencimento.getTime()).toBe(intervaloDoDia(somarDias(HOJE, 28)).inicio.getTime() + 12 * 3_600_000);

    // INV-007: nenhum lançamento no caixa.
    expect(await base.lancamentoFinanceiro.count()).toBe(0);
    expect(await caixa()).toBe(antes);

    // INV-003: uma entrada por produto, ligada à compra, pela primitiva (saldo antes e depois).
    const movs = await base.movimentacaoEstoque.findMany({ where: { compraId: r.id }, orderBy: { itemId: "asc" } });
    expect(movs.map((m) => ({ itemId: m.itemId, tipo: m.tipo, q: Number(m.quantidade), antes: Number(m.saldoAnterior), depois: Number(m.saldoPosterior) })).sort((a, b) => a.q - b.q)).toEqual([
      { itemId: embalagemG, tipo: "ENTRADA", q: 50, antes: 0, depois: 50 },
      { itemId: embalagemP, tipo: "ENTRADA", q: 100, antes: 20, depois: 120 },
    ]);

    // CA-04: o médio (marcado) — P passa a R$ 1,17; G, sem saldo antes, passa ao custo da compra (R$ 2,00 = atual, sem registro).
    expect(await custo(embalagemP)).toBe(1.17);
    expect(await custo(embalagemG)).toBe(2);
    const historico = await base.historicoCusto.findMany({ where: { compraId: r.id } });
    expect(historico.map((h) => ({ itemId: h.itemId, custo: Number(h.custo), usuarioId: h.usuarioId }))).toEqual([{ itemId: embalagemP, custo: 1.17, usuarioId: usuario }]);
    const linhaP = c.itens.find((i) => i.itemId === embalagemP)!;
    expect({ escolha: linhaP.escolhaCusto, anterior: Number(linhaP.custoAnterior), novo: Number(linhaP.custoNovo), comRateio: Number(linhaP.custoComRateio), total: Number(linhaP.totalLinha) }).toEqual({
      escolha: "MEDIO",
      anterior: 1,
      novo: 1.17,
      comRateio: 1.2,
      total: 120,
    });
  });

  it("CA-04: escolher o custo desta compra ou manter o atual", async () => {
    const d = exemplo({
      linhas: [
        { itemId: embalagemP, quantidade: 100, custoUnitario: 1.2, escolhaCusto: "COMPRA" },
        { itemId: embalagemG, quantidade: 50, custoUnitario: 2.5, escolhaCusto: "ATUAL" },
      ],
    });
    const r = await compras().registrar(d, usuario);
    expect(await custo(embalagemP)).toBe(1.2);
    expect(await custo(embalagemG)).toBe(2);
    expect((await base.historicoCusto.findMany({ where: { compraId: r.id } })).map((h) => h.itemId)).toEqual([embalagemP]);
    const g = await base.itemCompra.findFirstOrThrow({ where: { compraId: r.id, itemId: embalagemG } });
    expect({ escolha: g.escolhaCusto, anterior: Number(g.custoAnterior), novo: Number(g.custoNovo), pago: Number(g.custoUnitario) }).toEqual({ escolha: "ATUAL", anterior: 2, novo: 2, pago: 2.5 });
  });

  it("CA-02: à vista — uma conta com o total, vencendo na data da compra; o caixa só muda no pagamento", async () => {
    const antes = await caixa();
    const ontem = somarDias(HOJE, -1);
    const d = exemplo({ condicao: "A_VISTA", parcelas: undefined, dia: ontem, linhas: [{ itemId: embalagemP, quantidade: 125, custoUnitario: 1.2 }] });
    const r = await compras().registrar(d, usuario);
    const [conta] = await contasDa(r.id);
    expect(conta).toMatchObject({ descricao: "Compra nº 1 — à vista", status: "ABERTA", categoria: "FORNECEDORES" });
    expect(Number(conta.valorTotal)).toBe(150);
    expect(conta.vencimento.getTime()).toBe(intervaloDoDia(ontem).inicio.getTime() + 12 * 3_600_000);
    expect(await caixa()).toBe(antes);
    // A entrada no estoque fica na data da compra (meio-dia local, como a entrada manual retroativa).
    const mov = await base.movimentacaoEstoque.findFirstOrThrow({ where: { compraId: r.id } });
    expect(mov.data.getTime()).toBe(intervaloDoDia(ontem).inicio.getTime() + 12 * 3_600_000);

    // Pagamento no Financeiro, com Pix: a saída entra no caixa e a conta fica paga.
    const contaId = (await base.contaPagarReceber.findFirstOrThrow({ where: { compraId: r.id } })).id;
    expect(await financeiro.registrarPagamento(contaId, { valor: "150", data: HOJE, forma: "PIX" }, depsFin())).toMatchObject({ status: "salvo" });
    expect(await caixa()).toBe(antes - 15000);
    const l = await base.lancamentoFinanceiro.findFirstOrThrow({ where: { contaId } });
    expect({ tipo: l.tipo, forma: l.formaPagamento, valor: Number(l.valor), categoria: l.categoria }).toEqual({ tipo: "SAIDA", forma: "PIX", valor: 150, categoria: "FORNECEDORES" });
    expect((await base.contaPagarReceber.findUniqueOrThrow({ where: { id: contaId } })).status).toBe("QUITADA");
  });

  it("CA-03: com entrada — três contas (entrada na data da compra e duas parcelas), caixa igual", async () => {
    const antes = await caixa();
    const venc = vencimentosSugeridos(HOJE, 2);
    const d = exemplo({ linhas: [{ itemId: embalagemP, quantidade: 3, custoUnitario: 100 }], entrada: 100, parcelas: venc.map((vencimento) => ({ vencimento })) });
    const r = await compras().registrar(d, usuario);
    const contas = await contasDa(r.id);
    expect(contas.map((c) => [c.descricao, Number(c.valorTotal), diaDe(c.vencimento)])).toEqual([
      ["Compra nº 1 — entrada", 100, HOJE],
      ["Compra nº 1 — parcela 1/2", 100, venc[0]],
      ["Compra nº 1 — parcela 2/2", 100, venc[1]],
    ]);
    expect(Number((await base.compra.findUniqueOrThrow({ where: { id: r.id } })).valorEntrada)).toBe(100);
    expect(await caixa()).toBe(antes);
  });

  it("CA-05: frete e desconto rateados no custo desta compra", async () => {
    const d = exemplo({
      linhas: [
        { itemId: embalagemP, quantidade: 100, custoUnitario: 1.2, escolhaCusto: "COMPRA" },
        { itemId: embalagemG, quantidade: 40, custoUnitario: 2, escolhaCusto: "COMPRA" },
      ],
      frete: 20,
      desconto: 10,
    });
    const r = await compras().registrar(d, usuario);
    const c = await base.compra.findUniqueOrThrow({ where: { id: r.id } });
    expect([Number(c.valorProdutos), Number(c.frete), Number(c.desconto), Number(c.total)]).toEqual([200, 20, 10, 210]);
    expect(await custo(embalagemP)).toBe(1.26);
    expect(await custo(embalagemG)).toBe(2.1);
    expect(Number((await contasDa(r.id))[0].valorTotal)).toBe(210);
  });

  it("compra sem nota fiscal: gravada sem o nº, e a conta também", async () => {
    const r = await compras().registrar(exemplo({ semNotaFiscal: true }), usuario);
    expect(await base.compra.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ semNotaFiscal: true, numeroDocumento: null, documentoChave: null });
    expect((await contasDa(r.id))[0].numeroDocumento).toBeNull();
  });

  it("revisar: saldo atual e novo, os três custos com o médio marcado, as contas — sem gravar nada", async () => {
    const resumo = await compras().revisar(exemplo());
    const p = resumo.linhas.find((l) => l.itemId === embalagemP)!;
    expect(p).toMatchObject({ nome: "Embalagem P", saldoAtual: 20, saldoNovo: 120, escolhaCusto: "MEDIO", custos: { atualCentavos: 100, compraCentavos: 120, medioCentavos: 117 } });
    expect(resumo.totalCentavos).toBe(22000);
    expect(resumo.contas).toEqual([{ tipo: "PARCELA", parcela: 1, deParcelas: 1, valorCentavos: 22000, vencimento: somarDias(HOJE, 28) }]);
    expect(await base.compra.count()).toBe(0);
    expect(await saldo(embalagemP)).toBe(20);
  });

  it("envio duplicado: a mesma compra não é gravada duas vezes", async () => {
    const d = exemplo();
    const [a, b] = await Promise.all([compras().registrar(d, usuario), compras().registrar(d, usuario)]);
    expect([a.id, b.id]).toEqual([d.id, d.id]);
    expect([a.jaExistia, b.jaExistia].sort()).toEqual([false, true]);
    expect(await base.compra.count()).toBe(1);
    expect(await saldo(embalagemP)).toBe(120);
  });
});

describe("T03 — tudo ou nada, simultâneas e número (CA-07, CA-08, INV-001, INV-003, INV-005)", () => {
  it("CA-07: produto arquivado depois da revisão — nada é gravado, e a mensagem diz qual", async () => {
    const d = exemplo();
    // O produto que a transação movimenta por último é arquivado entre a conferência e a gravação.
    const [, ultimo] = [embalagemP, embalagemG].sort();
    const c = cliente();
    const comArquivamento = new Proxy(c, {
      get(alvo, prop, receptor) {
        if (prop !== "$transaction") return Reflect.get(alvo, prop, receptor);
        return async (...args: unknown[]) => {
          await base.item.update({ where: { id: ultimo }, data: { arquivadoEm: new Date(), nomeChave: null } });
          return (alvo.$transaction as (...a: unknown[]) => unknown)(...args);
        };
      },
    }) as ClienteDoNegocio;
    const erro = await criarConsultasDeCompras(comArquivamento, negocioA).registrar(d, usuario).catch((e) => e);
    expect(erro).toBeInstanceOf(ProdutoIndisponivel);
    expect(erro.nome).toBe(ultimo === embalagemP ? "Embalagem P" : "Embalagem G");
    expect(await base.compra.count()).toBe(0);
    expect(await base.itemCompra.count()).toBe(0);
    expect(await base.movimentacaoEstoque.count()).toBe(0);
    expect(await base.contaPagarReceber.count()).toBe(0);
    expect(await base.historicoCusto.count({ where: { compraId: { not: null } } })).toBe(0);
    expect([await saldo(embalagemP), await saldo(embalagemG), await custo(embalagemP)]).toEqual([20, 0, 1]);
    expect((await base.negocio.findUniqueOrThrow({ where: { id: negocioA } })).proximoNumeroCompra).toBe(1);
  });

  it("produto arquivado, serviço ou de outro negócio antes da confirmação: recusado sem gravar", async () => {
    await base.item.update({ where: { id: embalagemG }, data: { arquivadoEm: new Date(), nomeChave: null } });
    await expect(compras().registrar(exemplo(), usuario)).rejects.toEqual(new ProdutoIndisponivel("Embalagem G"));
    const servico = await produto("Corte", 10, 0, negocioA, { tipo: "SERVICO" });
    await expect(compras().revisar(exemplo({ linhas: [{ itemId: servico, quantidade: 1, custoUnitario: 1 }] }))).rejects.toEqual(new ProdutoIndisponivel("Corte"));
    const deB = await produto("Embalagem B", 1, 0, negocioB);
    await expect(compras().registrar(exemplo({ linhas: [{ itemId: deB, quantidade: 1, custoUnitario: 1 }] }), usuario)).rejects.toEqual(new ProdutoIndisponivel("Um dos produtos"));
    expect(await base.compra.count()).toBe(0);
  });

  it("CA-08: compras e vendas simultâneas — números seguidos, sem repetição, e o saldo certo", async () => {
    const vendavel = await produto("Embalagem V", 1, 10, negocioA, { precoAtual: 5 });
    const comprar = (q: number) => compras().registrar(exemplo({ numeroDocumento: randomUUID().slice(0, 8), linhas: [{ itemId: vendavel, quantidade: q, custoUnitario: 1 }] }), usuario);
    const vender = () =>
      vendas.registrarVenda(
        { carrinho: JSON.stringify({ id: randomUUID(), linhas: [{ itemId: vendavel, quantidade: 2 }], pagamentos: [{ forma: "DINHEIRO", valor: 10 }] }) },
        { vendas: criarConsultasDeVendas(cliente(), negocioA), usuarioId: usuario, hoje: HOJE, agora: new Date() },
      );
    const resultados = await Promise.all([comprar(5), vender(), comprar(5), vender(), comprar(5), vender(), comprar(5)]);
    const numeros = resultados.filter((r): r is CompraRegistrada => "numero" in r && "jaExistia" in r && !("status" in r)).map((r) => r.numero);
    expect(numeros.sort()).toEqual([1, 2, 3, 4]);
    expect(resultados.filter((r) => "status" in r && r.status === "registrada")).toHaveLength(3);
    // 10 + 4 × 5 − 3 × 2 = 24, e a cadeia de saldos fecha na ordem de registro.
    expect(await saldo(vendavel)).toBe(24);
    const cadeia = await base.movimentacaoEstoque.findMany({ where: { itemId: vendavel }, orderBy: { registradoEm: "asc" } });
    for (let i = 1; i < cadeia.length; i++) expect(Number(cadeia[i].saldoAnterior)).toBe(Number(cadeia[i - 1].saldoPosterior));
    expect((await base.negocio.findUniqueOrThrow({ where: { id: negocioA } })).proximoNumeroCompra).toBe(5);
  });
});

/** Compra gravada direto no banco, sem passar pelas regras da gravação. */
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

describe("T09 — documento repetido e compra sem nota (CA-14, INV-011)", () => {
  it("recusa o mesmo nº do mesmo fornecedor (sem diferença de espaços e maiúsculas); outro fornecedor pode", async () => {
    const primeira = await compras().registrar(exemplo({ numeroDocumento: "NF-1234" }), usuario);
    const erro = await compras().registrar(exemplo({ numeroDocumento: " nf-1234 " }), usuario).catch((e) => e);
    expect(erro).toEqual(new DocumentoDaCompraRepetido(1, "NF-1234"));
    expect(erro).toMatchObject({ numero: 1, documento: "NF-1234" });
    await expect(compras().revisar(exemplo({ numeroDocumento: "NF-1234" }))).rejects.toBeInstanceOf(DocumentoDaCompraRepetido);
    const outro = (await base.fornecedor.create({ data: { negocioId: negocioA, tipo: "PESSOA_FISICA", nome: "Bia" } })).id;
    await expect(compras().registrar(exemplo({ fornecedorId: outro, numeroDocumento: "NF-1234" }), usuario)).resolves.toMatchObject({ numero: 2 });
    // Várias compras sem nota do mesmo fornecedor.
    await compras().registrar(exemplo({ semNotaFiscal: true }), usuario);
    await compras().registrar(exemplo({ semNotaFiscal: true }), usuario);
    // A compra cancelada libera o nº (o cancelamento em si é da etapa 3; aqui, direto no banco).
    await base.compra.update({ where: { id: primeira.id }, data: { situacao: "CANCELADA", documentoChave: null, canceladaPorId: usuario, canceladaEm: new Date(), motivoCancelamento: "Nota errada" } });
    await expect(compras().registrar(exemplo({ numeroDocumento: "NF-1234" }), usuario)).resolves.toMatchObject({ numero: 5 });
  });

  it("simultâneas com o mesmo nº: uma grava, a outra recebe a mensagem", async () => {
    const resultados = await Promise.allSettled([compras().registrar(exemplo(), usuario), compras().registrar(exemplo(), usuario), compras().registrar(exemplo(), usuario)]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const recusas = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(recusas).toHaveLength(2);
    for (const r of recusas) expect(r.reason).toBeInstanceOf(DocumentoDaCompraRepetido);
    expect(await base.compra.count()).toBe(1);
    expect(await saldo(embalagemP)).toBe(120);
  });

  it("fornecedor de outro negócio ou anonimizado: não encontrado", async () => {
    const deB = (await base.fornecedor.create({ data: { negocioId: negocioB, tipo: "PESSOA_FISICA", nome: "Outro" } })).id;
    await expect(compras().registrar(exemplo({ fornecedorId: deB }), usuario)).rejects.toBeInstanceOf(FornecedorNaoEncontrado);
    await base.fornecedor.update({ where: { id: fornecedor }, data: { nome: "Fornecedor anônimo", anonimizadoEm: new Date() } });
    await expect(compras().revisar(exemplo())).rejects.toBeInstanceOf(FornecedorNaoEncontrado);
    expect(await base.compra.count()).toBe(0);
  });
});

describe("suporte, negócio suspenso e outro negócio (INV-009 no registro, INV-010)", () => {
  it("o suporte nunca registra: nada é gravado", async () => {
    await expect(compras(negocioA, true).registrar(exemplo(), usuario)).rejects.toBeInstanceOf(SomenteLeituraNoSuporte);
    expect(await base.compra.count()).toBe(0);
    expect(await saldo(embalagemP)).toBe(20);
  });

  it("negócio suspenso: o registro é recusado", async () => {
    await base.negocio.update({ where: { id: negocioA }, data: { suspensoEm: new Date(), suspensoPorId: usuario, motivoSuspensao: "ORDEM_JUDICIAL", descricaoSuspensao: "Teste" } });
    await expect(compras().registrar(exemplo(), usuario)).rejects.toBeInstanceOf(NegocioSuspenso);
    expect(await base.compra.count()).toBe(0);
    expect(await saldo(embalagemP)).toBe(20);
  });

  it("o número é por negócio", async () => {
    const fornecedorB = (await base.fornecedor.create({ data: { negocioId: negocioB, tipo: "PESSOA_FISICA", nome: "Outro" } })).id;
    const produtoB = await produto("Embalagem B", 1, 0, negocioB);
    await compras().registrar(exemplo(), usuario);
    const d = validarCompra({ id: randomUUID(), fornecedorId: fornecedorB, semNotaFiscal: true, linhas: [{ itemId: produtoB, quantidade: 1, custoUnitario: 3 }], condicao: "A_VISTA" }, HOJE);
    if (!d.ok) throw new Error("dados");
    expect(await compras(negocioB).registrar(d.dados, usuario)).toMatchObject({ numero: 1 });
    expect(await cliente(negocioB).compra.count()).toBe(1);
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

describe("fluxo da tela: revisar e confirmar (etapa 1c, 5.1)", () => {
  const deps = (): fluxo.DependenciasDaCompra => ({ compras: compras(), usuarioId: usuario, hoje: HOJE, agora: new Date() });
  /** Os campos como a tela manda: JSON com os valores digitados (vírgula decimal). */
  const campos = (extra: Record<string, unknown> = {}) => ({
    compra: JSON.stringify({
      id: randomUUID(),
      fornecedorId: fornecedor,
      numeroDocumento: "1234",
      semNotaFiscal: false,
      dia: HOJE,
      observacao: "",
      linhas: [
        { itemId: embalagemP, quantidade: "100", custoUnitario: "1,20" },
        { itemId: embalagemG, quantidade: "50", custoUnitario: "2,00" },
      ],
      frete: "",
      outrasDespesas: "",
      desconto: "",
      condicao: "A_PRAZO",
      entrada: "",
      parcelas: [{ vencimento: somarDias(HOJE, 28) }],
      ...extra,
    }),
  });

  it("revisar devolve o resumo sem gravar; confirmar grava e diz quais custos mudaram", async () => {
    const revisado = await fluxo.revisarCompra(campos(), deps());
    expect(revisado.status).toBe("revisada");
    if (revisado.status !== "revisada") return;
    expect(revisado.resumo.linhas.find((l) => l.itemId === embalagemP)?.custos).toEqual({ atualCentavos: 100, compraCentavos: 120, medioCentavos: 117 });
    expect(await base.compra.count()).toBe(0);

    const registrado = await fluxo.registrarCompra(campos(), deps());
    expect(registrado).toMatchObject({ status: "registrada", numero: 1, jaExistia: false, custosNovos: [{ itemId: embalagemP, nome: "Embalagem P" }] });
  });

  it("mensagens: compra ilegível, campos, documento repetido e produto indisponível", async () => {
    expect(await fluxo.revisarCompra({ compra: "{" }, deps())).toEqual({ status: "erro", mensagem: MENSAGENS_COMPRA.compraInvalida });
    const semFornecedor = await fluxo.revisarCompra(campos({ fornecedorId: "" }), deps());
    expect(semFornecedor).toMatchObject({ status: "erro", erros: { fornecedor: "Escolha o fornecedor." } });

    await fluxo.registrarCompra(campos(), deps());
    expect(await fluxo.registrarCompra(campos(), deps())).toEqual({
      status: "erro",
      erros: { documento: "Este fornecedor já tem a compra nº 1 com o documento 1234. Confira o número ou cancele a compra anterior." },
    });

    await base.item.update({ where: { id: embalagemG }, data: { arquivadoEm: new Date(), nomeChave: null } });
    expect(await fluxo.revisarCompra(campos({ numeroDocumento: "999" }), deps())).toEqual({ status: "erro", mensagem: "Embalagem G não está mais disponível. Remova-o da compra." });
  });

  it("produtos da tela: só os físicos ativos, com o saldo e o custo", async () => {
    await produto("Corte", 10, 0, negocioA, { tipo: "SERVICO" });
    await base.item.update({ where: { id: embalagemG }, data: { arquivadoEm: new Date(), nomeChave: null } });
    expect(await compras().produtosDisponiveis()).toEqual([{ id: embalagemP, nome: "Embalagem P", codigo: null, unidadeMedida: "un", custoCentavos: 100, saldo: 20 }]);
  });
});

describe("\"Novo produto\" sem sair da compra (etapa 1d, OPEN-003)", () => {
  const deps = () => ({ catalogo: criarConsultasDoCatalogo(cliente(), negocioA), usuarioId: usuario });
  const campos = (extra: Record<string, string> = {}) => ({ nome: "Fita adesiva", categoria: "PRODUTOS", unidadeMedida: "un", custoBase: "3,50", codigo: "fita-1", ...extra });

  it("cria sempre produto físico, com o custo da linha, sem estoque e sem preço; ignora o resto do formulário", async () => {
    const r = await fluxo.criarProdutoDaCompra({ ...campos(), tipo: "SERVICO", preco: "10", materiais: "[]", estoqueMinimo: "5" }, deps());
    expect(r.status).toBe("salvo");
    if (r.status !== "salvo") return;
    const item = await base.item.findUniqueOrThrow({ where: { id: r.itemId } });
    expect({ tipo: item.tipo, nome: item.nome, codigo: item.codigo, custo: Number(item.custoBase), saldo: Number(item.quantidadeEstoque), preco: item.precoAtual, minimo: item.estoqueMinimo }).toEqual({
      tipo: "PRODUTO_FISICO",
      nome: "Fita adesiva",
      codigo: "FITA-1",
      custo: 3.5,
      saldo: 0,
      preco: null,
      minimo: null,
    });
    // O histórico de custo começa com o custo da linha (SPEC-025), e o produto já pode entrar na compra.
    expect((await base.historicoCusto.findMany({ where: { itemId: r.itemId } })).map((h) => Number(h.custo))).toEqual([3.5]);
    expect((await compras().produtosDisponiveis()).some((p) => p.id === r.itemId)).toBe(true);
  });

  it("as regras do Catálogo: nome e código únicos; NCM obrigatório quando o negócio emite nota", async () => {
    expect(await fluxo.criarProdutoDaCompra(campos({ nome: "Embalagem P" }), deps())).toMatchObject({ status: "erro", erros: { nome: expect.any(String) } });
    await fluxo.criarProdutoDaCompra(campos(), deps());
    expect(await fluxo.criarProdutoDaCompra(campos({ nome: "Outra fita" }), deps())).toMatchObject({ status: "erro", erros: { codigo: expect.stringContaining("FITA-1") } });
    await base.negocio.update({ where: { id: negocioA }, data: { emiteNotaDeProduto: true } });
    expect(await fluxo.criarProdutoDaCompra(campos({ nome: "Cola", codigo: "" }), deps())).toEqual({ status: "erro", erros: { ncm: MENSAGENS_CATALOGO.ncmObrigatorio } });
  });
});

