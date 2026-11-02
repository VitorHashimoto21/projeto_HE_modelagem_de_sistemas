import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { resolverContextoDaRequisicao, type ContextoComPapel } from "@/lib/auth/contexto";
import { criarConsultasDeAcesso } from "@/lib/db/acesso";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasFinanceiras } from "@/lib/db/financeiro";
import { criarConsultasDeSuporte } from "@/lib/db/suporte";
import { hoje as hojeLocal } from "@/lib/dominio/datas";
import { competenciaBrasileira, competenciaDoDia } from "@/lib/dominio/financeiro";
import { MENSAGENS_DAS_CORRECOES as M } from "@/lib/dominio/correcoes";
import { MENSAGENS_FLUXO_FINANCEIRO as F } from "@/lib/financeiro/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-019, etapa 2b — testes de integração das correções da Calculadora e do Financeiro: T02 (vínculo
// mantido, tipo com vínculo), T03 e T04 (desfazer, com as contas geradas da despesa fixa), CA-18, CA-19,
// INV-003 a INV-005. As Server Actions são as da aplicação, com o banco real; só a leitura da sessão
// é trocada, e a guarda decide com `autorizar` sobre o contexto montado como na aplicação.

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
(globalThis as { prismaHE?: PrismaClient }).prismaHE = base;
const db = await import("@/lib/db");
const financeiro = await import("@/lib/financeiro/acoes");
const calculadora = await import("@/lib/calculadora/acoes");
const { acaoDesfazerCorrecao } = await import("@/lib/suporte/acoes");

const suporte = criarConsultasDeSuporte(base);
const acesso = criarConsultasDeAcesso(base);
const VERSAO = "2026-11-01";
const HOJE = hojeLocal();
const MES = competenciaDoDia(HOJE);

let dono: string;
let admin: string;
let negocio: string;
let fornecedor: string;
let acessoId: string;

async function contextoDe(usuarioId: string, suporteDoCookie?: string, negocioDoCookie?: string) {
  return resolverContextoDaRequisicao(
    { usuarioId, negocioDoCookie, suporteDoCookie, autenticadoEm: new Date(Date.now() - 60_000), nivelDaSessao: "aal2", codigoEm: new Date(), agora: new Date(), versaoDosTermos: VERSAO },
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
const correcoesGravadas = () => base.registroSuporte.findMany({ where: { evento: "CORRECAO" }, orderBy: { criadoEm: "asc" } });
const ultimaCorrecao = async () => (await correcoesGravadas()).at(-1)!;
const dados = (r: { dados: unknown }) => r.dados as { acao: string; alvo: string; registro: string; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null };
const consultasDoDono = () => criarConsultasFinanceiras(comNegocio(base, { negocioId: negocio, usuarioId: dono }), negocio);

async function desfazer(correcaoId: string) {
  await comoDono();
  return acaoDesfazerCorrecao({ status: "ocioso" }, formulario({ correcaoId }));
}

/** Conta manual do Dono, com fornecedor e nº do documento (SPEC-026). */
async function contaDoDono(extra: Record<string, unknown> = {}) {
  return (
    await base.contaPagarReceber.create({
      data: {
        negocioId: negocio,
        tipo: "PAGAR",
        descricao: "Embalagens",
        categoria: "FORNECEDORES",
        valorTotal: 100,
        vencimento: new Date(`${HOJE}T15:00:00Z`),
        criadaPorId: dono,
        fornecedorId: fornecedor,
        numeroDocumento: "NF-10",
        ...extra,
      },
    })
  ).id;
}

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  dono = await usuario("Rafael Dono", "dono@exemplo.com");
  admin = await usuario("Vitor Suporte", "suporte@exemplo.com");
  negocio = (await base.negocio.create({ data: { nome: "Papelaria", taxaCartaoMedia: 3.5, margemLucroMeta: 20 } })).id;
  await base.membroNegocio.create({ data: { usuarioId: dono, negocioId: negocio, papel: "DONO" } });
  expect((await suporte.concederPapel("suporte@exemplo.com", "Equipe", new Date())).ok).toBe(true);
  fornecedor = (await base.fornecedor.create({ data: { negocioId: negocio, nome: "Embalagens Exemplo" } })).id;

  const l = await suporte.liberar(negocio, dono, { motivo: "Ajustes", modulos: ["financeiro", "calculadora", "catalogo"], modulosComCorrecao: ["financeiro", "calculadora"], prazo: "12h" }, new Date());
  acessoId = l!.id;
  expect(await suporte.entrar(acessoId, admin, new Date(), true)).toMatchObject({ ok: true });
  await comoSuporte();
});

