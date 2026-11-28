import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarConsultasDeCompras, LIMITE_DE_COMPRAS_DO_FORNECEDOR } from "@/lib/db/compras";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDoEstoque } from "@/lib/db/estoque";
import { criarConsultasFinanceiras } from "@/lib/db/financeiro";
import { validarCompra, type DadosDaCompra } from "@/lib/dominio/compras";
import { SEM_FILTROS } from "@/lib/dominio/contas";
import { hoje as hojeLocal } from "@/lib/dominio/datas";
import { somarDias } from "@/lib/dominio/estoque";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-027 (etapa 2c) — CA-09: as ligações com a compra. O histórico do produto mostra a entrada da
// compra; a conta traz a compra (nº e id); o detalhe do fornecedor mostra as compras dele e o total
// comprado, sem as canceladas, até 50, e nada de outro fornecedor ou de outro negócio (INV-010).

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();

let usuario: string;
let negocioA: string;
let negocioB: string;
let fornecedor: string;
let outro: string;
let embalagemP: string;

const cliente = (negocioId = negocioA) => comNegocio(base, { negocioId, usuarioId: usuario });
const compras = (negocioId = negocioA) => criarConsultasDeCompras(cliente(negocioId), negocioId);

function compra(fornecedorId: string, documento: string, quantidade = 100): DadosDaCompra {
  const v = validarCompra(
    {
      id: randomUUID(),
      fornecedorId,
      numeroDocumento: documento,
      dia: HOJE,
      linhas: [{ itemId: embalagemP, quantidade, custoUnitario: 1.2 }],
      condicao: "A_PRAZO",
      parcelas: [{ vencimento: somarDias(HOJE, 28) }],
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

describe("CA-09 — ligações com a compra", () => {
  it("o histórico do produto mostra a entrada da compra nº 1; as outras movimentações, sem compra", async () => {
    const r = await compras().registrar(compra(fornecedor, "1234"), usuario);
    await base.movimentacaoEstoque.create({
      data: { negocioId: negocioA, itemId: embalagemP, tipo: "SAIDA_MANUAL", motivo: "PERDA", quantidade: 1, saldoAnterior: 120, saldoPosterior: 119, usuarioId: usuario },
    });
    await base.item.update({ where: { id: embalagemP }, data: { quantidadeEstoque: 119 } });
    const d = await criarConsultasDoEstoque(cliente(), negocioA).detalhar(embalagemP, HOJE);
    const entrada = d.movimentacoes.find((m) => m.tipo === "ENTRADA")!;
    expect(entrada).toMatchObject({ quantidade: 100, saldoAnterior: 20, saldoPosterior: 120, compra: { id: r.id, numero: 1 } });
    expect(d.movimentacoes.find((m) => m.tipo === "SAIDA_MANUAL")!.compra).toBeNull();
  });

  it("a conta da compra traz o nº e o id da compra, na lista e no detalhe; a conta manual, não", async () => {
    const r = await compras().registrar(compra(fornecedor, "1234"), usuario);
    const fin = criarConsultasFinanceiras(cliente(), negocioA);
    await base.contaPagarReceber.create({
      data: { negocioId: negocioA, tipo: "PAGAR", categoria: "OUTROS", descricao: "Luz", valorTotal: 80, vencimento: new Date(`${HOJE}T15:00:00Z`), status: "ABERTA", criadaPorId: usuario },
    });
    const lista = await fin.listarContas({ tipo: "PAGAR", situacao: "todas", filtros: SEM_FILTROS }, HOJE);
    const daCompra = lista.contas.find((c) => c.origem === "compra")!;
    expect(daCompra.compra).toEqual({ id: r.id, numero: 1 });
    expect(lista.contas.find((c) => c.origem === "manual")!.compra).toBeNull();
    expect((await fin.detalharConta(daCompra.id, HOJE)).compra).toEqual({ id: r.id, numero: 1 });
    // O filtro de origem "Compra" encontra só a conta da compra.
    const filtradas = await fin.listarContas({ tipo: "PAGAR", situacao: "todas", filtros: { ...SEM_FILTROS, origem: "compra" } }, HOJE);
    expect(filtradas.contas.map((c) => c.id)).toEqual([daCompra.id]);
  });

  it("o fornecedor mostra as compras dele, das mais recentes para as mais antigas, e o total sem as canceladas", async () => {
    const r1 = await compras().registrar(compra(fornecedor, "1"), usuario);
    const r2 = await compras().registrar(compra(fornecedor, "2", 10), usuario);
    await compras().registrar(compra(outro, "3", 50), usuario);
    // A nº 2 cancelada (o cancelamento é da etapa 3; aqui, gravado direto no banco).
    await base.compra.update({ where: { id: r2.id }, data: { situacao: "CANCELADA", documentoChave: null, canceladaPorId: usuario, canceladaEm: new Date(), motivoCancelamento: "Em dobro" } });

    const f = await compras().doFornecedor(fornecedor);
    expect(f).toEqual({
      compras: [
        { id: r2.id, numero: 2, data: HOJE, totalCentavos: 1200, situacao: "CANCELADA" },
        { id: r1.id, numero: 1, data: HOJE, totalCentavos: 12000, situacao: "REGISTRADA" },
      ],
      quantidade: 2,
      totalCentavos: 12000,
    });
    expect((await compras().doFornecedor(outro)).totalCentavos).toBe(6000);
  });

  it("até 50 compras, com a quantidade de todas; id inválido e outro negócio não trazem nada", async () => {
    await base.compra.createMany({
      data: Array.from({ length: LIMITE_DE_COMPRAS_DO_FORNECEDOR + 2 }, (_, i) => ({
        negocioId: negocioA,
        numero: i + 1,
        fornecedorId: fornecedor,
        numeroDocumento: `D${i + 1}`,
        documentoChave: `D${i + 1}`,
        data: new Date(`${HOJE}T00:00:00Z`),
        valorProdutos: 10,
        total: 10,
        condicao: "A_VISTA" as const,
        registradaPorId: usuario,
      })),
    });
    const f = await compras().doFornecedor(fornecedor);
    expect(f.compras).toHaveLength(LIMITE_DE_COMPRAS_DO_FORNECEDOR);
    expect(f.compras[0].numero).toBe(LIMITE_DE_COMPRAS_DO_FORNECEDOR + 2);
    expect(f).toMatchObject({ quantidade: LIMITE_DE_COMPRAS_DO_FORNECEDOR + 2, totalCentavos: (LIMITE_DE_COMPRAS_DO_FORNECEDOR + 2) * 1000 });
    expect(await compras().doFornecedor("nao-e-uuid")).toEqual({ compras: [], quantidade: 0, totalCentavos: 0 });
    expect(await compras(negocioB).doFornecedor(fornecedor)).toEqual({ compras: [], quantidade: 0, totalCentavos: 0 });
  });
});
