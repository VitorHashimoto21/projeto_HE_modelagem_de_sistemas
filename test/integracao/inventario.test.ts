import { randomUUID } from "node:crypto";
import { strFromU8, unzipSync } from "fflate";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import * as servicos from "@/lib/catalogo/servicos";
import { criarConsultasDoCatalogo } from "@/lib/db/catalogo";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDoEstoque, type Movimento } from "@/lib/db/estoque";
import { criarConsultasDaLgpd } from "@/lib/db/lgpd";
import { hoje as hojeLocal, intervaloDoDia } from "@/lib/dominio/datas";
import { arquivoDoInventario, carregarInventario } from "@/lib/estoque/inventario";
import { exportar } from "@/lib/lgpd/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-025 — testes de integração (seção 12): T05, T06, T07 (sem plano) e T08, banco real e cliente do negócio.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();

let usuario: string;
let negocioA: string;
let negocioB: string;

const cliente = (negocioId: string) => comNegocio(base, { negocioId, usuarioId: usuario });
const depsDe = (negocioId: string) => ({ catalogo: criarConsultasDoCatalogo(cliente(negocioId), negocioId), usuarioId: usuario });
const estoqueDe = (negocioId: string) => criarConsultasDoEstoque(cliente(negocioId), negocioId);

const produto = (nome: string, custoBase = "10", extra: Record<string, string> = {}) => ({
  tipo: "PRODUTO_FISICO",
  nome,
  categoria: "ACESSORIOS",
  unidadeMedida: "un",
  custoBase,
  ...extra,
});

async function criar(campos: Record<string, string>, negocioId = negocioA) {
  const r = await servicos.criarItem(campos, depsDe(negocioId));
  if (r.status !== "salvo") throw new Error(`esperava salvo: ${JSON.stringify(r)}`);
  return r.itemId;
}

/** Movimentação com o instante da ocorrência informado (o registro é sempre agora). */
async function mover(itemId: string, tipo: Movimento["tipo"], quantidade: number, data: Date, negocioId = negocioA) {
  await estoqueDe(negocioId).registrar({ itemId, tipo, quantidade, data, usuarioId: usuario, motivo: tipo === "SAIDA_MANUAL" ? "PERDA" : null });
}
const meioDia = (dia: string) => new Date(intervaloDoDia(dia).inicio.getTime() + 12 * 3_600_000);
/** Instante local (America/Sao_Paulo) no dia, em minutos desde a meia-noite. */
const as = (dia: string, horas: number, minutos: number) => new Date(intervaloDoDia(dia).inicio.getTime() + (horas * 60 + minutos) * 60_000);

const historico = (itemId: string) =>
  base.historicoCusto.findMany({ where: { itemId }, orderBy: { vigenteDesde: "asc" }, select: { custo: true, usuarioId: true } }).then((l) => l.map((h) => [Number(h.custo), h.usuarioId]));

