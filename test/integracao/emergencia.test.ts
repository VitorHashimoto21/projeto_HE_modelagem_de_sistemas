import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { autorizar } from "@/lib/auth/autorizacao";
import { resolverContextoDaRequisicao } from "@/lib/auth/contexto";
import { criarConsultasDeAcesso } from "@/lib/db/acesso";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDaPlataforma } from "@/lib/db/plataforma";
import { criarConsultasDeSuporte } from "@/lib/db/suporte";
import type { PedidoDeEmergencia } from "@/lib/dominio/emergencia";
import * as servicosDaPlataforma from "@/lib/plataforma/servicos";
import * as servicosDoSuporte from "@/lib/suporte/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-019, etapa 3b — testes de integração (seção 12): T06 (emergência) e T07 (resultado obrigatório), com o
// banco real, as checagens e os gatilhos da migração e a mesma resolução de contexto da aplicação. Cobre os
// CA-10 a CA-13 e os INV-003 (a emergência nunca escreve), INV-006, INV-007 e INV-010.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const plataforma = criarConsultasDaPlataforma(base);
const suporte = criarConsultasDeSuporte(base);
const acesso = criarConsultasDeAcesso(base);
const VERSAO = "2026-11-01";
const HORA = 3_600_000;

let dono: string;
let adminA: string;
let adminB: string;
let negocio: string;
let outroNegocio: string;

const PEDIDO: PedidoDeEmergencia = { motivo: "INCIDENTE", referencia: "INC-42", justificativa: "Vendas sumiram depois da falha de ontem", modulos: ["vendas", "financeiro"], prazo: "2h" };

async function usuario(nome: string, admin = false) {
  return (
    await base.usuario.create({
      data: { id: randomUUID(), nome, email: `${nome.toLowerCase().replace(/\s+/g, ".")}@exemplo.com`, versaoTermosAceita: VERSAO, consentimentoLgpdEm: new Date(), administradorEm: admin ? new Date() : null },
    })
  ).id;
}

/** Contexto como a aplicação o monta nesta requisição, com a sessão do Administrador já com o código. */
const contexto = (usuarioId: string, suporteDoCookie?: string, negocioDoCookie?: string) =>
  resolverContextoDaRequisicao(
    { usuarioId, negocioDoCookie, suporteDoCookie, autenticadoEm: new Date(Date.now() - 60_000), nivelDaSessao: "aal2", codigoEm: new Date(Date.now() - 30_000), agora: new Date(), versaoDosTermos: VERSAO },
    { filiacao: (u, n) => acesso.filiacao(u, n), conta: (u) => acesso.estadoDaConta(u), liberacao: (id, adm) => suporte.liberacaoDoContexto(id, adm) },
  );

async function pedir(dados = PEDIDO, quem = adminA, agora = new Date(), negocioId = negocio) {
  const r = await plataforma.pedirEmergencia(negocioId, quem, dados, agora);
  if (!r.ok) throw new Error(`pedido recusado: ${r.erro}`);
  return r.id;
}

/** Pedido de A aprovado por B: devolve o id do acesso de emergência. */
async function aprovada(dados = PEDIDO, agora = new Date(), negocioId = negocio) {
  const id = await pedir(dados, adminA, agora, negocioId);
  const r = await plataforma.decidir(id, adminB, { aprovar: true }, agora);
  if (!r.ok || r.tipo !== "EMERGENCIA" || r.situacao !== "APROVADO") throw new Error(`aprovação recusada: ${JSON.stringify(r)}`);
  return r.acessoId;
}

const eventos = (negocioId = negocio) => base.registroSuporte.findMany({ where: { negocioId }, orderBy: { criadoEm: "asc" }, select: { evento: true, usuarioId: true, pedidoId: true, acessoId: true } });

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  dono = await usuario("Rafael Dono");
  adminA = await usuario("Ana Suporte", true);
  adminB = await usuario("Bruno Suporte", true);
  negocio = (await base.negocio.create({ data: { nome: "Salão da Gisele" } })).id;
  outroNegocio = (await base.negocio.create({ data: { nome: "Outro Negócio" } })).id;
  await base.membroNegocio.create({ data: { usuarioId: dono, negocioId: negocio, papel: "DONO" } });
  await base.membroNegocio.create({ data: { usuarioId: dono, negocioId: outroNegocio, papel: "DONO" } });
});

