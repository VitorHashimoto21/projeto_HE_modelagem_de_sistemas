import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { resolverContextoDaRequisicao, type ContextoComPapel } from "@/lib/auth/contexto";
import { criarConsultasDeAcesso } from "@/lib/db/acesso";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDeEquipe } from "@/lib/db/equipe";
import { NegocioSuspenso } from "@/lib/db/erros";
import { criarConsultasDaLgpd } from "@/lib/db/lgpd";
import { GRAVAM_NA_SUSPENSAO, MODELOS } from "@/lib/db/modelos";
import { criarConsultasDaPlataforma } from "@/lib/db/plataforma";
import { criarConsultasDeSuporte } from "@/lib/db/suporte";
import { MENSAGENS_DAS_CORRECOES } from "@/lib/dominio/correcoes";
import { MENSAGENS_DA_SUSPENSAO as S, type DadosDaSuspensao } from "@/lib/dominio/suspensao";
import { executarRotinaDiaria } from "@/lib/rotinas/diaria";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-019, etapa 4a — testes de integração (seção 12): T08 (suspensão), CA-14, CA-21 e INV-008, com o banco
// real, os gatilhos e as checagens da migração. As Server Actions são as da aplicação; só a leitura da sessão
// é trocada: a guarda decide com `autorizar` sobre o contexto montado como na aplicação (obterContexto).

const dubles = vi.hoisted(() => ({ contexto: null as unknown }));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
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
const negocioAcoes = await import("@/lib/negocio/acoes");
const { acaoDesfazerCorrecao } = await import("@/lib/suporte/acoes");
const { conferirFinanceiro } = await import("@/lib/financeiro/conferencia");

const plataforma = criarConsultasDaPlataforma(base);
const suporte = criarConsultasDeSuporte(base);
const acesso = criarConsultasDeAcesso(base);
const equipe = criarConsultasDeEquipe(base);
const lgpd = criarConsultasDaLgpd(base);
const VERSAO = "2026-11-01";
const DIA = 86_400_000;
const SUSPENSAO: DadosDaSuspensao = { motivo: "INCIDENTE_SEGURANCA", descricao: "Acesso não reconhecido; o Dono pediu para travar até trocar as senhas" };

let dono: string;
let gerente: string;
let adminA: string;
let adminB: string;
let negocio: string;
let outro: string;
let caneta: string;

async function usuario(nome: string, admin = false) {
  return (
    await base.usuario.create({
      data: { id: randomUUID(), nome, email: `${nome.toLowerCase().replace(/\s+/g, ".")}@exemplo.com`, versaoTermosAceita: VERSAO, consentimentoLgpdEm: new Date(), administradorEm: admin ? new Date() : null },
    })
  ).id;
}

/** Contexto como a aplicação o monta (servidor.ts → obterContexto). */
const contextoDe = (usuarioId: string, cookie: { negocio?: string; suporte?: string }) =>
  resolverContextoDaRequisicao(
    {
      usuarioId,
      negocioDoCookie: cookie.negocio,
      suporteDoCookie: cookie.suporte,
      autenticadoEm: new Date(Date.now() - 60_000),
      nivelDaSessao: "aal2",
      codigoEm: new Date(),
      agora: new Date(),
      versaoDosTermos: VERSAO,
    },
    { filiacao: (u, n) => acesso.filiacao(u, n), conta: (u) => acesso.estadoDaConta(u), liberacao: (id, adm) => suporte.liberacaoDoContexto(id, adm) },
  );
const como = async (usuarioId: string, cookie: { negocio?: string; suporte?: string } = { negocio }) => (dubles.contexto = await contextoDe(usuarioId, cookie));

function formulario(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

const OCIOSO = { status: "ocioso" } as never;
const recusa = (p: Promise<unknown>, motivo: string) => expect(p).rejects.toMatchObject({ motivo });
const redireciona = (p: Promise<unknown>) => expect(p).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });

