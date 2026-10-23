import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { autorizar } from "@/lib/auth/autorizacao";
import * as servicos from "@/lib/clientes/servicos";
import { MENSAGENS_FLUXO_CLIENTE as F } from "@/lib/clientes/servicos";
import { MENSAGENS_CLIENTE as M } from "@/lib/clientes/validacao";
import { ClienteNaoEncontrado, criarConsultasDeClientes, LIMITE_DE_COMPRAS, visaoDoCliente, type Visao } from "@/lib/db/clientes";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { SomenteLeituraNoSuporte } from "@/lib/db/erros";
import { criarConsultasDeVendas } from "@/lib/db/vendas";
import { hoje as hojeLocal } from "@/lib/dominio/datas";
import { CLIENTE_ANONIMO } from "@/lib/dominio/lgpd";
import { PREDEFINICOES } from "@/lib/dominio/permissoes";
import * as vendas from "@/lib/vendas/servicos";
import { MENSAGENS_FLUXO_VENDA } from "@/lib/vendas/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-022 — testes de integração (seção 12): T04, T05, T07 a T11 e as partes de integração de
// T06 e T10, com banco real, o cliente do negócio (SPEC-001) e as restrições da migração.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();

let usuario: string;
let negocioA: string;
let negocioB: string;

const CPF = "52998224725";
const CNPJ_LETRAS = "12ABC34501DE35";
const ENDERECO = { cep: "01310-100", logradouro: "Avenida Paulista", numero: "1000", bairro: "Bela Vista", municipio: "São Paulo", uf: "SP" };

const consultas = (visao: Visao = "completa", negocioId = negocioA) =>
  criarConsultasDeClientes(comNegocio(base, { negocioId, usuarioId: usuario, modoSuporte: visao === "suporte" }), negocioId, visao);

const deps = (visao: Visao = "completa", negocioId = negocioA): servicos.DependenciasDoCliente => ({
  clientes: consultas(visao, negocioId),
  consultaCep: { consultar: vi.fn() },
  consultaCnpj: { consultarEmpresa: vi.fn() },
});

async function criar(campos: Record<string, string>, visao: Visao = "completa", negocioId = negocioA) {
  const r = await servicos.cadastrarCliente(campos, deps(visao, negocioId));
  if (r.status !== "salvo") throw new Error(`esperava salvo: ${JSON.stringify(r)}`);
  return r.cliente;
}

