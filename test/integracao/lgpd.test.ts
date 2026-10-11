import { randomUUID } from "node:crypto";
import { strFromU8, unzipSync } from "fflate";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { criarConsultasDeAcesso } from "@/lib/db/acesso";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDaLgpd } from "@/lib/db/lgpd";
import { hoje as hojeLocal } from "@/lib/dominio/datas";
import { CLIENTE_ANONIMO, dataDeEliminacao, NOME_ANONIMO } from "@/lib/dominio/lgpd";
import { excluirConta, exportar, removerCredenciaisPendentes, type DependenciasDaLgpd } from "@/lib/lgpd/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-014 — testes de integração (seção 12): banco real, exportação e exclusão (RN27).

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const lgpd = criarConsultasDaLgpd(base);
const acesso = criarConsultasDeAcesso(base);
const HOJE = hojeLocal();
const NOME = "Gisele Original Souza";
const EMAIL = "gisele.original@exemplo.com";

let gisele: string;
let rafa: string;
let bruno: string;
let studio: string; // Gisele é a Dona
let clinica: string; // Bruno é o Dono; Gisele é colaboradora
let numero = 1;

async function usuario(nome: string, email: string) {
  return (await base.usuario.create({ data: { id: randomUUID(), nome, email, consentimentoLgpdEm: new Date(), versaoTermosAceita: "2026-10-03" } })).id;
}
async function venda(negocioId: string, registradaPorId: string, valor: number, clienteId?: string) {
  const item = await base.item.create({ data: { negocioId, tipo: "SERVICO", nome: `Serviço ${randomUUID()}`, nomeChave: randomUUID(), categoria: "BELEZA", unidadeMedida: "un", custoBase: 1 } });
  const v = await base.venda.create({ data: { negocioId, valorTotal: valor, numero: numero++, registradaPorId, clienteId } });
  await base.itemVenda.create({ data: { negocioId, vendaId: v.id, itemId: item.id, quantidade: 1, precoUnitario: valor, custoUnitario: 1 } });
  await base.pagamento.create({ data: { negocioId, vendaId: v.id, forma: "PIX", valor } });
  await base.lancamentoFinanceiro.create({ data: { negocioId, origem: "VENDA", tipo: "ENTRADA", categoria: "VENDAS", valor, vendaId: v.id, usuarioId: registradaPorId } });
  return v.id;
}
const deps = (usuarioId = gisele, extra: Partial<DependenciasDaLgpd> = {}): DependenciasDaLgpd => ({
  lgpd,
  usuarioId,
  agora: new Date(),
  hoje: HOJE,
  removerCredencial: async () => "removida",
  sair: async () => undefined,
  ...extra,
});
const confirmar = { email: EMAIL, ciencia: "on" };

async function fiscais(negocioId: string) {
  const [vendas, itens, pagamentos, lancamentos, contas, movs] = await Promise.all([
    base.venda.aggregate({ where: { negocioId }, _count: { _all: true }, _sum: { valorTotal: true } }),
    base.itemVenda.count({ where: { negocioId } }),
    base.pagamento.count({ where: { negocioId } }),
    base.lancamentoFinanceiro.aggregate({ where: { negocioId }, _count: { _all: true }, _sum: { valor: true } }),
    base.contaPagarReceber.count({ where: { negocioId } }),
    base.movimentacaoEstoque.count({ where: { negocioId } }),
  ]);
  return JSON.stringify({ vendas, itens, pagamentos, lancamentos, contas, movs });
}

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await base.$executeRawUnsafe(`DELETE FROM auth.users`);
  gisele = await usuario(NOME, EMAIL);
  rafa = await usuario("Rafa", "rafa@exemplo.com");
  bruno = await usuario("Bruno", "bruno@exemplo.com");
  studio = (await base.negocio.create({ data: { nome: "Studio Gisele" } })).id;
  clinica = (await base.negocio.create({ data: { nome: "Clínica do Bruno" } })).id;
  await base.membroNegocio.createMany({
    data: [
      { usuarioId: gisele, negocioId: studio, papel: "DONO" },
      { usuarioId: rafa, negocioId: studio, papel: "COLABORADOR" },
      { usuarioId: bruno, negocioId: clinica, papel: "DONO" },
      { usuarioId: gisele, negocioId: clinica, papel: "COLABORADOR" },
    ],
  });
  numero = 1;
});

