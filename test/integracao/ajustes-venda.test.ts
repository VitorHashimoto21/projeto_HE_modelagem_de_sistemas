import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDeRelatorios } from "@/lib/db/relatorios";
import { criarConsultasDeVendas } from "@/lib/db/vendas";
import { hoje as hojeLocal, intervaloDoDia } from "@/lib/dominio/datas";
import { carregarRentabilidade } from "@/lib/relatorios/servicos";
import * as servicos from "@/lib/vendas/servicos";
import { MENSAGENS_FLUXO_VENDA as F } from "@/lib/vendas/servicos";
import { MENSAGENS_VENDA as M } from "@/lib/vendas/validacao";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-017 — testes de integração (seção 12): o caso do eletricista, com banco real, o
// cliente do negócio e a primitiva de estoque da SPEC-007 dentro da transação da venda.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();

let usuario: string;
let negocio: string;
let lampada: string;
let troca: string;

const deps = (podeAjustarPreco = false): servicos.DependenciasDaVenda => ({
  vendas: criarConsultasDeVendas(comNegocio(base, { negocioId: negocio, usuarioId: usuario }), negocio),
  usuarioId: usuario,
  hoje: HOJE,
  agora: new Date(),
  podeAjustarPreco,
});
const vender = (linhas: unknown[], pagamentos: unknown[], podeAjustarPreco = false) =>
  servicos.registrarVenda({ carrinho: JSON.stringify({ id: randomUUID(), linhas, pagamentos }) }, deps(podeAjustarPreco));
const id = (r: servicos.EstadoDaVenda) => {
  if (r.status !== "registrada") throw new Error(`esperava registrada: ${JSON.stringify(r)}`);
  return r.vendaId;
};
const saldo = async (itemId: string) => Number((await base.item.findUniqueOrThrow({ where: { id: itemId } })).quantidadeEstoque);

async function item(nome: string, extra: Record<string, unknown>) {
  return (
    await base.item.create({
      data: { negocioId: negocio, tipo: "PRODUTO_FISICO", nome, nomeChave: nome.toLowerCase(), categoria: "CASA", unidadeMedida: "un", custoBase: 10, ...extra },
    })
  ).id;
}

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Lucas", email: "lucas@exemplo.com" } })).id;
  negocio = (await base.negocio.create({ data: { nome: "Lucas Eletricista" } })).id;
  // Lâmpada LED (custo R$ 10, 20 em estoque) e o serviço "Troca de lâmpadas": custo próprio
  // R$ 30, 2 lâmpadas por execução, preço R$ 80.
  lampada = await item("Lâmpada LED", { quantidadeEstoque: 20, precoAtual: 25 });
  troca = await item("Troca de lâmpadas", { tipo: "SERVICO", unidadeMedida: "atend", custoBase: 30, precoAtual: 80, quantidadeEstoque: 0 });
  await base.materialServico.create({ data: { negocioId: negocio, servicoId: troca, materialId: lampada, quantidade: 2 } });
});

afterAll(async () => {
  await base.$disconnect();
});

