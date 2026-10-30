import { randomUUID } from "node:crypto";
import { strFromU8, unzipSync } from "fflate";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import * as servicos from "@/lib/catalogo/servicos";
import { codigoEmUso } from "@/lib/catalogo/validacao";
import { criarConsultasDoCatalogo } from "@/lib/db/catalogo";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { SomenteLeituraNoSuporte } from "@/lib/db/erros";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDoEstoque } from "@/lib/db/estoque";
import { criarConsultasDaLgpd } from "@/lib/db/lgpd";
import { criarConsultasDeRelatorios } from "@/lib/db/relatorios";
import { criarConsultasDeVendas } from "@/lib/db/vendas";
import { hoje as hojeLocal } from "@/lib/dominio/datas";
import { exportar } from "@/lib/lgpd/servicos";
import * as vendas from "@/lib/vendas/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-024 — testes de integração (seção 12): T03 a T06 e T08, banco real e cliente do negócio (SPEC-001).

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();

let usuario: string;
let negocioA: string;
let negocioB: string;

const cliente = (negocioId: string) => comNegocio(base, { negocioId, usuarioId: usuario });
const depsDe = (negocioId: string) => ({ catalogo: criarConsultasDoCatalogo(cliente(negocioId), negocioId), usuarioId: usuario });
const deps = () => depsDe(negocioA);

const produto = (nome: string, codigo?: string, extra: Record<string, string> = {}) => ({
  tipo: "PRODUTO_FISICO",
  nome,
  categoria: "ACESSORIOS",
  unidadeMedida: "un",
  custoBase: "12",
  ...(codigo === undefined ? {} : { codigo }),
  ...extra,
});