afterAll(async () => {
  await base.$disconnect();
});

describe("exportação", () => {
  it("T03 — CA-01/CA-02/CA-10: Dono leva tudo do negócio; de outros negócios, só o que registrou; nada de outro titular (INV-004, INV-006)", async () => {
    const ana = await base.cliente.create({ data: { negocioId: studio, nome: "Ana Cliente", contato: "11 99999-0000" } });
    await venda(studio, gisele, 36, ana.id);
    await venda(studio, rafa, 50);
    await venda(clinica, gisele, 80);
    await venda(clinica, bruno, 999);

    const r = await exportar(deps());
    expect(r!.nome).toBe(`he-meus-dados-${HOJE}.zip`);
    const zip = unzipSync(r!.corpo);
    expect(Object.keys(zip)).toEqual(expect.arrayContaining(["LEIA-ME.txt", "dados.json", "usuario.csv", "vinculos.csv", "vendas.csv", "clientes.csv", "outros-negocios-vendas-registradas.csv"]));
    const d = JSON.parse(strFromU8(zip["dados.json"]));
    expect(d.titular).toMatchObject({ nome: NOME, email: EMAIL, versaoTermosAceita: "2026-10-03" });
    expect(d.negociosComoDono).toHaveLength(1);
    expect(d.negociosComoDono[0].tabelas.vendas.map((v: { valorTotal: string }) => v.valorTotal).sort()).toEqual(["36", "50"]);
    expect(d.negociosComoDono[0].tabelas.clientes[0]).toMatchObject({ nome: "Ana Cliente", contato: "11 99999-0000" });
    expect(d.registrosEmOutrosNegocios[0].tabelas.vendasRegistradas.map((v: { valorTotal: string }) => v.valorTotal)).toEqual(["80"]);
    expect(strFromU8(zip["dados.json"])).not.toContain('"valorTotal": "999"'); // venda do Bruno fica fora

    const doBruno = JSON.parse(strFromU8(unzipSync((await exportar(deps(bruno)))!.corpo)["dados.json"]));
    expect(doBruno.negociosComoDono.map((g: { negocio: { nome: string } }) => g.negocio.nome)).toEqual(["Clínica do Bruno"]);
    expect(JSON.stringify(doBruno)).not.toContain("Ana Cliente");
  });
});

