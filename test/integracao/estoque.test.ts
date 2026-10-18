import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDoEstoque } from "@/lib/db/estoque";
import { criarConsultasDeNegocios } from "@/lib/db/negocios";
import { hoje as hojeLocal } from "@/lib/dominio/datas";
import { somarDias } from "@/lib/dominio/estoque";
import * as servicos from "@/lib/estoque/servicos";
import { MENSAGENS_FLUXO_ESTOQUE as F } from "@/lib/estoque/servicos";
import { MENSAGENS_ESTOQUE as M } from "@/lib/estoque/validacao";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-007 — testes de integração (seção 12): banco real, cliente do negócio e a primitiva
// de movimentação com a trava do item.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();

let usuario: string;
let negocioA: string;
let negocioB: string;

const consultas = (negocioId: string) => criarConsultasDoEstoque(comNegocio(base, { negocioId, usuarioId: usuario }), negocioId);
const depsDe = (negocioId: string, extra: Partial<servicos.DependenciasDoEstoque> = {}): servicos.DependenciasDoEstoque => ({
  estoque: consultas(negocioId),
  usuarioId: usuario,
  hoje: HOJE,
  agora: new Date(),
  ...extra,
});
const deps = () => depsDe(negocioA);

async function produto(nome: string, extra: Record<string, unknown> = {}, negocioId = negocioA) {
  const i = await base.item.create({
    data: {
      negocioId,
      tipo: "PRODUTO_FISICO",
      nome,
      nomeChave: nome.toLowerCase(),
      categoria: "BELEZA",
      unidadeMedida: "un",
      custoBase: 5,
      ...extra,
    },
  });
  return i.id;
}

const entrada = (id: string, quantidade: string, data = HOJE, d = deps()) =>
  servicos.registrarMovimentacao(id, "entrada", { quantidade, data }, d);
const saida = (id: string, quantidade: string, motivo = "QUEBRA", data = HOJE, observacao = "", d = deps()) =>
  servicos.registrarMovimentacao(id, "saida", { quantidade, data, motivo, observacao }, d);

const saldo = async (id: string) => Number((await base.item.findUniqueOrThrow({ where: { id } })).quantidadeEstoque);

/** CA-06/INV-003: na ordem de registro, cada saldo anterior é o posterior da anterior, e o último é o do item. */
async function conferirCadeia(id: string) {
  const movs = await base.movimentacaoEstoque.findMany({ where: { itemId: id }, orderBy: { registradoEm: "asc" } });
  let esperado = 0;
  for (const m of movs) {
    const [q, ant, pos] = [Number(m.quantidade), Number(m.saldoAnterior), Number(m.saldoPosterior)];
    expect(ant).toBeCloseTo(esperado, 3);
    const sinal = m.tipo === "ENTRADA" || m.tipo === "ENTRADA_ESTORNO" ? 1 : -1;
    expect(pos).toBeCloseTo(ant + sinal * q, 3);
    expect(q).toBeGreaterThan(0);
    esperado = pos;
  }
  expect(await saldo(id)).toBeCloseTo(esperado, 3);
  return movs.length;
}

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

