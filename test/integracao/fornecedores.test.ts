import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarConsultasDeClientes } from "@/lib/db/clientes";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { SomenteLeituraNoSuporte } from "@/lib/db/erros";
import { CONTAS_POR_PAGINA, criarConsultasFinanceiras } from "@/lib/db/financeiro";
import { criarConsultasDeFornecedores } from "@/lib/db/fornecedores";
import { criarConsultasDaLgpd } from "@/lib/db/lgpd";
import { criarConsultasDeRelatorios } from "@/lib/db/relatorios";
import type { Visao } from "@/lib/db/clientes";
import { criarConsultasDeVendas } from "@/lib/db/vendas";
import { SEM_FILTROS, type FiltrosDasContas } from "@/lib/dominio/contas";
import { hoje as hojeLocal, intervaloDoDia } from "@/lib/dominio/datas";
import { FORNECEDOR_ANONIMO } from "@/lib/dominio/lgpd";
import * as clientes from "@/lib/clientes/servicos";
import * as financeiro from "@/lib/financeiro/servicos";
import { MENSAGENS_FLUXO_FINANCEIRO as F } from "@/lib/financeiro/servicos";
import { MENSAGENS_FINANCEIRO as M } from "@/lib/financeiro/validacao";
import * as fornecedores from "@/lib/fornecedores/servicos";
import { MENSAGENS_FLUXO_FORNECEDOR as FF } from "@/lib/fornecedores/servicos";
import { tabelaDeContas } from "@/lib/relatorios/tabelas";
import * as vendas from "@/lib/vendas/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-026 — testes de integração (seção 12): T03 a T10, com banco real, o cliente do negócio
// (SPEC-001) e as restrições da migração 20261101200000_fornecedores.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();
const CNPJ = "11222333000181";
const CNPJ_2 = "11444777000161";

let usuario: string;
let negocioA: string;
let negocioB: string;

const cliente = (negocioId = negocioA, suporte = false) => comNegocio(base, { negocioId, usuarioId: usuario, modoSuporte: suporte });
const forn = (visao: Visao = "completa", negocioId = negocioA) => criarConsultasDeFornecedores(cliente(negocioId, visao === "suporte"), negocioId, visao);
const fin = (negocioId = negocioA, mascararNomes = false) => criarConsultasFinanceiras(cliente(negocioId), negocioId, { mascararNomes });
const depsFin = (negocioId = negocioA): financeiro.DependenciasDoFinanceiro => ({ financeiro: fin(negocioId), usuarioId: usuario, hoje: HOJE, agora: new Date() });

async function novoFornecedor(campos: Record<string, string>, negocioId = negocioA) {
  const r = await fornecedores.cadastrarFornecedor(campos, { fornecedores: forn("completa", negocioId) });
  if (r.status !== "salvo") throw new Error(`esperava salvo: ${JSON.stringify(r)}`);
  return r.cliente.id;
}

async function novoCliente(nome: string, negocioId = negocioA) {
  const r = await clientes.cadastrarCliente({ tipo: "PESSOA_FISICA", nome }, {
    clientes: criarConsultasDeClientes(cliente(negocioId), negocioId, "completa"),
    consultaCep: { consultar: vi.fn() },
    consultaCnpj: { consultarEmpresa: vi.fn() },
  });
  if (r.status !== "salvo") throw new Error(JSON.stringify(r));
  return r.cliente.id;
}

const salvo = (r: financeiro.EstadoDoFinanceiro) => {
  if (r.status !== "salvo") throw new Error(`esperava salvo: ${JSON.stringify(r)}`);
  return r.id!;
};

const conta = (campos: Record<string, string>, negocioId = negocioA) =>
  financeiro.criarConta({ tipo: "PAGAR", descricao: "Embalagens", categoria: "FORNECEDORES", valor: "100", vencimento: HOJE, ...campos }, depsFin(negocioId));

/** Pagamento numa data (até 90 dias atrás), com a forma. */
const pagar = (contaId: string, valor: string, dia: string, forma = "PIX") => financeiro.registrarPagamento(contaId, { valor, data: dia, forma }, depsFin());

const dia = (deslocamento: number) => new Date(intervaloDoDia(HOJE).inicio.getTime() + deslocamento * 86_400_000 + 12 * 3_600_000).toISOString().slice(0, 10);

