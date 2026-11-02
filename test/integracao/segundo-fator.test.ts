import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { resolverContextoDaRequisicao } from "@/lib/auth/contexto";
import * as fluxos from "@/lib/auth/segundo-fator";
import type { DependenciasDoSegundoFator } from "@/lib/auth/segundo-fator";
import * as servicos from "@/lib/auth/servicos";
import { ROTA_SENHA_ALTERADA, type DependenciasDeAcesso } from "@/lib/auth/servicos";
import { VERSAO_TERMOS } from "@/lib/auth/validacao";
import { criarConsultasDeAcesso } from "@/lib/db/acesso";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDeSuporte } from "@/lib/db/suporte";
import { MENSAGENS_DO_SEGUNDO_FATOR as M } from "@/lib/dominio/segundo-fator";
import { redefinirSegundoFator, type ApiDeAdministracao } from "@/lib/suporte/redefinir-segundo-fator";
import { criarAutenticacaoFalsa } from "../apoio/autenticacao-falsa";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-019, etapa 1 — testes de integração do 2º fator do Administrador, com o banco local e o dublê
// do Supabase Auth, que gera e confere códigos TOTP de verdade: cadastro (CA-01), código no login,
// remoção (nunca o último), nova senha com o código (OPEN-017, CA-20), redefinição pelo workflow
// (T12, CA-05) e os eventos novos só de inclusão (INV-011).

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const acesso = criarConsultasDeAcesso(base);
const suporte = criarConsultasDeSuporte(base);

let falsa: ReturnType<typeof criarAutenticacaoFalsa>;
let deps: DependenciasDoSegundoFator;
let adminId: string;

const EMAIL = "suporte@exemplo.com";
const SENHA = "senha-forte-1";

async function limparBanco() {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await base.$executeRawUnsafe("DELETE FROM auth.users");
}

async function contaDe(email: string, administrador: boolean): Promise<string> {
  await falsa.adaptador.cadastrar({ nome: "Pessoa do Suporte", email, senha: SENHA, versaoTermos: VERSAO_TERMOS, urlDeConfirmacao: "x" });
  falsa.confirmar(email);
  if (administrador) expect(await suporte.concederPapel(email, "Equipe (teste)", new Date())).toMatchObject({ ok: true });
  return (await base.usuario.findUniqueOrThrow({ where: { email } })).id;
}

const eventos = (usuarioId: string) =>
  base.registroSuporte.findMany({ where: { usuarioId, evento: { in: ["SEGUNDO_FATOR_CADASTRADO", "SEGUNDO_FATOR_REMOVIDO", "SEGUNDO_FATOR_REDEFINIDO"] } }, orderBy: { criadoEm: "asc" } });

/** Cadastra um autenticador pelo fluxo completo (nome → QR → código) e devolve o id. */
async function cadastrarAutenticador(nome: string): Promise<{ id: string; primeiro: boolean }> {
  const qr = await fluxos.iniciarCadastro({ nome }, deps);
  if (qr.status !== "qr") throw new Error(`esperava o QR code: ${JSON.stringify(qr)}`);
  const r = await fluxos.concluirCadastro({ fator: qr.fatorId, codigo: falsa.codigoDe(qr.fatorId) }, qr, deps);
  if (r.status !== "concluido") throw new Error(`esperava concluir: ${JSON.stringify(r)}`);
  return { id: qr.fatorId, primeiro: r.primeiro };
}

beforeEach(async () => {
  await limparBanco();
  falsa = criarAutenticacaoFalsa(base);
  adminId = await contaDe(EMAIL, true);
  expect(await falsa.adaptador.entrar(EMAIL, SENHA)).toMatchObject({ ok: true });
  deps = {
    auth: falsa.adaptador,
    registrar: (evento, descricao) => suporte.registrarSegundoFator(adminId, evento, descricao, new Date()),
    emissor: "HE Homologação",
  };
});

afterAll(async () => {
  await base.$disconnect();
});