describe("movimentações", () => {
  it("T04 — entrada: saldo, movimentação com usuário e datas (CA-01)", async () => {
    const id = await produto("Esmalte");
    expect(await entrada(id, "10")).toEqual({ status: "salvo", mensagem: F.entrada(10, 10) });
    const [m] = await base.movimentacaoEstoque.findMany({ where: { itemId: id } });
    expect(m).toMatchObject({ negocioId: negocioA, tipo: "ENTRADA", usuarioId: usuario, motivo: null });
    expect([Number(m.quantidade), Number(m.saldoAnterior), Number(m.saldoPosterior)]).toEqual([10, 0, 10]);
    expect(m.registradoEm).toBeInstanceOf(Date);
    expect(await saldo(id)).toBe(10);
  });

  it("T05 — saída manual com motivo; sem motivo e 'Outro' sem observação recusados (CA-02, CA-03, INV-006)", async () => {
    const id = await produto("Esmalte");
    await entrada(id, "10");
    expect(await saida(id, "3", "QUEBRA")).toEqual({ status: "salvo", mensagem: F.saida(3, 7) });
    expect(await saida(id, "1", "")).toMatchObject({ status: "erro", erros: { motivo: M.motivoObrigatorio } });
    expect(await saida(id, "1", "OUTRO", HOJE, "  ")).toMatchObject({ status: "erro", erros: { observacao: M.observacaoObrigatoria } });
    expect(await saida(id, "1", "OUTRO", HOJE, "Amostra para cliente")).toMatchObject({ status: "salvo" });
    const movs = await base.movimentacaoEstoque.findMany({ where: { itemId: id, tipo: "SAIDA_MANUAL" }, orderBy: { registradoEm: "asc" } });
    expect(movs.map((m) => [m.motivo, m.observacao])).toEqual([["QUEBRA", null], ["OUTRO", "Amostra para cliente"]]);
    expect(await saldo(id)).toBe(6);
  });

  it("T06 — saída maior que o saldo é recusada; 8 saídas simultâneas nunca deixam o saldo negativo (CA-04, INV-002)", async () => {
    const id = await produto("Esmalte");
    await entrada(id, "2");
    expect(await saida(id, "3")).toMatchObject({ status: "erro", erros: { quantidade: F.insuficiente(2) } });
    expect(await saldo(id)).toBe(2);

    const outro = await produto("Algodão");
    await entrada(outro, "10");
    const resultados = await Promise.all(Array.from({ length: 8 }, () => saida(outro, "6")));
    expect(resultados.filter((r) => r.status === "salvo")).toHaveLength(1);
    expect(await saldo(outro)).toBe(4);
    expect(await base.movimentacaoEstoque.count({ where: { itemId: outro, tipo: "SAIDA_MANUAL" } })).toBe(1);
  });

  it("T07 — cadeia de saldos após sequência e após concorrência de entradas e saídas (CA-06, INV-003)", async () => {
    const id = await produto("Esmalte");
    await entrada(id, "5,5");
    await saida(id, "1,25");
    await entrada(id, "3");
    await Promise.all([
      ...Array.from({ length: 6 }, () => entrada(id, "2")),
      ...Array.from({ length: 6 }, () => saida(id, "1,5")),
    ]);
    expect(await conferirCadeia(id)).toBeGreaterThanOrEqual(9);
    expect(await saldo(id)).toBeGreaterThanOrEqual(0);
  });

  it("T08 — falha depois de atualizar o saldo desfaz tudo (INV-001)", async () => {
    const id = await produto("Esmalte");
    await entrada(id, "10");
    // Usuário inexistente: a inserção da movimentação falha (FK) depois do UPDATE do saldo.
    const r = await entrada(id, "5", HOJE, depsDe(negocioA, { usuarioId: randomUUID() }));
    expect(r).toMatchObject({ status: "erro", mensagem: F.falhaInterna });
    expect(await saldo(id)).toBe(10);
    expect(await conferirCadeia(id)).toBe(1);
  });

  it("T09 — o banco recusa alterar/apagar movimentações, saldo negativo e motivo fora da saída manual (CA-05, INV-002, INV-004, INV-006)", async () => {
    const id = await produto("Esmalte");
    await entrada(id, "10");
    await expect(base.$executeRawUnsafe(`UPDATE "MovimentacaoEstoque" SET quantidade = 1`)).rejects.toThrow(/he_somente_insercao/);
    await expect(base.$executeRawUnsafe(`DELETE FROM "MovimentacaoEstoque"`)).rejects.toThrow(/he_somente_insercao/);
    await expect(base.$executeRawUnsafe(`UPDATE "Item" SET "quantidadeEstoque" = -1 WHERE id = '${id}'`)).rejects.toThrow(/quantidadeEstoque_nao_negativa/);
    const mov = { negocioId: negocioA, itemId: id, quantidade: 1, saldoAnterior: 10, saldoPosterior: 11, usuarioId: usuario };
    await expect(base.movimentacaoEstoque.create({ data: { ...mov, tipo: "ENTRADA", motivo: "PERDA" } })).rejects.toThrow();
    await expect(base.movimentacaoEstoque.create({ data: { ...mov, tipo: "SAIDA_MANUAL" } })).rejects.toThrow();
    await expect(base.movimentacaoEstoque.create({ data: { ...mov, tipo: "ENTRADA", quantidade: 0 } })).rejects.toThrow();
    expect(await conferirCadeia(id)).toBe(1);
  });

  it("T10 — Serviço, arquivado e outro negócio recusados; Serviço fora da lista (CA-12, INV-005)", async () => {
    const servico = await produto("Manicure", { tipo: "SERVICO" });
    const arquivado = await produto("Lixa", { arquivadoEm: new Date(), nomeChave: null });
    const alheio = await produto("Acetona", {}, negocioB);
    expect(await entrada(servico, "1")).toMatchObject({ status: "erro", mensagem: F.semEstoque });
    expect(await entrada(arquivado, "1")).toMatchObject({ status: "erro", mensagem: F.arquivado });
    expect(await entrada(alheio, "1")).toMatchObject({ status: "erro", mensagem: F.naoEncontrado });
    expect(await entrada("nao-e-uuid", "1")).toMatchObject({ status: "erro", mensagem: F.naoEncontrado });
    expect(await base.movimentacaoEstoque.count()).toBe(0);
    expect(await saldo(alheio)).toBe(0);
    await produto("Esmalte");
    expect((await deps().estoque.listar({}, HOJE)).map((p) => p.nome)).toEqual(["Esmalte"]);
    await expect(deps().estoque.detalhar(servico, HOJE)).rejects.toThrow("Item não encontrado");
  });

  it("T14 — data retroativa entra no consumo pela data informada; futura e > 90 dias recusadas (CA-14)", async () => {
    const id = await produto("Esmalte");
    expect(await entrada(id, "10", somarDias(HOJE, 1))).toMatchObject({ status: "erro", erros: { data: M.dataInvalida } });
    expect(await entrada(id, "10", somarDias(HOJE, -91))).toMatchObject({ status: "erro", erros: { data: M.dataInvalida } });
    await entrada(id, "10", HOJE);
    await saida(id, "4", "PERDA", somarDias(HOJE, -5)); // registrada depois, ocorrida antes
    const d = await deps().estoque.detalhar(id, HOJE);
    expect(d.consumoNaJanela).toEqual({ saidas: 4, estornos: 0, primeiroDia: somarDias(HOJE, -5) });
    // Ordem de registro (mais nova primeiro), com a data da ocorrência preservada.
    expect(d.movimentacoes.map((m) => m.tipo)).toEqual(["SAIDA_MANUAL", "ENTRADA"]);
    expect(await conferirCadeia(id)).toBe(2);
  });
});