async function venderNoCartao(clienteId: string, valor: number) {
  const item = await base.item.create({
    data: { negocioId: negocioA, tipo: "SERVICO", nome: `Serviço ${randomUUID()}`, nomeChave: randomUUID(), categoria: "BELEZA", unidadeMedida: "un", custoBase: 1, precoAtual: valor },
  });
  const r = await vendas.registrarVenda(
    { carrinho: JSON.stringify({ id: randomUUID(), clienteId, linhas: [{ itemId: item.id, quantidade: 1 }], pagamentos: [{ forma: "CREDITO", valor, parcelas: 2 }] }) },
    { vendas: criarConsultasDeVendas(cliente(), negocioA), usuarioId: usuario, hoje: HOJE, agora: new Date() },
  );
  if (r.status !== "registrada") throw new Error(JSON.stringify(r));
  return r.vendaId;
}

const listar = (tipo: "PAGAR" | "RECEBER", filtros: Partial<FiltrosDasContas> = {}, extra: { situacao?: "abertas" | "todas" | "quitadas"; desde?: string; pagina?: number } = {}) =>
  fin().listarContas({ tipo, situacao: extra.situacao ?? "todas", desde: extra.desde, pagina: extra.pagina, filtros: { ...SEM_FILTROS, ...filtros } }, HOJE);

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Gisele", email: "gisele@exemplo.com", consentimentoLgpdEm: new Date(), versaoTermosAceita: "2026-11-01" } })).id;
  negocioA = (await base.negocio.create({ data: { nome: "Studio A" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Studio B" } })).id;
  await base.membroNegocio.create({ data: { negocioId: negocioA, usuarioId: usuario, papel: "DONO" } });
});

afterAll(async () => {
  await base.$disconnect();
});

describe("T03 — fornecedores no banco (CA-01, CA-02, CA-05, INV-005, INV-006, INV-008)", () => {
  it("cadastra, edita, recusa documento repetido e aceita o mesmo documento de um cliente", async () => {
    const id = await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "Embalagens Exemplo Ltda", nomeFantasia: "Embalagens Exemplo", documento: CNPJ });
    expect(await fornecedores.cadastrarFornecedor({ tipo: "PESSOA_JURIDICA", nome: "Outra", documento: CNPJ }, { fornecedores: forn() })).toEqual({
      status: "erro",
      erros: { documento: FF.repetido("PESSOA_JURIDICA", "Embalagens Exemplo") },
    });
    // Cadastros separados: um cliente pode ter o mesmo CNPJ.
    await base.cliente.create({ data: { negocioId: negocioA, tipo: "PESSOA_JURIDICA", nome: "Embalagens Exemplo Ltda", documento: CNPJ } });
    expect(await fornecedores.editarFornecedor(id, { tipo: "PESSOA_JURIDICA", nome: "Embalagens Exemplo SA", documento: CNPJ, telefone: "(11) 98765-4321" }, { fornecedores: forn() })).toMatchObject({ status: "salvo" });
    expect(await base.fornecedor.findUniqueOrThrow({ where: { id } })).toMatchObject({ nome: "Embalagens Exemplo SA", telefone: "11987654321" });
    // Outro negócio não vê nem edita.
    expect((await forn("completa", negocioB).listar()).fornecedores).toEqual([]);
    expect(await fornecedores.editarFornecedor(id, { tipo: "PESSOA_JURIDICA", nome: "X" }, { fornecedores: forn("completa", negocioB) })).toEqual({ status: "erro", mensagem: FF.naoEncontrado });
  });

  it("sem contas, apaga; com conta, anonimiza e a conta continua com os mesmos valores", async () => {
    const semConta = await novoFornecedor({ tipo: "PESSOA_FISICA", nome: "Bia Costureira", documento: "529.982.247-25" });
    expect(await fornecedores.excluirFornecedor(semConta, { fornecedores: forn() })).toBe("apagado");
    expect(await base.fornecedor.count()).toBe(0);

    const comConta = await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "Embalagens Exemplo Ltda", documento: CNPJ, email: "contato@exemplo.com" });
    const contaId = salvo(await conta({ pessoa: comConta, numeroDocumento: "1234" }));
    expect(await fornecedores.excluirFornecedor(comConta, { fornecedores: forn() })).toBe("anonimizado");
    expect(await base.fornecedor.findUniqueOrThrow({ where: { id: comConta } })).toMatchObject({ nome: FORNECEDOR_ANONIMO, documento: null, email: null, anonimizadoEm: expect.any(Date) });
    expect(await base.contaPagarReceber.findUniqueOrThrow({ where: { id: contaId } })).toMatchObject({ fornecedorId: comConta, numeroDocumento: "1234", valorTotal: expect.anything() });
    // O documento fica livre; o anonimizado sai da lista e do seletor.
    await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "Nova Embalagens", documento: CNPJ });
    expect((await forn().opcoes()).map((o) => o.nome)).toEqual(["Nova Embalagens"]);
    // O banco recusa um anonimizado com dados.
    await expect(base.fornecedor.update({ where: { id: comConta }, data: { email: "volta@exemplo.com" } })).rejects.toThrow(/Fornecedor_anonimizado_sem_dados/);
  });

  it("detalhe com as contas, os totais e as despesas fixas", async () => {
    const id = await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "Embalagens Exemplo Ltda" });
    const a = salvo(await conta({ pessoa: id, valor: "100" }));
    salvo(await conta({ pessoa: id, valor: "50" }));
    salvo(await pagar(a, "40", HOJE));
    salvo(await financeiro.criarDespesa({ descricao: "Aluguel", valor: "900", diaVencimento: "28", fornecedor: id }, depsFin()));
    const d = await forn().detalhar(id, HOJE);
    expect(d.quantidadeDeContas).toBe(3); // as duas e a do mês gerada pela despesa
    expect(d.pagoCentavos).toBe(4000);
    expect(d.emAbertoCentavos).toBe(6000 + 5000 + 90000);
    expect(d.despesas.map((x) => x.descricao)).toEqual(["Aluguel"]);
    expect(await forn().vinculos(id)).toEqual({ contas: 3, despesas: 1 });
  });
});

