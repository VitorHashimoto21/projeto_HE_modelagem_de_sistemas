import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { resolverContexto } from "@/lib/auth/contexto";
import { criarConsultasDeAcesso } from "@/lib/db/acesso";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDeNegocios } from "@/lib/db/negocios";
import { criarConsultasFiscais } from "@/lib/db/parametros-fiscais";
import { CAMINHO_DO_ARQUIVO, validarParametros } from "@/lib/fiscal/arquivo";
import { mapearRespostaBrasilApi, type ConsultaCnpj, type ResultadoDaConsulta } from "@/lib/integracoes/consulta-cnpj";
import * as servicos from "@/lib/negocio/servicos";
import { MENSAGENS_FLUXO as F, type DependenciasDoNegocio } from "@/lib/negocio/servicos";
import { carregarParametros } from "../../scripts/fiscal/carga";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-004 — testes de integração (seção 12): banco real, parâmetros fiscais reais
// (SPEC-003) e consulta de CNPJ simulada (nunca a BrasilAPI de verdade).

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const repo = criarConsultasDeNegocios(base);
const fiscais = criarConsultasFiscais(base);
const acesso = criarConsultasDeAcesso(base);
const respostaReal = JSON.parse(readFileSync("test/apoio/fixtures/brasilapi-cnpj-banco-do-brasil.json", "utf-8"));

const CNPJ_MEI = "11222333000181";
const CNPJ_SIMPLES = "00000000000191";

let usuario: string;
let ativo: string | null;
let resultadoDaConsulta: ResultadoDaConsulta;
let consulta: ConsultaCnpj & { consultar: ReturnType<typeof vi.fn> };

const deps = (usuarioId: string | null = usuario): DependenciasDoNegocio => ({
  usuarioId,
  consulta,
  anexoDoCnae: async (cnae) => {
    const r = await fiscais.anexoDoCnae(cnae);
    return r ? { anexo: r.anexo, sujeitoFatorR: r.sujeitoFatorR } : null;
  },
  negocios: repo,
  definirNegocioAtivo: async (id) => {
    ativo = id;
  },
});

const dadosMei = (cnpj = CNPJ_MEI) => ({
  ...mapearRespostaBrasilApi(cnpj, respostaReal),
  razaoSocial: "GISELE MENDES 12345678901",
  nomeFantasia: "STUDIO GISELE",
  cnae: "9602-5/02",
  optanteMei: true,
  optanteSimples: true,
});

async function novoUsuario(nome: string) {
  return (await base.usuario.create({ data: { id: randomUUID(), nome, email: `${randomUUID()}@exemplo.com` } })).id;
}

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await carregarParametros(base, validarParametros(JSON.parse(readFileSync(CAMINHO_DO_ARQUIVO, "utf-8"))));
  usuario = await novoUsuario("Gisele");
  ativo = null;
  resultadoDaConsulta = { ok: true, dados: dadosMei() };
  consulta = { consultar: vi.fn(async () => resultadoDaConsulta) };
});

afterAll(async () => {
  await base.$disconnect();
});

describe("consulta do CNPJ", () => {
  it("MEI com CNAE na tabela: sugestão completa (CA-01)", async () => {
    const r = await servicos.consultarCnpj({ cnpj: "11.222.333/0001-81" }, deps());
    expect(r).toMatchObject({
      status: "sugerido",
      cnpj: CNPJ_MEI,
      sugestao: { regime: "MEI", atividadeMei: "SERVICOS", nome: "STUDIO GISELE", razaoSocial: "GISELE MENDES", cnaePrincipal: "9602-5/02" },
    });
  });

  it("Simples com CNAE sujeito ao Fator R → Anexo V (CA-02)", async () => {
    resultadoDaConsulta = { ok: true, dados: { ...dadosMei(CNPJ_SIMPLES), optanteMei: false, cnae: "6201-5/01" } };
    const r = await servicos.consultarCnpj({ cnpj: CNPJ_SIMPLES }, deps());
    expect(r).toMatchObject({ status: "sugerido", sugestao: { regime: "SIMPLES_NACIONAL", anexoSimples: "V", sujeitoFatorR: true } });
  });

  it("consulta indisponível ou não encontrada → formulário manual (CA-03)", async () => {
    resultadoDaConsulta = { ok: false, erro: "Indisponivel" };
    expect(await servicos.consultarCnpj({ cnpj: CNPJ_MEI }, deps())).toEqual({ status: "manual", cnpj: CNPJ_MEI, mensagem: F.consultaIndisponivel });
    resultadoDaConsulta = { ok: false, erro: "NaoEncontrado" };
    expect(await servicos.consultarCnpj({ cnpj: CNPJ_MEI }, deps())).toEqual({ status: "manual", cnpj: CNPJ_MEI, mensagem: F.naoEncontrado });
  });

  it("empresa fora do Simples é bloqueada (OPEN-002)", async () => {
    resultadoDaConsulta = { ok: true, dados: mapearRespostaBrasilApi(CNPJ_SIMPLES, respostaReal) };
    expect(await servicos.consultarCnpj({ cnpj: CNPJ_SIMPLES }, deps())).toMatchObject({ status: "bloqueado" });
  });

  it("CNPJ inválido não chega a consultar", async () => {
    expect(await servicos.consultarCnpj({ cnpj: "11.222.333/0001-80" }, deps())).toMatchObject({ status: "erro", erros: { cnpj: "CNPJ inválido" } });
    expect(consulta.consultar).not.toHaveBeenCalled();
  });

  it("T13 — sem sessão, nada é consultado (INV-008)", async () => {
    expect(await servicos.consultarCnpj({ cnpj: CNPJ_MEI }, deps(null))).toEqual({ status: "erro", mensagem: F.semSessao });
    expect(consulta.consultar).not.toHaveBeenCalled();
  });
});