afterAll(async () => {
  await base.$disconnect();
});

// ---------------------------------------------------------------------------------------

describe("Calculadora (5.4)", () => {
  it("parâmetros: guarda só o que mudou; o desfazer volta os valores anteriores", async () => {
    expect(await calculadora.acaoSalvarParametros(OCIOSO, formulario({ taxaCartao: "4", margemMeta: "20" }))).toMatchObject({ status: "salvo" });
    const c = await ultimaCorrecao();
    expect(dados(c)).toMatchObject({ acao: "calculadora.salvarParametros", alvo: negocio, registro: "Parâmetros de precificação", antes: { taxaCartao: "3.50" }, depois: { taxaCartao: "4.00" } });
    expect(await desfazer(c.id)).toMatchObject({ status: "ok" });
    expect(Number((await base.negocio.findUniqueOrThrow({ where: { id: negocio } })).taxaCartaoMedia)).toBe(3.5);
  });

  it("confirmar preço: o preço da calculadora; o desfazer grava o preço anterior em nome do Dono", async () => {
    const item = (
      await base.item.create({ data: { negocioId: negocio, tipo: "PRODUTO_FISICO", nome: "Caneta", nomeChave: "caneta", categoria: "PRODUTOS", unidadeMedida: "un", custoBase: 4, precoAtual: 10 } })
    ).id;
    // O cálculo em si é da SPEC-010; aqui, a gravação da confirmação passa pelo motor como na ação.
    const motor = db.correcoes();
    await motor.executar({ negocioId: negocio, administradorId: admin, acessoId }, "calculadora.confirmarPreco", [formulario({ itemId: item })], () =>
      db.catalogo({ negocioId: negocio, usuarioId: admin }).definirPreco(item, 12, admin, "CALCULADORA"),
    );
    const c = await ultimaCorrecao();
    expect(dados(c)).toMatchObject({ antes: { preco: "10.00" }, depois: { preco: "12.00" } });
    expect(await desfazer(c.id)).toMatchObject({ status: "ok" });
    expect(Number((await base.item.findUniqueOrThrow({ where: { id: item } })).precoAtual)).toBe(10);
    expect(await base.historicoPreco.findFirst({ where: { itemId: item, usuarioId: dono } })).toMatchObject({ origem: "MANUAL" });
  });
});