describe("T04 — vínculos nas contas e nas despesas fixas (CA-06, CA-08, CA-09, INV-001, INV-002)", () => {
  it("conta a pagar com fornecedor e documento; a receber com cliente; nome visível no Financeiro", async () => {
    const f = await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "Embalagens Exemplo Ltda", nomeFantasia: "Embalagens Exemplo" });
    const c = await novoCliente("Ana Souza");
    const pagarId = salvo(await conta({ pessoa: f, numeroDocumento: "NF 1234" }));
    const receberId = salvo(await conta({ tipo: "RECEBER", categoria: "VENDAS", pessoa: c }));
    expect((await fin().detalharConta(pagarId, HOJE)).pessoa).toEqual({ id: f, nome: "Embalagens Exemplo", papel: "fornecedor", daVenda: false });
    expect((await fin().detalharConta(pagarId, HOJE)).numeroDocumento).toBe("NF 1234");
    expect((await fin().detalharConta(receberId, HOJE)).pessoa).toMatchObject({ id: c, nome: "Ana Souza", papel: "cliente" });
    // Fornecedor ou cliente que não existe, é de outro negócio ou foi anonimizado: recusado no campo.
    const deOutro = await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "De outro" }, negocioB);
    expect(await conta({ pessoa: deOutro })).toEqual({ status: "erro", erros: { pessoa: F.fornecedorNaoEncontrado } });
    expect(await conta({ tipo: "RECEBER", pessoa: f })).toEqual({ status: "erro", erros: { pessoa: F.clienteNaoEncontrado } });
  });

  it("o banco recusa fornecedor na conta a receber, cliente na a pagar ou na de venda, e de outro negócio", async () => {
    const f = await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "Embalagens" });
    const c = await novoCliente("Ana");
    const pagarId = salvo(await conta({}));
    const receberId = salvo(await conta({ tipo: "RECEBER", categoria: "VENDAS" }));
    await expect(base.contaPagarReceber.update({ where: { id: receberId }, data: { fornecedorId: f } })).rejects.toThrow(/ContaPagarReceber_fornecedor_a_pagar/);
    await expect(base.contaPagarReceber.update({ where: { id: pagarId }, data: { clienteId: c } })).rejects.toThrow(/ContaPagarReceber_cliente_a_receber_manual/);
    await venderNoCartao(c, 100);
    const daVenda = await base.contaPagarReceber.findFirstOrThrow({ where: { parcelaId: { not: null } } });
    await expect(base.contaPagarReceber.update({ where: { id: daVenda.id }, data: { clienteId: c } })).rejects.toThrow(/ContaPagarReceber_cliente_a_receber_manual/);
    const deOutro = await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "De outro" }, negocioB);
    await expect(base.contaPagarReceber.update({ where: { id: pagarId }, data: { fornecedorId: deOutro } })).rejects.toThrow(/he_negocio_divergente/);
    await expect(base.$executeRawUnsafe(`UPDATE "DespesaFixa" SET "fornecedorId" = '${f}' WHERE "origem" = 'DAS_MEI'`)).resolves.toBe(0);
    // O fornecedor com conta não pode ser apagado direto (a exclusão anonimiza).
    await base.contaPagarReceber.update({ where: { id: pagarId }, data: { fornecedorId: f } });
    await expect(base.fornecedor.delete({ where: { id: f } })).rejects.toThrow();
  });

  it("correção a qualquer momento, mesmo quitada, sem mudar valores; na de venda, só o documento", async () => {
    const f1 = await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "Primeiro" });
    const f2 = await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "Segundo" });
    const id = salvo(await conta({ pessoa: f1 }));
    salvo(await pagar(id, "100", HOJE));
    const antes = await base.contaPagarReceber.findUniqueOrThrow({ where: { id }, include: { lancamentos: true } });
    expect(antes.status).toBe("QUITADA");
    expect(await financeiro.corrigirVinculo(id, { pessoa: f2, numeroDocumento: "Boleto 9" }, depsFin())).toEqual({ status: "salvo", mensagem: F.vinculoCorrigido, id });
    const depois = await base.contaPagarReceber.findUniqueOrThrow({ where: { id }, include: { lancamentos: true } });
    expect(depois).toMatchObject({ fornecedorId: f2, numeroDocumento: "Boleto 9" });
    expect({ ...depois, fornecedorId: null, numeroDocumento: null }).toEqual({ ...antes, fornecedorId: null, numeroDocumento: null });
    // Edição completa continua só na manual sem pagamento.
    expect(await financeiro.editarConta(id, { tipo: "PAGAR", descricao: "X", categoria: "OUTROS", valor: "1", vencimento: HOJE }, depsFin())).toEqual({
      status: "erro",
      mensagem: F.contaNaoEditavel.encerrada,
    });

    const c = await novoCliente("Ana");
    await venderNoCartao(c, 100);
    const daVenda = await base.contaPagarReceber.findFirstOrThrow({ where: { parcelaId: { not: null } } });
    salvo(await financeiro.corrigirVinculo(daVenda.id, { pessoa: randomUUID(), numeroDocumento: "Maquininha 77" }, depsFin()));
    expect(await base.contaPagarReceber.findUniqueOrThrow({ where: { id: daVenda.id } })).toMatchObject({ clienteId: null, numeroDocumento: "Maquininha 77" });
    expect((await fin().detalharConta(daVenda.id, HOJE)).pessoa).toMatchObject({ id: c, nome: "Ana", daVenda: true });
    // Um anonimizado que já está na conta continua valendo na correção só do documento.
    await fornecedores.excluirFornecedor(f2, { fornecedores: forn() });
    salvo(await financeiro.corrigirVinculo(id, { pessoa: f2, numeroDocumento: "Boleto 10" }, depsFin()));
    expect(await financeiro.corrigirVinculo(id, { pessoa: f1 }, depsFin())).toMatchObject({ status: "salvo" });
  });

  it("a despesa fixa repassa o fornecedor às contas que gerar; trocar não muda as já geradas", async () => {
    const f1 = await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "Imobiliária Exemplo" });
    const f2 = await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "Outra Imobiliária" });
    const despesa = salvo(await financeiro.criarDespesa({ descricao: "Aluguel", valor: "900", diaVencimento: "28", fornecedor: f1 }, depsFin()));
    const gerada = await base.contaPagarReceber.findFirstOrThrow({ where: { despesaFixaId: despesa } });
    expect(gerada.fornecedorId).toBe(f1);
    expect((await fin().detalharDespesa(despesa)).fornecedor).toEqual({ id: f1, nome: "Imobiliária Exemplo" });
    salvo(await financeiro.editarDespesa(despesa, { descricao: "Aluguel", valor: "900", diaVencimento: "28", fornecedor: f2 }, depsFin()));
    expect((await base.contaPagarReceber.findUniqueOrThrow({ where: { id: gerada.id } })).fornecedorId).toBe(f1);
    expect((await base.despesaFixa.findUniqueOrThrow({ where: { id: despesa } })).fornecedorId).toBe(f2);
    expect(await financeiro.criarDespesa({ descricao: "Luz", valor: "100", diaVencimento: "5", fornecedor: randomUUID() }, depsFin())).toEqual({
      status: "erro",
      erros: { fornecedor: F.fornecedorNaoEncontrado },
    });
  });
});