afterAll(async () => {
  await base.$disconnect();
});

describe("T06 — pedido de emergência (5.6, INV-007)", () => {
  it("sem liberação, o pedido fica pendente por 12 h, e o Dono o vê desde já", async () => {
    const agora = new Date();
    const r = await plataforma.pedirEmergencia(negocio, adminA, PEDIDO, agora);
    expect(r).toEqual({ ok: true, id: expect.any(String), expiraEm: new Date(agora.getTime() + 12 * HORA) });
    if (!r.ok) return;
    expect(await eventos()).toEqual([{ evento: "EMERGENCIA_SOLICITADA", usuarioId: adminA, pedidoId: r.id, acessoId: null }]);
    // INV-007: a mesma leitura da tela "Acessos do suporte" do Dono.
    const doDono = await plataforma.pedidosDoNegocio(negocio, new Date());
    expect(doDono).toEqual([expect.objectContaining({ id: r.id, tipo: "EMERGENCIA", situacao: "PENDENTE", solicitadoPor: "Ana Suporte", emergencia: PEDIDO })]);
    expect(await base.acessoSuporte.count()).toBe(0);
  });

  it("recusa com liberação ativa, negócio encerrado, outro pendente e emergência em andamento", async () => {
    const l = (await suporte.liberar(negocio, dono, { motivo: "Ajuda", modulos: ["vendas"], modulosComCorrecao: [], prazo: "24h" }, new Date()))!;
    expect(await plataforma.pedirEmergencia(negocio, adminA, PEDIDO, new Date())).toEqual({ ok: false, erro: "LiberacaoAtiva" });
    await suporte.revogar(negocio, l.id, dono, new Date());

    await base.negocio.update({ where: { id: outroNegocio }, data: { encerradoEm: new Date() } });
    expect(await plataforma.pedirEmergencia(outroNegocio, adminA, PEDIDO, new Date())).toEqual({ ok: false, erro: "NegocioEncerrado" });

    await pedir();
    expect(await plataforma.pedirEmergencia(negocio, adminB, PEDIDO, new Date())).toEqual({ ok: false, erro: "PedidoPendente" });
  });

  it("o banco recusa dados fora da lista", async () => {
    const criar = (dados: object) =>
      base.pedidoPlataforma.create({ data: { tipo: "EMERGENCIA", negocioId: negocio, solicitadoPorId: adminA, dados, criadoEm: new Date(), expiraEm: new Date(Date.now() + HORA) } });
    await expect(criar({ ...PEDIDO, motivo: "CURIOSIDADE" })).rejects.toThrow(/PedidoPlataforma_dados/);
    await expect(criar({ ...PEDIDO, referencia: "x".repeat(121) })).rejects.toThrow(/PedidoPlataforma_dados/);
    await expect(criar({ ...PEDIDO, justificativa: " " })).rejects.toThrow(/PedidoPlataforma_dados/);
    await expect(criar({ ...PEDIDO, prazo: "8h" })).rejects.toThrow(/PedidoPlataforma_dados/);
    await expect(criar({ ...PEDIDO, modulos: [] })).rejects.toThrow(/PedidoPlataforma_dados/);
    await expect(criar({ motivo: "INCIDENTE" })).rejects.toThrow(/PedidoPlataforma_dados/);
  });
});