async function suspender(negocioId = negocio, dados = SUSPENSAO) {
  const r = await plataforma.suspender(negocioId, adminA, dados, new Date());
  if (!r.ok) throw new Error(`suspensão recusada: ${r.erro}`);
}

const custo = async (id: string) => Number((await base.item.findUniqueOrThrow({ where: { id } })).custoBase);
const editar = (id: string, custoBase: string) =>
  catalogo.acaoEditarItem(OCIOSO, formulario({ itemId: id, nome: "Caneta", codigo: "C-1", categoria: "PRODUTOS", unidadeMedida: "un", custoBase }));

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  dono = await usuario("Rafael Dono");
  gerente = await usuario("Gabi Gerente");
  adminA = await usuario("Ana Suporte", true);
  adminB = await usuario("Bruno Suporte", true);
  negocio = (await base.negocio.create({ data: { nome: "Papelaria" } })).id;
  outro = (await base.negocio.create({ data: { nome: "Outro" } })).id;
  await base.membroNegocio.create({ data: { usuarioId: dono, negocioId: negocio, papel: "DONO" } });
  await base.membroNegocio.create({ data: { usuarioId: gerente, negocioId: negocio, papel: "GERENTE" } });
  await base.membroNegocio.create({ data: { usuarioId: dono, negocioId: outro, papel: "DONO" } });
  caneta = (
    await base.item.create({
      data: { negocioId: negocio, tipo: "PRODUTO_FISICO", nome: "Caneta", nomeChave: "caneta", codigo: "C-1", codigoChave: "C-1", categoria: "PRODUTOS", unidadeMedida: "un", custoBase: 40 },
    })
  ).id;
});

afterAll(async () => {
  await base.$disconnect();
});

// ---------------------------------------------------------------------------------------

