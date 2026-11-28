import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { CompraNaoEncontrada, criarConsultasDeCompras, DocumentoDaCompraRepetido } from "@/lib/db/compras";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { NegocioSuspenso, SomenteLeituraNoSuporte } from "@/lib/db/erros";
import { criarConsultasFinanceiras } from "@/lib/db/financeiro";
import { FORNECEDOR_SEM_DADOS, FornecedorNaoEncontrado } from "@/lib/db/fornecedores";
import { MENSAGENS_COMPRA, validarCompra, type DadosDaCompra } from "@/lib/dominio/compras";
import { hoje as hojeLocal } from "@/lib/dominio/datas";
import { somarDias } from "@/lib/dominio/estoque";
import * as fluxo from "@/lib/compras/servicos";
import * as financeiro from "@/lib/financeiro/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-027 (etapa 3a) — T06 (CA-11): a correção do fornecedor e do nº do documento vale para a compra e
// para as contas dela, sem mudar valores, vencimentos, situação nem pagamentos; a mesma regra de
// unicidade do registro (INV-011). INV-009 na correção: o suporte e o negócio suspenso não corrigem.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();

let usuario: string;
let negocioA: string;
let negocioB: string;
let fornecedor: string;
let outro: string;
let embalagemP: string;

const cliente = (negocioId = negocioA, suporte = false) => comNegocio(base, { negocioId, usuarioId: usuario, modoSuporte: suporte });
const compras = (negocioId = negocioA, suporte = false) => criarConsultasDeCompras(cliente(negocioId, suporte), negocioId);
const depsFin = (): financeiro.DependenciasDoFinanceiro => ({ financeiro: criarConsultasFinanceiras(cliente(), negocioA), usuarioId: usuario, hoje: HOJE, agora: new Date() });

function compra(fornecedorId: string, documento: string | null, extra: Record<string, unknown> = {}): DadosDaCompra {
  const v = validarCompra(
    {
      id: randomUUID(),
      fornecedorId,
      ...(documento === null ? { semNotaFiscal: true } : { numeroDocumento: documento }),
      dia: HOJE,
      linhas: [{ itemId: embalagemP, quantidade: 100, custoUnitario: 1.2 }],
      condicao: "A_PRAZO",
      entrada: 20,
      parcelas: [{ vencimento: somarDias(HOJE, 30) }, { vencimento: somarDias(HOJE, 60) }],
      ...extra,
    },
    HOJE,
  );
  if (!v.ok) throw new Error(JSON.stringify(v.erros));
  return v.dados;
}

/** O que a correção nunca muda (CA-11): a compra sem o fornecedor e o documento, as contas, os pagamentos, o estoque e o custo. */
async function fotografia(compraId: string) {
  const resto = await base.compra.findUniqueOrThrow({
    where: { id: compraId },
    include: { itens: true },
    omit: { fornecedorId: true, numeroDocumento: true, documentoChave: true, semNotaFiscal: true },
  });
  const contas = await base.contaPagarReceber.findMany({ where: { compraId }, orderBy: { descricao: "asc" }, omit: { fornecedorId: true, numeroDocumento: true } });
  const lancamentos = await base.lancamentoFinanceiro.findMany({ where: { contaId: { in: contas.map((k) => k.id) } }, orderBy: { data: "asc" } });
  const movimentacoes = await base.movimentacaoEstoque.findMany({ where: { compraId } });
  const item = await base.item.findUniqueOrThrow({ where: { id: embalagemP }, select: { quantidadeEstoque: true, custoBase: true } });
  return { compra: resto, contas, lancamentos, movimentacoes, item, historico: await base.historicoCusto.count() };
}