describe("T06 — duas pessoas e o acesso (CA-10, INV-006)", () => {
  it("A não aprova o próprio pedido; B aprova e nasce o acesso somente leitura, pelo prazo pedido", async () => {
    const id = await pedir();
    expect(await plataforma.decidir(id, adminA, { aprovar: true }, new Date())).toEqual({ ok: false, erro: "MesmoAdministrador" });
    const agora = new Date();
    const r = await plataforma.decidir(id, adminB, { aprovar: true }, agora);
    expect(r).toEqual({ ok: true, tipo: "EMERGENCIA", situacao: "APROVADO", negocioId: negocio, emergencia: PEDIDO, acessoId: expect.any(String), expiraEm: new Date(agora.getTime() + 2 * HORA), solicitadoPor: "Ana Suporte" });
    if (!r.ok || r.tipo !== "EMERGENCIA" || r.situacao !== "APROVADO") return;
    const a = await base.acessoSuporte.findUniqueOrThrow({ where: { id: r.acessoId } });
    expect(a).toMatchObject({ tipo: "EMERGENCIA", liberadoPorId: null, modulos: ["vendas", "financeiro"], modulosComCorrecao: [], motivoEmergencia: "INCIDENTE", referencia: "INC-42", pedidoId: id, criadoEm: agora });
    expect((await eventos()).map((e) => [e.evento, e.usuarioId, e.pedidoId === id, e.acessoId])).toEqual([
      ["EMERGENCIA_SOLICITADA", adminA, true, null],
      ["EMERGENCIA_APROVADA", adminB, true, r.acessoId],
    ]);
  });

  it("sem resposta em 12 h, o pedido expira; recusado, guarda o motivo e não cria acesso", async () => {
    const vencido = await pedir(PEDIDO, adminA, new Date(Date.now() - 13 * HORA));
    expect(await plataforma.decidir(vencido, adminB, { aprovar: true }, new Date())).toEqual({ ok: false, erro: "PedidoExpirado" });
    const id = await pedir();
    expect(await plataforma.decidir(id, adminB, { aprovar: false, motivo: "Sem número de incidente" }, new Date())).toEqual({ ok: true, tipo: "EMERGENCIA", situacao: "RECUSADO", negocioId: negocio, emergencia: PEDIDO });
    expect((await eventos()).map((e) => e.evento)).toEqual(["EMERGENCIA_SOLICITADA", "EMERGENCIA_SOLICITADA", "EMERGENCIA_RECUSADA"]);
    expect(await base.acessoSuporte.count()).toBe(0);
  });

  it("o Dono liberou depois do pedido: a aprovação é recusada (o caminho é a liberação)", async () => {
    const id = await pedir();
    await suporte.liberar(negocio, dono, { motivo: "Ajuda", modulos: ["vendas"], modulosComCorrecao: [], prazo: "1h" }, new Date());
    expect(await plataforma.decidir(id, adminB, { aprovar: true }, new Date())).toEqual({ ok: false, erro: "LiberacaoAtiva" });
  });

  it("cancelar o pedido não vai para o registro (decisão de 06/11/2026)", async () => {
    const id = await pedir();
    expect(await plataforma.cancelar(id, adminA, new Date())).toEqual({ ok: true });
    expect((await eventos()).map((e) => e.evento)).toEqual(["EMERGENCIA_SOLICITADA"]);
    expect((await plataforma.pedidosDoNegocio(negocio, new Date()))[0]).toMatchObject({ situacao: "CANCELADO" });
  });
});

