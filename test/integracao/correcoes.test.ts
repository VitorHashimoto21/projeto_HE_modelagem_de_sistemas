import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { resolverContextoDaRequisicao, type ContextoComPapel } from "@/lib/auth/contexto";
import { codigoEmUsoAoReativar } from "@/lib/catalogo/validacao";
import * as servicosDoCatalogo from "@/lib/catalogo/servicos";
import { criarConsultasDeAcesso } from "@/lib/db/acesso";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDeSuporte } from "@/lib/db/suporte";
import { hoje as hojeLocal } from "@/lib/dominio/datas";
import { MENSAGENS_DAS_CORRECOES as M } from "@/lib/dominio/correcoes";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-019, etapa 2a — testes de integração: T02 (parte), T03 e T04 (Catálogo e Estoque), INV-003 a
// INV-005, CA-06 a CA-09. As Server Actions são as da aplicação, com o banco real, o cliente do negócio,
// o motor das correções e o desfazer. Só a leitura da sessão é trocada: a guarda decide com `autorizar`
// sobre o contexto montado como na aplicação (servidor.ts → obterContexto).

const dubles = vi.hoisted(() => ({ contexto: null as unknown }));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  // O redirect do Next é um erro com o digest NEXT_REDIRECT; o motor o trata como sucesso.
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
  },
}));
vi.mock("@/lib/auth/servidor", async () => {
  const { autorizar } = await import("@/lib/auth/autorizacao");
  return {
    exigirNivel: async (nivel: Parameters<typeof autorizar>[1]) => {
      const r = autorizar(dubles.contexto as ContextoComPapel | null, nivel);
      if (!r.ok) throw Object.assign(new Error(`recusada: ${r.motivo}`), { motivo: r.motivo });
      return r;
    },
  };
});
vi.mock("@/lib/suporte/servidor", () => ({}));

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
// O "@/lib/db" da aplicação usa este cliente (prismaBase lê o global antes do ambiente).
(globalThis as { prismaHE?: PrismaClient }).prismaHE = base;
const db = await import("@/lib/db");
const catalogo = await import("@/lib/catalogo/acoes");
const estoque = await import("@/lib/estoque/acoes");
const { acaoDesfazerCorrecao } = await import("@/lib/suporte/acoes");

const suporte = criarConsultasDeSuporte(base);
const acesso = criarConsultasDeAcesso(base);
const VERSAO = "2026-11-01";
const HOJE = hojeLocal();

let dono: string;
let gerente: string;
let admin: string;
let negocio: string;
let outroNegocio: string;
let caneta: string;
let acessoId: string;

const LOGIN = () => new Date(Date.now() - 60_000);

/** Contexto como a aplicação o monta (servidor.ts → obterContexto). */
async function contextoDe(usuarioId: string, suporteDoCookie?: string, negocioDoCookie?: string) {
  return resolverContextoDaRequisicao(
    { usuarioId, negocioDoCookie, suporteDoCookie, autenticadoEm: LOGIN(), nivelDaSessao: "aal2", codigoEm: new Date(), agora: new Date(), versaoDosTermos: VERSAO },
    { filiacao: (u, n) => acesso.filiacao(u, n), conta: (u) => acesso.estadoDaConta(u), liberacao: (id, adm) => suporte.liberacaoDoContexto(id, adm) },
  );
}
const comoSuporte = async () => (dubles.contexto = await contextoDe(admin, acessoId));
const comoDono = async () => (dubles.contexto = await contextoDe(dono, undefined, negocio));