describe("T08 — suspender e reativar (5.7)", () => {
  it("um Administrador suspende com o motivo e a descrição completa; o registro guarda os dois", async () => {
    const longa = "d".repeat(500);
    expect(await plataforma.suspender(negocio, adminA, { motivo: "USO_INDEVIDO", descricao: longa }, new Date())).toEqual({ ok: true, negocio: "Papelaria" });
    const n = await base.negocio.findUniqueOrThrow({ where: { id: negocio } });
    expect(n).toMatchObject({ suspensoPorId: adminA, motivoSuspensao: "USO_INDEVIDO", descricaoSuspensao: longa });
    expect(n.suspensoEm).toBeInstanceOf(Date);
    const r = await base.registroSuporte.findFirstOrThrow({ where: { evento: "SUSPENSAO" } });
    expect(r).toMatchObject({ negocioId: negocio, usuarioId: adminA, acessoId: null, pedidoId: null, dados: { motivo: "USO_INDEVIDO", descricao: longa } });
    expect(r.descricao.length).toBe(200);
  });

  it("recusa negócio já suspenso, encerrado, inexistente e conta comum; reativar só o suspenso", async () => {
    await suspender();
    expect(await plataforma.suspender(negocio, adminB, SUSPENSAO, new Date())).toEqual({ ok: false, erro: "JaSuspenso" });
    expect(await plataforma.reativar(outro, adminA, "x", new Date())).toEqual({ ok: false, erro: "NaoSuspenso" });
    expect(await plataforma.suspender(negocio, dono, SUSPENSAO, new Date())).toEqual({ ok: false, erro: "NaoEAdministrador" });
    expect(await plataforma.suspender(randomUUID(), adminA, SUSPENSAO, new Date())).toEqual({ ok: false, erro: "NegocioInexistente" });
    await base.negocio.update({ where: { id: outro }, data: { encerradoEm: new Date() } });
    expect(await plataforma.suspender(outro, adminA, SUSPENSAO, new Date())).toEqual({ ok: false, erro: "NegocioEncerrado" });

    // Reativar: outra conta pode, com a descrição; a suspensão sai do negócio e o registro guarda as duas.
    expect(await plataforma.reativar(negocio, adminB, "Senhas trocadas e equipe revisada", new Date())).toEqual({ ok: true, negocio: "Papelaria" });
    expect(await base.negocio.findUniqueOrThrow({ where: { id: negocio } })).toMatchObject({ suspensoEm: null, suspensoPorId: null, motivoSuspensao: null, descricaoSuspensao: null });
    const lista = await plataforma.suspensoesDoNegocio(negocio);
    expect(lista.map((s) => [s.evento, s.motivo, s.descricao, s.autor])).toEqual([
      ["REATIVACAO", null, "Senhas trocadas e equipe revisada", "Bruno Suporte"],
      ["SUSPENSAO", "INCIDENTE_SEGURANCA", SUSPENSAO.descricao, "Ana Suporte"],
    ]);
  });

  it("o banco recusa suspensão incompleta, negócio encerrado e suspenso, e o evento sem os dados", async () => {
    await expect(base.negocio.update({ where: { id: negocio }, data: { suspensoEm: new Date() } })).rejects.toThrow(/Negocio_suspensao/);
    // Suspender um encerrado por fora da aplicação: o CHECK recusa.
    await base.negocio.update({ where: { id: outro }, data: { encerradoEm: new Date() } });
    const completa = { suspensoEm: new Date(), suspensoPorId: adminA, motivoSuspensao: "ORDEM_JUDICIAL" as const, descricaoSuspensao: "x" };
    await expect(base.negocio.update({ where: { id: outro }, data: completa })).rejects.toThrow(/Negocio_encerrado_nao_suspenso/);
    // Encerrar o suspenso sem tirar a suspensão: o gatilho recusa antes (a exclusão da conta tira a suspensão junto).
    await suspender();
    await expect(base.negocio.update({ where: { id: negocio }, data: { encerradoEm: new Date() } })).rejects.toThrow(/he_negocio_suspenso/);
    await expect(base.negocio.update({ where: { id: negocio }, data: { encerradoEm: new Date(), ...completa, suspensoEm: null, suspensoPorId: null, motivoSuspensao: null, descricaoSuspensao: null } })).resolves.toBeTruthy();
    await expect(base.registroSuporte.create({ data: { negocioId: negocio, usuarioId: adminA, evento: "SUSPENSAO", descricao: "x" } })).rejects.toThrow(
      /RegistroSuporte_evento_da_suspensao/,
    );
  });

  it("o painel mostra a situação e filtra os suspensos; a ficha traz quem suspendeu", async () => {
    await suspender();
    const todos = await suporte.listarNegocios("", 1, new Date());
    expect(todos.total).toBe(2);
    const suspensos = await suporte.listarNegocios("", 1, new Date(), "suspensos");
    expect(suspensos.negocios.map((n) => n.id)).toEqual([negocio]);
    expect(suspensos.negocios[0].suspensao).toMatchObject({ motivo: "INCIDENTE_SEGURANCA", descricao: SUSPENSAO.descricao, por: "Ana Suporte" });
    expect((await suporte.negocioNoPainel(outro, new Date()))?.suspensao).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------

describe("INV-008 — nenhuma escrita de membros nem do suporte no negócio suspenso", () => {
  it("cada fábrica: ações de módulo e do Dono recusadas; consulta, desfazer e acesso do suporte passam", async () => {
    await suspender();
    await como(dono);
    expect(dubles.contexto).toMatchObject({ negocioSuspenso: { motivo: "INCIDENTE_SEGURANCA" } });
    await recusa(editar(caneta, "42,00"), "NegocioSuspenso");
    await recusa(catalogo.acaoCriarSubcategoria(OCIOSO, formulario({ categoria: "PRODUTOS", nome: "Canetas" })), "NegocioSuspenso");
    await recusa(negocioAcoes.acaoDefinirDiasCobertura(OCIOSO, formulario({ diasCoberturaEstoque: "10" })), "NegocioSuspenso");
    // A consulta do formulário não grava: passa (o NCM vem da tabela global).
    expect(await catalogo.acaoBuscarNcm("caneta")).not.toMatchObject({ motivo: expect.anything() });
    // O desfazer passa pela fábrica e é recusado no banco com a explicação (OPEN-018).
    expect(await acaoDesfazerCorrecao({ status: "ocioso" }, formulario({ correcaoId: randomUUID() }))).toEqual({ status: "erro", mensagem: S.desfazer });

    await como(gerente);
    await recusa(editar(caneta, "42,00"), "NegocioSuspenso");
    expect(await custo(caneta)).toBe(40);
    expect(await base.subcategoria.count()).toBe(0);
  });

  it("segunda barreira: o banco recusa toda gravação nos módulos e no negócio, venha de onde vier", async () => {
    await suspender();
    const cliente = comNegocio(base, { negocioId: negocio, usuarioId: dono });
    await expect(cliente.item.update({ where: { id: caneta }, data: { custoBase: 1 } })).rejects.toBeInstanceOf(NegocioSuspenso);
    await expect(
      cliente.item.create({ data: { tipo: "PRODUTO_FISICO", nome: "Lápis", nomeChave: "lapis", categoria: "PRODUTOS", unidadeMedida: "un", custoBase: 1 } as never }),
    ).rejects.toBeInstanceOf(NegocioSuspenso);
    await expect(cliente.item.delete({ where: { id: caneta } })).rejects.toBeInstanceOf(NegocioSuspenso);
    await expect(base.cliente.create({ data: { negocioId: negocio, nome: "Maria" } })).rejects.toThrow(/he_negocio_suspenso/);
    await expect(base.$executeRaw`UPDATE "Item" SET "custoBase" = 1 WHERE "negocioId" = ${negocio}::uuid`).rejects.toThrow(/he_negocio_suspenso/);
    // Configurações: dados, parâmetros e o número da venda ficam travados.
    await expect(base.negocio.update({ where: { id: negocio }, data: { nome: "Outro nome" } })).rejects.toThrow(/he_negocio_suspenso/);
    await expect(base.negocio.update({ where: { id: negocio }, data: { proximoNumeroVenda: { increment: 1 } } })).rejects.toThrow(/he_negocio_suspenso/);
    // O outro negócio do mesmo Dono continua gravando.
    await base.cliente.create({ data: { negocioId: outro, nome: "João" } });
    expect(await custo(caneta)).toBe(40);
  });

  it("todas as tabelas dos módulos têm o gatilho; as que gravam na suspensão, não", async () => {
    const linhas = await base.$queryRaw<{ tabela: string }[]>`
      SELECT c.relname AS "tabela" FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE t.tgname = 'he_negocio_suspenso' AND NOT t.tgisinternal`;
    const comGatilho = new Set(linhas.map((l) => l.tabela));
    for (const [modelo, def] of Object.entries(MODELOS)) {
      if (def.classe === "global") continue;
      const esperado = def.classe === "ancora" || !Object.hasOwn(GRAVAM_NA_SUSPENSAO, modelo);
      expect(comGatilho.has(modelo), modelo).toBe(esperado);
    }
  });

  it("no suporte, as correções saem da liberação e a chamada direta é recusada", async () => {
    const l = await suporte.liberar(negocio, dono, { motivo: "Custo", modulos: ["catalogo"], modulosComCorrecao: ["catalogo"], prazo: "1h" }, new Date());
    expect(await suporte.entrar(l!.id, adminA, new Date(), true)).toMatchObject({ ok: true });
    await suspender();
    await como(adminA, { suporte: l!.id });
    expect((dubles.contexto as ContextoComPapel).suporte).toMatchObject({ modulos: ["catalogo"], modulosComCorrecao: [] });
    await recusa(editar(caneta, "42,00"), "NegocioSuspenso");
    expect(await base.registroSuporte.count({ where: { evento: "CORRECAO" } })).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------

describe("CA-14 — o que continua e o que volta na reativação", () => {
  it("os membros leem e exportam; a liberação, a emergência e a troca de plano pela plataforma continuam", async () => {
    await suspender();
    expect((await db.catalogo({ negocioId: negocio }).listar({})).length).toBeGreaterThan(0);
    expect(await lgpd.dadosDoTitular(dono, new Date())).not.toBeNull();

    const l = await suporte.liberar(negocio, dono, { motivo: "Ajuda", modulos: ["vendas"], modulosComCorrecao: [], prazo: "24h" }, new Date());
    expect(l).not.toBeNull();
    expect(await suporte.revogar(negocio, l!.id, dono, new Date())).toBe(true);
    expect(await plataforma.pedirEmergencia(negocio, adminA, { motivo: "INCIDENTE", referencia: "INC-7", justificativa: "Ver o caixa", modulos: ["financeiro"], prazo: "1h" }, new Date())).toMatchObject({
      ok: true,
    });
    const p = await plataforma.pedirTrocaDePlano(negocio, adminB, { para: "PAGO", motivo: "CORTESIA", descricao: "Teste combinado" }, new Date());
    if (!p.ok) throw new Error(p.erro);
    expect(await plataforma.decidir(p.id, adminA, { aprovar: true }, new Date())).toMatchObject({ ok: true, situacao: "APROVADO" });
    expect((await base.negocio.findUniqueOrThrow({ where: { id: negocio } })).plano).toBe("PAGO");
  });

  it("a rotina diária e a conferência pulam o negócio; ao reativar, as contas do período são geradas", async () => {
    const mesPassado = new Date();
    mesPassado.setUTCDate(1);
    mesPassado.setUTCMonth(mesPassado.getUTCMonth() - 1);
    const geraDesde = new Date(`${mesPassado.toISOString().slice(0, 10)}T00:00:00Z`);
    await base.despesaFixa.create({ data: { negocioId: negocio, descricao: "Aluguel", valorMensal: 1200, diaVencimento: 1, geraDesde } });
    await suspender();

    const ativos = await db.negociosAtivos();
    expect(ativos).toEqual([outro]);
    const conferidos: string[] = [];
    await executarRotinaDiaria(ativos, async (n) => (conferidos.push(n), { contasCriadas: 0, parcelasRecebidas: 0 }));
    expect(conferidos).toEqual([outro]);
    // A conferência ao abrir a tela não tenta; a chamada direta é recusada pelo banco.
    await conferirFinanceiro({ negocioId: negocio, usuarioId: dono, negocioSuspenso: { desde: new Date(), motivo: "INCIDENTE_SEGURANCA" } });
    await expect(db.financeiro({ negocioId: negocio }).conferir(new Date().toISOString().slice(0, 10))).rejects.toBeInstanceOf(NegocioSuspenso);
    expect(await base.contaPagarReceber.count({ where: { negocioId: negocio } })).toBe(0);

    expect((await plataforma.reativar(negocio, adminA, "Resolvido", new Date())).ok).toBe(true);
    expect(await db.negociosAtivos()).toEqual([negocio, outro]);
    await conferirFinanceiro({ negocioId: negocio, usuarioId: dono, negocioSuspenso: null });
    const contas = await base.contaPagarReceber.findMany({ where: { negocioId: negocio }, orderBy: { competencia: "asc" } });
    expect(contas.length).toBeGreaterThan(0);
    expect(contas[0].descricao).toMatch(/^Aluguel — /);

    // A gravação voltou, e nada se perdeu.
    await como(dono);
    await redireciona(editar(caneta, "42,00"));
    expect(await custo(caneta)).toBe(42);
  });

  it("convite pendente não é aceito na suspensão e continua pendente; ao reativar, o aceite volta", async () => {
    const convidado = await usuario("Nina Nova");
    const c = await base.convite.create({
      data: { negocioId: negocio, email: "nina.nova@exemplo.com", papel: "COLABORADOR", tokenHash: "h-suspensao", expiraEm: new Date(Date.now() + 7 * DIA), convidadoPorId: dono },
    });
    await suspender();
    expect(await equipe.conviteDoToken("h-suspensao", new Date())).toMatchObject({ valido: true, suspenso: true });
    expect(await equipe.aceitar(c.id, convidado, "nina.nova@exemplo.com", new Date())).toEqual({ ok: false, erro: "NegocioSuspenso" });
    expect(await base.convite.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ status: "PENDENTE" });
    expect(await base.membroNegocio.count({ where: { usuarioId: convidado } })).toBe(0);

    await plataforma.reativar(negocio, adminA, "Resolvido", new Date());
    expect(await equipe.aceitar(c.id, convidado, "nina.nova@exemplo.com", new Date())).toEqual({ ok: true, negocioId: negocio });
  });

  it("excluir a conta do Dono continua: o negócio é encerrado, a suspensão sai, e os registros ficam", async () => {
    await base.cliente.create({ data: { negocioId: negocio, nome: "Maria Cliente" } });
    await suspender();
    expect(await lgpd.excluirConta(dono, new Date())).toEqual({ ok: true, negociosEncerrados: 2, administrador: false });
    const n = await base.negocio.findUniqueOrThrow({ where: { id: negocio } });
    expect(n.encerradoEm).toBeInstanceOf(Date);
    expect(n.suspensoEm).toBeNull();
    expect(await base.registroSuporte.count({ where: { negocioId: negocio, evento: "SUSPENSAO" } })).toBe(1);
    expect(await base.item.count({ where: { negocioId: negocio } })).toBe(1);
    expect((await base.cliente.findFirstOrThrow({ where: { negocioId: negocio } })).anonimizadoEm).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------------------

describe("CA-21 — desfazer na suspensão (OPEN-018)", () => {
  it("recusado com a explicação; ao reativar, volta enquanto não passarem os 30 dias", async () => {
    const l = await suporte.liberar(negocio, dono, { motivo: "Custo errado", modulos: ["catalogo"], modulosComCorrecao: ["catalogo"], prazo: "1h" }, new Date());
    expect(await suporte.entrar(l!.id, adminA, new Date(), true)).toMatchObject({ ok: true });
    await como(adminA, { suporte: l!.id });
    await redireciona(editar(caneta, "42,00"));
    const correcao = await base.registroSuporte.findFirstOrThrow({ where: { evento: "CORRECAO" } });
    await suspender();

    // Cinco dias depois, suspenso: recusado com a explicação, e nada muda.
    const daqui5 = new Date(Date.now() + 5 * DIA);
    await expect(db.correcoes().desfazer(correcao.id, negocio, dono, daqui5)).rejects.toMatchObject({ mensagem: S.desfazer });
    expect(await custo(caneta)).toBe(42);
    // Pela Server Action do Dono, a mesma explicação.
    await como(dono);
    expect(await acaoDesfazerCorrecao({ status: "ocioso" }, formulario({ correcaoId: correcao.id }))).toEqual({ status: "erro", mensagem: S.desfazer });

    // O prazo continuou contando: com 31 dias, não dá mais; reativado aos 5 dias, dá.
    await plataforma.reativar(negocio, adminA, "Resolvido", new Date());
    await expect(db.correcoes().desfazer(correcao.id, negocio, dono, new Date(Date.now() + 31 * DIA))).rejects.toMatchObject({ mensagem: MENSAGENS_DAS_CORRECOES.naoPodeMaisDesfazer });
    await db.correcoes().desfazer(correcao.id, negocio, dono, daqui5);
    expect(await custo(caneta)).toBe(40);
  });
});
