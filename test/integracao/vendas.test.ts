import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDeVendas } from "@/lib/db/vendas";
import { hoje as hojeLocal, intervaloDoDia } from "@/lib/dominio/datas";
import { somarDias } from "@/lib/dominio/estoque";
import { vencimentoDaParcela } from "@/lib/dominio/venda";
import * as servicos from "@/lib/vendas/servicos";
import { MENSAGENS_FLUXO_VENDA as F } from "@/lib/vendas/servicos";
import { MENSAGENS_VENDA as M } from "@/lib/vendas/validacao";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-008 — testes de integração (seção 12): banco real, cliente do negócio e a primitiva
// de estoque da SPEC-007 dentro da transação da venda.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();

let usuario: string;
let negocioA: string;
let negocioB: string;

const consultas = (negocioId: string) => criarConsultasDeVendas(comNegocio(base, { negocioId, usuarioId: usuario }), negocioId);
const depsDe = (negocioId: string, extra: Partial<servicos.DependenciasDaVenda> = {}): servicos.DependenciasDaVenda => ({
  vendas: consultas(negocioId),
  usuarioId: usuario,
  hoje: HOJE,
  agora: new Date(),
  ...extra,
});
const deps = () => depsDe(negocioA);

async function item(nome: string, extra: Record<string, unknown> = {}, negocioId = negocioA) {
  return (
    await base.item.create({
      data: {
        negocioId,
        tipo: "PRODUTO_FISICO",
        nome,
        nomeChave: nome.toLowerCase(),
        categoria: "BELEZA",
        unidadeMedida: "un",
        custoBase: 5,
        precoAtual: 18,
        quantidadeEstoque: 10,
        ...extra,
      },
    })
  ).id;
}

type Linha = { itemId: string; quantidade: number | string; precoVisto?: number };
type Pag = { forma: string; valor: number | string; parcelas?: number };
const carrinho = (linhas: Linha[], pagamentos: Pag[], extra: Record<string, unknown> = {}) => ({
  carrinho: JSON.stringify({ id: randomUUID(), linhas, pagamentos, ...extra }),
});
const vender = (linhas: Linha[], pagamentos: Pag[], extra: Record<string, unknown> = {}, d = deps()) =>
  servicos.registrarVenda(carrinho(linhas, pagamentos, extra), d);

