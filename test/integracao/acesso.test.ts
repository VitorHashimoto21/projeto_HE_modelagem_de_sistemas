import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { resolverContexto } from "@/lib/auth/contexto";
import * as servicos from "@/lib/auth/servicos";
import { MENSAGENS_DE_RESPOSTA as M, type DependenciasDeAcesso } from "@/lib/auth/servicos";
import { MENSAGENS, VERSAO_TERMOS } from "@/lib/auth/validacao";
import { criarConsultasDeAcesso } from "@/lib/db/acesso";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarAutenticacaoFalsa } from "../apoio/autenticacao-falsa";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-002 — testes de integração (seção 12) com o gatilho real no PostgreSQL local
// e um dublê do Supabase Auth (nunca os projetos de homologação ou produção).

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const consultas = criarConsultasDeAcesso(base);

let falsa: ReturnType<typeof criarAutenticacaoFalsa>;
let deps: DependenciasDeAcesso;
let avisos: string[];

const cadastro = (email: string, extra: Record<string, string> = {}) => ({
  nome: "Ana Souza",
  email,
  senha: "senha-forte-1",
  confirmacao: "senha-forte-1",
  aceite: "on",
  ...extra,
});

async function limparBanco() {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await base.$executeRawUnsafe("DELETE FROM auth.users");
}

beforeEach(async () => {
  await limparBanco();
  falsa = criarAutenticacaoFalsa(base);
  avisos = [];
  deps = {
    auth: falsa.adaptador,
    usuarioBloqueado: (id) => consultas.usuarioBloqueado(id),
    avisarContaExistente: async (email) => {
      avisos.push(email);
    },
    origem: "http://localhost:3000",
  };
});

afterAll(async () => {
  await base.$disconnect();
});

