import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MENSAGENS_CLIENTE, validarCliente } from "@/lib/clientes/validacao";
import { exibicaoDoCadastro } from "@/lib/db/clientes";
import { visaoDoFornecedor } from "@/lib/db/fornecedores";
import type { ContaExportada } from "@/lib/db/relatorios";
import {
  filtraPagamentos,
  lerFiltrosDasContas,
  MENSAGENS_DOS_FILTROS as F,
  parametrosDosFiltros,
  quantidadeDeFiltros,
  rotuloDaForma,
  SEM_FILTROS,
} from "@/lib/dominio/contas";
import { MATRIZ_COMPLETA, PREDEFINICOES } from "@/lib/dominio/permissoes";
import { MENSAGENS_FINANCEIRO as M, validarConta, validarDespesa, validarPagamento, validarVinculo } from "@/lib/financeiro/validacao";
import { csvDaTabela } from "@/lib/relatorios/arquivos";
import { tabelaDeContas } from "@/lib/relatorios/tabelas";

// SPEC-026 — testes unitários (seção 12): T01, T02 e a parte unitária do T09, mais a guarda das ações.

const HOJE = "2026-11-01";
const UUID = "8f14e45f-ceea-467a-9575-0d6f0a1c1d2e";
const CNPJ = "11222333000181";

describe("T01 — validação, máscara e selo do fornecedor (CA-01, CA-03, CA-04, INV-004, INV-005)", () => {
  it("só o nome é obrigatório, com a mensagem do fornecedor; o CNPJ é validado", () => {
    expect(validarCliente({ tipo: "PESSOA_FISICA", nome: "" }, null, "fornecedor")).toMatchObject({ ok: false, erros: { nome: MENSAGENS_CLIENTE.nomeDoFornecedorObrigatorio } });
    expect(validarCliente({ tipo: "PESSOA_FISICA", nome: "" })).toMatchObject({ ok: false, erros: { nome: MENSAGENS_CLIENTE.nomeObrigatorio } });
    expect(validarCliente({ tipo: "PESSOA_JURIDICA", nome: "" }, null, "fornecedor")).toMatchObject({ ok: false, erros: { nome: MENSAGENS_CLIENTE.razaoSocialObrigatoria } });
    expect(validarCliente({ tipo: "PESSOA_JURIDICA", nome: "Embalagens Exemplo Ltda", documento: "11.222.333/0001-00" }, null, "fornecedor")).toMatchObject({
      ok: false,
      erros: { documento: MENSAGENS_CLIENTE.cnpjInvalido },
    });
    expect(validarCliente({ tipo: "PESSOA_JURIDICA", nome: "Embalagens Exemplo Ltda", documento: "11.222.333/0001-81" }, null, "fornecedor")).toMatchObject({
      ok: true,
      dados: { documento: CNPJ },
    });
  });

  it("a visão sai das permissões do Financeiro: editar vê tudo, só ver é mascarado, suporte mascara o nome", () => {
    const soVer = { ...MATRIZ_COMPLETA, financeiro: { ver: true, criar: false, editar: false, excluir: false } };
    expect(visaoDoFornecedor({ permissoes: MATRIZ_COMPLETA })).toBe("completa");
    expect(visaoDoFornecedor({ permissoes: soVer })).toBe("mascarada");
    expect(visaoDoFornecedor({ permissoes: PREDEFINICOES.COLABORADOR })).toBe("mascarada");
    expect(visaoDoFornecedor({ permissoes: MATRIZ_COMPLETA, modoSuporte: true })).toBe("suporte");
  });

  it("máscara e selo: o mesmo cadastro do cliente (OPEN-002, OPEN-003)", () => {
    const linha = {
      id: UUID,
      tipo: "PESSOA_JURIDICA" as const,
      nome: "Embalagens Exemplo Ltda",
      nomeFantasia: "Embalagens Exemplo",
      documento: CNPJ,
      situacaoIe: "ISENTO" as const,
      inscricaoEstadual: null,
      inscricaoMunicipal: null,
      nomeContato: "Bia",
      email: "contato@exemplo.com",
      telefone: "11987654321",
      cep: "01310100",
      logradouro: "Avenida Paulista",
      numero: "1000",
      complemento: null,
      bairro: "Bela Vista",
      municipio: "São Paulo",
      uf: "SP",
    };
    const completa = exibicaoDoCadastro("completa").paraDetalhe(linha);
    expect(completa).toMatchObject({ documento: "11.222.333/0001-81", telefone: "(11) 98765-4321", logradouro: "Avenida Paulista", faltando: [] });
    const mascarada = exibicaoDoCadastro("mascarada").paraDetalhe(linha);
    expect(mascarada.documento).not.toContain("222.333");
    expect(mascarada).toMatchObject({ nome: "Embalagens Exemplo Ltda", logradouro: null, numero: null, cep: null, municipio: "São Paulo", uf: "SP" });
    const suporte = exibicaoDoCadastro("suporte").paraLista(linha);
    expect(suporte.nome).not.toBe("Embalagens Exemplo");
    expect(exibicaoDoCadastro("completa").paraLista({ ...linha, numero: null }).completoParaNota).toBe(false);
  });
});