describe("Lançamento avulso e contas (5.4; OPEN-016, CA-19)", () => {
  it("lançamento avulso: registrado; desfazer é o estorno, uma vez", async () => {
    expect(await financeiro.acaoLancarAvulso(OCIOSO, formulario({ tipo: "SAIDA", valor: "35,00", categoria: "FORNECEDORES", descricao: "Frete", data: HOJE }))).toMatchObject({ status: "salvo" });
    const c = await ultimaCorrecao();
    expect(dados(c)).toMatchObject({ acao: "financeiro.lancarAvulso", registro: "Frete", antes: null, depois: { descricao: "Frete", tipo: "SAIDA", valor: "35.00", data: HOJE } });
    expect(await base.lancamentoFinanceiro.findFirstOrThrow({ where: { origem: "AVULSO" } })).toMatchObject({ usuarioId: admin });
    expect(await desfazer(c.id)).toMatchObject({ status: "ok" });
    expect(await base.lancamentoFinanceiro.findFirstOrThrow({ where: { origem: "ESTORNO" } })).toMatchObject({ usuarioId: dono, tipo: "ENTRADA" });

    // O Dono já estornou um lançamento do suporte: o desfazer explica.
    await comoSuporte();
    await financeiro.acaoLancarAvulso(OCIOSO, formulario({ tipo: "ENTRADA", valor: "10", categoria: "OUTROS", descricao: "Ajuste", data: HOJE }));
    const outra = await ultimaCorrecao();
    await consultasDoDono().estornar(dados(outra).alvo, dono, new Date());
    expect(await desfazer(outra.id)).toEqual({ status: "erro", mensagem: F.jaEstornado });
  });

  it("criar conta: sem o vínculo do formulário; desfazer cancela; com pagamento, recusa", async () => {
    await redireciona(
      financeiro.acaoCriarConta(OCIOSO, formulario({ tipo: "PAGAR", descricao: "Boleto", categoria: "FORNECEDORES", valor: "80", vencimento: HOJE, pessoa: fornecedor, numeroDocumento: "X-1" })),
    );
    const conta = await base.contaPagarReceber.findFirstOrThrow({ where: { descricao: "Boleto" } });
    expect(conta).toMatchObject({ criadaPorId: admin, fornecedorId: null, clienteId: null, numeroDocumento: null });
    const c = await ultimaCorrecao();
    expect(dados(c)).toMatchObject({ acao: "financeiro.criarConta", alvo: conta.id, antes: null, depois: { descricao: "Boleto", tipo: "PAGAR", valor: "80.00", vencimento: HOJE } });
    expect(JSON.stringify(c.dados)).not.toContain(fornecedor);
    expect(await desfazer(c.id)).toMatchObject({ status: "ok" });
    expect(await base.contaPagarReceber.findUniqueOrThrow({ where: { id: conta.id } })).toMatchObject({ status: "CANCELADA" });

    await comoSuporte();
    await redireciona(financeiro.acaoCriarConta(OCIOSO, formulario({ tipo: "PAGAR", descricao: "Outro boleto", categoria: "FORNECEDORES", valor: "50", vencimento: HOJE })));
    const outra = await ultimaCorrecao();
    await consultasDoDono().pagar({ contaId: dados(outra).alvo, valorCentavos: 1000, data: new Date(), usuarioId: dono, forma: "PIX" });
    expect(await desfazer(outra.id)).toEqual({ status: "erro", mensagem: F.contaNaoEditavel["com-pagamento"] });
  });

  it("editar conta: o fornecedor e o documento ficam; a troca de tipo com vínculo é recusada (CA-19)", async () => {
    const conta = await contaDoDono();
    const editar = (extra: Record<string, string>) =>
      financeiro.acaoEditarConta(OCIOSO, formulario({ contaId: conta, tipo: "PAGAR", descricao: "Embalagens de papel", categoria: "FORNECEDORES", valor: "120", vencimento: HOJE, ...extra }));

    expect(await editar({ tipo: "RECEBER" })).toEqual({ status: "erro", erros: { tipo: M.tipoComVinculo("fornecedor") } });
    expect(await correcoesGravadas()).toEqual([]);

    // O formulário manda outro vínculo: o servidor ignora e mantém o atual.
    expect(await editar({ pessoa: "", numeroDocumento: "OUTRO" })).toMatchObject({ status: "salvo" });
    expect(await base.contaPagarReceber.findUniqueOrThrow({ where: { id: conta } })).toMatchObject({ fornecedorId: fornecedor, numeroDocumento: "NF-10", descricao: "Embalagens de papel" });
    const c = await ultimaCorrecao();
    expect(dados(c)).toMatchObject({ antes: { descricao: "Embalagens", valor: "100.00" }, depois: { descricao: "Embalagens de papel", valor: "120.00" } });
    expect(JSON.stringify(c.dados)).not.toContain(fornecedor);

    expect(await desfazer(c.id)).toMatchObject({ status: "ok" });
    expect(await base.contaPagarReceber.findUniqueOrThrow({ where: { id: conta } })).toMatchObject({ descricao: "Embalagens", fornecedorId: fornecedor, numeroDocumento: "NF-10" });
    expect(Number((await base.contaPagarReceber.findUniqueOrThrow({ where: { id: conta } })).valorTotal)).toBe(100);
  });

  it("editar conta: sem vínculo, a troca de tipo vale; com pagamento depois, o desfazer é recusado", async () => {
    const conta = await contaDoDono({ fornecedorId: null, numeroDocumento: null });
    expect(
      await financeiro.acaoEditarConta(OCIOSO, formulario({ contaId: conta, tipo: "RECEBER", descricao: "Embalagens", categoria: "FORNECEDORES", valor: "100", vencimento: HOJE })),
    ).toMatchObject({ status: "salvo" });
    const c = await ultimaCorrecao();
    expect(dados(c)).toMatchObject({ antes: { tipo: "PAGAR" }, depois: { tipo: "RECEBER" } });
    await consultasDoDono().pagar({ contaId: conta, valorCentavos: 1000, data: new Date(), usuarioId: dono, forma: "PIX" });
    expect(await desfazer(c.id)).toEqual({ status: "erro", mensagem: F.contaNaoEditavel["com-pagamento"] });
  });

  it("fora da lista: estorno, pagamento, cancelamento, saldo inicial e a correção do vínculo são recusados", async () => {
    const conta = await contaDoDono();
    await recusa(financeiro.acaoCancelarConta(OCIOSO, formulario({ contaId: conta })), "ForaDaListaDeCorrecoes");
    await recusa(financeiro.acaoRegistrarPagamento(OCIOSO, formulario({ contaId: conta, valor: "10", data: HOJE, forma: "PIX" })), "ForaDaListaDeCorrecoes");
    await recusa(financeiro.acaoInformarSaldoInicial(OCIOSO, formulario({ valor: "10", data: HOJE })), "ForaDaListaDeCorrecoes");
    await recusa(financeiro.acaoCorrigirVinculo(OCIOSO, formulario({ contaId: conta, pessoa: "", numeroDocumento: "" })), "ForaDaListaDeCorrecoes");
    await recusa(financeiro.acaoEstornar(OCIOSO, formulario({ lancamentoId: randomUUID() })), "ForaDaListaDeCorrecoes");
    expect(await base.contaPagarReceber.findUniqueOrThrow({ where: { id: conta } })).toMatchObject({ status: "ABERTA", fornecedorId: fornecedor });
  });
});

