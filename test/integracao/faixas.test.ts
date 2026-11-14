import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { resolverContextoDaRequisicao } from "@/lib/auth/contexto";
import { criarConsultasDeAcesso } from "@/lib/db/acesso";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDePlanos } from "@/lib/db/planos";
import { criarConsultasDaPlataforma } from "@/lib/db/plataforma";
import { criarConsultasDeSuporte } from "@/lib/db/suporte";
import { estadoDasFaixas } from "@/lib/estrutura/faixas";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// Correção da homologação da SPEC-019 (T17): o layout da área do negócio não é recalculado ao navegar, e a
// faixa da emergência só aparecia (e só sumia) para o Dono depois de atualizar a página. A rota /api/faixas
// devolve a assinatura do estado das faixas; o navegador atualiza o layout quando ela muda. Aqui, com o banco
// real, a assinatura muda em cada transição que outra pessoa faz e volta à de antes quando o estado volta.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const acesso = criarConsultasDeAcesso(base);
const suporte = criarConsultasDeSuporte(base);
const plataforma = criarConsultasDaPlataforma(base);
const planos = criarConsultasDePlanos(base);
const VERSAO = "2026-11-07";

let dono: string;
let gerente: string;
let adminA: string;
let adminB: string;
let negocio: string;

async function usuario(nome: string, admin = false) {
  return (
    await base.usuario.create({
      data: { id: randomUUID(), nome, email: `${nome.toLowerCase().replace(/\s+/g, ".")}@exemplo.com`, versaoTermosAceita: VERSAO, consentimentoLgpdEm: new Date(), administradorEm: admin ? new Date() : null },
    })
  ).id;
}

/** Contexto como a aplicação o monta (servidor.ts → obterContexto) e a assinatura como a rota a devolve. */
async function assinatura(usuarioId: string, cookie: { negocio?: string; suporte?: string } = { negocio }) {
  const agora = new Date();
  const contexto = await resolverContextoDaRequisicao(
    {
      usuarioId,
      negocioDoCookie: cookie.negocio,
      suporteDoCookie: cookie.suporte,
      autenticadoEm: new Date(Date.now() - 60_000),
      nivelDaSessao: "aal2",
      codigoEm: new Date(),
      agora,
      versaoDosTermos: VERSAO,
    },
    { filiacao: (u, n) => acesso.filiacao(u, n), conta: (u) => acesso.estadoDaConta(u), liberacao: (id, adm) => suporte.liberacaoDoContexto(id, adm) },
  );
  const estado = await estadoDasFaixas(contexto!, agora, {
    plano: (n) => planos.planoDoNegocio(n),
    liberacao: (n, quando) => suporte.liberacaoAtiva(n, quando),
    emergencia: (n, quando) => suporte.emergenciaAtiva(n, quando),
  });
  return estado;
}

async function emergenciaAprovada() {
  const pedido = await plataforma.pedirEmergencia(
    negocio,
    adminA,
    { motivo: "INCIDENTE", referencia: "INC-1", justificativa: "Ver o caixa", modulos: ["vendas", "financeiro"], prazo: "1h" },
    new Date(),
  );
  if (!pedido.ok) throw new Error(pedido.erro);
  return pedido.id;
}

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  dono = await usuario("Rafael Dono");
  gerente = await usuario("Gabi Gerente");
  adminA = await usuario("Ana Suporte", true);
  adminB = await usuario("Bruno Suporte", true);
  negocio = (await base.negocio.create({ data: { nome: "Papelaria", plano: "PAGO" } })).id;
  await base.membroNegocio.createMany({
    data: [
      { usuarioId: dono, negocioId: negocio, papel: "DONO" },
      { usuarioId: gerente, negocioId: negocio, papel: "GERENTE" },
    ],
  });
});

afterAll(async () => {
  await base.$disconnect();
});