const saldo = async (id: string) => Number((await base.item.findUniqueOrThrow({ where: { id } })).quantidadeEstoque);
const id = (r: servicos.EstadoDaVenda) => {
  if (r.status !== "registrada") throw new Error(`esperava registrada: ${JSON.stringify(r)}`);
  return r.vendaId;
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

describe("registro da venda", () => {
  it("T03 — venda à vista: venda, item, baixa ligada à venda e lançamento (CA-01, INV-005, INV-006)", async () => {
    const esmalte = await item("Esmalte");
    const vendaId = id(await vender([{ itemId: esmalte, quantidade: 2 }], [{ forma: "PIX", valor: 36 }]));
    const v = await base.venda.findUniqueOrThrow({ where: { id: vendaId }, include: { itens: true, lancamentos: true, movimentacoes: true } });
    expect(v).toMatchObject({ negocioId: negocioA, numero: 1, registradaPorId: usuario, status: "CONCLUIDA" });
    expect(Number(v.valorTotal)).toBe(36);
    expect(v.itens.map((i) => [Number(i.quantidade), Number(i.precoUnitario), Number(i.custoUnitario)])).toEqual([[2, 18, 5]]);
    expect(v.lancamentos.map((l) => [l.tipo, l.categoria, Number(l.valor)])).toEqual([["ENTRADA", "VENDAS", 36]]);
    expect(v.movimentacoes.map((m) => [m.tipo, Number(m.saldoAnterior), Number(m.saldoPosterior)])).toEqual([["SAIDA_VENDA", 10, 8]]);
    expect(await saldo(esmalte)).toBe(8);
    expect(await base.contaPagarReceber.count()).toBe(0);
  });

  it("T04 — serviço com materiais: baixas por material e custo unitário com materiais (CA-02, INV-007)", async () => {
    const esmalte = await item("Esmalte", { quantidadeEstoque: 1, custoBase: 8 });
    const algodao = await item("Algodão", { quantidadeEstoque: 10, custoBase: 0.5 });
    const manicure = await item("Manicure", { tipo: "SERVICO", precoAtual: 40, custoBase: 20, quantidadeEstoque: 0 });
    await base.materialServico.createMany({
      data: [
        { negocioId: negocioA, servicoId: manicure, materialId: esmalte, quantidade: 0.25 },
        { negocioId: negocioA, servicoId: manicure, materialId: algodao, quantidade: 2 },
      ],
    });
    const vendaId = id(await vender([{ itemId: manicure, quantidade: 2 }], [{ forma: "DINHEIRO", valor: 80 }]));
    expect(await saldo(esmalte)).toBe(0.5);
    expect(await saldo(algodao)).toBe(6);
    expect(await saldo(manicure)).toBe(0);
    const [iv] = await base.itemVenda.findMany({ where: { vendaId } });
    expect(Number(iv.custoUnitario)).toBe(23); // 20 + 8 × 0,25 + 0,5 × 2
    expect(await base.movimentacaoEstoque.count({ where: { vendaId } })).toBe(2);
    // Custo alterado depois não muda a venda passada.
    await base.item.update({ where: { id: manicure }, data: { custoBase: 99 } });
    expect(Number((await base.itemVenda.findFirstOrThrow({ where: { vendaId } })).custoUnitario)).toBe(23);
  });

  it("T05 — estoque insuficiente (produto e material) e vendas simultâneas (CA-03)", async () => {
    const esmalte = await item("Esmalte", { quantidadeEstoque: 1 });
    expect(await vender([{ itemId: esmalte, quantidade: 2 }], [{ forma: "PIX", valor: 36 }])).toEqual({
      status: "erro",
      mensagem: F.estoque("Esmalte", 1, "un"),
    });
    const manicure = await item("Manicure", { tipo: "SERVICO", precoAtual: 40, quantidadeEstoque: 0 });
    await base.materialServico.create({ data: { negocioId: negocioA, servicoId: manicure, materialId: esmalte, quantidade: 0.6 } });
    expect(await vender([{ itemId: manicure, quantidade: 2 }], [{ forma: "PIX", valor: 80 }])).toMatchObject({ mensagem: F.estoque("Esmalte", 1, "un") });
    expect(await base.venda.count()).toBe(0);
    expect(await saldo(esmalte)).toBe(1);
    expect(await base.lancamentoFinanceiro.count()).toBe(0);

    const lixa = await item("Lixa", { quantidadeEstoque: 5, precoAtual: 2 });
    const r = await Promise.all(Array.from({ length: 6 }, () => vender([{ itemId: lixa, quantidade: 2 }], [{ forma: "PIX", valor: 4 }])));
    expect(r.filter((x) => x.status === "registrada")).toHaveLength(2);
    expect(await saldo(lixa)).toBe(1);
    // Números sem buracos mesmo com transações desfeitas (OPEN-007).
    expect((await base.venda.findMany({ orderBy: { numero: "asc" } })).map((v) => v.numero)).toEqual([1, 2]);
  });

  it("T06 — pagamento misto e parcelado: lançamento, parcelas (RN11) e contas a receber (CA-04, INV-004)", async () => {
    const kit = await item("Kit", { precoAtual: 250 });
    const vendaId = id(await vender([{ itemId: kit, quantidade: 1 }], [{ forma: "DINHEIRO", valor: "50,00" }, { forma: "CREDITO", valor: 200, parcelas: 3 }]));
    expect((await base.lancamentoFinanceiro.findMany()).map((l) => Number(l.valor))).toEqual([50]);
    const parcelas = await base.parcela.findMany({ orderBy: { numero: "asc" }, include: { conta: true } });
    expect(parcelas.map((p) => Number(p.valor))).toEqual([66.68, 66.66, 66.66]);
    const dias = parcelas.map((p) => intervaloDoDia(vencimentoDaParcela(HOJE, p.numero)).inicio.getTime() <= p.vencimento.getTime());
    expect(dias).toEqual([true, true, true]);
    expect(parcelas.map((p) => [p.conta?.tipo, p.conta?.categoria, p.conta?.status, Number(p.conta?.valorTotal), p.conta?.descricao])).toEqual([
      ["RECEBER", "VENDAS", "ABERTA", 66.68, "Venda nº 1 — parcela 1/3"],
      ["RECEBER", "VENDAS", "ABERTA", 66.66, "Venda nº 1 — parcela 2/3"],
      ["RECEBER", "VENDAS", "ABERTA", 66.66, "Venda nº 1 — parcela 3/3"],
    ]);
    const d = await deps().vendas.detalhar(vendaId);
    expect(d.pagamentos.find((p) => p.forma === "CREDITO")?.parcelas.map((p) => p.status)).toEqual(["ABERTA", "ABERTA", "ABERTA"]);
  });

  it("T07 — soma divergente e preço adulterado/alterado (CA-05, CA-06, INV-002)", async () => {
    const esmalte = await item("Esmalte");
    expect(await vender([{ itemId: esmalte, quantidade: 1 }], [{ forma: "PIX", valor: 10 }])).toEqual({ status: "erro", mensagem: F.somaDivergente(1800) });
    // Preço adulterado no navegador é ignorado: a soma tem que bater com o preço oficial.
    expect(await vender([{ itemId: esmalte, quantidade: 1, precoVisto: 1 }], [{ forma: "PIX", valor: 1 }])).toMatchObject({ mensagem: expect.stringMatching(/O preço mudou: Esmalte agora custa R\$\s18,00/) });
    expect((await vender([{ itemId: esmalte, quantidade: 1, precoVisto: 18 }], [{ forma: "PIX", valor: 18 }])).status).toBe("registrada");
    expect(await base.venda.count()).toBe(1);
  });

  it("T08 — item sem preço, arquivado ou de outro negócio (CA-07)", async () => {
    const semPreco = await item("Base", { precoAtual: null });
    const arquivado = await item("Lixa", { arquivadoEm: new Date(), nomeChave: null });
    const alheio = await item("Acetona", {}, negocioB);
    expect(await vender([{ itemId: semPreco, quantidade: 1 }], [{ forma: "PIX", valor: 1 }])).toMatchObject({ mensagem: F.naoVendavel("Base", "sem-preco") });
    expect(await vender([{ itemId: arquivado, quantidade: 1 }], [{ forma: "PIX", valor: 18 }])).toMatchObject({ mensagem: F.naoVendavel("Lixa", "arquivado") });
    expect(await vender([{ itemId: alheio, quantidade: 1 }], [{ forma: "PIX", valor: 18 }])).toMatchObject({ mensagem: F.naoVendavel("Item", "inexistente") });
    expect((await deps().vendas.itensVendaveis()).map((i) => i.nome)).toEqual([]);
    expect(await saldo(alheio)).toBe(10);
  });

  it("T09 — o mesmo carrinho duas vezes (inclusive em paralelo) gera uma venda só (CA-08, INV-009)", async () => {
    const esmalte = await item("Esmalte");
    const campos = carrinho([{ itemId: esmalte, quantidade: 1 }], [{ forma: "PIX", valor: 18 }]);
    const [a, b] = await Promise.all([servicos.registrarVenda(campos, deps()), servicos.registrarVenda(campos, deps())]);
    const c = await servicos.registrarVenda(campos, deps());
    expect([a, b, c].every((r) => r.status === "registrada")).toBe(true);
    expect(new Set([a, b, c].map(id)).size).toBe(1);
    expect([a, b, c].filter((r) => r.status === "registrada" && r.jaExistia)).toHaveLength(2);
    expect(await base.venda.count()).toBe(1);
    expect(await saldo(esmalte)).toBe(9);
    expect(await base.lancamentoFinanceiro.count()).toBe(1);
  });

  it("T10 — falha na última conta a receber desfaz tudo (CA-09, INV-001)", async () => {
    const esmalte = await item("Esmalte");
    // Usuário inexistente: a venda falha na FK de registradaPor — e nada fica gravado.
    const r = await vender([{ itemId: esmalte, quantidade: 1 }], [{ forma: "CREDITO", valor: 18, parcelas: 2 }], {}, depsDe(negocioA, { usuarioId: randomUUID() }));
    expect(r).toEqual({ status: "erro", mensagem: F.falhaInterna });
    // Falha no fim da transação (conta a receber com valor que viola o CHECK depois da baixa):
    await base.$executeRawUnsafe(`ALTER TABLE "ContaPagarReceber" ADD CONSTRAINT teste_falha CHECK ("descricao" NOT LIKE '%parcela 2/2%')`);
    try {
      expect(await vender([{ itemId: esmalte, quantidade: 1 }], [{ forma: "CREDITO", valor: 18, parcelas: 2 }])).toEqual({ status: "erro", mensagem: F.falhaInterna });
    } finally {
      await base.$executeRawUnsafe(`ALTER TABLE "ContaPagarReceber" DROP CONSTRAINT teste_falha`);
    }
    expect(await base.venda.count()).toBe(0);
    expect(await saldo(esmalte)).toBe(10);
    expect(await base.movimentacaoEstoque.count()).toBe(0);
    expect(await base.parcela.count()).toBe(0);
    expect((await base.negocio.findUniqueOrThrow({ where: { id: negocioA } })).proximoNumeroVenda).toBe(1);
  });

  it("T11 — cliente cadastrado na hora; venda sem cliente; cliente de outro negócio recusado (CA-10)", async () => {
    const esmalte = await item("Esmalte");
    const r = await servicos.cadastrarCliente({ nome: "  Maria   Souza ", contato: "(11) 99999-0000" }, deps());
    if (r.status !== "criado") throw new Error("esperava criado");
    expect(r.cliente.nome).toBe("Maria Souza");
    const comCliente = id(await vender([{ itemId: esmalte, quantidade: 1 }], [{ forma: "PIX", valor: 18 }], { clienteId: r.cliente.id }));
    expect((await base.venda.findUniqueOrThrow({ where: { id: comCliente } })).clienteId).toBe(r.cliente.id);
    expect((await vender([{ itemId: esmalte, quantidade: 1 }], [{ forma: "PIX", valor: 18 }])).status).toBe("registrada");
    const alheio = await base.cliente.create({ data: { negocioId: negocioB, nome: "Outro" } });
    expect(await vender([{ itemId: esmalte, quantidade: 1 }], [{ forma: "PIX", valor: 18 }], { clienteId: alheio.id })).toMatchObject({ mensagem: F.clienteInvalido });
    expect(await servicos.cadastrarCliente({ nome: "" }, deps())).toMatchObject({ status: "erro", erros: { nome: M.nomeObrigatorio } });
  });

  it("T12 — data retroativa, histórico por período e detalhe (CA-11, OPEN-002)", async () => {
    const esmalte = await item("Esmalte");
    id(await vender([{ itemId: esmalte, quantidade: 1 }], [{ forma: "PIX", valor: 18 }]));
    const ontem = id(await vender([{ itemId: esmalte, quantidade: 2 }], [{ forma: "DEBITO", valor: 36 }], { dia: somarDias(HOJE, -1) }));
    expect(await vender([{ itemId: esmalte, quantidade: 1 }], [{ forma: "PIX", valor: 18 }], { dia: somarDias(HOJE, -8) })).toMatchObject({ erros: { dia: M.dataInvalida } });

    const c = deps().vendas;
    const hojeInt = intervaloDoDia(HOJE);
    const deHoje = await c.listar(hojeInt.inicio, hojeInt.fim);
    expect(deHoje.vendas.map((v) => v.numero)).toEqual([1]);
    expect(deHoje.totalConcluidas).toBe(18);
    const d = await c.detalhar(ontem);
    expect(d).toMatchObject({ numero: 2, registradaPor: "Gisele", formas: ["DEBITO"] });
    expect(d.itensVenda).toEqual([{ itemId: esmalte, nome: "Esmalte", unidadeMedida: "un", quantidade: 2, precoUnitario: 18, subtotal: 36 }]);
    expect(d.movimentacoes.map((m) => [m.tipo, m.quantidade])).toEqual([["SAIDA_VENDA", 2]]);
    // A movimentação de estoque usa a mesma data retroativa.
    const mov = await base.movimentacaoEstoque.findFirstOrThrow({ where: { vendaId: ontem } });
    expect(mov.data.getTime()).toBeLessThan(hojeInt.inicio.getTime());
    await expect(depsDe(negocioB).vendas.detalhar(ontem)).rejects.toThrow("Venda não encontrada");
  });

  it("linhas do mesmo item são somadas; quantidades decimais", async () => {
    const granel = await item("Granola", { unidadeMedida: "kg", precoAtual: 12.9, quantidadeEstoque: 5 });
    const vendaId = id(await vender([{ itemId: granel, quantidade: "0,333" }, { itemId: granel, quantidade: "1,5" }], [{ forma: "PIX", valor: 23.65 }]));
    // 12,90 × 1,833 = 23,6457 → R$ 23,65
    expect(Number((await base.venda.findUniqueOrThrow({ where: { id: vendaId } })).valorTotal)).toBe(23.65);
    expect(await saldo(granel)).toBe(3.167);
  });

  it("T14 — venda com 20 linhas e histórico com 1.000 vendas em menos de 2 s (RNF06)", async () => {
    const ids = await Promise.all(Array.from({ length: 20 }, (_, i) => item(`Produto ${i}`, { precoAtual: 1, quantidadeEstoque: 100 })));
    let inicio = Date.now();
    expect((await vender(ids.map((itemId) => ({ itemId, quantidade: 1 })), [{ forma: "PIX", valor: 20 }])).status).toBe("registrada");
    expect(Date.now() - inicio).toBeLessThan(2_000);

    await base.venda.createMany({
      data: Array.from({ length: 1000 }, (_, k) => ({ negocioId: negocioA, numero: 100 + k, valorTotal: 10, registradaPorId: usuario })),
    });
    const hojeInt = intervaloDoDia(HOJE);
    inicio = Date.now();
    expect((await deps().vendas.listar(hojeInt.inicio, hojeInt.fim)).vendas).toHaveLength(1001);
    expect(Date.now() - inicio).toBeLessThan(2_000);
  });
});