const contarAuth = async () => Number((await base.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM auth.users`)[0].n);

describe("cadastro", () => {
  it("T02 — cria a conta e o Usuario com o mesmo id, consentimento e versão dos termos (CA-01, INV-002, INV-003)", async () => {
    const antes = Date.now();
    const r = await servicos.cadastrar(cadastro("Ana@Exemplo.com"), deps);
    expect(r).toEqual({ status: "enviado", mensagem: M.cadastroEnviado });

    const [conta] = await base.$queryRaw<{ id: string }[]>`SELECT id::text AS id FROM auth.users`;
    const usuario = await base.usuario.findUniqueOrThrow({ where: { id: conta.id } });
    expect(usuario).toMatchObject({ nome: "Ana Souza", email: "ana@exemplo.com", versaoTermosAceita: VERSAO_TERMOS });
    expect(usuario.consentimentoLgpdEm!.getTime()).toBeGreaterThanOrEqual(antes - 5_000);
    expect(falsa.registro.emails).toEqual([{ tipo: "confirmacao", email: "ana@exemplo.com" }]);
  });

  it("T03 — sem aceite, nada é criado e a mensagem é exibida (CA-02, INV-003)", async () => {
    const r = await servicos.cadastrar(cadastro("ana@exemplo.com", { aceite: "" }), deps);
    expect(r).toMatchObject({ status: "erro", mensagem: MENSAGENS.aceiteObrigatorio, erros: { aceite: MENSAGENS.aceiteObrigatorio } });
    expect(falsa.registro.chamadasDeCadastro).toBe(0);
    expect(await contarAuth()).toBe(0);
    expect(await base.usuario.count()).toBe(0);
  });

  it("T03 — o banco também recusa uma conta criada sem aceite, mesmo fora da aplicação (INV-003)", async () => {
    const meta = JSON.stringify({ nome: "Ana" });
    await expect(
      base.$executeRaw`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (${randomUUID()}::uuid, 'x@exemplo.com', ${meta}::jsonb)`,
    ).rejects.toThrow(/aceite/);
    expect(await contarAuth()).toBe(0);
  });

  it("T04 — falha no gatilho desfaz a criação da conta: nenhuma conta pela metade (INV-002, OPEN-001)", async () => {
    // Um Usuario com o mesmo e-mail faz o INSERT do gatilho falhar (e-mail único).
    await base.usuario.create({ data: { id: randomUUID(), nome: "Outra", email: "ana@exemplo.com" } });
    const r = await servicos.cadastrar(cadastro("ana@exemplo.com"), deps);
    expect(r).toMatchObject({ status: "erro", mensagem: M.falhaInterna });
    expect(await contarAuth()).toBe(0);
    expect(await base.usuario.count()).toBe(1);
  });

  it("T05 — e-mail já cadastrado: mesma resposta, nenhuma segunda conta, aviso ao dono (CA-04, INV-004)", async () => {
    const primeira = await servicos.cadastrar(cadastro("ana@exemplo.com"), deps);
    const segunda = await servicos.cadastrar(cadastro("ana@exemplo.com", { nome: "Impostor" }), deps);
    expect(segunda).toEqual(primeira);
    expect(await contarAuth()).toBe(1);
    expect(await base.usuario.count()).toBe(1);
    expect(avisos).toEqual(["ana@exemplo.com"]);
  });

  it("CA-03 — o servidor recusa os mesmos dados inválidos que a interface", async () => {
    const r = await servicos.cadastrar(cadastro("invalido", { senha: "curta", confirmacao: "outra" }), deps);
    expect(r).toMatchObject({
      status: "erro",
      erros: { email: MENSAGENS.emailInvalido, senha: MENSAGENS.senhaCurta, confirmacao: MENSAGENS.confirmacaoDiferente },
    });
    expect(falsa.registro.chamadasDeCadastro).toBe(0);
  });

  it("e-mail alterado no Supabase Auth é refletido no Usuario", async () => {
    await servicos.cadastrar(cadastro("ana@exemplo.com"), deps);
    await base.$executeRaw`UPDATE auth.users SET email = 'Nova@Exemplo.com'`;
    expect((await base.usuario.findFirstOrThrow()).email).toBe("nova@exemplo.com");
  });
});

describe("login", () => {
  beforeEach(async () => {
    await servicos.cadastrar(cadastro("ana@exemplo.com"), deps);
  });

  it("T06 — antes de confirmar, pede a confirmação; depois, entra (CA-05)", async () => {
    const campos = { email: "ana@exemplo.com", senha: "senha-forte-1" };
    expect(await servicos.entrar(campos, undefined, deps)).toMatchObject({
      status: "erro",
      mensagem: M.emailNaoConfirmado,
      codigo: "EmailNaoConfirmado",
    });
    falsa.confirmar("ana@exemplo.com");
    expect(await servicos.entrar(campos, undefined, deps)).toEqual({ status: "autenticado", destino: "/negocios" });
  });

  it("T07 — senha errada e e-mail inexistente dão a mesma mensagem (CA-06, CA-07)", async () => {
    falsa.confirmar("ana@exemplo.com");
    const senhaErrada = await servicos.entrar({ email: "ana@exemplo.com", senha: "errada" }, undefined, deps);
    const inexistente = await servicos.entrar({ email: "nao@existe.com", senha: "errada" }, undefined, deps);
    expect(senhaErrada).toMatchObject({ status: "erro", mensagem: M.credenciaisInvalidas });
    expect(inexistente).toMatchObject({ status: "erro", mensagem: M.credenciaisInvalidas });
    expect(await servicos.entrar({ email: "ana@exemplo.com", senha: "senha-forte-1" }, "/convites/abc", deps)).toEqual({
      status: "autenticado",
      destino: "/convites/abc",
    });
  });

  it("T09 — destino para outro domínio é ignorado no login (INV-007)", async () => {
    falsa.confirmar("ana@exemplo.com");
    const r = await servicos.entrar({ email: "ana@exemplo.com", senha: "senha-forte-1" }, "https://malicioso.com", deps);
    expect(r).toEqual({ status: "autenticado", destino: "/negocios" });
  });

  it("T14 — conta com excluidoEm não entra, com a mensagem genérica, e a sessão é encerrada (CA-13, INV-008)", async () => {
    falsa.confirmar("ana@exemplo.com");
    await base.usuario.updateMany({ data: { excluidoEm: new Date() } });
    const r = await servicos.entrar({ email: "ana@exemplo.com", senha: "senha-forte-1" }, undefined, deps);
    expect(r).toMatchObject({ status: "erro", mensagem: M.credenciaisInvalidas });
    expect(falsa.registro.sessao).toBeNull();
  });
});

describe("recuperação de senha", () => {
  it("T05 — resposta igual para e-mail cadastrado e não cadastrado (CA-10, INV-004)", async () => {
    await servicos.cadastrar(cadastro("ana@exemplo.com"), deps);
    const existente = await servicos.pedirRecuperacao({ email: "ana@exemplo.com" }, deps);
    const inexistente = await servicos.pedirRecuperacao({ email: "nao@existe.com" }, deps);
    expect(existente).toEqual(inexistente);
    expect(existente).toEqual({ status: "enviado", mensagem: M.recuperacaoEnviada });
    expect(falsa.registro.emails.filter((e) => e.tipo === "recuperacao")).toEqual([{ tipo: "recuperacao", email: "ana@exemplo.com" }]);
  });

  it("T11 — nova senha: a antiga deixa de valer, as outras sessões são encerradas e a nova funciona (CA-10)", async () => {
    await servicos.cadastrar(cadastro("ana@exemplo.com"), deps);
    falsa.confirmar("ana@exemplo.com");
    falsa.abrirSessaoDeRecuperacao("ana@exemplo.com");

    const mesma = await servicos.definirNovaSenha({ senha: "senha-forte-1", confirmacao: "senha-forte-1" }, deps);
    expect(mesma).toMatchObject({ status: "erro", erros: { senha: M.mesmaSenha } });

    const r = await servicos.definirNovaSenha({ senha: "nova-senha-9", confirmacao: "nova-senha-9" }, deps);
    expect(r).toEqual({ status: "autenticado", destino: "/negocios" });
    expect(falsa.registro.outrasSessoesEncerradas).toBe(1);

    await falsa.adaptador.sair("local");
    expect(await servicos.entrar({ email: "ana@exemplo.com", senha: "senha-forte-1" }, undefined, deps)).toMatchObject({
      mensagem: M.credenciaisInvalidas,
    });
    expect((await servicos.entrar({ email: "ana@exemplo.com", senha: "nova-senha-9" }, undefined, deps)).status).toBe("autenticado");
  });

  it("nova senha sem a sessão do link mostra que o link expirou", async () => {
    const r = await servicos.definirNovaSenha({ senha: "nova-senha-9", confirmacao: "nova-senha-9" }, deps);
    expect(r).toEqual({ status: "erro", mensagem: M.linkExpirado });
  });
});

describe("contexto da requisição", () => {
  let usuario: string;
  let meuNegocio: string;
  let outroNegocio: string;

  beforeEach(async () => {
    usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Ana", email: "ana@exemplo.com" } })).id;
    meuNegocio = (await base.negocio.create({ data: { nome: "Meu" } })).id;
    outroNegocio = (await base.negocio.create({ data: { nome: "Outro" } })).id;
    await base.membroNegocio.create({ data: { usuarioId: usuario, negocioId: meuNegocio, papel: "DONO" } });
  });

  const ehMembro = (u: string, n: string) => consultas.ehMembro(u, n);

  it("INV-005 — sem sessão, não há contexto", async () => {
    expect(await resolverContexto(null, meuNegocio, ehMembro)).toBeNull();
  });

  it("T12 — cookie de um negócio do qual não é membro: contexto sem negócio (CA-11, INV-006)", async () => {
    expect(await resolverContexto(usuario, outroNegocio, ehMembro)).toEqual({ usuarioId: usuario, negocioId: null, negocioRecusado: true });
    expect(await resolverContexto(usuario, "nao-e-uuid", ehMembro)).toEqual({ usuarioId: usuario, negocioId: null, negocioRecusado: true });
  });

  it("T13 — trocar para outro negócio do qual é membro mantém a sessão e muda o contexto (CA-12, RNF07)", async () => {
    expect(await resolverContexto(usuario, meuNegocio, ehMembro)).toEqual({ usuarioId: usuario, negocioId: meuNegocio, negocioRecusado: false });
    await base.membroNegocio.create({ data: { usuarioId: usuario, negocioId: outroNegocio } });
    expect(await resolverContexto(usuario, outroNegocio, ehMembro)).toEqual({ usuarioId: usuario, negocioId: outroNegocio, negocioRecusado: false });
  });

  it("sem cookie de negócio, o contexto tem só o usuário", async () => {
    expect(await resolverContexto(usuario, undefined, ehMembro)).toEqual({ usuarioId: usuario, negocioId: null, negocioRecusado: false });
  });
});