describe("Despesas fixas e as contas geradas (OPEN-015, CA-18)", () => {
  const criar = () => financeiro.acaoCriarDespesa(OCIOSO, formulario({ descricao: "Aluguel", valor: "900", diaVencimento: "31", categoria: "OUTROS", fornecedor }));

  it("criar: a conta do mês faz parte da correção; desfazer desativa e cancela a conta sem pagamento", async () => {
    expect(await criar()).toMatchObject({ status: "salvo" });
    const despesa = await base.despesaFixa.findFirstOrThrow({ where: { descricao: "Aluguel" } });
    expect(despesa).toMatchObject({ ativo: true, fornecedorId: null });
    const conta = await base.contaPagarReceber.findFirstOrThrow({ where: { despesaFixaId: despesa.id } });
    const c = await ultimaCorrecao();
    expect(dados(c)).toMatchObject({ acao: "financeiro.criarDespesa", alvo: despesa.id, antes: null, depois: { descricao: "Aluguel", valor: "900.00", ativo: true, geradas: [MES] } });

    expect(await desfazer(c.id)).toMatchObject({ status: "ok" });
    expect(await base.despesaFixa.findUniqueOrThrow({ where: { id: despesa.id } })).toMatchObject({ ativo: false });
    expect(await base.contaPagarReceber.findUniqueOrThrow({ where: { id: conta.id } })).toMatchObject({ status: "CANCELADA" });
  });

  it("CA-18: com a conta gerada já paga, o desfazer é recusado e nada muda", async () => {
    await criar();
    const despesa = await base.despesaFixa.findFirstOrThrow({ where: { descricao: "Aluguel" } });
    const conta = await base.contaPagarReceber.findFirstOrThrow({ where: { despesaFixaId: despesa.id } });
    await consultasDoDono().pagar({ contaId: conta.id, valorCentavos: 90000, data: new Date(), usuarioId: dono, forma: "PIX" });
    expect(await desfazer((await ultimaCorrecao()).id)).toEqual({ status: "erro", mensagem: M.contaDaDespesaPaga(competenciaBrasileira(MES)) });
    expect(await base.despesaFixa.findUniqueOrThrow({ where: { id: despesa.id } })).toMatchObject({ ativo: true });
  });

  it("ativar gera a conta do mês na correção; desfazer a ativação cancela só a conta gerada a partir dela", async () => {
    const despesa = (await base.despesaFixa.create({ data: { negocioId: negocio, descricao: "Internet", valorMensal: 100, diaVencimento: 31, categoria: "OUTROS", ativo: false, geraDesde: new Date(`${MES}-01T00:00:00Z`) } })).id;
    expect(await financeiro.acaoDefinirAtivo(OCIOSO, formulario({ despesaId: despesa, ativo: "true" }))).toMatchObject({ status: "salvo" });
    const c = await ultimaCorrecao();
    expect(dados(c)).toMatchObject({ acao: "financeiro.definirAtivo", antes: { ativo: false, geradas: [] }, depois: { ativo: true, geradas: [MES] } });
    expect(await desfazer(c.id)).toMatchObject({ status: "ok" });
    expect(await base.despesaFixa.findUniqueOrThrow({ where: { id: despesa } })).toMatchObject({ ativo: false });
    expect(await base.contaPagarReceber.findFirstOrThrow({ where: { despesaFixaId: despesa } })).toMatchObject({ status: "CANCELADA" });
  });

  it("desativar: o desfazer reativa como o Dono reativaria", async () => {
    await criar();
    const despesa = await base.despesaFixa.findFirstOrThrow({ where: { descricao: "Aluguel" } });
    await comoSuporte();
    expect(await financeiro.acaoDefinirAtivo(OCIOSO, formulario({ despesaId: despesa.id, ativo: "false" }))).toMatchObject({ status: "salvo" });
    const c = await ultimaCorrecao();
    expect(dados(c)).toMatchObject({ antes: { ativo: true }, depois: { ativo: false } });
    expect(await desfazer(c.id)).toMatchObject({ status: "ok" });
    expect(await base.despesaFixa.findUniqueOrThrow({ where: { id: despesa.id } })).toMatchObject({ ativo: true });
  });

  it("editar: o fornecedor fica como está; o desfazer volta os campos", async () => {
    const despesa = (
      await base.despesaFixa.create({ data: { negocioId: negocio, descricao: "Contador", valorMensal: 300, diaVencimento: 31, categoria: "OUTROS", fornecedorId: fornecedor, geraDesde: new Date(`${MES}-01T00:00:00Z`) } })
    ).id;
    expect(
      await financeiro.acaoEditarDespesa(OCIOSO, formulario({ despesaId: despesa, descricao: "Contabilidade", valor: "350", diaVencimento: "31", categoria: "OUTROS", fornecedor: "" })),
    ).toMatchObject({ status: "salvo" });
    expect(await base.despesaFixa.findUniqueOrThrow({ where: { id: despesa } })).toMatchObject({ descricao: "Contabilidade", fornecedorId: fornecedor });
    const c = await ultimaCorrecao();
    expect(dados(c)).toMatchObject({ antes: { descricao: "Contador", valor: "300.00" }, depois: { descricao: "Contabilidade", valor: "350.00" } });
    expect(await desfazer(c.id)).toMatchObject({ status: "ok" });
    expect(await base.despesaFixa.findUniqueOrThrow({ where: { id: despesa } })).toMatchObject({ descricao: "Contador", fornecedorId: fornecedor });
  });
});