describe("T02 — filtros das contas, forma e vínculo (CA-06, CA-10, CA-13)", () => {
  it("lê os filtros do endereço; ignora valores desconhecidos", () => {
    const { filtros, erros } = lerFiltrosDasContas({
      busca: "  NF   1234 ",
      vencimentoDe: "2026-10-01",
      vencimentoAte: "2026-10-31",
      pagamentoDe: "2026-10-01",
      pessoa: UUID.toUpperCase(),
      forma: "PIX",
      categoria: "FORNECEDORES",
      origem: "despesa",
    });
    expect(erros).toEqual({});
    expect(filtros).toEqual({
      busca: "NF 1234",
      vencimentoDe: "2026-10-01",
      vencimentoAte: "2026-10-31",
      pagamentoDe: "2026-10-01",
      pagamentoAte: null,
      pessoaId: UUID,
      forma: "PIX",
      categoria: "FORNECEDORES",
      origem: "despesa",
    });
    expect(quantidadeDeFiltros(filtros)).toBe(7);
    expect(filtraPagamentos(filtros)).toBe(true);
    expect(lerFiltrosDasContas({ pessoa: "x", forma: "CHEQUE", categoria: "LUXO", origem: "outra" }).filtros).toEqual(SEM_FILTROS);
    expect(lerFiltrosDasContas({ forma: "NAO_INFORMADA" }).filtros.forma).toBe("NAO_INFORMADA");
    expect(parametrosDosFiltros({ ...SEM_FILTROS, forma: "BOLETO", pessoaId: UUID })).toEqual({ forma: "BOLETO", pessoa: UUID });
  });

  it("período invertido e data inválida voltam com a mensagem e não filtram", () => {
    const r = lerFiltrosDasContas({ vencimentoDe: "2026-10-31", vencimentoAte: "2026-10-01", pagamentoDe: "2026-02-30" });
    expect(r.erros).toEqual({ vencimento: F.periodoInvertido, pagamento: F.dataInvalida });
    expect(r.filtros).toMatchObject({ vencimentoDe: null, vencimentoAte: null, pagamentoDe: null });
    expect(quantidadeDeFiltros(r.filtros)).toBe(0);
  });

  it("forma do pagamento obrigatória (OPEN-008)", () => {
    expect(validarPagamento({ valor: "100", data: HOJE }, HOJE)).toMatchObject({ ok: false, erros: { forma: M.formaObrigatoria } });
    expect(validarPagamento({ valor: "100", data: HOJE, forma: "CHEQUE" }, HOJE)).toMatchObject({ ok: false, erros: { forma: M.formaObrigatoria } });
    expect(validarPagamento({ valor: "100", data: HOJE, forma: "BOLETO" }, HOJE)).toEqual({ ok: true, dados: { valorCentavos: 10000, dia: HOJE, forma: "BOLETO" } });
    expect(rotuloDaForma(null)).toBe("Não informada");
    expect(rotuloDaForma("DEBITO")).toBe("Cartão de débito");
  });

  it("conta, correção e despesa: fornecedor ou cliente da lista e nº do documento até 40 caracteres", () => {
    const conta = { tipo: "PAGAR", descricao: "Embalagens", categoria: "FORNECEDORES", valor: "300", vencimento: HOJE };
    expect(validarConta({ ...conta, pessoa: UUID, numeroDocumento: " NF  1234 " }, HOJE)).toMatchObject({ ok: true, dados: { pessoaId: UUID, numeroDocumento: "NF 1234" } });
    expect(validarConta(conta, HOJE)).toMatchObject({ ok: true, dados: { pessoaId: null, numeroDocumento: null } });
    expect(validarConta({ ...conta, pessoa: "abc" }, HOJE)).toMatchObject({ ok: false, erros: { pessoa: M.pessoaInvalida } });
    expect(validarVinculo({ numeroDocumento: "x".repeat(41) })).toMatchObject({ ok: false, erros: { numeroDocumento: M.numeroDocumentoLongo } });
    expect(validarVinculo({ pessoa: "", numeroDocumento: "" })).toEqual({ ok: true, dados: { pessoaId: null, numeroDocumento: null } });
    expect(validarDespesa({ descricao: "Aluguel", valor: "1200", diaVencimento: "5", fornecedor: UUID })).toMatchObject({ ok: true, dados: { fornecedorId: UUID } });
  });
});