function formulario(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

const OCIOSO = { status: "ocioso" } as never;
const redireciona = (p: Promise<unknown>) => expect(p).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
const recusa = (p: Promise<unknown>, motivo: string) => expect(p).rejects.toMatchObject({ motivo });

async function usuario(nome: string, email: string) {
  return (await base.usuario.create({ data: { id: randomUUID(), nome, email, versaoTermosAceita: VERSAO, consentimentoLgpdEm: new Date() } })).id;
}

async function item(nome: string, extra: Record<string, unknown> = {}) {
  const i = await base.item.create({
    data: { negocioId: negocio, tipo: "PRODUTO_FISICO", nome, nomeChave: nome.toLowerCase(), categoria: "PRODUTOS", unidadeMedida: "un", custoBase: 40, ...extra },
  });
  return i.id;
}

const editar = (id: string, extra: Record<string, string> = {}) =>
  catalogo.acaoEditarItem(OCIOSO, formulario({ itemId: id, nome: "Caneta", codigo: "C-1", categoria: "PRODUTOS", unidadeMedida: "un", custoBase: "42,00", ...extra }));

const correcoesGravadas = () => base.registroSuporte.findMany({ where: { evento: "CORRECAO" }, orderBy: { criadoEm: "asc" } });
const ultimaCorrecao = async () => (await correcoesGravadas()).at(-1)!;
const saldo = async (id: string) => Number((await base.item.findUniqueOrThrow({ where: { id } })).quantidadeEstoque);
const custo = async (id: string) => Number((await base.item.findUniqueOrThrow({ where: { id } })).custoBase);

/** Desfaz como o Dono, pela Server Action; devolve o estado da tela. */
async function desfazer(correcaoId: string) {
  await comoDono();
  return acaoDesfazerCorrecao({ status: "ocioso" }, formulario({ correcaoId }));
}

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  dono = await usuario("Rafael Dono", "dono@exemplo.com");
  gerente = await usuario("Gabi Gerente", "gerente@exemplo.com");
  admin = await usuario("Vitor Suporte", "suporte@exemplo.com");
  negocio = (await base.negocio.create({ data: { nome: "Papelaria" } })).id;
  outroNegocio = (await base.negocio.create({ data: { nome: "Outro" } })).id;
  await base.membroNegocio.create({ data: { usuarioId: dono, negocioId: negocio, papel: "DONO" } });
  await base.membroNegocio.create({ data: { usuarioId: gerente, negocioId: negocio, papel: "GERENTE" } });
  await base.membroNegocio.create({ data: { usuarioId: dono, negocioId: outroNegocio, papel: "DONO" } });
  expect((await suporte.concederPapel("suporte@exemplo.com", "Equipe", new Date())).ok).toBe(true);
  caneta = await item("Caneta", { codigo: "C-1", codigoChave: "C-1" });

  const l = await suporte.liberar(negocio, dono, { motivo: "Custo errado", modulos: ["vendas", "catalogo", "estoque", "financeiro"], modulosComCorrecao: ["catalogo", "estoque"], prazo: "1h" }, new Date());
  acessoId = l!.id;
  expect(await suporte.entrar(acessoId, admin, new Date(), true)).toMatchObject({ ok: true });
  await comoSuporte();
});

afterAll(async () => {
  await base.$disconnect();
});

// ---------------------------------------------------------------------------------------

describe("entrada e contexto da correção (5.3, item 1)", () => {
  it("a entrada na liberação com correção exige o código reconfirmado e fica registrada", async () => {
    expect(await suporte.entrar(acessoId, admin, new Date(), false)).toEqual({ ok: false, erro: "Reconfirmar" });
    const entrada = await base.registroSuporte.findFirst({ where: { evento: "ENTRADA", acessoId }, orderBy: { criadoEm: "desc" } });
    expect(entrada).toMatchObject({ dados: { reconfirmada: true }, descricao: "Entrou em modo suporte com o código reconfirmado (pode corrigir Catálogo, Estoque)" });
    expect((dubles.contexto as ContextoComPapel).suporte).toMatchObject({ modulosComCorrecao: ["catalogo", "estoque"], correcaoPendente: false });
  });

  it("depois da saída, o mesmo cookie só lê; outra conta de Administrador não herda a entrada", async () => {
    await suporte.sair(negocio, acessoId, admin);
    expect((await contextoDe(admin, acessoId))?.suporte).toMatchObject({ modulosComCorrecao: [], correcaoPendente: true });
    await suporte.entrar(acessoId, admin, new Date(), true);
    expect((await contextoDe(admin, acessoId))?.suporte?.modulosComCorrecao).toEqual(["catalogo", "estoque"]);

    const outro = await usuario("Ana Suporte", "ana@exemplo.com");
    expect((await suporte.concederPapel("ana@exemplo.com", "Equipe", new Date())).ok).toBe(true);
    expect((await contextoDe(outro, acessoId))?.suporte).toMatchObject({ modulosComCorrecao: [], correcaoPendente: true });
  });
});