describe("cadastro", () => {
  const camposMei = { nome: "Studio Gisele", regime: "MEI", cnpj: CNPJ_MEI, razaoSocial: "GISELE MENDES", cnaePrincipal: "9602-5/02", atividadeMei: "SERVICOS" };

  it("T05 — cria o negócio com o usuário como Dono e o torna ativo (CA-01, INV-001)", async () => {
    const r = await servicos.cadastrarNegocio(camposMei, deps());
    expect(r.status).toBe("salvo");
    const id = r.status === "salvo" ? r.negocioId : "";
    expect(ativo).toBe(id);
    expect(await base.membroNegocio.findMany({ where: { negocioId: id } })).toMatchObject([{ usuarioId: usuario, papel: "DONO" }]);
    expect(await repo.dadosFiscais(id)).toMatchObject({ regime: "MEI", cnpj: CNPJ_MEI, atividadeMei: "SERVICOS", anexoSimples: null });
  });

  it("T05 — autônomo sem CNPJ (CA-05)", async () => {
    const r = await servicos.cadastrarNegocio({ nome: "Thiago Personal", regime: "AUTONOMO", impostoPercentual: "6,5" }, deps());
    const id = r.status === "salvo" ? r.negocioId : "";
    expect(await repo.dadosFiscais(id)).toMatchObject({ regime: "AUTONOMO", cnpj: null, impostoPercentualManual: 6.5 });
  });

  it("T06 — falha ao criar o Dono desfaz o negócio (CA-09)", async () => {
    // Usuário inexistente: a FK de MembroNegocio falha depois de criar o Negocio.
    const r = await servicos.cadastrarNegocio(camposMei, deps(randomUUID()));
    expect(r).toEqual({ status: "erro", mensagem: F.falhaInterna });
    expect(await base.negocio.count()).toBe(0);
    expect(ativo).toBeNull();
  });

  it("T07 — servidor chamado direto com dados inválidos recusa (CA-06, INV-002)", async () => {
    const r = await servicos.cadastrarNegocio({ ...camposMei, atividadeMei: "", anexoSimples: "III" }, deps());
    expect(r).toMatchObject({ status: "erro", erros: { atividadeMei: expect.any(String), anexoSimples: expect.any(String) } });
    expect(await base.negocio.count()).toBe(0);
  });

  it("CNPJ já cadastrado: mensagem de convite, nada criado (OPEN-001)", async () => {
    await servicos.cadastrarNegocio(camposMei, deps());
    const outro = await novoUsuario("Outra");
    expect(await servicos.consultarCnpj({ cnpj: CNPJ_MEI }, deps(outro))).toMatchObject({ status: "erro", erros: { cnpj: F.cnpjJaCadastrado } });
    expect(await servicos.cadastrarNegocio(camposMei, deps(outro))).toMatchObject({ status: "erro", erros: { cnpj: F.cnpjJaCadastrado } });
    expect(await base.negocio.count()).toBe(1);
  });

  it("T11 — nada de sócios, e-mail, telefone ou CPF no banco (CA-10, INV-004)", async () => {
    const consultaR = await servicos.consultarCnpj({ cnpj: CNPJ_MEI }, deps());
    if (consultaR.status !== "sugerido") throw new Error("esperava sugestão");
    const s = consultaR.sugestao;
    await servicos.cadastrarNegocio(
      { nome: s.nome, regime: s.regime, cnpj: consultaR.cnpj, razaoSocial: s.razaoSocial, cnaePrincipal: s.cnaePrincipal ?? "", atividadeMei: s.atividadeMei ?? "" },
      deps(),
    );
    const linha = JSON.stringify(await base.negocio.findFirst());
    for (const proibido of ["12345678901", String(respostaReal.ddd_telefone_1), respostaReal.qsa[0].nome_socio, String(respostaReal.cep)]) {
      expect(linha).not.toContain(proibido);
    }
  });
});