describe("motor: erro do banco engolido pelo serviço", () => {
  it("a transação abortada volta ao savepoint: nada é gravado e a resposta do serviço chega à tela", async () => {
    const motor = db.correcoes();
    const r = await motor.executar({ negocioId: negocio, administradorId: admin, acessoId }, "financeiro.lancarAvulso", [], async () => {
      const cliente = db.clienteDoNegocio({ negocioId: negocio, usuarioId: admin });
      await cliente.lancamentoFinanceiro.create({
        data: { negocioId: negocio, origem: "AVULSO", tipo: "SAIDA", categoria: "OUTROS", valor: "1.00", descricao: "Antes do erro", data: new Date(), usuarioId: admin },
      });
      try {
        await cliente.$queryRawUnsafe("SELECT 1/0");
      } catch {
        return { status: "erro" as const, mensagem: "falhou" };
      }
      return { status: "salvo" as const, mensagem: "ok" };
    });
    expect(r).toEqual({ status: "erro", mensagem: "falhou" });
    expect(await base.lancamentoFinanceiro.count()).toBe(0);
    expect(await correcoesGravadas()).toEqual([]);
  });
});

describe("históricos com o suporte do HE (5.3, item 3)", () => {
  it("a conta criada e o lançamento mostram '{nome} (suporte do HE)'", async () => {
    await financeiro.acaoLancarAvulso(OCIOSO, formulario({ tipo: "SAIDA", valor: "5", categoria: "OUTROS", descricao: "Taxa", data: HOJE }));
    await redireciona(financeiro.acaoCriarConta(OCIOSO, formulario({ tipo: "PAGAR", descricao: "Boleto", categoria: "OUTROS", valor: "5", vencimento: HOJE })));
    const conta = await base.contaPagarReceber.findFirstOrThrow({ where: { descricao: "Boleto" } });
    expect((await consultasDoDono().detalharConta(conta.id, HOJE)).criadaPor).toBe("Vitor Suporte (suporte do HE)");
    const fluxo = await consultasDoDono().fluxo({ mes: MES, pagina: 1 }, HOJE);
    expect(fluxo.lancamentos.find((l) => l.descricao === "Taxa")?.registradoPor).toBe("Vitor Suporte (suporte do HE)");
  });
});