describe("CA-01 — cadastro do 2º fator", () => {
  it("nome → QR code com o emissor do ambiente → código: a sessão sobe para aal2 e o registro guarda o cadastro", async () => {
    expect((await falsa.adaptador.sessaoAtual())?.nivel).toBe("aal1");
    const qr = await fluxos.iniciarCadastro({ nome: "Celular" }, deps);
    expect(qr).toMatchObject({ status: "qr", nome: "Celular" });
    expect(falsa.registro.emissores).toEqual(["HE Homologação"]);
    if (qr.status !== "qr") return;

    expect(await fluxos.concluirCadastro({ fator: qr.fatorId, codigo: "12345" }, qr, deps)).toMatchObject({ status: "qr", erros: { codigo: M.codigoFormato } });
    const errado = falsa.codigoDe(qr.fatorId) === "000000" ? "111111" : "000000";
    expect(await fluxos.concluirCadastro({ fator: qr.fatorId, codigo: errado }, qr, deps)).toMatchObject({ status: "qr", erros: { codigo: M.codigoInvalido } });
    expect((await falsa.adaptador.sessaoAtual())?.nivel).toBe("aal1");

    expect(await fluxos.concluirCadastro({ fator: qr.fatorId, codigo: falsa.codigoDe(qr.fatorId) }, qr, deps)).toEqual({ status: "concluido", primeiro: true });
    expect((await falsa.adaptador.sessaoAtual())?.nivel).toBe("aal2");
    expect((await eventos(adminId)).map((e) => [e.evento, e.descricao, e.negocioId])).toEqual([["SEGUNDO_FATOR_CADASTRADO", 'Autenticador "Celular" cadastrado', null]]);
  });

  it("nome obrigatório e sem repetição; um cadastro de outra conta ou já ativo não é concluído por id", async () => {
    expect(await fluxos.iniciarCadastro({ nome: "  " }, deps)).toMatchObject({ status: "erro", erros: { nome: M.nomeObrigatorio } });
    await cadastrarAutenticador("Celular");
    expect(await fluxos.iniciarCadastro({ nome: "Celular" }, deps)).toMatchObject({ status: "erro", erros: { nome: M.nomeRepetido } });
    const pendente = { qrCode: "x", segredo: "y", nome: "Outro" };
    expect(await fluxos.concluirCadastro({ fator: "f0000000-0000-4000-8000-000000000000", codigo: "123456" }, pendente, deps)).toEqual({ status: "erro", mensagem: M.falhaInterna });
  });

  it("o segundo autenticador não é 'primeiro' e o cadastro de um novo apaga o pendente anterior", async () => {
    expect((await cadastrarAutenticador("Celular")).primeiro).toBe(true);
    await fluxos.iniciarCadastro({ nome: "Abandonado" }, deps);
    const segundo = await cadastrarAutenticador("Notebook");
    expect(segundo.primeiro).toBe(false);
    expect((await falsa.adaptador.fatores()).map((f) => [f.nome, f.verificado])).toEqual([
      ["Celular", true],
      ["Notebook", true],
    ]);
  });
});

describe("login seguinte e remoção", () => {
  it("o código de qualquer autenticador ativo, escolhido na tela, sobe a sessão para aal2", async () => {
    const celular = await cadastrarAutenticador("Celular");
    const notebook = await cadastrarAutenticador("Notebook");
    await falsa.adaptador.sair("local");
    await falsa.adaptador.entrar(EMAIL, SENHA);
    expect((await falsa.adaptador.sessaoAtual())?.nivel).toBe("aal1");
    expect(await fluxos.verificarCodigo({ fator: notebook.id, codigo: falsa.codigoDe(celular.id) === falsa.codigoDe(notebook.id) ? "000000" : falsa.codigoDe(celular.id) }, deps)).toMatchObject({
      status: "erro",
      erros: { codigo: M.codigoInvalido },
    });
    expect(await fluxos.verificarCodigo({ fator: notebook.id, codigo: falsa.codigoDe(notebook.id) }, deps)).toEqual({ status: "verificado" });
    expect((await falsa.adaptador.sessaoAtual())?.nivel).toBe("aal2");
  });

  it("nunca remove o último; com dois, remove e registra", async () => {
    const celular = await cadastrarAutenticador("Celular");
    expect(await fluxos.removerAutenticador(celular.id, deps)).toEqual({ status: "erro", mensagem: M.ultimoAutenticador });
    await cadastrarAutenticador("Notebook");
    expect(await fluxos.removerAutenticador(celular.id, deps)).toEqual({ status: "removido", mensagem: M.autenticadorRemovido });
    expect((await falsa.adaptador.fatores()).map((f) => f.nome)).toEqual(["Notebook"]);
    expect((await eventos(adminId)).map((e) => e.evento)).toEqual(["SEGUNDO_FATOR_CADASTRADO", "SEGUNDO_FATOR_CADASTRADO", "SEGUNDO_FATOR_REMOVIDO"]);
  });
});