describe("T06 — o contexto da emergência (INV-010)", () => {
  it("só quem pediu tem o contexto; outra conta e cookie forjado não têm nada", async () => {
    const acessoId = await aprovada();
    const deA = await contexto(adminA, acessoId, outroNegocio);
    expect(deA).toMatchObject({ negocioId: negocio, suporte: { acessoId, negocioId: negocio, modulos: ["vendas", "financeiro"], modulosComCorrecao: [], emergencia: { motivo: "incidente de segurança" } } });
    expect(await contexto(adminB, acessoId)).toMatchObject({ negocioId: null, suporte: null, suporteEncerrado: null });
    expect(await contexto(adminA, randomUUID())).toMatchObject({ negocioId: null, suporte: null });
    expect(await contexto(adminA, "nao-e-uuid")).toMatchObject({ negocioId: null, suporte: null });
  });

  it("CA-12: somente leitura — toda ação é recusada, mesmo a de uma correção da lista", async () => {
    const acessoId = await aprovada();
    const c = await contexto(adminA, acessoId);
    expect(autorizar(c, { tipo: "permissao", modulo: "vendas", acao: "ver" })).toMatchObject({ ok: true, membro: { modoSuporte: true } });
    expect(autorizar(c, { tipo: "permissao", modulo: "financeiro", acao: "criar", origem: "acao", correcao: "financeiro.lancarAvulso" })).toEqual({ ok: false, motivo: "SomenteLeitura" });
    expect(autorizar(c, { tipo: "permissao", modulo: "catalogo", acao: "ver" })).toMatchObject({ ok: false });
    // Mesmo que o banco tivesse "ver e corrigir", a emergência não corrige: o banco também recusa.
    await expect(base.$executeRaw`UPDATE "AcessoSuporte" SET "modulosComCorrecao" = ARRAY['financeiro'] WHERE id = ${acessoId}::uuid`).rejects.toThrow(/AcessoSuporte_por_tipo/);
  });

  it("o Dono encerra: a próxima requisição de A volta ao painel, e o registro mostra quem encerrou", async () => {
    const acessoId = await aprovada();
    expect(await suporte.encerrarEmergencia(negocio, acessoId, dono, new Date(), "DONO")).toBe(true);
    expect(await contexto(adminA, acessoId)).toMatchObject({ negocioId: null, suporte: null, suporteEncerrado: "emergencia" });
    expect(await suporte.encerrarEmergencia(negocio, acessoId, dono, new Date(), "DONO")).toBe(false);
    expect((await eventos()).at(-1)).toMatchObject({ evento: "EMERGENCIA_ENCERRADA", usuarioId: dono, acessoId });
  });

  it("sem renovação: vencido o prazo, o contexto acaba", async () => {
    const acessoId = await aprovada(PEDIDO, new Date(Date.now() - 3 * HORA));
    expect(await contexto(adminA, acessoId)).toMatchObject({ negocioId: null, suporteEncerrado: "expirou" });
  });

  it("entrar: só quem pediu; a saída encerra o acesso", async () => {
    expect(await suporte.entrarNaEmergencia(negocio, adminA, new Date())).toEqual({ ok: false, erro: "SemEmergencia" });
    const acessoId = await aprovada();
    expect(await suporte.entrarNaEmergencia(negocio, adminB, new Date())).toEqual({ ok: false, erro: "SoQuemPediu" });
    expect(await suporte.entrarNaEmergencia(negocio, adminA, new Date())).toMatchObject({ ok: true, acessoId, primeira: true, modulos: ["vendas", "financeiro"] });

    const deps = {
      administradorId: adminA,
      agora: () => new Date(),
      liberacaoAtiva: (n: string) => suporte.liberacaoAtiva(n, new Date()),
      entrar: suporte.entrar,
      liberacao: (id: string) => suporte.liberacaoDoContexto(id),
      sair: suporte.sair,
      encerrarEmergencia: suporte.encerrarEmergencia,
      correcoesDaVisita: suporte.correcoesDaVisita,
      dono: suporte.donoDoNegocio,
      avisar: () => undefined,
      origem: "https://he.exemplo.com",
    };
    expect(await servicosDoSuporte.sair(acessoId, deps)).toBe(negocio);
    expect((await eventos()).slice(-3).map((e) => e.evento)).toEqual(["ENTRADA", "SAIDA", "EMERGENCIA_ENCERRADA"]);
    expect(await contexto(adminA, acessoId)).toMatchObject({ suporte: null, suporteEncerrado: "emergencia" });
  });

  it("a liberação do Dono não encerra a emergência, e a revogação da liberação não a alcança", async () => {
    const acessoId = await aprovada();
    await suporte.liberar(negocio, dono, { motivo: "Ajuda", modulos: ["vendas"], modulosComCorrecao: [], prazo: "1h" }, new Date());
    expect(await base.acessoSuporte.findUniqueOrThrow({ where: { id: acessoId }, select: { revogadoEm: true } })).toEqual({ revogadoEm: null });
    expect(await suporte.revogar(negocio, acessoId, dono, new Date())).toBe(false);
    expect((await suporte.liberacaoAtiva(negocio, new Date()))?.id).not.toBe(acessoId);
    expect((await suporte.emergenciaAtiva(negocio, new Date()))?.id).toBe(acessoId);
  });
});