describe("exclusão", () => {
  it("T04/T05 — CA-03/CA-04: Dona excluída — negócio encerrado, clientes e convites anonimizados, equipe sem acesso, registros intactos (INV-002, INV-005)", async () => {
    const ana = await base.cliente.create({ data: { negocioId: studio, nome: "Ana Cliente", contato: "11 99999-0000" } });
    await venda(studio, gisele, 36, ana.id);
    await venda(studio, rafa, 50);
    const vendaNaClinica = await venda(clinica, gisele, 80);
    const pendenteStudio = await base.convite.create({ data: { negocioId: studio, email: "novo@exemplo.com", tokenHash: randomUUID(), expiraEm: new Date(Date.now() + 86_400_000), convidadoPorId: gisele } });
    const paraGisele = await base.convite.create({ data: { negocioId: clinica, email: EMAIL, tokenHash: randomUUID(), expiraEm: new Date(Date.now() + 86_400_000), convidadoPorId: bruno } });
    const antes = await fiscais(studio);

    expect(await lgpd.resumoDaExclusao(gisele)).toEqual({
      email: EMAIL,
      encerrar: [{ id: studio, nome: "Studio Gisele", membrosAfetados: 1 }],
      deixar: [{ id: clinica, nome: "Clínica do Bruno", papel: "COLABORADOR" }],
    });
    expect(await excluirConta(confirmar, deps())).toEqual({ status: "excluida", credencial: "removida" });

    const u = await base.usuario.findUniqueOrThrow({ where: { id: gisele } });
    expect(u).toMatchObject({ nome: NOME_ANONIMO, email: `excluido-${gisele}@anonimo.invalid` });
    expect(u.excluidoEm).not.toBeNull();
    expect(u.credencialRemovidaEm).not.toBeNull();
    const n = await base.negocio.findUniqueOrThrow({ where: { id: studio } });
    expect(n.encerradoEm).not.toBeNull();
    expect(n.eliminarApos!.toISOString().slice(0, 10)).toBe(dataDeEliminacao(HOJE));
    expect(await base.cliente.findUniqueOrThrow({ where: { id: ana.id } })).toMatchObject({ nome: CLIENTE_ANONIMO, contato: null });
    expect(await base.convite.findUniqueOrThrow({ where: { id: pendenteStudio.id } })).toMatchObject({ status: "CANCELADO", email: `convite-${pendenteStudio.id}@anonimo.invalid` });
    expect(await base.convite.findUniqueOrThrow({ where: { id: paraGisele.id } })).toMatchObject({ status: "CANCELADO", email: `convite-${paraGisele.id}@anonimo.invalid` });
    expect(await fiscais(studio)).toBe(antes);
    expect(await acesso.filiacao(rafa, studio)).toBeNull(); // negócio encerrado
    expect(await base.membroNegocio.count({ where: { usuarioId: gisele, negocioId: clinica } })).toBe(0);
    expect((await base.venda.findUniqueOrThrow({ where: { id: vendaNaClinica } })).registradaPorId).toBe(gisele); // continua, anonimizada
    expect((await base.negocio.findUniqueOrThrow({ where: { id: clinica } })).encerradoEm).toBeNull();
  });

  it("T06 — CA-05: o nome e o e-mail originais não aparecem em nenhuma coluna de texto do banco (INV-001)", async () => {
    await base.cliente.create({ data: { negocioId: studio, nome: "Ana Cliente", contato: EMAIL } });
    await base.convite.create({ data: { negocioId: clinica, email: EMAIL, tokenHash: randomUUID(), expiraEm: new Date(Date.now() - 86_400_000), convidadoPorId: bruno, status: "EXPIRADO" } });
    await excluirConta(confirmar, deps());
    const colunas = await base.$queryRaw<{ tabela: string; coluna: string }[]>`
      SELECT table_name AS tabela, column_name AS coluna FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type IN ('text', 'character varying') AND table_name <> '_prisma_migrations'`;
    for (const { tabela, coluna } of colunas) {
      const [r] = await base.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${tabela}" WHERE "${coluna}" ILIKE $1 OR "${coluna}" ILIKE $2`, `%${EMAIL}%`, `%${NOME}%`);
      expect(Number(r.n), `${tabela}.${coluna}`).toBe(0);
    }
  });

  it("T07 — CA-06: confirmação errada não muda nada; pedidos simultâneos → um; falha no meio desfaz tudo (INV-003)", async () => {
    expect(await excluirConta({ email: "outro@exemplo.com", ciencia: "on" }, deps())).toMatchObject({ status: "erro" });
    expect((await base.usuario.findUniqueOrThrow({ where: { id: gisele } })).excluidoEm).toBeNull();

    await base.cliente.create({ data: { negocioId: studio, nome: "Ana Cliente" } });
    await base.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION he_teste_falha() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha simulada'; END; $$`);
    await base.$executeRawUnsafe(`CREATE TRIGGER he_teste_falha BEFORE UPDATE ON "Cliente" FOR EACH ROW EXECUTE FUNCTION he_teste_falha()`);
    try {
      expect(await excluirConta(confirmar, deps())).toMatchObject({ status: "erro" });
      const u = await base.usuario.findUniqueOrThrow({ where: { id: gisele } });
      expect(u).toMatchObject({ nome: NOME, email: EMAIL, excluidoEm: null });
      expect((await base.negocio.findUniqueOrThrow({ where: { id: studio } })).encerradoEm).toBeNull();
    } finally {
      await base.$executeRawUnsafe(`DROP TRIGGER he_teste_falha ON "Cliente"`);
      await base.$executeRawUnsafe(`DROP FUNCTION he_teste_falha()`);
    }

    const rs = await Promise.all([lgpd.excluirConta(gisele, new Date()), lgpd.excluirConta(gisele, new Date())]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(rs.find((r) => !r.ok)).toEqual({ ok: false, erro: "JaExcluida" });
  });

  it("T08 — CA-07/CA-08: conta bloqueada na requisição seguinte; novo cadastro com o mesmo e-mail nasce vazio", async () => {
    await excluirConta(confirmar, deps());
    expect(await acesso.usuarioBloqueado(gisele)).toBe(true);
    expect(await lgpd.resumoDaExclusao(gisele)).toBeNull();
    expect(await exportar(deps())).toBeNull();
    const novo = randomUUID();
    await base.$executeRawUnsafe(
      `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1::uuid, $2, $3::jsonb)`,
      novo,
      EMAIL,
      JSON.stringify({ nome: "Gisele Nova", aceiteTermos: "true", versaoTermosAceita: "2026-10-03" }),
    );
    expect(await base.usuario.findUniqueOrThrow({ where: { id: novo } })).toMatchObject({ email: EMAIL, excluidoEm: null });
    expect(await base.membroNegocio.count({ where: { usuarioId: novo } })).toBe(0);
  });

  it("T09 — OPEN-001: falha ao remover a credencial deixa pendência; a rotina tenta de novo e marca", async () => {
    expect(await excluirConta(confirmar, deps(gisele, { removerCredencial: async () => "falha" }))).toEqual({ status: "excluida", credencial: "falha" });
    expect(await lgpd.credenciaisPendentes()).toEqual([gisele]);
    expect(await removerCredenciaisPendentes({ lgpd, agora: new Date(), removerCredencial: async () => "sem-chave" })).toEqual({ removidas: 0, pendentes: 1 });
    expect(await removerCredenciaisPendentes({ lgpd, agora: new Date(), removerCredencial: async () => "removida" })).toEqual({ removidas: 1, pendentes: 0 });
    expect(await lgpd.credenciaisPendentes()).toEqual([]);
  });

  it("T10 — CA-09: convites expirados/cancelados há mais de 90 dias anonimizados; recentes, pendentes válidos e aceitos não", async () => {
    const dia = 86_400_000;
    const agora = new Date();
    const criar = (email: string, status: "PENDENTE" | "ACEITO" | "EXPIRADO" | "CANCELADO", expiraEm: Date, respondidoEm: Date | null = null) =>
      base.convite.create({ data: { negocioId: studio, email, tokenHash: randomUUID(), status, expiraEm, respondidoEm, convidadoPorId: gisele } });
    const exp = await criar("a@x.com", "EXPIRADO", new Date(agora.getTime() - 91 * dia));
    const canc = await criar("b@x.com", "CANCELADO", new Date(agora.getTime() - 80 * dia), new Date(agora.getTime() - 91 * dia));
    const pendVencido = await criar("c@x.com", "PENDENTE", new Date(agora.getTime() - 95 * dia));
    const recente = await criar("d@x.com", "CANCELADO", new Date(agora.getTime() + dia), new Date(agora.getTime() - 10 * dia));
    const aceito = await criar("e@x.com", "ACEITO", new Date(agora.getTime() - 200 * dia), new Date(agora.getTime() - 200 * dia));
    expect(await lgpd.anonimizarConvitesAntigos(agora)).toBe(3);
    const email = async (id: string) => (await base.convite.findUniqueOrThrow({ where: { id } })).email;
    expect(await email(exp.id)).toBe(`convite-${exp.id}@anonimo.invalid`);
    expect(await email(canc.id)).toMatch(/@anonimo\.invalid$/);
    expect(await base.convite.findUniqueOrThrow({ where: { id: pendVencido.id } })).toMatchObject({ status: "EXPIRADO" });
    expect(await email(recente.id)).toBe("d@x.com");
    expect(await email(aceito.id)).toBe("e@x.com");
    expect(await lgpd.anonimizarConvitesAntigos(agora)).toBe(0); // idempotente
  });

  it("T11 — RNF06: exportação com 10 mil vendas e exclusão em menos de 5 s", async () => {
    const ids = Array.from({ length: 10_000 }, () => randomUUID());
    await base.venda.createMany({ data: ids.map((id, i) => ({ id, negocioId: studio, valorTotal: 50, numero: 1000 + i, registradaPorId: gisele })) });
    let t0 = performance.now();
    const r = await exportar(deps());
    expect(performance.now() - t0).toBeLessThan(5000);
    expect(JSON.parse(strFromU8(unzipSync(r!.corpo)["dados.json"])).negociosComoDono[0].tabelas.vendas).toHaveLength(10_000);
    t0 = performance.now();
    expect(await excluirConta(confirmar, deps())).toMatchObject({ status: "excluida" });
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});