const vinculoDaCompra = async (compraId: string) => {
  const c = await base.compra.findUniqueOrThrow({ where: { id: compraId }, select: { fornecedorId: true, numeroDocumento: true, documentoChave: true, semNotaFiscal: true } });
  const contas = await base.contaPagarReceber.findMany({ where: { compraId }, select: { fornecedorId: true, numeroDocumento: true } });
  return { ...c, contas: [...new Set(contas.map((k) => `${k.fornecedorId}|${k.numeroDocumento}`))] };
};

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Gisele", email: "gisele@exemplo.com", consentimentoLgpdEm: new Date(), versaoTermosAceita: "2026-11-01" } })).id;
  negocioA = (await base.negocio.create({ data: { nome: "Loja A" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Loja B" } })).id;
  await base.membroNegocio.create({ data: { negocioId: negocioA, usuarioId: usuario, papel: "DONO" } });
  fornecedor = (await base.fornecedor.create({ data: { negocioId: negocioA, tipo: "PESSOA_JURIDICA", nome: "Embalagens Exemplo Ltda" } })).id;
  outro = (await base.fornecedor.create({ data: { negocioId: negocioA, tipo: "PESSOA_FISICA", nome: "Bruna Fornecedora" } })).id;
  const item = await base.item.create({
    data: { negocioId: negocioA, tipo: "PRODUTO_FISICO", nome: "Embalagem P", nomeChave: "embalagem p", categoria: "PRODUTOS", unidadeMedida: "un", custoBase: 1, quantidadeEstoque: 20 },
  });
  await base.historicoCusto.create({ data: { negocioId: negocioA, itemId: item.id, custo: 1, vigenteDesde: new Date(Date.now() - 86_400_000) } });
  embalagemP = item.id;
});

afterAll(async () => {
  await base.$disconnect();
});

describe("T06 — correção do fornecedor e do documento (CA-11)", () => {
  it("CA-11: com contas pagas, troca o fornecedor e o nº na compra e nas contas; valores, vencimentos, situação e pagamentos iguais", async () => {
    const r = await compras().registrar(compra(fornecedor, "1234"), usuario);
    const contas = await base.contaPagarReceber.findMany({ where: { compraId: r.id }, orderBy: { vencimento: "asc" } });
    // A entrada paga e a 1ª parcela paga em parte.
    expect(await financeiro.registrarPagamento(contas[0].id, { valor: "20", data: HOJE, forma: "PIX" }, depsFin())).toMatchObject({ status: "salvo" });
    expect(await financeiro.registrarPagamento(contas[1].id, { valor: "10", data: HOJE, forma: "BOLETO" }, depsFin())).toMatchObject({ status: "salvo" });
    const antes = await fotografia(r.id);

    expect(await compras().corrigir(r.id, { fornecedorId: outro, numeroDocumento: "NF 99", semNotaFiscal: false })).toEqual({ numero: 1 });

    expect(await vinculoDaCompra(r.id)).toEqual({ fornecedorId: outro, numeroDocumento: "NF 99", documentoChave: "NF 99", semNotaFiscal: false, contas: [`${outro}|NF 99`] });
    expect(await fotografia(r.id)).toEqual(antes);
    expect(antes.contas.map((k) => k.status)).toEqual(["QUITADA", "PARCIAL", "ABERTA"]);
    // O fornecedor antigo deixa de ter a compra; o novo passa a tê-la (5.6).
    expect((await compras().doFornecedor(fornecedor)).quantidade).toBe(0);
    expect((await compras().doFornecedor(outro)).compras.map((c) => c.numero)).toEqual([1]);
  });

  it("marcar e desmarcar \"Compra sem nota fiscal\": a compra e as contas ficam sem o nº, e depois com o nº", async () => {
    const r = await compras().registrar(compra(fornecedor, "1234"), usuario);
    await compras().corrigir(r.id, { fornecedorId: fornecedor, numeroDocumento: null, semNotaFiscal: true });
    expect(await vinculoDaCompra(r.id)).toEqual({ fornecedorId: fornecedor, numeroDocumento: null, documentoChave: null, semNotaFiscal: true, contas: [`${fornecedor}|null`] });
    // Sem a chave, o nº 1234 fica livre para outra compra do mesmo fornecedor.
    await compras().registrar(compra(fornecedor, "1234"), usuario);
    await expect(compras().corrigir(r.id, { fornecedorId: fornecedor, numeroDocumento: "1234", semNotaFiscal: false })).rejects.toEqual(new DocumentoDaCompraRepetido(2, "1234"));
    await compras().corrigir(r.id, { fornecedorId: fornecedor, numeroDocumento: "A-1", semNotaFiscal: false });
    expect(await vinculoDaCompra(r.id)).toEqual({ fornecedorId: fornecedor, numeroDocumento: "A-1", documentoChave: "A-1", semNotaFiscal: false, contas: [`${fornecedor}|A-1`] });
  });

  it("a mesma regra de unicidade: sem diferença de espaços e maiúsculas, por fornecedor, só entre as não canceladas", async () => {
    const r1 = await compras().registrar(compra(fornecedor, "1234"), usuario);
    await compras().registrar(compra(outro, "nf-77"), usuario);
    // O mesmo nº de outra compra do fornecedor novo é recusado; a própria compra pode manter o seu nº.
    await expect(compras().corrigir(r1.id, { fornecedorId: outro, numeroDocumento: "NF-77 ", semNotaFiscal: false })).rejects.toEqual(new DocumentoDaCompraRepetido(2, "nf-77"));
    expect(await compras().corrigir(r1.id, { fornecedorId: fornecedor, numeroDocumento: "1234", semNotaFiscal: false })).toEqual({ numero: 1 });
    // Outro fornecedor pode usar o mesmo nº.
    await compras().corrigir(r1.id, { fornecedorId: outro, numeroDocumento: "1234", semNotaFiscal: false });
    expect((await vinculoDaCompra(r1.id)).documentoChave).toBe("1234");

    // A compra cancelada (o cancelamento é da etapa 3b; aqui, direto no banco) não prende o nº e é corrigida sem a chave.
    const r3 = await compras().registrar(compra(fornecedor, "555"), usuario);
    await base.compra.update({ where: { id: r3.id }, data: { situacao: "CANCELADA", documentoChave: null, canceladaPorId: usuario, canceladaEm: new Date(), motivoCancelamento: "Em dobro" } });
    await compras().corrigir(r1.id, { fornecedorId: fornecedor, numeroDocumento: "555", semNotaFiscal: false });
    await compras().corrigir(r3.id, { fornecedorId: fornecedor, numeroDocumento: "556", semNotaFiscal: false });
    expect(await vinculoDaCompra(r3.id)).toMatchObject({ numeroDocumento: "556", documentoChave: null, contas: [`${fornecedor}|556`] });
  });

  it("duas correções simultâneas para o mesmo nº do mesmo fornecedor: uma grava, a outra é recusada (INV-011)", async () => {
    const r1 = await compras().registrar(compra(fornecedor, "1"), usuario);
    const r2 = await compras().registrar(compra(fornecedor, "2"), usuario);
    const resultados = await Promise.allSettled([r1, r2].map((r) => compras().corrigir(r.id, { fornecedorId: outro, numeroDocumento: "900", semNotaFiscal: false })));
    expect(resultados.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const recusa = resultados.find((x) => x.status === "rejected") as PromiseRejectedResult;
    expect(recusa.reason).toBeInstanceOf(DocumentoDaCompraRepetido);
    expect(await base.compra.count({ where: { fornecedorId: outro, documentoChave: "900" } })).toBe(1);
  });

  it("fornecedor novo de outro negócio ou excluído: não encontrado; o atual, mesmo excluído, continua aceito", async () => {
    const r = await compras().registrar(compra(fornecedor, "1234"), usuario);
    const deOutroNegocio = (await base.fornecedor.create({ data: { negocioId: negocioB, tipo: "PESSOA_FISICA", nome: "Outro" } })).id;
    await base.fornecedor.update({ where: { id: outro }, data: { ...FORNECEDOR_SEM_DADOS, anonimizadoEm: new Date() } });
    for (const f of [deOutroNegocio, outro]) {
      await expect(compras().corrigir(r.id, { fornecedorId: f, numeroDocumento: "1234", semNotaFiscal: false })).rejects.toBeInstanceOf(FornecedorNaoEncontrado);
    }
    await base.fornecedor.update({ where: { id: fornecedor }, data: { ...FORNECEDOR_SEM_DADOS, anonimizadoEm: new Date() } });
    await compras().corrigir(r.id, { fornecedorId: fornecedor, numeroDocumento: "1235", semNotaFiscal: false });
    expect((await vinculoDaCompra(r.id)).numeroDocumento).toBe("1235");
  });

  it("compra de outro negócio, inexistente ou id inválido: não encontrada (INV-010)", async () => {
    const r = await compras().registrar(compra(fornecedor, "1234"), usuario);
    for (const [negocioId, id] of [[negocioB, r.id], [negocioA, randomUUID()], [negocioA, "nao-e-uuid"]]) {
      await expect(compras(negocioId).corrigir(id, { fornecedorId: fornecedor, numeroDocumento: "9", semNotaFiscal: false })).rejects.toBeInstanceOf(CompraNaoEncontrada);
    }
    expect((await vinculoDaCompra(r.id)).numeroDocumento).toBe("1234");
  });
});

describe("T10 (parte) — o suporte e o negócio suspenso não corrigem (CA-15, INV-009)", () => {
  it("o suporte nunca corrige: nada muda", async () => {
    const r = await compras().registrar(compra(fornecedor, "1234"), usuario);
    await expect(compras(negocioA, true).corrigir(r.id, { fornecedorId: outro, numeroDocumento: "9", semNotaFiscal: false })).rejects.toBeInstanceOf(SomenteLeituraNoSuporte);
    expect(await vinculoDaCompra(r.id)).toMatchObject({ fornecedorId: fornecedor, numeroDocumento: "1234", contas: [`${fornecedor}|1234`] });
  });

  it("negócio suspenso: a correção é recusada, e nada muda", async () => {
    const r = await compras().registrar(compra(fornecedor, "1234"), usuario);
    await base.negocio.update({ where: { id: negocioA }, data: { suspensoEm: new Date(), suspensoPorId: usuario, motivoSuspensao: "ORDEM_JUDICIAL", descricaoSuspensao: "Teste" } });
    await expect(compras().corrigir(r.id, { fornecedorId: outro, numeroDocumento: "9", semNotaFiscal: false })).rejects.toBeInstanceOf(NegocioSuspenso);
    expect(await vinculoDaCompra(r.id)).toMatchObject({ fornecedorId: fornecedor, numeroDocumento: "1234", contas: [`${fornecedor}|1234`] });
  });
});

describe("fluxo da tela: corrigir (5.7, 5.11)", () => {
  const deps = () => ({ compras: compras() });

  it("salva e diz que vale para as contas; mensagens do formulário e do documento repetido", async () => {
    const r1 = await compras().registrar(compra(fornecedor, "1234"), usuario);
    await compras().registrar(compra(fornecedor, "777"), usuario);
    expect(await fluxo.corrigirCompra(r1.id, { fornecedor: outro, numeroDocumento: " NF  12 " }, deps())).toEqual({ status: "salvo", mensagem: fluxo.MENSAGENS_FLUXO_COMPRA.corrigida });
    expect((await vinculoDaCompra(r1.id)).numeroDocumento).toBe("NF 12");
    expect(await fluxo.corrigirCompra(r1.id, { fornecedor: "", numeroDocumento: "" }, deps())).toEqual({ status: "erro", erros: { fornecedor: MENSAGENS_COMPRA.semFornecedor, documento: MENSAGENS_COMPRA.semDocumento } });
    expect(await fluxo.corrigirCompra(r1.id, { fornecedor: outro, numeroDocumento: "x".repeat(41) }, deps())).toEqual({ status: "erro", erros: { documento: MENSAGENS_COMPRA.documentoLongo } });
    expect(await fluxo.corrigirCompra(r1.id, { fornecedor: fornecedor, numeroDocumento: "777" }, deps())).toEqual({ status: "erro", erros: { documento: MENSAGENS_COMPRA.documentoRepetido(2, "777") } });
    expect(await fluxo.corrigirCompra(r1.id, { fornecedor: randomUUID(), numeroDocumento: "1" }, deps())).toEqual({ status: "erro", erros: { fornecedor: MENSAGENS_COMPRA.semFornecedor } });
    expect(await fluxo.corrigirCompra(randomUUID(), { fornecedor: outro, numeroDocumento: "1" }, deps())).toEqual({ status: "erro", mensagem: fluxo.MENSAGENS_FLUXO_COMPRA.compraNaoEncontrada });
    // A caixa marcada dispensa o nº, mesmo com algo digitado.
    expect(await fluxo.corrigirCompra(r1.id, { fornecedor: outro, numeroDocumento: "ignorado", semNotaFiscal: "on" }, deps())).toMatchObject({ status: "salvo" });
    expect(await vinculoDaCompra(r1.id)).toMatchObject({ numeroDocumento: null, semNotaFiscal: true });
  });
});