describe("CA-20 — nova senha com 2º fator (OPEN-017)", () => {
  const acessoDeps = (): DependenciasDeAcesso => ({ auth: falsa.adaptador, usuarioBloqueado: async () => false, avisarContaExistente: async () => undefined, origem: "http://localhost:3000" });
  const novaSenha = (extra: Record<string, string> = {}) => ({ senha: "senha-nova-22", confirmacao: "senha-nova-22", ...extra });

  it("pelo link de recuperação: sem o código, pede; com o código, troca, encerra todas as sessões e manda entrar de novo", async () => {
    const celular = await cadastrarAutenticador("Celular");
    await falsa.adaptador.sair("local");
    falsa.abrirSessaoDeRecuperacao(EMAIL);

    expect(await servicos.definirNovaSenha(novaSenha(), acessoDeps())).toEqual({ status: "erro", erros: { codigo: M.codigoFormato } });
    expect(await servicos.definirNovaSenha(novaSenha({ codigo: "000000" === falsa.codigoDe(celular.id) ? "111111" : "000000" }), acessoDeps())).toEqual({
      status: "erro",
      erros: { codigo: M.codigoInvalido },
    });
    const antes = falsa.registro.outrasSessoesEncerradas;
    expect(await servicos.definirNovaSenha(novaSenha({ codigo: falsa.codigoDe(celular.id) }), acessoDeps())).toEqual({ status: "autenticado", destino: ROTA_SENHA_ALTERADA });
    expect(falsa.registro.outrasSessoesEncerradas).toBe(antes + 1);
    expect(falsa.registro.sessao).toBeNull();
    expect(await falsa.adaptador.entrar(EMAIL, "senha-nova-22")).toMatchObject({ ok: true });
  });

  it("conta sem 2º fator: o fluxo de sempre, sem código, e continua na sessão", async () => {
    const comum = "dona@exemplo.com";
    await contaDe(comum, false);
    falsa.abrirSessaoDeRecuperacao(comum);
    expect(await servicos.definirNovaSenha(novaSenha(), acessoDeps())).toEqual({ status: "autenticado", destino: "/painel" });
    expect(falsa.registro.sessao).not.toBeNull();
  });
});

describe("T12 — redefinição do 2º fator pelo workflow (CA-05)", () => {
  function apiFalsa(fatores: string[], falhar = false) {
    const apagados: string[] = [];
    const api: ApiDeAdministracao = {
      listarFatores: async () => (falhar ? null : [...fatores]),
      apagarFator: async (_u, id) => {
        apagados.push(id);
        return true;
      },
    };
    return { api, apagados };
  }

  it("apaga os autenticadores, invalida as sessões abertas antes e registra quem redefiniu", async () => {
    await cadastrarAutenticador("Celular");
    const sessao = await falsa.adaptador.sessaoAtual();
    const { api, apagados } = apiFalsa(["f1", "f2"]);
    const agora = new Date(Date.now() + 1_000);
    expect(await redefinirSegundoFator(EMAIL, "maria (GitHub Actions)", agora, { consultas: suporte, api })).toEqual({ ok: true, removidos: 2 });
    expect(apagados).toEqual(["f1", "f2"]);

    const conta = await acesso.estadoDaConta(adminId);
    expect(conta?.segundoFatorRedefinidoEm).toEqual(agora);
    const [evento] = (await eventos(adminId)).filter((e) => e.evento === "SEGUNDO_FATOR_REDEFINIDO");
    expect(evento.descricao).toBe("2º fator redefinido por maria (GitHub Actions) (workflow): 2 autenticador(es) removido(s)");

    // A sessão aberta antes da redefinição deixa de valer (INV-001).
    const contexto = await resolverContextoDaRequisicao(
      { usuarioId: adminId, negocioDoCookie: undefined, suporteDoCookie: undefined, autenticadoEm: sessao!.autenticadoEm, nivelDaSessao: "aal2", codigoEm: sessao!.codigoEm, agora: new Date(agora.getTime() + 60_000), versaoDosTermos: VERSAO_TERMOS },
      { filiacao: async () => null, conta: (u) => acesso.estadoDaConta(u), liberacao: async () => null },
    );
    expect(contexto?.sessaoExpirada).toBe(true);
  });

  it("conta inexistente, conta comum ou falha no Supabase: nada é gravado", async () => {
    const { api, apagados } = apiFalsa(["f1"]);
    expect(await redefinirSegundoFator("ninguem@exemplo.com", "x", new Date(), { consultas: suporte, api })).toEqual({ ok: false, erro: "ContaInexistente" });
    await contaDe("dona@exemplo.com", false);
    expect(await redefinirSegundoFator("dona@exemplo.com", "x", new Date(), { consultas: suporte, api })).toEqual({ ok: false, erro: "NaoEAdministrador" });
    expect(apagados).toEqual([]);
    expect(await redefinirSegundoFator(EMAIL, "x", new Date(), { consultas: suporte, api: apiFalsa([], true).api })).toEqual({ ok: false, erro: "FalhaNoSupabase" });
    expect((await acesso.estadoDaConta(adminId))?.segundoFatorRedefinidoEm).toBeNull();
    expect(await eventos(adminId)).toEqual([]);
  });
});

describe("INV-011 — os eventos novos são só de inclusão (RN32)", () => {
  it("o gatilho recusa alterar ou apagar um evento do 2º fator", async () => {
    await cadastrarAutenticador("Celular");
    const [evento] = await eventos(adminId);
    await expect(base.registroSuporte.update({ where: { id: evento.id }, data: { descricao: "alterado" } })).rejects.toThrow();
    await expect(base.registroSuporte.delete({ where: { id: evento.id } })).rejects.toThrow();
  });
});