describe("assinatura das faixas (correção da homologação da SPEC-019)", () => {
  it("o mesmo estado dá a mesma assinatura em duas leituras", async () => {
    expect((await assinatura(dono)).assinatura).toBe((await assinatura(dono)).assinatura);
  });

  it("emergência: o pedido não muda nada; a aprovação muda para todos os membros; o encerramento volta à de antes", async () => {
    const [donoAntes, gerenteAntes] = [(await assinatura(dono)).assinatura, (await assinatura(gerente)).assinatura];
    const pedido = await emergenciaAprovada();
    expect((await assinatura(dono)).assinatura).toBe(donoAntes);

    expect(await plataforma.decidir(pedido, adminB, { aprovar: true }, new Date())).toMatchObject({ ok: true });
    const durante = await assinatura(dono);
    expect(durante.emergencia).not.toBeNull();
    expect(durante.assinatura).not.toBe(donoAntes);
    expect((await assinatura(gerente)).assinatura).not.toBe(gerenteAntes);

    expect(await suporte.encerrarEmergencia(negocio, durante.emergencia!.id, dono, new Date(), "DONO")).toBe(true);
    expect((await assinatura(dono)).assinatura).toBe(donoAntes);
    expect((await assinatura(gerente)).assinatura).toBe(gerenteAntes);
  });

  it("suspensão e reativação, troca de plano pela plataforma, liberação e revogação mudam a assinatura", async () => {
    const antes = (await assinatura(dono)).assinatura;

    expect((await plataforma.suspender(negocio, adminA, { motivo: "INCIDENTE_SEGURANCA", descricao: "Acesso não reconhecido" }, new Date())).ok).toBe(true);
    const suspenso = (await assinatura(dono)).assinatura;
    expect(suspenso).not.toBe(antes);
    expect((await plataforma.reativar(negocio, adminB, "Senhas trocadas", new Date())).ok).toBe(true);
    expect((await assinatura(dono)).assinatura).toBe(antes);

    const plano = await plataforma.pedirTrocaDePlano(negocio, adminA, { para: "GRATUITO", motivo: "TESTE", descricao: "Teste combinado" }, new Date());
    if (!plano.ok) throw new Error(plano.erro);
    expect((await assinatura(dono)).assinatura).toBe(antes);
    expect(await plataforma.decidir(plano.id, adminB, { aprovar: true }, new Date())).toMatchObject({ ok: true, situacao: "APROVADO" });
    const gratuito = await assinatura(dono);
    expect(gratuito.plano).toBe("GRATUITO");
    expect(gratuito.assinatura).not.toBe(antes);

    const gerenteAntes = (await assinatura(gerente)).assinatura;
    const liberacao = await suporte.liberar(negocio, dono, { motivo: "Ajuda", modulos: ["catalogo"], modulosComCorrecao: [], prazo: "1h" }, new Date());
    const liberado = await assinatura(gerente);
    expect(liberado.liberacao).not.toBeNull();
    expect(liberado.assinatura).not.toBe(gerenteAntes);
    expect(await suporte.revogar(negocio, liberacao!.id, dono, new Date())).toBe(true);
    expect((await assinatura(gerente)).assinatura).toBe(gerenteAntes);
  });

  it("a leitura não registra nada, nem no modo suporte", async () => {
    const liberacao = await suporte.liberar(negocio, dono, { motivo: "Ajuda", modulos: ["catalogo"], modulosComCorrecao: [], prazo: "1h" }, new Date());
    expect(await suporte.entrar(liberacao!.id, adminA, new Date(), true)).toMatchObject({ ok: true });
    const eventos = await base.registroSuporte.count();
    const comoSuporte = await assinatura(adminA, { suporte: liberacao!.id });
    expect(comoSuporte.liberacao).toBeNull();
    expect(comoSuporte.assinatura).toEqual(expect.any(String));
    await assinatura(dono);
    expect(await base.registroSuporte.count()).toBe(eventos);
  });
});
