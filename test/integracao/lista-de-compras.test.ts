import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { COMPRAS_POR_PAGINA, criarConsultasDeCompras } from "@/lib/db/compras";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { lerFiltrosDasCompras, SEM_FILTROS_DE_COMPRA, type FiltrosDasCompras } from "@/lib/dominio/lista-de-compras";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-027 (etapa 2a) — T05: a lista de compras no banco (CA-10, INV-010): busca, filtros, total de
// todas as páginas sem as canceladas, o limite do plano gratuito, a situação das contas, o nome
// mascarado no modo suporte e outro negócio fora.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());

let usuario: string;
let negocioA: string;
let negocioB: string;
let fornA: string;
let fornB: string;

const compras = (negocioId = negocioA, suporte = false) => criarConsultasDeCompras(comNegocio(base, { negocioId, usuarioId: usuario, modoSuporte: suporte }), negocioId, { mascararNomes: suporte });
const listar = (filtros: Partial<FiltrosDasCompras> = {}, extra: { pagina?: number; desde?: string | null; negocioId?: string; suporte?: boolean } = {}) =>
  compras(extra.negocioId, extra.suporte).listar({ filtros: { ...SEM_FILTROS_DE_COMPRA, ...filtros }, pagina: extra.pagina, desde: extra.desde });