let numero = 0;
async function venda(clienteId: string, valor: number, extra: Record<string, unknown> = {}, negocioId = negocioA) {
  numero += 1;
  return (await base.venda.create({ data: { negocioId, numero, clienteId, valorTotal: valor, registradaPorId: usuario, ...extra } })).id;
}

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  usuario = (await base.usuario.create({ data: { id: randomUUID(), nome: "Lia", email: "lia@exemplo.com" } })).id;
  negocioA = (await base.negocio.create({ data: { nome: "Semijoias da Lia" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Outra loja" } })).id;
  numero = 0;
});

afterAll(async () => {
  await base.$disconnect();
});

describe("T04 — cadastrar e editar (CA-01, CA-02, CA-04, CA-05, INV-001, INV-002)", () => {
  it("pessoa física completa: CPF e endereço normalizados, selo completo", async () => {
    const c = await criar({ nome: "Ana Lima", documento: "529.982.247-25", email: "Ana@Exemplo.com", telefone: "(11) 98765-4321", ...ENDERECO });
    expect(c).toMatchObject({ nome: "Ana Lima", faltando: [] });
    const gravado = await base.cliente.findUniqueOrThrow({ where: { id: c.id } });
    expect(gravado).toMatchObject({ tipo: "PESSOA_FISICA", documento: CPF, email: "ana@exemplo.com", telefone: "11987654321", cep: "01310100", uf: "SP" });
    const { cliente } = await consultas().detalhar(c.id);
    expect(cliente).toMatchObject({ documento: "529.982.247-25", telefone: "(11) 98765-4321", cep: "01310-100", faltando: [] });
  });

  it("empresa com CNPJ de letras, inscrições, nome fantasia e quem compra", async () => {
    const c = await criar({
      tipo: "PESSOA_JURIDICA",
      nome: "Padaria Bom Pão Ltda",
      nomeFantasia: "Bom Pão",
      documento: "12.abc.345/01de-35",
      situacaoIe: "CONTRIBUINTE",
      inscricaoEstadual: "110.042.490.114",
      inscricaoMunicipal: "1.234.567-8",
      nomeContato: "Carla",
      ...ENDERECO,
    });
    expect(c).toMatchObject({ nome: "Bom Pão", faltando: [] });
    expect(await consultas().valores(c.id)).toMatchObject({
      tipo: "PESSOA_JURIDICA",
      documento: CNPJ_LETRAS,
      inscricaoEstadual: "110042490114",
      inscricaoMunicipal: "12345678",
      nomeFantasia: "Bom Pão",
      nomeContato: "Carla",
    });
    const { clientes } = await consultas().listar();
    expect(clientes[0]).toMatchObject({ nome: "Bom Pão", razaoSocial: "Padaria Bom Pão Ltda", documento: "12.***.***/01DE-**", municipioUf: "São Paulo/SP", completoParaNota: true });
  });

  it("trocar de empresa para pessoa física descarta os campos de empresa", async () => {
    const c = await criar({ tipo: "PESSOA_JURIDICA", nome: "Bom Pão", documento: CNPJ_LETRAS, situacaoIe: "ISENTO", nomeFantasia: "BP", nomeContato: "Carla" });
    expect(await servicos.editarCliente(c.id, { tipo: "PESSOA_FISICA", nome: "Carla Souza", documento: "" }, deps())).toMatchObject({ status: "salvo" });
    expect(await base.cliente.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({
      tipo: "PESSOA_FISICA",
      documento: null,
      situacaoIe: null,
      nomeFantasia: null,
      nomeContato: null,
    });
  });

  it("e-mail e telefone antigos fora do formato ficam, se não mudarem (5.2, item 10)", async () => {
    const antigo = await base.cliente.create({ data: { negocioId: negocioA, nome: "Bia", email: "fala no insta", telefone: "ramal 21" } });
    expect(await servicos.editarCliente(antigo.id, { nome: "Bia Souza", email: "fala no insta", telefone: "ramal 21" }, deps())).toMatchObject({ status: "salvo" });
    expect(await base.cliente.findUniqueOrThrow({ where: { id: antigo.id } })).toMatchObject({ nome: "Bia Souza", email: "fala no insta", telefone: "ramal 21" });
    expect(await servicos.editarCliente(antigo.id, { nome: "Bia", email: "outro", telefone: "ramal 22" }, deps())).toEqual({
      status: "erro",
      erros: { email: M.emailInvalido, telefone: M.telefoneInvalido },
    });
  });

  it("documento repetido no negócio: a mensagem diz qual é o outro; em outro negócio, aceito", async () => {
    await criar({ nome: "Ana Lima", documento: CPF });
    expect(await servicos.cadastrarCliente({ nome: "Outra Ana", documento: "529.982.247-25" }, deps())).toEqual({
      status: "erro",
      erros: { documento: F.repetido("PESSOA_FISICA", "Ana Lima") },
    });
    // Quem só vê também recebe a mensagem, sem o documento.
    expect(await servicos.cadastrarCliente({ nome: "Outra Ana", documento: CPF }, deps("mascarada"))).toEqual({
      status: "erro",
      erros: { documento: "Já existe um cliente com este CPF: Ana Lima." },
    });
    const outra = await criar({ nome: "Ana Lima", documento: CPF }, "completa", negocioB);
    expect(outra.id).toBeTruthy();
    const segunda = await criar({ nome: "Beto" });
    expect(await servicos.editarCliente(segunda.id, { nome: "Beto", documento: CPF }, deps())).toMatchObject({ status: "erro", erros: { documento: F.repetido("PESSOA_FISICA", "Ana Lima") } });
  });

  it("duas gravações simultâneas com o mesmo documento: só uma fica (INV-002)", async () => {
    const rs = await Promise.all([1, 2, 3].map((i) => servicos.cadastrarCliente({ nome: `Cliente ${i}`, documento: CPF }, deps())));
    expect(rs.filter((r) => r.status === "salvo")).toHaveLength(1);
    expect(rs.filter((r) => r.status === "erro")).toHaveLength(2);
    expect(await base.cliente.count({ where: { documento: CPF } })).toBe(1);
  });

  it("o banco recusa o que a aplicação recusaria (restrições da migração)", async () => {
    const tenta = (data: Record<string, unknown>) => base.cliente.create({ data: { negocioId: negocioA, nome: "X", ...data } as never });
    await expect(tenta({ documento: CNPJ_LETRAS })).rejects.toThrow(); // CNPJ em pessoa física
    await expect(tenta({ tipo: "PESSOA_JURIDICA", documento: CPF })).rejects.toThrow(); // CPF em empresa
    await expect(tenta({ documento: "5299822472a" })).rejects.toThrow();
    await expect(tenta({ nomeFantasia: "Só empresa" })).rejects.toThrow();
    await expect(tenta({ tipo: "PESSOA_JURIDICA", situacaoIe: "CONTRIBUINTE" })).rejects.toThrow();
    await expect(tenta({ tipo: "PESSOA_JURIDICA", situacaoIe: "ISENTO", inscricaoEstadual: "123" })).rejects.toThrow();
    await expect(tenta({ tipo: "PESSOA_JURIDICA", inscricaoMunicipal: "12-3" })).rejects.toThrow();
    await expect(tenta({ cep: "0131010" })).rejects.toThrow();
    await expect(tenta({ uf: "XX" })).rejects.toThrow();
    await expect(tenta({ anonimizadoEm: new Date(), email: "a@b.co" })).rejects.toThrow();
    await tenta({ documento: CPF });
    await expect(tenta({ documento: CPF })).rejects.toThrow(); // único no negócio
    expect(await base.cliente.count()).toBe(1);
  });
});

describe("T05 — a máscara sai do servidor pela permissão (CA-06, CA-13, INV-003)", () => {
  async function completa() {
    return criar({ nome: "Maria Silva", documento: CPF, email: "maria.silva@exemplo.com", telefone: "11987654321", complemento: "Apto 4", ...ENDERECO });
  }

  it("a visão: Dono e Gerente veem tudo; Colaborador, mascarado; suporte, inclusive o nome", () => {
    expect(visaoDoCliente({ permissoes: PREDEFINICOES.DONO })).toBe("completa");
    expect(visaoDoCliente({ permissoes: PREDEFINICOES.GERENTE })).toBe("completa");
    expect(visaoDoCliente({ permissoes: PREDEFINICOES.COLABORADOR })).toBe("mascarada");
    expect(visaoDoCliente({ permissoes: PREDEFINICOES.DONO, modoSuporte: true })).toBe("suporte");
  });

  it("lista: documento mascarado para todos; nome mascarado só no suporte", async () => {
    await completa();
    const [dono, colaborador, suporte] = await Promise.all((["completa", "mascarada", "suporte"] as const).map((v) => consultas(v).listar()));
    expect(dono.clientes[0]).toMatchObject({ nome: "Maria Silva", documento: "***.982.247-**" });
    expect(colaborador.clientes[0]).toMatchObject({ nome: "Maria Silva", documento: "***.982.247-**" });
    expect(suporte.clientes[0]).toMatchObject({ nome: "M*** S***", documento: "***.982.247-**" });
  });

  it("detalhe: quem só vê recebe documento, e-mail e telefone mascarados e, do endereço, só município e UF", async () => {
    const c = await completa();
    const { cliente } = await consultas("mascarada").detalhar(c.id);
    expect(cliente).toMatchObject({
      nome: "Maria Silva",
      documento: "***.982.247-**",
      email: "m***@exemplo.com",
      telefone: "•••21",
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      municipio: "São Paulo",
      uf: "SP",
      faltando: [],
      visao: "mascarada",
    });
    const tudo = JSON.stringify(await consultas("mascarada").detalhar(c.id));
    for (const proibido of [CPF, "529.982", "maria.silva", "98765", "Paulista", "01310", "Bela Vista", "Apto"]) expect(tudo).not.toContain(proibido);
    const doSuporte = await consultas("suporte").detalhar(c.id);
    expect(doSuporte.cliente).toMatchObject({ nome: "M*** S***", documento: "***.982.247-**", logradouro: null, municipio: "São Paulo" });
    expect(JSON.stringify(doSuporte)).not.toContain("Maria");
    await expect(consultas("mascarada").valores(c.id)).rejects.toBeInstanceOf(ClienteNaoEncontrado);
    await expect(consultas("suporte").valores(c.id)).rejects.toBeInstanceOf(ClienteNaoEncontrado);
  });

  it("seletor da Nova venda: só o nome e o que falta para a nota", async () => {
    const c = await completa();
    const incompleto = await criar({ nome: "Bia", telefone: "11912345678" });
    const doDono = criarConsultasDeVendas(comNegocio(base, { negocioId: negocioA }), negocioA);
    expect(await doDono.clientes()).toEqual([
      { id: incompleto.id, nome: "Bia", faltando: ["CPF", "endereço"] },
      { id: c.id, nome: "Maria Silva", faltando: [] },
    ]);
    expect(JSON.stringify(await doDono.clientes())).not.toMatch(/1191234|52998/);
  });

  it("respostas das ações: o cadastro de quem só vê devolve só id, nome e o que falta", async () => {
    const r = await servicos.cadastrarCliente({ nome: "Caio", documento: CPF, telefone: "11987654321" }, deps("mascarada"));
    expect(r).toEqual({ status: "salvo", cliente: { id: expect.any(String), nome: "Caio", faltando: ["endereço"] } });
  });
});

describe("T06/T10 — suporte e permissões (INV-004, INV-007)", () => {
  it("no modo suporte, nenhuma escrita passa pelo cliente do negócio", async () => {
    const c = await criar({ nome: "Ana" });
    const doSuporte = deps("suporte");
    await expect(servicos.cadastrarCliente({ nome: "Nova" }, doSuporte)).rejects.toBeInstanceOf(SomenteLeituraNoSuporte);
    await expect(servicos.editarCliente(c.id, { nome: "Outra" }, doSuporte)).rejects.toBeInstanceOf(SomenteLeituraNoSuporte);
    await expect(servicos.excluirCliente(c.id, doSuporte)).rejects.toBeInstanceOf(SomenteLeituraNoSuporte);
    expect(await base.cliente.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ nome: "Ana" });
  });

  it("as guardas das ações: Colaborador cadastra, mas não edita nem exclui; suporte não escreve", () => {
    const membro = (papel: "DONO" | "GERENTE" | "COLABORADOR") => ({ usuarioId: usuario, negocioId: negocioA, papel, permissoes: PREDEFINICOES[papel] });
    const pede = (papel: "DONO" | "GERENTE" | "COLABORADOR", acao: "ver" | "criar" | "editar" | "excluir") =>
      autorizar(membro(papel) as never, { tipo: "permissao", modulo: "vendas", acao, origem: "acao" }).ok;
    expect((["ver", "criar", "editar", "excluir"] as const).map((a) => pede("DONO", a))).toEqual([true, true, true, true]);
    expect((["ver", "criar", "editar", "excluir"] as const).map((a) => pede("GERENTE", a))).toEqual([true, true, true, true]);
    expect((["ver", "criar", "editar", "excluir"] as const).map((a) => pede("COLABORADOR", a))).toEqual([true, true, false, false]);
  });

  it("isolamento: cliente de outro negócio não é encontrado", async () => {
    const deB = await criar({ nome: "Cliente de B", documento: CPF }, "completa", negocioB);
    await expect(consultas().detalhar(deB.id)).rejects.toBeInstanceOf(ClienteNaoEncontrado);
    expect(await servicos.editarCliente(deB.id, { nome: "Invadido" }, deps())).toEqual({ status: "erro", mensagem: F.naoEncontrado });
    expect(await servicos.excluirCliente(deB.id, deps())).toBe("naoEncontrado");
    expect(await base.cliente.findUniqueOrThrow({ where: { id: deB.id } })).toMatchObject({ nome: "Cliente de B", documento: CPF });
  });
});

describe("T07 — detalhe com as compras (OPEN-008, CA-09)", () => {
  it("da mais recente para a mais antiga, com situação, troca e total sem as canceladas", async () => {
    const c = await criar({ nome: "Ana" });
    const dia = (d: number) => new Date(Date.UTC(2026, 9, d, 15));
    const original = await venda(c.id, 100, { data: dia(10), status: "CANCELADA", canceladaEm: dia(12), canceladaPorId: usuario, motivoCancelamento: "TROCA" });
    await venda(c.id, 40, { data: dia(12), vendaOrigemId: original });
    await venda(c.id, 25.5, { data: dia(15) });
    const outro = await criar({ nome: "Bia" });
    await venda(outro.id, 999, { data: dia(16) });

    const d = await consultas().detalhar(c.id);
    expect(d.compras.map((v) => [v.numero, v.data, v.valor, v.cancelada, v.troca])).toEqual([
      [3, "15/10/2026", 25.5, false, false],
      [2, "12/10/2026", 40, false, true],
      [1, "10/10/2026", 100, true, false],
    ]);
    expect(d.quantidadeDeCompras).toBe(3);
    expect(d.totalComprado).toBe(65.5);
  });

  it(`até ${LIMITE_DE_COMPRAS} compras; a contagem e o total consideram todas`, async () => {
    const c = await criar({ nome: "Ana" });
    for (let i = 0; i < LIMITE_DE_COMPRAS + 2; i++) await venda(c.id, 10, { data: new Date(Date.now() - i * 60_000) });
    const d = await consultas().detalhar(c.id);
    expect(d.compras).toHaveLength(LIMITE_DE_COMPRAS);
    expect(d.compras[0].numero).toBe(1); // a mais recente
    expect(d.quantidadeDeCompras).toBe(LIMITE_DE_COMPRAS + 2);
    expect(d.totalComprado).toBe((LIMITE_DE_COMPRAS + 2) * 10);
  });
});

describe("T08 — excluir: apaga sem vendas, anonimiza com vendas (OPEN-005, CA-10, CA-11, INV-005, INV-011)", () => {
  const fiscais = async () => {
    const [v, p, l, c] = await Promise.all([
      base.venda.aggregate({ _sum: { valorTotal: true }, _count: true }),
      base.pagamento.count(),
      base.lancamentoFinanceiro.count(),
      base.contaPagarReceber.count(),
    ]);
    return JSON.stringify([v, p, l, c]);
  };

  it("sem vendas: o cadastro é apagado", async () => {
    const c = await criar({ nome: "Ana", documento: CPF });
    expect(await consultas().quantidadeDeCompras(c.id)).toBe(0);
    expect(await servicos.excluirCliente(c.id, deps())).toBe("apagado");
    expect(await base.cliente.count()).toBe(0);
  });

  it("com vendas: anonimiza, as vendas ficam iguais, e o cliente sai da lista, do seletor e de vendas novas", async () => {
    const c = await criar({ nome: "Maria Silva", documento: CPF, email: "maria@exemplo.com", telefone: "11987654321", ...ENDERECO });
    const esmalte = (await base.item.create({ data: { negocioId: negocioA, tipo: "PRODUTO_FISICO", nome: "Esmalte", nomeChave: "esmalte", categoria: "BELEZA", unidadeMedida: "un", custoBase: 5, precoAtual: 18, quantidadeEstoque: 10 } })).id;
    const depsDaVenda: vendas.DependenciasDaVenda = {
      vendas: criarConsultasDeVendas(comNegocio(base, { negocioId: negocioA, usuarioId: usuario }), negocioA),
      usuarioId: usuario,
      hoje: HOJE,
      agora: new Date(),
    };
    const vender = () =>
      vendas.registrarVenda({ carrinho: JSON.stringify({ id: randomUUID(), clienteId: c.id, linhas: [{ itemId: esmalte, quantidade: 1 }], pagamentos: [{ forma: "PIX", valor: 18 }] }) }, depsDaVenda);
    expect((await vender()).status).toBe("registrada");
    const vendaId = (await base.venda.findFirstOrThrow()).id;
    // A troca começa com o cliente da venda original (5.10, item 4).
    expect((await depsDaVenda.vendas.previaDoCancelamento(vendaId)).clienteId).toBe(c.id);
    const antes = await fiscais();

    expect(await servicos.excluirCliente(c.id, deps())).toBe("anonimizado");
    const anonimo = await base.cliente.findUniqueOrThrow({ where: { id: c.id } });
    expect(anonimo).toMatchObject({ nome: CLIENTE_ANONIMO, documento: null, email: null, telefone: null, cep: null, logradouro: null, numero: null, bairro: null, municipio: null, uf: null });
    expect(anonimo.anonimizadoEm).not.toBeNull();
    expect(await fiscais()).toBe(antes);
    expect((await base.venda.findUniqueOrThrow({ where: { id: vendaId } })).clienteId).toBe(c.id);
    expect((await depsDaVenda.vendas.detalhar(vendaId)).cliente).toBe(CLIENTE_ANONIMO);
    expect((await depsDaVenda.vendas.previaDoCancelamento(vendaId)).clienteId).toBeNull();

    expect((await consultas().listar()).clientes).toEqual([]);
    expect(await depsDaVenda.vendas.clientes()).toEqual([]);
    await expect(consultas().detalhar(c.id)).rejects.toBeInstanceOf(ClienteNaoEncontrado);
    expect(await vender()).toMatchObject({ status: "erro", mensagem: MENSAGENS_FLUXO_VENDA.clienteInvalido });
    expect(await servicos.excluirCliente(c.id, deps())).toBe("naoEncontrado");
    // O documento fica livre para um cadastro novo.
    expect((await criar({ nome: "Maria Silva", documento: CPF })).id).not.toBe(c.id);
  });
});

describe("T09 — busca e filtro (CA-12)", () => {
  it("por nome, nome fantasia, documento com ou sem pontuação, e-mail e telefone; e o filtro de incompletos", async () => {
    const ana = await criar({ nome: "Ana Lima", documento: CPF, email: "ana@exemplo.com", telefone: "11987654321", ...ENDERECO });
    const padaria = await criar({ tipo: "PESSOA_JURIDICA", nome: "Padaria Bom Pão Ltda", nomeFantasia: "Pão Quente", documento: CNPJ_LETRAS });
    const bia = await criar({ nome: "Beatriz Souza" });
    const busca = async (termo: string, incompletos = false) => (await consultas().listar({ busca: termo, incompletos })).clientes.map((c) => c.id);

    expect(await busca("lima")).toEqual([ana.id]);
    expect(await busca("quente")).toEqual([padaria.id]);
    expect(await busca("padaria")).toEqual([padaria.id]);
    expect(await busca("529.982.247")).toEqual([ana.id]);
    expect(await busca("12.abc.345")).toEqual([padaria.id]);
    expect(await busca("ANA@EXEMPLO")).toEqual([ana.id]);
    expect(await busca("(11) 98765")).toEqual([ana.id]);
    expect(await busca("zzz")).toEqual([]);
    expect(await busca("", true)).toEqual([bia.id, padaria.id]);
    expect(await busca("souza", true)).toEqual([bia.id]);
    expect((await consultas().listar()).clientes.map((c) => c.nome)).toEqual(["Ana Lima", "Beatriz Souza", "Pão Quente"]);
  });
});

describe("T11 — migração do contato (5.9, CA-15, INV-008)", () => {
  it("com @ vira e-mail; 10 ou 11 dígitos, telefone; outro texto, telefone como estava; anonimizados ficam vazios", async () => {
    const sql = readFileSync("prisma/migrations/20261023120000_clientes_completos/migration.sql", "utf-8");
    const atualizacoes = sql.slice(sql.indexOf("UPDATE"), sql.indexOf('ALTER TABLE "Cliente" DROP COLUMN "contato"'));
    expect(atualizacoes.match(/UPDATE "Cliente"/g)).toHaveLength(3);

    // As mesmas instruções da migração, numa tabela com as colunas de antes, num esquema à parte.
    await base.$executeRawUnsafe(`DROP SCHEMA IF EXISTS teste_migracao CASCADE`);
    await base.$executeRawUnsafe(`CREATE SCHEMA teste_migracao`);
    try {
      await base.$executeRawUnsafe(
        `CREATE TABLE teste_migracao."Cliente" ("id" int PRIMARY KEY, "contato" text, "anonimizadoEm" timestamp, "email" text, "telefone" text)`,
      );
      await base.$executeRawUnsafe(`INSERT INTO teste_migracao."Cliente" ("id", "contato", "anonimizadoEm") VALUES
        (1, ' Ana@Exemplo.com ', NULL), (2, '(11) 98765-4321', NULL), (3, '11 3333-4444', NULL),
        (4, 'insta @ana.lima', NULL), (5, 'ramal 21', NULL), (6, NULL, NULL), (7, '   ', NULL), (8, '11987654321', now())`);
      await base.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO teste_migracao`);
        for (const instrucao of atualizacoes.split(";").map((s) => s.trim()).filter((s) => s.startsWith("UPDATE"))) await tx.$executeRawUnsafe(instrucao);
      });
      const linhas = await base.$queryRawUnsafe<{ id: number; email: string | null; telefone: string | null }[]>(
        `SELECT "id", "email", "telefone" FROM teste_migracao."Cliente" ORDER BY "id"`,
      );
      expect(linhas).toEqual([
        { id: 1, email: "Ana@Exemplo.com", telefone: null },
        { id: 2, email: null, telefone: "11987654321" },
        { id: 3, email: null, telefone: "1133334444" },
        { id: 4, email: "insta @ana.lima", telefone: null },
        { id: 5, email: null, telefone: "ramal 21" },
        { id: 6, email: null, telefone: null },
        { id: 7, email: null, telefone: null },
        { id: 8, email: null, telefone: null },
      ]);
    } finally {
      await base.$executeRawUnsafe(`DROP SCHEMA IF EXISTS teste_migracao CASCADE`);
    }
  });

  it("a coluna antiga saiu e os clientes antigos viram pessoa física sem documento", async () => {
    const colunas = await base.$queryRaw<{ column_name: string }[]>`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Cliente'`;
    expect(colunas.map((c) => c.column_name)).not.toContain("contato");
    const c = await base.cliente.create({ data: { negocioId: negocioA, nome: "Antigo" } });
    expect(c).toMatchObject({ tipo: "PESSOA_FISICA", documento: null });
  });
});