describe("T07 — resultado obrigatório (CA-13)", () => {
  it("depois do fim, só quem pediu registra, uma vez; sem ele, não há novo pedido", async () => {
    const acessoId = await aprovada();
    expect(await suporte.registrarResultado(acessoId, adminA, "Achei a causa", new Date())).toEqual({ ok: false, erro: "AindaAtiva" });
    await suporte.encerrarEmergencia(negocio, acessoId, dono, new Date(), "DONO");
    expect(await plataforma.pedirEmergencia(outroNegocio, adminA, PEDIDO, new Date())).toEqual({ ok: false, erro: "ResultadoPendente" });
    expect(await suporte.registrarResultado(acessoId, adminB, "Outra pessoa", new Date())).toEqual({ ok: false, erro: "SoQuemPediu" });
    expect(await suporte.registrarResultado(acessoId, adminA, "Vendas restauradas do backup; causa: falha no sincronismo", new Date())).toEqual({ ok: true, negocioId: negocio });
    expect(await suporte.registrarResultado(acessoId, adminA, "De novo", new Date())).toEqual({ ok: false, erro: "JaRegistrado" });
    await expect(base.$executeRaw`UPDATE "AcessoSuporte" SET "resultado" = 'Mudado' WHERE id = ${acessoId}::uuid`).rejects.toThrow(/he_acesso_de_emergencia/);
    expect((await eventos()).at(-1)).toMatchObject({ evento: "EMERGENCIA_RESULTADO", usuarioId: adminA, acessoId });
    expect((await plataforma.pedirEmergencia(outroNegocio, adminA, PEDIDO, new Date())).ok).toBe(true);
  });

  it("o resultado aparece para o Dono e no histórico do painel, com quem pediu e quem aprovou", async () => {
    const acessoId = await aprovada();
    await suporte.encerrarEmergencia(negocio, acessoId, dono, new Date(), "DONO");
    await suporte.registrarResultado(acessoId, adminA, "Nada de anormal", new Date());
    const doDono = (await suporte.liberacoesDoNegocio(negocio)).find((l) => l.id === acessoId);
    expect(doDono).toMatchObject({
      tipo: "EMERGENCIA",
      liberadoPor: null,
      revogadoPor: "Rafael Dono",
      emergencia: { motivo: "INCIDENTE", referencia: "INC-42", solicitadoPor: "Ana Suporte", aprovadoPor: "Bruno Suporte", resultado: "Nada de anormal" },
    });
    expect(doDono?.eventos.map((e) => e.evento)).toEqual(["EMERGENCIA_APROVADA", "EMERGENCIA_ENCERRADA", "EMERGENCIA_RESULTADO"]);
    expect(await suporte.emergencias()).toEqual([
      expect.objectContaining({ id: acessoId, negocio: "Salão da Gisele", solicitadoPor: "Ana Suporte", aprovadoPor: "Bruno Suporte", encerradoPor: "Rafael Dono", resultado: "Nada de anormal" }),
    ]);
  });
});