describe("T05 — forma do pagamento (CA-10, INV-003)", () => {
  it("obrigatória; gravada no lançamento; antigos sem forma; parcela recebida no vencimento = cartão de crédito", async () => {
    const id = salvo(await conta({ valor: "100" }));
    expect(await financeiro.registrarPagamento(id, { valor: "10", data: HOJE }, depsFin())).toEqual({ status: "erro", erros: { forma: M.formaObrigatoria } });
    salvo(await pagar(id, "10", HOJE, "BOLETO"));
    // Pagamento anterior à SPEC-026: lançamento sem forma.
    await base.lancamentoFinanceiro.create({ data: { negocioId: negocioA, contaId: id, origem: "CONTA", tipo: "SAIDA", categoria: "FORNECEDORES", valor: 5, data: new Date() } });
    expect((await fin().detalharConta(id, HOJE)).lancamentos.map((l) => l.forma).sort()).toEqual(["BOLETO", null].sort());
    await expect(base.lancamentoFinanceiro.create({ data: { negocioId: negocioA, origem: "AVULSO", tipo: "SAIDA", categoria: "OUTROS", valor: 1, formaPagamento: "PIX" } })).rejects.toThrow(
      /LancamentoFinanceiro_forma_so_de_conta/,
    );

    const c = await novoCliente("Ana");
    await venderNoCartao(c, 100);
    const parcela = await base.contaPagarReceber.findFirstOrThrow({ where: { parcelaId: { not: null } }, orderBy: { vencimento: "asc" } });
    await base.contaPagarReceber.update({ where: { id: parcela.id }, data: { vencimento: new Date(intervaloDoDia(HOJE).inicio.getTime() - 86_400_000) } });
    await fin().conferir(HOJE);
    expect((await base.lancamentoFinanceiro.findFirstOrThrow({ where: { contaId: parcela.id } })).formaPagamento).toBe("CREDITO");
  });
});