describe("negócios do usuário e troca do ativo", () => {
  it("T08 — lista os negócios (sem encerrados) e troca o ativo (CA-07, INV-006)", async () => {
    const a = await servicos.cadastrarNegocio({ nome: "B Negócio", regime: "AUTONOMO", impostoPercentual: "5" }, deps());
    const b = await servicos.cadastrarNegocio({ nome: "A Negócio", regime: "AUTONOMO", impostoPercentual: "5" }, deps());
    const idA = a.status === "salvo" ? a.negocioId : "";
    const idB = b.status === "salvo" ? b.negocioId : "";
    expect((await repo.listarDoUsuario(usuario)).map((n) => n.nome)).toEqual(["A Negócio", "B Negócio"]);

    expect(await servicos.trocarNegocio(idA, deps())).toEqual({ ok: true });
    expect(ativo).toBe(idA);

    await base.negocio.update({ where: { id: idB }, data: { encerradoEm: new Date() } });
    expect((await repo.listarDoUsuario(usuario)).map((n) => n.nome)).toEqual(["B Negócio"]);
  });

  it("T09 — troca para negócio alheio ou encerrado é recusada (CA-08)", async () => {
    const dono = await novoUsuario("Outro dono");
    const r = await servicos.cadastrarNegocio({ nome: "Alheio", regime: "AUTONOMO", impostoPercentual: "5" }, deps(dono));
    const alheio = r.status === "salvo" ? r.negocioId : "";
    ativo = null;
    expect(await servicos.trocarNegocio(alheio, deps())).toEqual({ ok: false });
    expect(ativo).toBeNull();

    const meu = await servicos.cadastrarNegocio({ nome: "Meu", regime: "AUTONOMO", impostoPercentual: "5" }, deps());
    const idMeu = meu.status === "salvo" ? meu.negocioId : "";
    await base.negocio.update({ where: { id: idMeu }, data: { encerradoEm: new Date() } });
    expect(await servicos.trocarNegocio(idMeu, deps())).toEqual({ ok: false });
    // O contexto da requisição (SPEC-002) também recusa o negócio encerrado.
    expect(await resolverContexto(usuario, idMeu, (u, n) => acesso.ehMembro(u, n))).toMatchObject({ negocioId: null, negocioRecusado: true });
  });
});

describe("edição dos dados fiscais", () => {
  it("T10 — só o Dono edita; trocar o regime limpa os campos antigos (CA-11, INV-007)", async () => {
    const r = await servicos.cadastrarNegocio(
      { nome: "Studio", regime: "MEI", cnpj: CNPJ_MEI, atividadeMei: "SERVICOS" },
      deps(),
    );
    const id = r.status === "salvo" ? r.negocioId : "";

    const colaborador = await novoUsuario("Colaboradora");
    await base.membroNegocio.create({ data: { usuarioId: colaborador, negocioId: id, papel: "COLABORADOR" } });
    const paraSimples = { nome: "Studio", regime: "SIMPLES_NACIONAL", anexoSimples: "III", cnpj: "99999999999999" };
    expect(await servicos.editarNegocio(id, paraSimples, deps(colaborador))).toEqual({ status: "erro", mensagem: F.somenteDono });

    expect(await servicos.editarNegocio(id, paraSimples, deps())).toMatchObject({ status: "salvo" });
    // O CNPJ enviado é ignorado: não muda depois de cadastrado.
    expect(await repo.dadosFiscais(id)).toMatchObject({ regime: "SIMPLES_NACIONAL", anexoSimples: "III", atividadeMei: null, cnpj: CNPJ_MEI });

    expect(await servicos.editarNegocio(id, { nome: "Studio", regime: "AUTONOMO", impostoPercentual: "5" }, deps())).toMatchObject({
      status: "erro",
      erros: { regime: expect.stringMatching(/não pode ser autônomo/) },
    });
  });

  it("autônomo pode informar o CNPJ ao virar MEI", async () => {
    const r = await servicos.cadastrarNegocio({ nome: "Thiago", regime: "AUTONOMO", impostoPercentual: "5" }, deps());
    const id = r.status === "salvo" ? r.negocioId : "";
    expect(await servicos.editarNegocio(id, { nome: "Thiago", regime: "MEI", cnpj: CNPJ_MEI, atividadeMei: "SERVICOS" }, deps())).toMatchObject({ status: "salvo" });
    expect(await repo.dadosFiscais(id)).toMatchObject({ regime: "MEI", cnpj: CNPJ_MEI, impostoPercentualManual: null });
  });
});