describe("integridade e painel", () => {
  it("o banco recusa emergência acima de 4 h, sem pedido, ou com Dono, e liberação com pedido", async () => {
    const id = await pedir();
    const emergencia = (extra: object) =>
      base.acessoSuporte.create({
        data: { negocioId: negocio, tipo: "EMERGENCIA", motivo: "Incidente", motivoEmergencia: "INCIDENTE", referencia: "INC-1", justificativa: "x", modulos: ["vendas"], pedidoId: id, criadoEm: new Date(), expiraEm: new Date(Date.now() + HORA), ...extra },
      });
    await expect(emergencia({ expiraEm: new Date(Date.now() + 5 * HORA) })).rejects.toThrow(/AcessoSuporte_por_tipo/);
    await expect(emergencia({ pedidoId: null })).rejects.toThrow(/AcessoSuporte_por_tipo/);
    await expect(emergencia({ liberadoPorId: dono })).rejects.toThrow(/AcessoSuporte_por_tipo/);
    await expect(
      base.acessoSuporte.create({ data: { negocioId: negocio, liberadoPorId: dono, motivo: "Ajuda", modulos: ["vendas"], pedidoId: id, expiraEm: new Date(Date.now() + HORA) } }),
    ).rejects.toThrow(/AcessoSuporte_por_tipo/);
    // O pedido é de outro negócio: o isolamento recusa.
    const deOutro = await pedir(PEDIDO, adminA, new Date(), outroNegocio);
    await expect(emergencia({ pedidoId: deOutro })).rejects.toThrow(/he_mesmo_negocio|negócio/i);
  });

  it("a ficha do painel mostra a emergência à parte da liberação", async () => {
    const acessoId = await aprovada();
    const n = await suporte.negocioNoPainel(negocio, new Date());
    expect(n?.liberacao).toBeNull();
    expect(n?.emergencia).toMatchObject({ id: acessoId, motivo: "INCIDENTE", referencia: "INC-42", solicitadoPorId: adminA, solicitadoPor: "Ana Suporte" });
  });
});

describe("fluxos (servicos.ts) com o banco: mensagens e os avisos ao Dono", () => {
  const avisos: { para: string; assunto: string; texto: string }[] = [];
  const deps = (administradorId: string): servicosDaPlataforma.DependenciasDaPlataforma => ({
    administradorId,
    agora: () => new Date(),
    pedirTrocaDePlano: plataforma.pedirTrocaDePlano,
    pedirEmergencia: plataforma.pedirEmergencia,
    decidir: plataforma.decidir,
    cancelar: plataforma.cancelar,
    entrarNaEmergencia: suporte.entrarNaEmergencia,
    suspender: plataforma.suspender,
    reativar: plataforma.reativar,
    registrarResultado: suporte.registrarResultado,
    dono: suporte.donoDoNegocio,
    avisar: (m) => avisos.push(m),
    origem: "https://he.exemplo.com",
  });

  it("o Dono recebe o e-mail no pedido e na aprovação", async () => {
    avisos.length = 0;
    const campos = { negocioId: negocio, motivo: "DONO_SEM_ACESSO", referencia: "Joana, por WhatsApp", justificativa: "O Dono perdeu o acesso ao e-mail", "modulo.vendas": "on", prazo: "1h" };
    expect(await servicosDaPlataforma.pedirEmergencia(campos, deps(adminA))).toEqual({ status: "ok", mensagem: expect.stringContaining("O Dono já vê o pedido") });
    expect(avisos.map((a) => a.assunto)).toEqual(["Pedido de acesso de emergência ao Salão da Gisele"]);
    expect(avisos[0].texto).toContain("Dono sem acesso, a pedido de um membro (Joana, por WhatsApp)");
    const id = (await base.pedidoPlataforma.findFirstOrThrow({ select: { id: true } })).id;
    expect(await servicosDaPlataforma.aprovar({ pedidoId: id }, deps(adminB))).toEqual({ status: "ok", mensagem: expect.stringContaining("Ana Suporte pode entrar, somente leitura") });
    expect(avisos[1].assunto).toMatch(/^Acesso de emergência do suporte ao Salão da Gisele até /);
  });

  it("as recusas do pedido explicam o motivo", async () => {
    await suporte.liberar(negocio, dono, { motivo: "Ajuda", modulos: ["vendas"], modulosComCorrecao: [], prazo: "1h" }, new Date());
    const campos = { negocioId: negocio, motivo: "INCIDENTE", referencia: "INC-9", justificativa: "Falha", "modulo.vendas": "on", prazo: "4h" };
    expect(await servicosDaPlataforma.pedirEmergencia(campos, deps(adminA))).toEqual({ status: "erro", mensagem: expect.stringContaining("Use a liberação") });
    expect(await servicosDaPlataforma.pedirEmergencia({ ...campos, prazo: "12h" }, deps(adminA))).toMatchObject({ status: "erro", erros: { prazo: "Escolha 1, 2 ou 4 horas." } });
  });
});