let proximo = 1;
/** Uma compra gravada direto no banco, com as contas na situação pedida (a data pode ser antiga). */
async function compra(p: {
  dia: string;
  fornecedorId?: string;
  total?: number;
  documento?: string | null;
  cancelada?: boolean;
  contas?: ("ABERTA" | "PARCIAL" | "QUITADA" | "CANCELADA")[];
  negocioId?: string;
}) {
  const negocioId = p.negocioId ?? negocioA;
  const fornecedorId = p.fornecedorId ?? fornA;
  const total = p.total ?? 100;
  const documento = p.documento === undefined ? `NF-${proximo}` : p.documento;
  const c = await base.compra.create({
    data: {
      negocioId,
      numero: proximo++,
      fornecedorId,
      numeroDocumento: documento,
      documentoChave: documento && !p.cancelada ? documento.toUpperCase() : null,
      semNotaFiscal: documento === null,
      data: new Date(`${p.dia}T00:00:00Z`),
      valorProdutos: total,
      total,
      condicao: (p.contas?.length ?? 1) > 1 ? "A_PRAZO" : "A_VISTA",
      registradaPorId: usuario,
      ...(p.cancelada ? { situacao: "CANCELADA" as const, canceladaPorId: usuario, canceladaEm: new Date(), motivoCancelamento: "Registrada errada" } : {}),
    },
  });
  const contas = p.contas ?? [p.cancelada ? "CANCELADA" : "ABERTA"];
  for (const [i, status] of contas.entries()) {
    const valor = total / contas.length;
    await base.contaPagarReceber.create({
      data: {
        negocioId,
        compraId: c.id,
        tipo: "PAGAR",
        categoria: "FORNECEDORES",
        descricao: `Compra nº ${c.numero} — parcela ${i + 1}/${contas.length}`,
        valorTotal: valor,
        valorPago: status === "QUITADA" ? valor : status === "PARCIAL" ? valor / 2 : 0,
        vencimento: new Date(`${p.dia}T15:00:00Z`),
        status,
        criadaPorId: usuario,
        fornecedorId,
        numeroDocumento: documento,
      },
    });
  }
  return c;
}

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  proximo = 1;
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Gisele", email: "gisele@exemplo.com", consentimentoLgpdEm: new Date(), versaoTermosAceita: "2026-11-01" } })).id;
  negocioA = (await base.negocio.create({ data: { nome: "Loja A" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Loja B" } })).id;
  fornA = (await base.fornecedor.create({ data: { negocioId: negocioA, tipo: "PESSOA_JURIDICA", nome: "Embalagens Exemplo Ltda", nomeFantasia: "Embalagens Exemplo" } })).id;
  fornB = (await base.fornecedor.create({ data: { negocioId: negocioA, tipo: "PESSOA_FISICA", nome: "Bruna Fornecedora" } })).id;
});

afterAll(async () => {
  await base.$disconnect();
});

describe("T05 — lista de compras (CA-10, INV-010)", () => {
  it("CA-10: o fornecedor A em outubro; o total soma só as não canceladas, e as mais recentes vêm primeiro", async () => {
    await compra({ dia: "2026-10-05", total: 100 });
    const segunda = await compra({ dia: "2026-10-20", total: 50 });
    await compra({ dia: "2026-10-25", total: 70, cancelada: true });
    await compra({ dia: "2026-10-10", fornecedorId: fornB, total: 300 });
    await compra({ dia: "2026-11-03", total: 40 });

    const r = await listar({ fornecedorId: fornA, de: "2026-10-01", ate: "2026-10-31" });
    expect(r.compras.map((c) => c.numero)).toEqual([3, 2, 1]);
    expect(r.compras[1]).toEqual({
      id: segunda.id,
      numero: 2,
      data: "2026-10-20",
      fornecedor: "Embalagens Exemplo",
      numeroDocumento: "NF-2",
      semNotaFiscal: false,
      totalCentavos: 5000,
      condicao: "A_VISTA",
      pagamento: "A_PAGAR",
      situacao: "REGISTRADA",
    });
    expect(r).toMatchObject({ quantidade: 2, totalCentavos: 15000, canceladas: 1, pagina: 1, paginas: 1, ocultasPeloPlano: 0 });

    // Só as canceladas: aparecem, mas não somam.
    expect(await listar({ situacao: "CANCELADA" })).toMatchObject({ quantidade: 0, totalCentavos: 0, canceladas: 1 });
    expect((await listar({ situacao: "REGISTRADA" })).compras).toHaveLength(4);
  });

  it("busca pelo nome (ou nome fantasia) do fornecedor, pelo nº do documento e pelo nº da compra", async () => {
    await compra({ dia: "2026-11-01", documento: "1234" });
    await compra({ dia: "2026-11-02", fornecedorId: fornB, documento: "A-77" });
    await compra({ dia: "2026-11-03", documento: null });

    const numeros = async (busca: string) => (await listar({ busca })).compras.map((c) => c.numero);
    expect(await numeros("bruna")).toEqual([2]);
    expect(await numeros("exemplo")).toEqual([3, 1]);
    expect(await numeros("a-7")).toEqual([2]);
    expect(await numeros("3")).toEqual([3, 1]); // nº da compra 3 e o documento 1234
    expect(await numeros("nº 2")).toEqual([2]);
    expect(await numeros("nada disso")).toEqual([]);
    const semNota = (await listar({ busca: "#3" })).compras[0];
    expect(semNota).toMatchObject({ numero: 3, numeroDocumento: null, semNotaFiscal: true });
  });

  it("a situação das contas: a pagar, paga em parte e paga; a cancelada não tem", async () => {
    await compra({ dia: "2026-11-01", contas: ["ABERTA", "ABERTA"] });
    await compra({ dia: "2026-11-02", contas: ["QUITADA", "ABERTA"] });
    await compra({ dia: "2026-11-03", contas: ["PARCIAL"] });
    await compra({ dia: "2026-11-04", contas: ["QUITADA", "QUITADA"] });
    await compra({ dia: "2026-11-05", cancelada: true });
    const r = await listar();
    expect(r.compras.map((c) => [c.numero, c.condicao, c.pagamento, c.situacao])).toEqual([
      [5, "A_VISTA", null, "CANCELADA"],
      [4, "A_PRAZO", "PAGA", "REGISTRADA"],
      [3, "A_VISTA", "PARCIAL", "REGISTRADA"],
      [2, "A_PRAZO", "PARCIAL", "REGISTRADA"],
      [1, "A_PRAZO", "A_PAGAR", "REGISTRADA"],
    ]);
  });

  it("várias páginas: o total soma todas, e a página fora do intervalo vai para a última", async () => {
    const n = COMPRAS_POR_PAGINA + 5;
    await base.compra.createMany({
      data: Array.from({ length: n }, (_, i) => ({
        negocioId: negocioA,
        numero: i + 1,
        fornecedorId: fornA,
        numeroDocumento: `D${i + 1}`,
        documentoChave: `D${i + 1}`,
        data: new Date("2026-11-10T00:00:00Z"),
        valorProdutos: 10,
        total: 10,
        condicao: "A_VISTA" as const,
        registradaPorId: usuario,
      })),
    });
    const p1 = await listar();
    expect(p1).toMatchObject({ pagina: 1, paginas: 2, quantidade: n, totalCentavos: n * 1000 });
    expect(p1.compras).toHaveLength(COMPRAS_POR_PAGINA);
    expect(p1.compras[0].numero).toBe(n);
    const p2 = await listar({}, { pagina: 9 });
    expect(p2.pagina).toBe(2);
    expect(p2.compras.map((c) => c.numero)).toEqual([5, 4, 3, 2, 1]);
  });

  it("plano gratuito: compras anteriores ao histórico ficam fora, inclusive com o período pedido antes", async () => {
    await compra({ dia: "2025-10-15", total: 100 });
    await compra({ dia: "2025-12-01", total: 20 });
    const r = await listar({ de: "2025-01-01" }, { desde: "2025-12-01" });
    expect(r.compras.map((c) => c.numero)).toEqual([2]);
    expect(r).toMatchObject({ quantidade: 1, totalCentavos: 2000, ocultasPeloPlano: 1 });
    expect(await listar()).toMatchObject({ quantidade: 2, ocultasPeloPlano: 0 });
  });

  it("modo suporte: o nome do fornecedor sai mascarado e não é buscado; o nº continua buscável", async () => {
    await compra({ dia: "2026-11-01", documento: "1234" });
    const r = await listar({}, { suporte: true });
    expect(r.compras[0].fornecedor).not.toContain("Exemplo");
    expect(r.compras[0].fornecedor).toMatch(/^E/);
    expect((await listar({ busca: "exemplo" }, { suporte: true })).compras).toEqual([]);
    expect((await listar({ busca: "1234" }, { suporte: true })).compras).toHaveLength(1);
  });

  it("INV-010: as compras de outro negócio ficam fora", async () => {
    await compra({ dia: "2026-11-01" });
    const fornOutro = (await base.fornecedor.create({ data: { negocioId: negocioB, tipo: "PESSOA_FISICA", nome: "Outro" } })).id;
    await compra({ dia: "2026-11-02", negocioId: negocioB, fornecedorId: fornOutro, total: 999 });
    expect(await listar()).toMatchObject({ quantidade: 1, totalCentavos: 10000 });
    expect((await listar({}, { negocioId: negocioB })).compras.map((c) => c.fornecedor)).toEqual(["Outro"]);
    // O filtro com o fornecedor de outro negócio não traz nada.
    expect((await listar({ fornecedorId: fornOutro })).compras).toEqual([]);
  });

  it("filtros do endereço: período invertido não filtra, e valores desconhecidos são ignorados", async () => {
    await compra({ dia: "2026-10-01" });
    await compra({ dia: "2026-11-01" });
    const { filtros, erro } = lerFiltrosDasCompras({ de: "2026-11-30", ate: "2026-10-01", situacao: "TALVEZ", fornecedor: "x" });
    expect(erro).toBe("A data final precisa ser igual ou posterior à inicial.");
    expect((await listar(filtros)).compras).toHaveLength(2);
  });
});