async function criar(campos: Record<string, string>, d = deps()) {
  const r = await servicos.criarItem(campos, d);
  if (r.status !== "salvo") throw new Error(`esperava salvo: ${JSON.stringify(r)}`);
  return r.itemId;
}
const linha = (id: string) => base.item.findUniqueOrThrow({ where: { id }, select: { codigo: true, codigoChave: true, arquivadoEm: true } });

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Gisele", email: "gisele@exemplo.com", consentimentoLgpdEm: new Date(), versaoTermosAceita: "2026-10-23" } })).id;
  negocioA = (await base.negocio.create({ data: { nome: "Semijoias A" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Semijoias B" } })).id;
});

afterAll(async () => {
  await base.$disconnect();
});

describe("T03 — cadastro, edição e unicidade (CA-01, CA-04, INV-001, INV-004)", () => {
  it("grava em maiúsculas, troca e apaga o código na edição", async () => {
    const id = await criar(produto("Brinco argola dourado M", "br-015 "));
    expect(await linha(id)).toEqual({ codigo: "BR-015", codigoChave: "BR-015", arquivadoEm: null });
    expect((await deps().catalogo.detalhar(id)).codigo).toBe("BR-015");

    expect(await servicos.editarItem(id, produto("Brinco argola dourado M", "br-016"), deps())).toEqual({ status: "salvo", itemId: id });
    expect(await linha(id)).toMatchObject({ codigo: "BR-016", codigoChave: "BR-016" });
    expect(await servicos.editarItem(id, produto("Brinco argola dourado M", ""), deps())).toEqual({ status: "salvo", itemId: id });
    expect(await linha(id)).toMatchObject({ codigo: null, codigoChave: null });
  });

  it("código em uso por outro item ativo é recusado com o nome dele; serviço também tem código; outro negócio pode repetir", async () => {
    await criar(produto("Brinco argola dourado M", "BR-015"));
    expect(await servicos.criarItem(produto("Brinco argola dourado G", "br-015"), deps())).toEqual({
      status: "erro",
      erros: { codigo: codigoEmUso("BR-015", "Brinco argola dourado M") },
    });
    const outro = await criar(produto("Brinco argola dourado G", "BR-0150"));
    expect(await servicos.editarItem(outro, produto("Brinco argola dourado G", "BR-015"), deps())).toMatchObject({ status: "erro", erros: { codigo: codigoEmUso("BR-015", "Brinco argola dourado M") } });
    // O próprio item pode manter o código ao editar outros campos.
    expect(await servicos.editarItem(outro, produto("Brinco argola dourado G", "BR-0150", { custoBase: "13" }), deps())).toMatchObject({ status: "salvo" });

    await criar({ tipo: "SERVICO", nome: "Limpeza de peças", categoria: "ACESSORIOS", unidadeMedida: "atend", custoBase: "5", codigo: "SRV-01", materiais: "[]" });
    expect(await criar(produto("Brinco do outro negócio", "BR-015"), depsDe(negocioB))).toBeTruthy();
  });

  it("o banco garante a unicidade entre os ativos e o formato, também em gravações ao mesmo tempo", async () => {
    await criar(produto("Brinco argola dourado M", "BR-015"));
    const dado = { negocioId: negocioA, tipo: "PRODUTO_FISICO" as const, categoria: "ACESSORIOS" as const, unidadeMedida: "un", custoBase: 1 };
    await expect(base.item.create({ data: { ...dado, nome: "Direto", nomeChave: "direto", codigo: "BR-015", codigoChave: "BR-015" } })).rejects.toThrow();
    await expect(base.item.create({ data: { ...dado, nome: "Minúsculo", nomeChave: "minusculo", codigo: "br-1", codigoChave: "br-1" } })).rejects.toThrow(/Item_codigo_formato/);
    await expect(base.item.create({ data: { ...dado, nome: "Sem chave", nomeChave: "sem chave", codigo: "BR-2" } })).rejects.toThrow(/Item_codigo_chave/);

    const [a, b] = await Promise.all([servicos.criarItem(produto("Colar A", "CO-001"), deps()), servicos.criarItem(produto("Colar B", "CO-001"), deps())]);
    const estados = [a, b].map((r) => r.status).sort();
    expect(estados).toEqual(["erro", "salvo"]);
    const erro = [a, b].find((r) => r.status === "erro")!;
    expect(erro).toMatchObject({ erros: { codigo: expect.stringContaining("O código CO-001 já é usado por") } });
    expect(await base.item.count({ where: { negocioId: negocioA, codigo: "CO-001" } })).toBe(1);
  });
});

describe("T04 — arquivar e reativar (CA-05, INV-006)", () => {
  it("o arquivado mantém o código, mas o libera; reativar com o código em uso é recusado", async () => {
    const a = await criar(produto("Brinco antigo", "BR-015"));
    expect(await servicos.arquivarItem(a, true, deps())).toMatchObject({ ok: true });
    expect(await linha(a)).toMatchObject({ codigo: "BR-015", codigoChave: null });

    const b = await criar(produto("Brinco novo", "BR-015"));
    expect(await servicos.arquivarItem(a, false, deps())).toEqual({ ok: false, codigo: "codigo-em-uso" });
    expect((await linha(a)).arquivadoEm).not.toBeNull();

    // Editar o arquivado não confere a repetição (ele não ocupa o código).
    expect(await servicos.editarItem(a, produto("Brinco antigo", "BR-015", { custoBase: "11" }), deps())).toMatchObject({ status: "salvo" });

    expect(await servicos.editarItem(b, produto("Brinco novo", "BR-015N"), deps())).toMatchObject({ status: "salvo" });
    expect(await servicos.arquivarItem(a, false, deps())).toMatchObject({ ok: true });
    expect(await linha(a)).toMatchObject({ codigo: "BR-015", codigoChave: "BR-015", arquivadoEm: null });
  });

  it("o nome continua conferido ao reativar", async () => {
    const a = await criar(produto("Brinco antigo", "BR-1"));
    await servicos.arquivarItem(a, true, deps());
    await criar(produto("Brinco antigo", "BR-2"));
    expect(await servicos.arquivarItem(a, false, deps())).toEqual({ ok: false, codigo: "nome-duplicado" });
  });
});

describe("T05 — busca, código exato primeiro e itens sem código (CA-06, CA-09)", () => {
  it("Catálogo e Estoque encontram pelo código; o exato vem primeiro; o Estoque só tem produtos", async () => {
    await criar(produto("Colar 015 cm"));
    await criar(produto("Anel A", "BR-0150"));
    await criar(produto("Zircônia", "BR-015"));
    await criar({ tipo: "SERVICO", nome: "Ajuste 015", categoria: "ACESSORIOS", unidadeMedida: "atend", custoBase: "5", codigo: "SRV-015", materiais: "[]" });
    const c = deps().catalogo;

    expect((await c.listar({ busca: "br-015" })).map((i) => i.codigo)).toEqual(["BR-015", "BR-0150"]);
    expect((await c.listar({ busca: "015" })).map((i) => i.nome)).toEqual(["Ajuste 015", "Anel A", "Colar 015 cm", "Zircônia"]);
    expect((await c.listar({ busca: "srv" })).map((i) => i.nome)).toEqual(["Ajuste 015"]);

    const e = criarConsultasDoEstoque(cliente(negocioA), negocioA);
    expect((await e.listar({ busca: "BR-015" }, HOJE)).map((p) => p.codigo)).toEqual(["BR-015", "BR-0150"]);
    expect((await e.listar({ busca: "015" }, HOJE)).map((p) => p.nome)).toEqual(["Anel A", "Colar 015 cm", "Zircônia"]);
    const umProduto = (await e.listar({ busca: "Zircônia" }, HOJE))[0];
    expect((await e.detalhar(umProduto.id, HOJE)).codigo).toBe("BR-015");
    expect(await criarConsultasDoEstoque(cliente(negocioB), negocioB).listar({ busca: "BR-015" }, HOJE)).toEqual([]);
  });

  it("filtro e contagem dos itens sem código: só ativos, produtos e serviços", async () => {
    const c = deps().catalogo;
    expect(await c.contagensDoCodigo()).toEqual({ comCodigo: 0, semCodigo: 0 });
    await criar(produto("Colar"));
    expect(await c.contagensDoCodigo()).toEqual({ comCodigo: 0, semCodigo: 1 });
    await criar(produto("Brinco", "BR-1"));
    await criar({ tipo: "SERVICO", nome: "Ajuste", categoria: "ACESSORIOS", unidadeMedida: "atend", custoBase: "5", materiais: "[]" });
    const arquivado = await criar(produto("Antigo"));
    await servicos.arquivarItem(arquivado, true, deps());
    expect(await c.contagensDoCodigo()).toEqual({ comCodigo: 1, semCodigo: 2 });
    expect((await c.listar({ codigo: "sem" })).map((i) => i.nome)).toEqual(["Ajuste", "Colar"]);
    expect((await c.listar({ codigo: "sem", tipo: "SERVICO" })).map((i) => i.nome)).toEqual(["Ajuste"]);
  });
});

describe("T06 — venda, rentabilidade e exportação com o código (CA-07, CA-10, CA-11)", () => {
  it("itens vendáveis, detalhe da venda (código atual), rentabilidade e exportação", async () => {
    await base.membroNegocio.create({ data: { usuarioId: usuario, negocioId: negocioA, papel: "DONO" } });
    const brinco = await criar(produto("Brinco argola dourado M", "BR-015", { preco: "79,90" }));
    await criar(produto("Sem preço", "SP-1"));
    await base.$executeRaw`UPDATE "Item" SET "quantidadeEstoque" = 5 WHERE id = ${brinco}::uuid`;

    const v = criarConsultasDeVendas(cliente(negocioA), negocioA);
    const vendaveis = await v.itensVendaveis();
    expect(vendaveis.map((i) => [i.nome, i.codigo])).toEqual([["Brinco argola dourado M", "BR-015"]]);

    const r = await vendas.registrarVenda(
      { carrinho: JSON.stringify({ id: randomUUID(), linhas: [{ itemId: brinco, quantidade: 2 }], pagamentos: [{ forma: "PIX", valor: 159.8 }] }) },
      { vendas: v, usuarioId: usuario, hoje: HOJE, agora: new Date() },
    );
    if (r.status !== "registrada") throw new Error(JSON.stringify(r));
    expect((await v.detalhar(r.vendaId)).itensVenda.map((i) => [i.codigo, i.nome])).toEqual([["BR-015", "Brinco argola dourado M"]]);

    // O código mostrado é o atual (a venda não guarda cópia, como o nome).
    await servicos.editarItem(brinco, produto("Brinco argola dourado M", "BR-015M"), deps());
    expect((await v.detalhar(r.vendaId)).itensVenda[0].codigo).toBe("BR-015M");
    const rent = await criarConsultasDeRelatorios(cliente(negocioA), negocioA).rentabilidade(HOJE, HOJE);
    expect(rent.map((l) => [l.codigo, l.nome])).toEqual([["BR-015M", "Brinco argola dourado M"]]);

    const zip = unzipSync(
      (await exportar({ lgpd: criarConsultasDaLgpd(base), usuarioId: usuario, agora: new Date(), hoje: HOJE }))!.corpo,
    );
    const d = JSON.parse(strFromU8(zip["dados.json"]));
    expect(d.negociosComoDono[0].tabelas.itens.map((i: { codigo: string | null }) => i.codigo).sort()).toEqual(["BR-015M", "SP-1"]);
    const csv = strFromU8(zip["itens.csv"]).replace(/^﻿/, "").split("\r\n");
    expect(csv[0].split(";")).toContain("codigo");
  });
});

describe("T08 — permissões e modo suporte (CA-12)", () => {
  it("as ações que gravam o código exigem Catálogo — criar ou editar; o suporte vê o código e não grava", async () => {
    const { readFileSync } = await import("node:fs");
    const acoes = readFileSync("src/lib/catalogo/acoes.ts", "utf-8");
    expect(acoes).toMatch(/export const acaoCriarItem = acaoComPermissao\("catalogo", "criar"/);
    expect(acoes).toMatch(/export const acaoEditarItem = acaoComPermissao\("catalogo", "editar"/);

    const id = await criar(produto("Brinco argola dourado M", "BR-015"));
    const doSuporte = criarConsultasDoCatalogo(comNegocio(base, { negocioId: negocioA, usuarioId: usuario, modoSuporte: true }), negocioA);
    expect((await doSuporte.detalhar(id)).codigo).toBe("BR-015");
    expect((await doSuporte.listar({ busca: "br-015" })).map((i) => i.id)).toEqual([id]);
    const r = await servicos.editarItem(id, produto("Brinco argola dourado M", "BR-999"), { catalogo: doSuporte, usuarioId: usuario });
    expect(r.status).toBe("erro");
    expect(await linha(id)).toMatchObject({ codigo: "BR-015" });
    await expect(comNegocio(base, { negocioId: negocioA, modoSuporte: true }).item.updateMany({ data: { codigo: "X" } })).rejects.toThrow(SomenteLeituraNoSuporte);
  });
});