describe("T02/T03 — correções do Catálogo e do Estoque pela Server Action (INV-003, INV-004; CA-06, CA-08)", () => {
  it("CA-08: editar o custo grava a correção e o evento com o antes e o depois na mesma transação", async () => {
    await redireciona(editar(caneta));
    expect(await custo(caneta)).toBe(42);
    const c = await ultimaCorrecao();
    expect(c).toMatchObject({
      negocioId: negocio,
      acessoId,
      usuarioId: admin,
      modulo: "catalogo",
      descricao: "Editar item: Caneta",
      dados: { acao: "catalogo.editarItem", alvo: caneta, registro: "Caneta", antes: { custoBase: "40.00" }, depois: { custoBase: "42.00" } },
    });
    // O histórico do custo é do próprio Administrador (RN30), mostrado como suporte do HE.
    const historico = await base.historicoCusto.findMany({ where: { itemId: caneta }, include: { usuario: { select: { nome: true, administradorEm: true } } } });
    expect(historico.map((h) => [Number(h.custo), h.usuario?.nome])).toEqual([[42, "Vitor Suporte"]]);
  });

  it("sem mudança real (mesmo valor ou erro de validação), nada é registrado", async () => {
    await redireciona(editar(caneta, { custoBase: "40,00" }));
    expect(await editar(caneta, { nome: "" })).toMatchObject({ status: "erro" });
    expect(await correcoesGravadas()).toEqual([]);
  });

  it("INV-004: se o registro falha, a correção não é gravada", async () => {
    // Uma liberação inexistente faz o evento falhar (chave estrangeira) depois da edição: tudo volta.
    const motor = db.correcoes();
    const form = formulario({ itemId: caneta, nome: "Caneta", codigo: "C-1", categoria: "PRODUTOS", unidadeMedida: "un", custoBase: "50" });
    await expect(
      motor.executar({ negocioId: negocio, administradorId: admin, acessoId: randomUUID() }, "catalogo.editarItem", [form], () =>
        servicosDoCatalogo.editarItem(caneta, { nome: "Caneta", codigo: "C-1", categoria: "PRODUTOS", unidadeMedida: "un", custoBase: "50" }, { catalogo: db.catalogo({ negocioId: negocio, usuarioId: admin }), usuarioId: admin }),
      ),
    ).rejects.toThrow();
    expect(await custo(caneta)).toBe(40);
    expect(await base.historicoCusto.count()).toBe(0);
    expect(await correcoesGravadas()).toEqual([]);
    // Fora da correção, o cliente do negócio volta a ser o de sempre (nada ficou preso à transação).
    expect(await db.catalogo({ negocioId: negocio, usuarioId: admin }).tipoDoItem(caneta)).toBe("PRODUTO_FISICO");
  });

  it("preço, arquivar, subcategoria e as movimentações: cada uma com o seu registro", async () => {
    expect(await catalogo.acaoDefinirPreco(OCIOSO, formulario({ itemId: caneta, preco: "60,00" }))).toMatchObject({ status: "salvo" });
    const sub = await catalogo.acaoCriarSubcategoria(OCIOSO, formulario({ categoria: "PRODUTOS", nome: "Escrita" }));
    expect(sub).toMatchObject({ status: "salvo" });
    const subId = (sub as { subcategoria: { id: string } }).subcategoria.id;
    expect(await catalogo.acaoRenomearSubcategoria(OCIOSO, formulario({ subcategoriaId: subId, nome: "Escrita fina" }))).toMatchObject({ status: "salvo" });
    expect(await estoque.acaoRegistrarEntrada(OCIOSO, formulario({ itemId: caneta, quantidade: "10", data: HOJE }))).toMatchObject({ status: "salvo" });
    expect(await estoque.acaoRegistrarSaida(OCIOSO, formulario({ itemId: caneta, quantidade: "2", data: HOJE, motivo: "QUEBRA" }))).toMatchObject({ status: "salvo" });
    expect(await estoque.acaoDefinirMinimo(OCIOSO, formulario({ itemId: caneta, estoqueMinimo: "5" }))).toMatchObject({ status: "salvo" });
    await redireciona(catalogo.acaoArquivarItem(formulario({ itemId: caneta, arquivar: "1" })));

    const lista = await correcoesGravadas();
    expect(lista.map((c) => [(c.dados as { acao: string }).acao, (c.dados as { antes: unknown }).antes, (c.dados as { depois: unknown }).depois])).toEqual([
      ["catalogo.definirPreco", { preco: null }, { preco: "60.00" }],
      ["catalogo.criarSubcategoria", null, { nome: "Escrita", categoria: "PRODUTOS" }],
      ["catalogo.renomearSubcategoria", { nome: "Escrita" }, { nome: "Escrita fina" }],
      ["estoque.registrarEntrada", null, { itemId: caneta, item: "Caneta", movimento: "ENTRADA", quantidade: "10.000", motivo: null }],
      ["estoque.registrarSaida", null, { itemId: caneta, item: "Caneta", movimento: "SAIDA_MANUAL", quantidade: "2.000", motivo: "QUEBRA" }],
      ["estoque.definirMinimo", { estoqueMinimo: null }, { estoqueMinimo: "5.000" }],
      ["catalogo.arquivarItem", { arquivado: false }, { arquivado: true }],
    ]);
    // As movimentações e o preço guardam o Administrador como autor (os históricos mostram "suporte do HE").
    expect(await base.movimentacaoEstoque.count({ where: { usuarioId: admin } })).toBe(2);
    expect(await base.historicoPreco.count({ where: { usuarioId: admin } })).toBe(1);
  });

  it("CA-07: fora da lista ou fora dos módulos em correção, a chamada direta é recusada e nada é gravado", async () => {
    await recusa(catalogo.acaoCriarItem(OCIOSO, formulario({ tipo: "PRODUTO_FISICO", nome: "Lápis", categoria: "PRODUTOS", unidadeMedida: "un", custoBase: "1" })), "ForaDaListaDeCorrecoes");
    const s = await base.subcategoria.create({ data: { negocioId: negocio, categoria: "PRODUTOS", nome: "Vazia", nomeChave: "vazia" } });
    await recusa(catalogo.acaoExcluirSubcategoria(OCIOSO, formulario({ subcategoriaId: s.id })), "ForaDaListaDeCorrecoes");
    expect(await base.item.count()).toBe(1);
    expect(await base.subcategoria.count()).toBe(1);
    expect(await correcoesGravadas()).toEqual([]);
  });

  it("o resumo da saída conta só as correções desta visita, deste Administrador", async () => {
    await redireciona(editar(caneta));
    await catalogo.acaoDefinirPreco(OCIOSO, formulario({ itemId: caneta, preco: "60" }));
    expect(await suporte.correcoesDaVisita(acessoId, admin)).toBe(2);
    await suporte.sair(negocio, acessoId, admin);
    await suporte.entrar(acessoId, admin, new Date(), true);
    expect(await suporte.correcoesDaVisita(acessoId, admin)).toBe(0);
    expect(await suporte.correcoesDaVisita(acessoId, dono)).toBe(0);
  });

  it("CA-06: com o Catálogo só em 'ver', a edição é recusada (SomenteLeitura); a busca do NCM só no módulo em correção", async () => {
    expect(await catalogo.acaoBuscarNcm("caneta")).not.toMatchObject({ status: "erro" });
    const l = await suporte.liberar(negocio, dono, { motivo: "Ver", modulos: ["catalogo"], modulosComCorrecao: [], prazo: "24h" }, new Date());
    await suporte.entrar(l!.id, admin, new Date());
    dubles.contexto = await contextoDe(admin, l!.id);
    await recusa(editar(caneta), "SomenteLeitura");
    await recusa(catalogo.acaoBuscarNcm("caneta"), "SomenteLeitura");
    expect(await custo(caneta)).toBe(40);
  });

  it("a liberação anterior, substituída, não vale mais: o contexto cai para o painel", async () => {
    await suporte.liberar(negocio, dono, { motivo: "Outra", modulos: ["catalogo"], modulosComCorrecao: ["catalogo"], prazo: "1h" }, new Date());
    dubles.contexto = await contextoDe(admin, acessoId);
    await recusa(editar(caneta), "SemNegocio");
  });
});