describe("T06 — filtros e totais (CA-11 a CA-14, INV-007, INV-008)", () => {
  it("fornecedor + data do pagamento + forma; totais somam só os pagamentos do filtro", async () => {
    const a = await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "Fornecedor A" });
    const b = await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "Fornecedor B" });
    const c1 = salvo(await conta({ pessoa: a, valor: "100", descricao: "Tecidos", numeroDocumento: "1234" }));
    const c2 = salvo(await conta({ pessoa: a, valor: "200", descricao: "Linhas" }));
    const c3 = salvo(await conta({ pessoa: b, valor: "300", descricao: "Botões" }));
    salvo(await pagar(c1, "60", dia(-40), "PIX"));
    salvo(await pagar(c1, "40", dia(-5), "PIX"));
    salvo(await pagar(c2, "50", dia(-5), "BOLETO"));
    salvo(await pagar(c3, "300", dia(-5), "PIX"));

    const r = await listar("PAGAR", { pessoaId: a, pagamentoDe: dia(-10), pagamentoAte: HOJE, forma: "PIX" });
    expect(r.contas.map((c) => c.id)).toEqual([c1]);
    expect(r.totais).toEqual({ quantidade: 1, totalCentavos: 10000, pagoCentavos: 4000, emAbertoCentavos: 0 });

    const deA = await listar("PAGAR", { pessoaId: a });
    expect(deA.contas.map((c) => c.id).sort()).toEqual([c1, c2].sort());
    expect(deA.totais).toEqual({ quantidade: 2, totalCentavos: 30000, pagoCentavos: 15000, emAbertoCentavos: 15000 });
    expect((await listar("PAGAR", { busca: "234" })).contas.map((c) => c.id)).toEqual([c1]);
    expect((await listar("PAGAR", { busca: "botõ" })).contas.map((c) => c.id)).toEqual([c3]);
    expect((await listar("PAGAR", { forma: "BOLETO" })).contas.map((c) => c.id)).toEqual([c2]);
    expect((await listar("PAGAR", { categoria: "SALARIO" })).totais.quantidade).toBe(0);
    expect((await listar("PAGAR", { origem: "manual" })).totais.quantidade).toBe(3);
    expect((await listar("PAGAR", { origem: "despesa" })).totais.quantidade).toBe(0);
    expect((await listar("PAGAR", { vencimentoDe: dia(1) })).totais.quantidade).toBe(0);
    // Outro negócio não vê nada.
    expect((await fin(negocioB).listarContas({ tipo: "PAGAR", situacao: "todas", filtros: SEM_FILTROS }, HOJE)).totais.quantidade).toBe(0);
  });

  it("cliente inclui as contas da venda no cartão; sem forma (\"Não informada\"); canceladas fora dos valores", async () => {
    const c = await novoCliente("Ana");
    await venderNoCartao(c, 100);
    const manual = salvo(await conta({ tipo: "RECEBER", categoria: "VENDAS", pessoa: c, valor: "40" }));
    const r = await listar("RECEBER", { pessoaId: c });
    expect(r.totais.quantidade).toBe(3);
    expect(r.contas.every((x) => x.pessoa?.id === c)).toBe(true);
    expect(r.totais.totalCentavos).toBe(14000);
    expect((await listar("RECEBER", { origem: "venda" })).totais.quantidade).toBe(2);

    await base.lancamentoFinanceiro.create({ data: { negocioId: negocioA, contaId: manual, origem: "CONTA", tipo: "ENTRADA", categoria: "VENDAS", valor: 10, data: new Date() } });
    await base.contaPagarReceber.update({ where: { id: manual }, data: { valorPago: 10, status: "PARCIAL" } });
    expect((await listar("RECEBER", { forma: "NAO_INFORMADA" })).contas.map((x) => x.id)).toEqual([manual]);

    const cancelada = salvo(await conta({ tipo: "RECEBER", categoria: "VENDAS", valor: "500" }));
    salvo(await financeiro.cancelarConta(cancelada, depsFin()));
    const todas = await listar("RECEBER");
    expect(todas.totais.quantidade).toBe(4);
    expect(todas.totais.totalCentavos).toBe(14000);
  });

  it("os totais somam todas as páginas; o plano gratuito esconde quitadas antigas, também nos totais", async () => {
    const f = await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "Muitas" });
    await base.contaPagarReceber.createMany({
      data: Array.from({ length: CONTAS_POR_PAGINA + 5 }, () => ({ negocioId: negocioA, tipo: "PAGAR" as const, categoria: "FORNECEDORES" as const, valorTotal: 1, vencimento: new Date(), fornecedorId: f })),
    });
    const r = await listar("PAGAR", { pessoaId: f });
    expect(r.contas).toHaveLength(CONTAS_POR_PAGINA);
    expect(r.paginas).toBe(2);
    expect(r.totais).toMatchObject({ quantidade: CONTAS_POR_PAGINA + 5, totalCentavos: (CONTAS_POR_PAGINA + 5) * 100 });

    const antiga = await base.contaPagarReceber.create({
      data: { negocioId: negocioA, tipo: "PAGAR", categoria: "FORNECEDORES", valorTotal: 50, valorPago: 50, status: "QUITADA", vencimento: new Date("2024-01-10T15:00:00Z"), fornecedorId: f },
    });
    const desde = "2025-11-01";
    const gratuito = await listar("PAGAR", { pessoaId: f }, { situacao: "quitadas", desde });
    expect(gratuito.contas.map((c) => c.id)).not.toContain(antiga.id);
    expect(gratuito.totais.quantidade).toBe(0);
    expect(gratuito.ocultasPeloPlano).toBe(1);
    expect((await listar("PAGAR", { pessoaId: f }, { situacao: "quitadas" })).totais.pagoCentavos).toBe(5000);
  });
});