describe("mínimo, situação e alertas", () => {
  it("T11 — sugestão a partir de movimentações reais, mínimo manual, filtro e contagem (CA-07 a CA-10)", async () => {
    const id = await produto("Esmalte");
    // Só entradas: sem ciclo e sem mínimo → sem alerta (RN07).
    await entrada(id, "100", somarDias(HOJE, -29));
    let d = await deps().estoque.detalhar(id, HOJE);
    expect([d.sugestao, d.minimo, d.situacao]).toEqual([null, null, "SEM_MINIMO"]);

    // Saídas somando 60 em 30 dias, cobertura 7 → ⌈2 × 7⌉ = 14.
    await saida(id, "25", "USO_INTERNO", somarDias(HOJE, -20));
    await saida(id, "35", "USO_INTERNO", somarDias(HOJE, -2));
    d = await deps().estoque.detalhar(id, HOJE);
    expect(d.sugestao).toBe(14);
    expect(d.minimo).toEqual({ valor: 14, origem: "sugerido" });
    expect(d.situacao).toBe("NORMAL"); // saldo 40

    // Mínimo manual 10 vale sobre a sugestão, que continua visível; remover volta a 14.
    expect(await servicos.definirMinimo(id, { estoqueMinimo: "10" }, deps())).toMatchObject({ status: "salvo" });
    d = await deps().estoque.detalhar(id, HOJE);
    expect([d.minimo, d.sugestao]).toEqual([{ valor: 10, origem: "manual" }, 14]);
    await servicos.definirMinimo(id, { estoqueMinimo: "" }, deps());
    expect((await deps().estoque.detalhar(id, HOJE)).minimo).toEqual({ valor: 14, origem: "sugerido" });

    // Saldo 14 → baixo; 0 → sem estoque; aparece no filtro e na contagem.
    await saida(id, "26", "PERDA");
    expect((await deps().estoque.detalhar(id, HOJE)).situacao).toBe("BAIXO");
    const manual = await produto("Algodão", { estoqueMinimo: 5 }); // mínimo manual no cadastro alerta já (OPEN-003)
    expect((await deps().estoque.detalhar(manual, HOJE)).situacao).toBe("SEM_ESTOQUE");
    await produto("Lixa");
    expect((await deps().estoque.listar({ situacao: "baixo" }, HOJE)).map((p) => p.nome)).toEqual(["Algodão", "Esmalte"]);
    expect((await deps().estoque.listar({ situacao: "sem-estoque" }, HOJE)).map((p) => p.nome)).toEqual(["Algodão"]);
    expect(await deps().estoque.contarAlertas(HOJE)).toEqual({ baixo: 1, semEstoque: 1 });
    expect((await deps().estoque.situacaoDoProduto(id, HOJE))?.situacao).toBe("BAIXO");
  });

  it("T12 — dias de cobertura mudam a sugestão (CA-11)", async () => {
    const id = await produto("Esmalte");
    await entrada(id, "100", somarDias(HOJE, -29));
    await saida(id, "60", "USO_INTERNO", somarDias(HOJE, -10));
    expect((await deps().estoque.detalhar(id, HOJE)).sugestao).toBe(14);
    await criarConsultasDeNegocios(base).definirDiasCobertura(negocioA, 14);
    expect((await deps().estoque.detalhar(id, HOJE)).sugestao).toBe(28);
    // O outro negócio não é afetado.
    expect(await criarConsultasDeNegocios(base).diasCobertura(negocioB)).toBe(7);
  });

  it("estornos de venda descontam o consumo (preparação das SPECs 008/011)", async () => {
    const id = await produto("Esmalte");
    const c = deps().estoque;
    await c.registrar({ itemId: id, tipo: "ENTRADA", quantidade: 50, usuarioId: usuario, data: new Date() });
    await c.registrar({ itemId: id, tipo: "SAIDA_VENDA", quantidade: 10, usuarioId: usuario, data: new Date() });
    await c.registrar({ itemId: id, tipo: "ENTRADA_ESTORNO", quantidade: 4, usuarioId: usuario, data: new Date() });
    const d = await c.detalhar(id, HOJE);
    expect(d.consumoNaJanela).toMatchObject({ saidas: 10, estornos: 4 });
    expect(d.sugestao).toBe(42); // ⌈(10 − 4) ÷ 1 × 7⌉
    expect(await conferirCadeia(id)).toBe(3);
  });

  it("T15 — lista com 500 produtos e 10.000 movimentações em menos de 2 s (RNF06)", async () => {
    await base.item.createMany({
      data: Array.from({ length: 500 }, (_, i) => ({
        negocioId: negocioA,
        tipo: "PRODUTO_FISICO" as const,
        nome: `Produto ${i}`,
        nomeChave: `produto ${i}`,
        categoria: "OUTROS" as const,
        unidadeMedida: "un",
        custoBase: 1,
        quantidadeEstoque: 100,
      })),
    });
    const ids = (await base.item.findMany({ where: { negocioId: negocioA }, select: { id: true } })).map((i) => i.id);
    const agora = Date.now();
    await base.movimentacaoEstoque.createMany({
      data: Array.from({ length: 10_000 }, (_, k) => ({
        negocioId: negocioA,
        itemId: ids[k % ids.length],
        // Cada produto recebe 20 movimentações, alternando entrada e saída (ciclo completo).
        tipo: Math.floor(k / ids.length) % 2 ? ("SAIDA_MANUAL" as const) : ("ENTRADA" as const),
        motivo: Math.floor(k / ids.length) % 2 ? ("USO_INTERNO" as const) : null,
        quantidade: 1,
        saldoAnterior: 100,
        saldoPosterior: 100,
        usuarioId: usuario,
        data: new Date(agora - (k % 60) * 86_400_000),
      })),
    });
    const inicio = Date.now();
    const lista = await deps().estoque.listar({}, HOJE);
    expect(Date.now() - inicio).toBeLessThan(2_000);
    expect(lista).toHaveLength(500);
    expect(lista.every((p) => p.sugestao !== null)).toBe(true);
  });
});
