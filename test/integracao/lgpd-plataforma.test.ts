import { randomUUID } from "node:crypto";
import { strFromU8, unzipSync } from "fflate";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDaLgpd } from "@/lib/db/lgpd";
import { criarConsultasDaPlataforma } from "@/lib/db/plataforma";
import { criarConsultasDeSuporte } from "@/lib/db/suporte";
import { hoje as hojeLocal } from "@/lib/dominio/datas";
import { excluirConta, exportar, type DependenciasDaLgpd } from "@/lib/lgpd/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-019, etapa 4b — T11 (5.11; INV-011, RNF04): a exportação LGPD traz o registro do suporte com os dados de
// cada evento novo e os pedidos da plataforma dos negócios em que o titular é Dono; os eventos novos são só de
// inclusão; a exclusão da conta de um Administrador retira o papel e os autenticadores.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const lgpd = criarConsultasDaLgpd(base);
const plataforma = criarConsultasDaPlataforma(base);
const suporte = criarConsultasDeSuporte(base);
const HOJE = hojeLocal();

let dono: string;
let colaboradora: string;
let adminA: string;
let adminB: string;
let negocio: string;

async function usuario(nome: string, email: string) {
  return (await base.usuario.create({ data: { id: randomUUID(), nome, email, consentimentoLgpdEm: new Date(), versaoTermosAceita: "2026-11-07" } })).id;
}

const deps = (usuarioId: string, extra: Partial<DependenciasDaLgpd> = {}): DependenciasDaLgpd => ({
  lgpd,
  usuarioId,
  agora: new Date(),
  hoje: HOJE,
  removerCredencial: async () => "removida",
  removerAutenticadores: async () => ({ status: "removidos", quantos: 2 }),
  sair: async () => undefined,
  ...extra,
});

async function exportado(usuarioId: string) {
  const zip = unzipSync((await exportar(deps(usuarioId)))!.corpo);
  return { zip, dados: JSON.parse(strFromU8(zip["dados.json"])) };
}

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  dono = await usuario("Rafael Dono", "rafael.dono@exemplo.com");
  colaboradora = await usuario("Joana Colaboradora", "joana@exemplo.com");
  adminA = await usuario("Ana Suporte", "ana.suporte@exemplo.com");
  adminB = await usuario("Bruno Suporte", "bruno.suporte@exemplo.com");
  for (const email of ["ana.suporte@exemplo.com", "bruno.suporte@exemplo.com"]) expect((await suporte.concederPapel(email, "Equipe", new Date())).ok).toBe(true);
  negocio = (await base.negocio.create({ data: { nome: "Papelaria" } })).id;
  await base.membroNegocio.createMany({
    data: [
      { usuarioId: dono, negocioId: negocio, papel: "DONO" },
      { usuarioId: colaboradora, negocioId: negocio, papel: "COLABORADOR" },
    ],
  });

  // Troca de plano pedida por A e aprovada por B; emergência pedida por A; suspensão e reativação.
  const plano = await plataforma.pedirTrocaDePlano(negocio, adminA, { para: "PAGO", motivo: "CORTESIA", descricao: "Teste combinado com o Dono" }, new Date());
  if (!plano.ok) throw new Error(plano.erro);
  expect(await plataforma.decidir(plano.id, adminB, { aprovar: true }, new Date())).toMatchObject({ ok: true, situacao: "APROVADO" });
  expect(
    await plataforma.pedirEmergencia(negocio, adminA, { motivo: "INCIDENTE", referencia: "INC-7", justificativa: "Ver o caixa", modulos: ["financeiro"], prazo: "1h" }, new Date()),
  ).toMatchObject({ ok: true });
  expect((await plataforma.suspender(negocio, adminA, { motivo: "USO_INDEVIDO", descricao: "Cadastro de terceiros sem base legal" }, new Date())).ok).toBe(true);
  expect((await plataforma.reativar(negocio, adminB, "Dados removidos pelo Dono", new Date())).ok).toBe(true);
});

afterAll(async () => {
  await base.$disconnect();
});