describe("T09 (unitário) — relatório de Contas com as colunas novas (CA-15)", () => {
  const conta = (extra: Partial<ContaExportada>): ContaExportada => ({
    tipo: "PAGAR",
    descricao: "Embalagens",
    categoria: "FORNECEDORES",
    vencimento: new Date("2026-10-10T15:00:00Z"),
    status: "QUITADA",
    totalCentavos: 15000,
    pagoCentavos: 15000,
    pessoa: "Embalagens Exemplo",
    numeroDocumento: "1234",
    pagamentos: [
      { data: new Date("2026-10-05T15:00:00Z"), forma: "PIX", valorCentavos: 10000 },
      { data: new Date("2026-10-20T15:00:00Z"), forma: "BOLETO", valorCentavos: 5000 },
    ],
    ...extra,
  });

  it("fornecedor ou cliente, nº do documento e os pagamentos numa coluna só", () => {
    const t = tabelaDeContas([conta({}), conta({ tipo: "RECEBER", pessoa: null, numeroDocumento: null, status: "ABERTA", pagoCentavos: 0, pagamentos: [{ data: new Date("2026-09-30T15:00:00Z"), forma: null, valorCentavos: 0 }] })]);
    expect(t.colunas.map((c) => c.titulo)).toEqual(["Tipo", "Descrição", "Fornecedor/Cliente", "Nº do documento", "Categoria", "Vencimento", "Situação", "Total", "Pago", "Restante", "Pagamentos"]);
    expect(t.colunas.reduce((s, c) => s + c.largura, 0)).toBeCloseTo(1, 5);
    expect(t.linhas[0].slice(2, 4)).toEqual(["Embalagens Exemplo", "1234"]);
    expect(t.linhas[0][10]).toBe("05/10/2026 Pix 100,00 + 20/10/2026 Boleto 50,00");
    expect(t.linhas[1].slice(2, 4)).toEqual(["", ""]);
    expect(t.linhas[1][10]).toBe("30/09/2026 Não informada 0,00");
    expect(t.totais).toEqual(["Total", "A receber 150,00", "A pagar 0,00", "", "", "", "", "", "", "", ""]);
    const csv = csvDaTabela(t).replace(/^﻿/, "").split("\r\n");
    expect(csv[0]).toBe("Tipo;Descrição;Fornecedor/Cliente;Nº do documento;Categoria;Vencimento;Situação;Total;Pago;Restante;Pagamentos");
  });
});

describe("T07 (parte estática) — guardas das ações (CA-04, CA-07, CA-16)", () => {
  it("fornecedores com as permissões do Financeiro; a correção do vínculo pede editar", () => {
    const fornecedores = readFileSync("src/lib/fornecedores/acoes.ts", "utf-8");
    expect(fornecedores).toMatch(/acaoCadastrarFornecedor = acaoComPermissao\("financeiro", "criar"/);
    expect(fornecedores).toMatch(/acaoEditarFornecedor = acaoComPermissao\("financeiro", "editar"/);
    expect(fornecedores).toMatch(/acaoExcluirFornecedor = acaoComPermissao\("financeiro", "excluir"/);
    expect(readFileSync("src/lib/financeiro/acoes.ts", "utf-8")).toMatch(/acaoCorrigirVinculo = acaoComPermissao\("financeiro", "editar"/);
  });

  it("o \"Novo cliente\" na conta exige Vendas — criar; nada se cadastra no suporte", () => {
    const opcoes = readFileSync("src/lib/financeiro/opcoes.ts", "utf-8");
    expect(opcoes).toMatch(/podeCriarCliente: !suporte && pode\(membro\.permissoes, "vendas", "criar"\)/);
    expect(opcoes).toMatch(/podeCriarFornecedor: !suporte && pode\(membro\.permissoes, "financeiro", "criar"\)/);
  });
});