describe("ajustes na venda (SPEC-017)", () => {
  it("T03 — CA-01: 6 lâmpadas numa troca: baixa e custo pelo ajuste; catálogo intacto (INV-001, INV-004, INV-005)", async () => {
    const vendaId = id(await vender([{ itemId: troca, quantidade: 1, materiais: [{ materialId: lampada, quantidade: 6 }] }], [{ forma: "PIX", valor: 80 }]));
    expect(await saldo(lampada)).toBe(14);
    const [iv] = await base.itemVenda.findMany({ where: { vendaId } });
    expect([Number(iv.precoUnitario), Number(iv.custoUnitario), iv.materiaisAjustados, iv.precoOficial, iv.motivoAjustePreco]).toEqual([80, 90, true, null, null]);
    const movs = await base.movimentacaoEstoque.findMany({ where: { vendaId } });
    expect(movs.map((m) => [m.itemId, m.tipo, Number(m.quantidade)])).toEqual([[lampada, "SAIDA_VENDA", 6]]);
    // O catálogo continua com 2 lâmpadas por execução e o preço oficial.
    expect(Number((await base.materialServico.findFirstOrThrow()).quantidade)).toBe(2);
    expect(Number((await base.item.findUniqueOrThrow({ where: { id: troca } })).precoAtual)).toBe(80);
  });

  it("T04 — CA-02: sem ajuste, igual à SPEC-008 (padrão do catálogo × quantidade)", async () => {
    const vendaId = id(await vender([{ itemId: troca, quantidade: 3 }], [{ forma: "PIX", valor: 240 }]));
    expect(await saldo(lampada)).toBe(14);
    const [iv] = await base.itemVenda.findMany({ where: { vendaId } });
    expect([Number(iv.custoUnitario), iv.materiaisAjustados]).toEqual([50, false]);
  });

  it("T03 — material fora do serviço e ajuste de materiais num produto são recusados (OPEN-001)", async () => {
    const fita = await item("Fita isolante", { quantidadeEstoque: 5, precoAtual: 8 });
    expect(await vender([{ itemId: troca, quantidade: 1, materiais: [{ materialId: fita, quantidade: 1 }] }], [{ forma: "PIX", valor: 80 }])).toEqual({
      status: "erro",
      mensagem: F.materialInvalido("Troca de lâmpadas"),
    });
    expect(await vender([{ itemId: lampada, quantidade: 1, materiais: [{ materialId: lampada, quantidade: 1 }] }], [{ forma: "PIX", valor: 25 }])).toMatchObject({
      status: "erro",
      mensagem: F.materialInvalido("Lâmpada LED"),
    });
    expect(await base.venda.count()).toBe(0);
  });

  it("T05 — CA-03: o ajuste respeita o estoque; nada é gravado", async () => {
    await base.item.update({ where: { id: lampada }, data: { quantidadeEstoque: 4 } });
    expect(await vender([{ itemId: troca, quantidade: 1, materiais: [{ materialId: lampada, quantidade: 6 }] }], [{ forma: "PIX", valor: 80 }])).toEqual({
      status: "erro",
      mensagem: F.estoque("Lâmpada LED", 4, "un"),
    });
    expect([await base.venda.count(), await saldo(lampada)]).toEqual([0, 4]);
  });

  it("T06 — CA-04/CA-05: preço ajustado com Vendas — editar e motivo; sem permissão é recusado; catálogo e histórico intactos (INV-002, INV-003)", async () => {
    const linha = { itemId: troca, quantidade: 1, precoVisto: 80, precoAjustado: "150,00", motivoAjuste: "preço combinado" };
    // Sem a permissão: recusado no servidor, nada gravado.
    expect(await vender([linha], [{ forma: "PIX", valor: 150 }], false)).toEqual({ status: "erro", mensagem: F.ajusteSemPermissao });
    expect(await base.venda.count()).toBe(0);
    // Sem motivo: recusado na validação.
    expect(await vender([{ ...linha, motivoAjuste: "" }], [{ forma: "PIX", valor: 150 }], true)).toMatchObject({
      status: "erro",
      erros: { [`motivo_${troca}`]: M.motivoAjusteObrigatorio },
    });
    // O preço oficial mudou depois que o carrinho foi aberto: o ajuste vale e guarda o oficial do momento.
    await base.item.update({ where: { id: troca }, data: { precoAtual: 85 } });
    const vendaId = id(await vender([linha], [{ forma: "PIX", valor: 150 }], true));
    const v = await base.venda.findUniqueOrThrow({ where: { id: vendaId }, include: { itens: true } });
    expect(Number(v.valorTotal)).toBe(150);
    expect(v.itens.map((i) => [Number(i.precoUnitario), Number(i.precoOficial), i.motivoAjustePreco])).toEqual([[150, 85, "preço combinado"]]);
    expect(Number((await base.item.findUniqueOrThrow({ where: { id: troca } })).precoAtual)).toBe(85);
    expect(await base.historicoPreco.count()).toBe(0);
    // O detalhe e o histórico mostram o ajuste (CA-07).
    const d = await deps().vendas.detalhar(vendaId);
    expect(d.itensVenda[0]).toMatchObject({ precoUnitario: 150, precoOficial: 85, motivoAjustePreco: "preço combinado", materiaisAjustados: false });
    expect((await deps().vendas.listar(intervaloDoDia(HOJE).inicio, intervaloDoDia(HOJE).fim)).vendas[0].precoAjustado).toBe(true);
  });

  it("T06 — o banco exige preço oficial e motivo juntos no ajuste", async () => {
    const vendaId = id(await vender([{ itemId: troca, quantidade: 1 }], [{ forma: "PIX", valor: 80 }]));
    await expect(base.itemVenda.updateMany({ where: { vendaId }, data: { precoOficial: 80 } })).rejects.toThrow();
  });

  it("T07 — CA-08: o cancelamento devolve exatamente as lâmpadas baixadas", async () => {
    const vendaId = id(await vender([{ itemId: troca, quantidade: 1, materiais: [{ materialId: lampada, quantidade: 6 }] }], [{ forma: "PIX", valor: 80 }]));
    expect(await saldo(lampada)).toBe(14);
    expect(await servicos.cancelarVenda(vendaId, { motivo: "ERRO_REGISTRO", formaReembolso: "PIX" }, deps())).toMatchObject({ status: "cancelada" });
    expect(await saldo(lampada)).toBe(20);
  });

  it("T08 — CA-09: rentabilidade usa o preço cobrado e o custo com os materiais ajustados", async () => {
    id(
      await vender(
        [{ itemId: troca, quantidade: 1, materiais: [{ materialId: lampada, quantidade: 6 }], precoAjustado: 150, motivoAjuste: "preço combinado" }],
        [{ forma: "PIX", valor: 150 }],
        true,
      ),
    );
    const r = await carregarRentabilidade(HOJE, HOJE, "margem", {
      relatorios: criarConsultasDeRelatorios(comNegocio(base, { negocioId: negocio, usuarioId: usuario }), negocio),
      negocio: "Lucas Eletricista",
      hoje: HOJE,
      agora: new Date(),
    });
    expect(r.itens.map((i) => [i.nome, i.faturamentoCentavos, i.custoCentavos, i.margemCentavos])).toEqual([["Troca de lâmpadas", 15000, 9000, 6000]]);
  });
});