describe("T11 — exportação com os eventos novos e os pedidos (RNF04)", () => {
  it("o Dono leva o registro do suporte com os dados de cada evento e os pedidos da plataforma", async () => {
    const { zip, dados } = await exportado(dono);
    const tabelas = dados.negociosComoDono[0].tabelas;

    const eventos = tabelas.registrosSuporte.map((r: { evento: string }) => r.evento).sort();
    expect(eventos).toEqual(["EMERGENCIA_SOLICITADA", "PLANO_APROVADO", "PLANO_SOLICITADO", "REATIVACAO", "SUSPENSAO"]);
    const suspensao = tabelas.registrosSuporte.find((r: { evento: string }) => r.evento === "SUSPENSAO");
    expect(JSON.parse(suspensao.dados)).toEqual({ motivo: "USO_INDEVIDO", descricao: "Cadastro de terceiros sem base legal" });
    expect(suspensao.autor).toBe("Ana Suporte");
    const aprovado = tabelas.registrosSuporte.find((r: { evento: string }) => r.evento === "PLANO_APROVADO");
    expect(aprovado.pedidoId).toEqual(expect.any(String));

    expect(tabelas.pedidosPlataforma.map((p: { tipo: string; situacao: string; solicitadoPor: string; decididoPor: string | null }) => [p.tipo, p.situacao, p.solicitadoPor, p.decididoPor]).sort()).toEqual([
      ["EMERGENCIA", "PENDENTE", "Ana Suporte", null],
      ["PLANO", "APROVADO", "Ana Suporte", "Bruno Suporte"],
    ]);
    expect(JSON.parse(tabelas.pedidosPlataforma.find((p: { tipo: string }) => p.tipo === "PLANO").dados)).toMatchObject({ para: "PAGO", motivo: "CORTESIA" });
    expect(tabelas.historicoPlano).toHaveLength(1);

    expect(Object.keys(zip)).toEqual(expect.arrayContaining(["registros-suporte.csv", "pedidos-plataforma.csv"]));
    expect(strFromU8(zip["pedidos-plataforma.csv"])).toContain("Papelaria");
    expect(strFromU8(zip["LEIA-ME.txt"])).toContain("pedidos-plataforma.csv");
    // O Dono não leva os eventos de conta de ninguém.
    expect(dados.eventosDaConta).toEqual([]);
    expect(zip["eventos-da-conta.csv"]).toBeUndefined();
  });

  it("a colaboradora não leva o registro do suporte nem os pedidos (só o que ela registrou)", async () => {
    const { dados } = await exportado(colaboradora);
    expect(dados.negociosComoDono).toEqual([]);
    expect(JSON.stringify(dados)).not.toContain("PLANO_SOLICITADO");
    expect(JSON.stringify(dados)).not.toContain("Cadastro de terceiros");
  });

  it("a conta de Administrador leva os eventos dela fora de negócio, e nada dos negócios em que agiu", async () => {
    const { zip, dados } = await exportado(adminA);
    expect(dados.eventosDaConta.map((e: { evento: string }) => e.evento)).toEqual(["PAPEL_CONCEDIDO"]);
    expect(strFromU8(zip["eventos-da-conta.csv"])).toContain("PAPEL_CONCEDIDO");
    expect(JSON.stringify(dados)).not.toContain("Papelaria");
  });

  it("INV-011: os eventos novos são só de inclusão", async () => {
    for (const evento of ["SUSPENSAO", "REATIVACAO", "PLANO_APROVADO", "EMERGENCIA_SOLICITADA"]) {
      await expect(base.$executeRawUnsafe(`UPDATE "RegistroSuporte" SET descricao = 'outra' WHERE evento::text = '${evento}'`)).rejects.toThrow(/he_somente_insercao/);
      await expect(base.$executeRawUnsafe(`DELETE FROM "RegistroSuporte" WHERE evento::text = '${evento}'`)).rejects.toThrow(/he_somente_insercao/);
    }
  });
});

describe("5.11 — exclusão da conta de Administrador", () => {
  it("retira o papel na transação e os autenticadores logo depois, com os dois no registro", async () => {
    expect(await excluirConta({ email: "ana.suporte@exemplo.com", ciencia: "on" }, deps(adminA))).toEqual({ status: "excluida", credencial: "removida" });
    expect(await base.usuario.findUniqueOrThrow({ where: { id: adminA } })).toMatchObject({ administradorEm: null });
    const eventos = await base.registroSuporte.findMany({ where: { usuarioId: adminA, negocioId: null }, orderBy: { criadoEm: "asc" }, select: { evento: true, descricao: true } });
    expect(eventos.map((e) => e.evento)).toEqual(["PAPEL_CONCEDIDO", "PAPEL_RETIRADO", "SEGUNDO_FATOR_REMOVIDO"]);
    expect(eventos.at(-1)?.descricao).toBe("2 autenticadores removidos pela exclusão da conta");
    // A lista de Administradores do painel não mostra mais a conta; o histórico dela continua no registro do negócio.
    expect((await plataforma.administradores()).map((a) => a.nome)).toEqual(["Bruno Suporte"]);
    expect(await base.registroSuporte.count({ where: { usuarioId: adminA, negocioId: negocio } })).toBeGreaterThan(0);
  });

  it("sem a chave, o papel sai do mesmo jeito e nada é registrado sobre os autenticadores (a credencial os leva depois)", async () => {
    const d = deps(adminB, { removerAutenticadores: async () => ({ status: "sem-chave" }), removerCredencial: async () => "sem-chave" });
    expect(await excluirConta({ email: "bruno.suporte@exemplo.com", ciencia: "on" }, d)).toEqual({ status: "excluida", credencial: "sem-chave" });
    expect(await base.usuario.findUniqueOrThrow({ where: { id: adminB } })).toMatchObject({ administradorEm: null, credencialRemovidaEm: null });
    expect(await base.registroSuporte.count({ where: { usuarioId: adminB, evento: "SEGUNDO_FATOR_REMOVIDO" } })).toBe(0);
    expect(await lgpd.credenciaisPendentes()).toContain(adminB);
  });

  it("conta comum: a API dos autenticadores não é chamada", async () => {
    let chamada = false;
    const d = deps(colaboradora, { removerAutenticadores: async () => ((chamada = true), { status: "removidos", quantos: 0 }) });
    expect(await excluirConta({ email: "joana@exemplo.com", ciencia: "on" }, d)).toMatchObject({ status: "excluida" });
    expect(chamada).toBe(false);
  });
});