async function inventarioDe(data: string, negocioId = negocioA) {
  const r = await carregarInventario(data, { estoque: estoqueDe(negocioId), hoje: HOJE });
  if (!r.ok) throw new Error(r.erro);
  return r.inventario;
}
const quantidades = async (data: string, negocioId = negocioA) => Object.fromEntries((await inventarioDe(data, negocioId)).linhas.map((l) => [l.nome, l.quantidade]));

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Gisele", email: "gisele@exemplo.com", consentimentoLgpdEm: new Date(), versaoTermosAceita: "2026-10-23" } })).id;
  negocioA = (await base.negocio.create({ data: { nome: "Semijoias A", cnpj: "11222333000181" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Semijoias B" } })).id;
});

afterAll(async () => {
  await base.$disconnect();
});

describe("T05 — histórico de custo (CA-13, INV-004)", () => {
  it("o cadastro grava o primeiro custo; editar sem mudar o custo não grava; mudar grava com o autor", async () => {
    const id = await criar(produto("Brinco argola dourado M", "18.5"));
    expect(await historico(id)).toEqual([[18.5, usuario]]);
    await servicos.editarItem(id, produto("Brinco argola dourado M (par)", "18,50"), depsDe(negocioA));
    expect(await historico(id)).toHaveLength(1);
    await servicos.editarItem(id, produto("Brinco argola dourado M (par)", "19,90"), depsDe(negocioA));
    expect(await historico(id)).toEqual([
      [18.5, usuario],
      [19.9, usuario],
    ]);
  });

  it("o banco recusa alterar e apagar um registro do histórico", async () => {
    const id = await criar(produto("Colar", "30"));
    await expect(base.$executeRawUnsafe(`UPDATE "HistoricoCusto" SET custo = 1 WHERE "itemId" = '${id}'`)).rejects.toThrow(/he_somente_insercao/);
    await expect(base.$executeRawUnsafe(`DELETE FROM "HistoricoCusto" WHERE "itemId" = '${id}'`)).rejects.toThrow(/he_somente_insercao/);
  });

  it("o registro só aponta para item do mesmo negócio", async () => {
    const id = await criar(produto("Anel", "5"));
    await expect(base.historicoCusto.create({ data: { negocioId: negocioB, itemId: id, custo: 5 } })).rejects.toThrow();
  });
});

describe("T06 — inventário no banco (CA-01 a CA-09, INV-001, INV-002, INV-005 a INV-007)", () => {
  it("hoje é o saldo atual; uma data passada desfaz as movimentações posteriores, inclusive as retroativas", async () => {
    const brinco = await criar(produto("Brinco", "18.5"));
    await mover(brinco, "ENTRADA", 12, meioDia("2026-09-20"));
    await mover(brinco, "SAIDA_VENDA", 2, meioDia("2026-10-01"));
    // Saída manual registrada agora, com data retroativa de 29/09: já conta em 30/09 (CA-03).
    await mover(brinco, "SAIDA_MANUAL", 1, meioDia("2026-09-29"));
    expect(await quantidades(HOJE)).toEqual({ Brinco: 9 });
    expect(await quantidades("2026-09-30")).toEqual({ Brinco: 11 });
    expect(await quantidades("2026-09-28")).toEqual({ Brinco: 12 });
    expect(await quantidades("2026-09-19")).toEqual({});
  });

  it("a virada do dia segue o horário do negócio (CA-04) e os estornos voltam como entradas", async () => {
    const colar = await criar(produto("Colar"));
    await mover(colar, "ENTRADA", 10, meioDia("2026-09-01"));
    await mover(colar, "SAIDA_VENDA", 1, as("2026-09-30", 23, 50));
    await mover(colar, "SAIDA_VENDA", 2, as("2026-10-01", 0, 10));
    await mover(colar, "ENTRADA_ESTORNO", 2, as("2026-10-01", 9, 0));
    expect(await quantidades("2026-09-30")).toEqual({ Colar: 9 });
    expect(await quantidades("2026-10-01")).toEqual({ Colar: 9 });
    expect((await base.item.findUniqueOrThrow({ where: { id: colar } })).quantidadeEstoque.toString()).toBe("9");
  });

  it("entram ativos e arquivados com quantidade; zerados, serviços e outro negócio não; nada é alterado", async () => {
    const ativo = await criar(produto("Ativo"));
    const arquivado = await criar(produto("Arquivado"));
    const zerado = await criar(produto("Zerado"));
    await criar({ tipo: "SERVICO", nome: "Manicure", categoria: "BELEZA", unidadeMedida: "atend", custoBase: "20" });
    const deOutro = await criar(produto("De outro negócio"), negocioB);
    for (const id of [ativo, arquivado, zerado]) await mover(id, "ENTRADA", 3, meioDia(HOJE));
    await mover(deOutro, "ENTRADA", 3, meioDia(HOJE), negocioB);
    await mover(zerado, "SAIDA_MANUAL", 3, meioDia(HOJE));
    await depsDe(negocioA).catalogo.arquivar(arquivado, true);
    const antes = await base.$queryRaw`SELECT (SELECT count(*) FROM "MovimentacaoEstoque") AS m, (SELECT count(*) FROM "HistoricoCusto") AS h, (SELECT sum("quantidadeEstoque") FROM "Item") AS q`;
    const inv = await inventarioDe(HOJE);
    expect(inv.linhas.map((l) => [l.nome, l.arquivado])).toEqual([
      ["Arquivado", true],
      ["Ativo", false],
    ]);
    expect(await base.$queryRaw`SELECT (SELECT count(*) FROM "MovimentacaoEstoque") AS m, (SELECT count(*) FROM "HistoricoCusto") AS h, (SELECT sum("quantidadeEstoque") FROM "Item") AS q`).toEqual(antes);
  });

  it("custo da data pelo histórico; antes dele, o do início, marcado (CA-05, CA-06)", async () => {
    const id = await criar(produto("Pulseira", "10"));
    await mover(id, "ENTRADA", 2, meioDia("2026-09-15"));
    // O histórico começa agora, depois de 30/09, como o da migração: o custo de 30/09 é o do início, marcado.
    const inv = await inventarioDe("2026-09-30");
    expect(inv.linhas).toMatchObject([{ nome: "Pulseira", quantidade: 2, custoCentavos: 1000, custoDoInicio: true, valorCentavos: 2000 }]);
    await servicos.editarItem(id, produto("Pulseira", "12"), depsDe(negocioA));
    expect((await inventarioDe(HOJE)).linhas).toMatchObject([{ custoCentavos: 1200, custoDoInicio: false, valorCentavos: 2400 }]);
    expect((await inventarioDe("2026-09-30")).linhas).toMatchObject([{ custoCentavos: 1000, custoDoInicio: true }]);
  });

  it("quantidade negativa aparece com o aviso (CA-09)", async () => {
    const id = await criar(produto("Argola"));
    await mover(id, "ENTRADA", 5, meioDia("2026-09-20"));
    await mover(id, "SAIDA_MANUAL", 5, meioDia("2026-09-10"));
    const inv = await inventarioDe("2026-09-15");
    expect(inv.linhas).toMatchObject([{ nome: "Argola", quantidade: -5, quantidadeNegativa: true }]);
    expect(inv.avisos.negativos).toBe(1);
  });

  it("os arquivos têm o nome da data e os mesmos números da tela (CA-10)", async () => {
    const id = await criar(produto("Brinco argola", "18.5", { codigo: "br-015" }));
    await mover(id, "ENTRADA", 12, meioDia("2026-09-20"));
    const deps = { estoque: estoqueDe(negocioA), hoje: HOJE, negocio: "Semijoias A", cnpj: "11222333000181", autor: "Gisele", agora: new Date() };
    const csv = await arquivoDoInventario({ data: "2026-09-30", formato: "csv" }, deps);
    if (!csv.ok) throw new Error(csv.erro);
    expect(csv.arquivo.nome).toBe("inventario-2026-09-30.csv");
    const linhas = String(csv.arquivo.corpo).replace(/^﻿/, "").split("\r\n");
    expect(linhas[1]).toBe("BR-015;Brinco argola;UN;;12;18,50;222,00;Custo do início do histórico");
    expect(linhas[2]).toBe("Total;;;;;;222,00;");
    const pdf = await arquivoDoInventario({ data: "2026-09-30", formato: "pdf" }, deps);
    expect(pdf.ok && pdf.arquivo.nome).toBe("inventario-2026-09-30.pdf");
    expect(pdf.ok && strFromU8((pdf.arquivo.corpo as Uint8Array).slice(0, 5))).toBe("%PDF-");
    expect(await arquivoDoInventario({ data: "2999-01-01", formato: "csv" }, deps)).toEqual({ ok: false, erro: "Escolha uma data até hoje." });
    expect(await arquivoDoInventario({ data: "2026-09-30", formato: "xlsx" }, deps)).toEqual({ ok: false, erro: "Formato inválido." });
  });
});

describe("T07 — sem regra de plano: qualquer data (CA-12)", () => {
  it("uma data de mais de 12 meses atrás funciona, no negócio do plano gratuito", async () => {
    const id = await criar(produto("Antigo"));
    await mover(id, "ENTRADA", 1, meioDia(HOJE));
    expect((await base.negocio.findUniqueOrThrow({ where: { id: negocioA } })).plano).toBe("GRATUITO");
    const r = await carregarInventario("2024-01-31", { estoque: estoqueDe(negocioA), hoje: HOJE });
    expect(r).toMatchObject({ ok: true, inventario: { data: "2024-01-31", linhas: [] } });
    expect(await quantidades(HOJE)).toEqual({ Antigo: 1 });
  });
});

describe("T08 — exportação dos dados com o histórico de custo (CA-14)", () => {
  it("o dados.json traz o histórico de custo do negócio", async () => {
    await base.membroNegocio.create({ data: { usuarioId: usuario, negocioId: negocioA, papel: "DONO" } });
    const id = await criar(produto("Brinco", "18.5"));
    await servicos.editarItem(id, produto("Brinco", "20"), depsDe(negocioA));
    const zip = unzipSync((await exportar({ lgpd: criarConsultasDaLgpd(base), usuarioId: usuario, agora: new Date(), hoje: HOJE }))!.corpo);
    const d = JSON.parse(strFromU8(zip["dados.json"]));
    expect(d.negociosComoDono[0].tabelas.historicoCustos.map((h: { custo: string }) => Number(h.custo)).sort()).toEqual([18.5, 20]);
  });
});