// ---------------------------------------------------------------------------------------

describe("T04 — desfazer pelo Dono (INV-005; CA-09)", () => {
  it("CA-09: o custo volta em nome do Dono; o registro mostra a correção e o desfazer; uma vez só", async () => {
    await redireciona(editar(caneta));
    const c = await ultimaCorrecao();
    expect(await desfazer(c.id)).toEqual({ status: "ok", mensagem: M.desfeita });
    expect(await custo(caneta)).toBe(40);
    const desfeita = await base.registroSuporte.findFirstOrThrow({ where: { evento: "CORRECAO_DESFEITA" } });
    expect(desfeita).toMatchObject({ correcaoId: c.id, usuarioId: dono, acessoId, modulo: "catalogo", dados: { antes: { custoBase: "42.00" }, depois: { custoBase: "40.00" } } });
    const historico = await base.historicoCusto.findMany({ where: { itemId: caneta }, orderBy: { vigenteDesde: "asc" } });
    expect(historico.map((h) => [Number(h.custo), h.usuarioId])).toEqual([
      [42, admin],
      [40, dono],
    ]);
    expect(await desfazer(c.id)).toEqual({ status: "erro", mensagem: M.naoPodeMaisDesfazer });

    const lista = await db.correcoes().correcoesDoNegocio(negocio, new Date());
    expect(lista).toEqual([expect.objectContaining({ id: c.id, rotulo: "Editar item", registro: "Caneta", autor: "Vitor Suporte", desfeitaPor: "Rafael Dono", podeDesfazer: false })]);
  });

  it("o registro mudou depois da correção: recusa com a explicação; outro campo mudado não impede", async () => {
    await redireciona(editar(caneta));
    const c = await ultimaCorrecao();
    await base.item.update({ where: { id: caneta }, data: { nome: "Caneta azul", nomeChave: "caneta azul" } });
    expect(await desfazer(c.id)).toEqual({ status: "ok", mensagem: M.desfeita });
    // O nome mudado pelo Dono fica; só o custo volta.
    expect(await base.item.findUniqueOrThrow({ where: { id: caneta } })).toMatchObject({ nome: "Caneta azul" });
    expect(await custo(caneta)).toBe(40);

    await comoSuporte();
    await redireciona(editar(caneta, { nome: "Caneta azul", custoBase: "44" }));
    const outra = await ultimaCorrecao();
    await base.item.update({ where: { id: caneta }, data: { custoBase: 45 } });
    expect(await desfazer(outra.id)).toEqual({ status: "erro", mensagem: M.registroMudou("Caneta azul", "Catálogo") });
    expect(await custo(caneta)).toBe(45);
  });

  it("30 dias, só o Dono, só o próprio negócio", async () => {
    await redireciona(editar(caneta));
    const c = await ultimaCorrecao();
    await expect(db.correcoes().desfazer(c.id, negocio, dono, new Date(Date.now() + 31 * 86_400_000))).rejects.toMatchObject({ mensagem: M.naoPodeMaisDesfazer });
    await expect(db.correcoes().desfazer(c.id, outroNegocio, dono, new Date())).rejects.toMatchObject({ mensagem: M.naoPodeMaisDesfazer });

    dubles.contexto = await contextoDe(gerente, undefined, negocio);
    await recusa(acaoDesfazerCorrecao({ status: "ocioso" }, formulario({ correcaoId: c.id })), "SomenteDono");
    await comoSuporte();
    await recusa(acaoDesfazerCorrecao({ status: "ocioso" }, formulario({ correcaoId: c.id })), "SomenteLeitura");
    expect(await desfazer("nao-e-uuid")).toEqual({ status: "erro", mensagem: M.naoPodeMaisDesfazer });
    expect(await custo(caneta)).toBe(42);
  });

  it("preço: novo registro com o valor anterior; sem preço antes, recusa", async () => {
    await base.item.update({ where: { id: caneta }, data: { precoAtual: 50 } });
    await base.historicoPreco.create({ data: { negocioId: negocio, itemId: caneta, preco: 50, origem: "MANUAL", usuarioId: dono } });
    await catalogo.acaoDefinirPreco(OCIOSO, formulario({ itemId: caneta, preco: "60" }));
    expect(await desfazer((await ultimaCorrecao()).id)).toMatchObject({ status: "ok" });
    const precos = await base.historicoPreco.findMany({ where: { itemId: caneta }, orderBy: { dataConfirmacao: "asc" } });
    expect(precos.map((p) => [Number(p.preco), p.usuarioId])).toEqual([
      [50, dono],
      [60, admin],
      [50, dono],
    ]);

    const lapis = await item("Lápis");
    await comoSuporte();
    await catalogo.acaoDefinirPreco(OCIOSO, formulario({ itemId: lapis, preco: "3" }));
    expect(await desfazer((await ultimaCorrecao()).id)).toEqual({ status: "erro", mensagem: "O item não tinha preço antes da correção. Ajuste direto no Catálogo." });
  });

  it("arquivar: a operação inversa; o código em uso ao reativar recusa com a mensagem do Catálogo", async () => {
    await redireciona(catalogo.acaoArquivarItem(formulario({ itemId: caneta, arquivar: "1" })));
    expect(await desfazer((await ultimaCorrecao()).id)).toMatchObject({ status: "ok" });
    expect(await base.item.findUniqueOrThrow({ where: { id: caneta } })).toMatchObject({ arquivadoEm: null });

    await comoSuporte();
    await redireciona(catalogo.acaoArquivarItem(formulario({ itemId: caneta, arquivar: "1" })));
    await item("Caneta nova", { codigo: "C-1", codigoChave: "C-1" });
    expect(await desfazer((await ultimaCorrecao()).id)).toEqual({ status: "erro", mensagem: codigoEmUsoAoReativar("C-1") });
  });

  it("subcategoria: criar desfaz excluindo (se nenhum item a usa); renomear volta o nome", async () => {
    const r = (await catalogo.acaoCriarSubcategoria(OCIOSO, formulario({ categoria: "PRODUTOS", nome: "Escrita" }))) as { subcategoria: { id: string } };
    const criada = await ultimaCorrecao();
    await catalogo.acaoRenomearSubcategoria(OCIOSO, formulario({ subcategoriaId: r.subcategoria.id, nome: "Escrita fina" }));
    const renomeada = await ultimaCorrecao();

    expect(await desfazer(renomeada.id)).toMatchObject({ status: "ok" });
    expect(await base.subcategoria.findUniqueOrThrow({ where: { id: r.subcategoria.id } })).toMatchObject({ nome: "Escrita" });

    await base.item.update({ where: { id: caneta }, data: { subcategoriaId: r.subcategoria.id } });
    expect(await desfazer(criada.id)).toEqual({ status: "erro", mensagem: 'A subcategoria "Escrita" já tem itens. Ajuste direto no Catálogo.' });
    await base.item.update({ where: { id: caneta }, data: { subcategoriaId: null } });
    expect(await desfazer(criada.id)).toMatchObject({ status: "ok" });
    expect(await base.subcategoria.count()).toBe(0);
  });

  it("CA-09: a entrada de 10 desfaz com uma saída de 10; saldo insuficiente recusa", async () => {
    await estoque.acaoRegistrarEntrada(OCIOSO, formulario({ itemId: caneta, quantidade: "10", data: HOJE }));
    const entrada = await ultimaCorrecao();
    expect(await saldo(caneta)).toBe(10);

    // O Dono vendeu ou tirou 5 depois: desfazer precisaria de 10.
    await criarSaidaDoDono(caneta, 5);
    expect(await desfazer(entrada.id)).toEqual({ status: "erro", mensagem: M.saldoInsuficiente("5") });
    await criarEntradaDoDono(caneta, 5);
    expect(await desfazer(entrada.id)).toMatchObject({ status: "ok" });
    expect(await saldo(caneta)).toBe(0);
    const desfeita = await base.movimentacaoEstoque.findFirstOrThrow({ where: { observacao: "Correção do suporte desfeita" } });
    expect(desfeita).toMatchObject({ tipo: "SAIDA_MANUAL", motivo: "OUTRO", usuarioId: dono });
    expect(Number(desfeita.quantidade)).toBe(10);
  });

  it("a saída manual desfaz com uma entrada; o mínimo volta ao valor anterior", async () => {
    await criarEntradaDoDono(caneta, 8);
    await comoSuporte();
    await estoque.acaoRegistrarSaida(OCIOSO, formulario({ itemId: caneta, quantidade: "3", data: HOJE, motivo: "PERDA" }));
    expect(await desfazer((await ultimaCorrecao()).id)).toMatchObject({ status: "ok" });
    expect(await saldo(caneta)).toBe(8);

    await base.item.update({ where: { id: caneta }, data: { estoqueMinimo: 2 } });
    await comoSuporte();
    await estoque.acaoDefinirMinimo(OCIOSO, formulario({ itemId: caneta, estoqueMinimo: "6" }));
    expect(await desfazer((await ultimaCorrecao()).id)).toMatchObject({ status: "ok" });
    expect(Number((await base.item.findUniqueOrThrow({ where: { id: caneta } })).estoqueMinimo)).toBe(2);
  });
});

// Movimentações do Dono, pelo mesmo caminho da aplicação (fora do modo suporte).
async function criarEntradaDoDono(id: string, quantidade: number) {
  const { criarConsultasDoEstoque } = await import("@/lib/db/estoque");
  await criarConsultasDoEstoque(comNegocio(base, { negocioId: negocio, usuarioId: dono }), negocio).registrar({ itemId: id, tipo: "ENTRADA", quantidade, usuarioId: dono, data: new Date() });
}
async function criarSaidaDoDono(id: string, quantidade: number) {
  const { criarConsultasDoEstoque } = await import("@/lib/db/estoque");
  await criarConsultasDoEstoque(comNegocio(base, { negocioId: negocio, usuarioId: dono }), negocio).registrar({ itemId: id, tipo: "SAIDA_MANUAL", quantidade, usuarioId: dono, data: new Date(), motivo: "PERDA" });
}