describe("T08 — suporte (CA-16, INV-009)", () => {
  it("fornecedores e nomes nas contas mascarados; nenhuma escrita", async () => {
    const f = await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "Embalagens Exemplo Ltda", documento: CNPJ_2 });
    salvo(await conta({ pessoa: f }));
    const lista = (await forn("suporte").listar()).fornecedores;
    expect(lista[0].nome).not.toContain("Embalagens");
    expect((await forn("suporte").detalhar(f, HOJE)).fornecedor.nome).not.toContain("Embalagens");
    expect((await forn("suporte").opcoes())[0].nome).not.toContain("Embalagens");
    const contas = await fin(negocioA, true).listarContas({ tipo: "PAGAR", situacao: "todas", filtros: SEM_FILTROS }, HOJE);
    expect(contas.contas[0].pessoa?.nome).not.toContain("Embalagens");
    await expect(forn("suporte").criar({ tipo: "PESSOA_JURIDICA", nome: "X" } as never)).rejects.toThrow(SomenteLeituraNoSuporte);
    await expect(forn("suporte").excluir(f)).rejects.toThrow(SomenteLeituraNoSuporte);
    const finSuporte = criarConsultasFinanceiras(cliente(negocioA, true), negocioA, { mascararNomes: true });
    const contaId = contas.contas[0].id;
    await expect(finSuporte.corrigirVinculo(contaId, { pessoaId: null, numeroDocumento: "x" })).rejects.toThrow(SomenteLeituraNoSuporte);
  });
});

describe("T09 — relatório de Contas (CA-15)", () => {
  it("traz fornecedor ou cliente, documento e pagamentos", async () => {
    const f = await novoFornecedor({ tipo: "PESSOA_JURIDICA", nome: "Embalagens Exemplo Ltda", nomeFantasia: "Embalagens Exemplo" });
    const id = salvo(await conta({ pessoa: f, numeroDocumento: "1234", valor: "150" }));
    salvo(await pagar(id, "100", HOJE, "PIX"));
    const c = await novoCliente("Ana");
    await venderNoCartao(c, 100);
    const lista = await criarConsultasDeRelatorios(cliente(), negocioA).contas(dia(-1), dia(70));
    const aPagar = lista.find((x) => x.tipo === "PAGAR")!;
    expect(aPagar).toMatchObject({ pessoa: "Embalagens Exemplo", numeroDocumento: "1234", pagamentos: [{ forma: "PIX", valorCentavos: 10000 }] });
    expect(lista.filter((x) => x.tipo === "RECEBER").every((x) => x.pessoa === "Ana")).toBe(true);
    const t = tabelaDeContas(lista);
    expect(t.linhas.find((l) => l[2] === "Embalagens Exemplo")![10]).toMatch(/Pix 100,00$/);
  });
});

describe("T10 — LGPD (CA-17)", () => {
  it("exportação com fornecedores e formas; exclusão de conta anonimiza os fornecedores", async () => {
    const f = await novoFornecedor({ tipo: "PESSOA_FISICA", nome: "Bia Costureira", documento: "529.982.247-25", email: "bia@exemplo.com" });
    const id = salvo(await conta({ pessoa: f, numeroDocumento: "77" }));
    salvo(await pagar(id, "100", HOJE, "DINHEIRO"));
    const lgpd = criarConsultasDaLgpd(base);
    const dados = await lgpd.dadosDoTitular(usuario, new Date());
    const tabelas = dados!.negociosComoDono[0].tabelas;
    expect(tabelas.fornecedores).toEqual([expect.objectContaining({ id: f, nome: "Bia Costureira", documento: "52998224725" })]);
    expect(tabelas.contasPagarReceber).toEqual([expect.objectContaining({ fornecedorId: f, numeroDocumento: "77" })]);
    expect(tabelas.lancamentosFinanceiros).toEqual([expect.objectContaining({ formaPagamento: "DINHEIRO" })]);

    await lgpd.excluirConta(usuario, new Date());
    expect(await base.fornecedor.findUniqueOrThrow({ where: { id: f } })).toMatchObject({ nome: FORNECEDOR_ANONIMO, documento: null, email: null });
    expect(await base.contaPagarReceber.findUniqueOrThrow({ where: { id } })).toMatchObject({ fornecedorId: f, numeroDocumento: "77" });
  });

  it("cliente com conta a receber, sem vendas, é anonimizado (e não apagado)", async () => {
    const c = await novoCliente("Ana");
    salvo(await conta({ tipo: "RECEBER", categoria: "VENDAS", pessoa: c }));
    const consultas = criarConsultasDeClientes(cliente(), negocioA, "completa");
    expect(await consultas.quantidadeDeContas(c)).toBe(1);
    expect(await consultas.excluir(c)).toBe("anonimizado");
  });
});
