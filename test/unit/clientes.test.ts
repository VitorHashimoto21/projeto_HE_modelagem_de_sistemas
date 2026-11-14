import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { consultarCep, consultarEmpresa, MENSAGENS_FLUXO_CLIENTE as F, type DependenciasDoCliente } from "@/lib/clientes/servicos";
import { MENSAGENS_CLIENTE as M, validarCliente } from "@/lib/clientes/validacao";
import {
  completoParaNota,
  cpfValido,
  faltandoParaNota,
  formatarCep,
  formatarCpf,
  formatarDocumento,
  formatarTelefone,
  mascararDocumento,
  mascararEmailDoCliente,
  mascararTelefoneDoCliente,
  nomeDeExibicao,
  normalizarCep,
  normalizarCpf,
  normalizarTelefone,
  textoDoQueFalta,
  type DadosParaNota,
} from "@/lib/dominio/cliente";
import { cnpjValido, formatarCnpj, normalizarCnpj } from "@/lib/dominio/cnpj";
import { criarConsultaCepBrasilApi, mapearCepBrasilApi } from "@/lib/integracoes/consulta-cep";
import { criarConsultaBrasilApi, mapearEmpresaBrasilApi, type DadosDaEmpresa } from "@/lib/integracoes/consulta-cnpj";
import { validarNegocio } from "@/lib/negocio/validacao";

// SPEC-022 — testes unitários (seção 12): T01, T02, T03 e as partes unitárias de T06 e T10.

const respostaReal = JSON.parse(readFileSync("test/apoio/fixtures/brasilapi-cnpj-banco-do-brasil.json", "utf-8"));
const resposta = (status: number, corpo?: unknown) =>
  new Response(corpo === undefined ? "" : JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

describe("T01 — CPF (CA-04, INV-001)", () => {
  it.each(["52998224725", "529.982.247-25", " 123.456.789-09 "])("%s é válido", (cpf) => {
    expect(cpfValido(cpf)).toBe(true);
  });

  it.each(["52998224724", "111.111.111-11", "00000000000", "5299822472", "529982247250", "", "529.982.247-2A"])("%s é inválido", (cpf) => {
    expect(cpfValido(cpf)).toBe(false);
  });

  it("normaliza e formata", () => {
    expect(normalizarCpf("529.982.247-25")).toBe("52998224725");
    expect(normalizarCpf("123")).toBeNull();
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
    expect(formatarDocumento("PESSOA_FISICA", "52998224725")).toBe("529.982.247-25");
  });
});

describe("T02 — CNPJ numérico e com letras (OPEN-007, CA-14, INV-009)", () => {
  it("exemplo oficial da Receita (IN RFB 2.229/2024): 12.ABC.345/01DE-35", () => {
    expect(cnpjValido("12.ABC.345/01DE-35")).toBe(true);
    expect(cnpjValido("12ABC34501DE35")).toBe(true);
    expect(cnpjValido("12.abc.345/01de-35")).toBe(true); // minúsculas viram maiúsculas
    expect(normalizarCnpj("12.abc.345/01de-35")).toBe("12ABC34501DE35");
    expect(formatarCnpj("12abc34501de35")).toBe("12.ABC.345/01DE-35");
  });

  it("dígito verificador errado ou letra nos dígitos finais é recusado", () => {
    expect(cnpjValido("12ABC34501DE36")).toBe(false);
    expect(cnpjValido("12ABC34501DE3A")).toBe(false);
    expect(cnpjValido("AAAAAAAAAAAAAA")).toBe(false);
    expect(cnpjValido("12ABC34501D")).toBe(false);
  });

  it.each(["00000000000191", "00.000.000/0001-91", "11.222.333/0001-81"])("o numérico %s continua válido", (c) => {
    expect(cnpjValido(c)).toBe(true);
  });

  it("o negócio (cadastro e Dados do negócio) também aceita o CNPJ com letras (SPEC-004; T12)", () => {
    const mei = { nome: "Studio", regime: "MEI", atividadeMei: "SERVICOS" };
    expect(validarNegocio({ ...mei, cnpj: "12.abc.345/01de-35" })).toMatchObject({ ok: true, dados: { cnpj: "12ABC34501DE35" } });
    expect(validarNegocio({ ...mei, cnpj: "12.ABC.345/01DE-36" }).ok).toBe(false);
    const campos = ["src/components/negocio/formularios.tsx", "src/components/negocio/campos-fiscais.tsx"].map((f) => readFileSync(f, "utf-8"));
    for (const c of campos) expect(c).toContain('autoCapitalize="characters"'); // teclado de texto no celular (RNF01)
  });

  it("formatação pelo tipo", () => {
    expect(formatarDocumento("PESSOA_JURIDICA", "11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("T03 — telefone, CEP, e-mail, máscaras e selo (CA-01, CA-02, CA-05, INV-010)", () => {
  it("telefone: DDD válido, 10 ou 11 dígitos, sem o 55 do país", () => {
    expect(normalizarTelefone("(11) 98765-4321")).toBe("11987654321");
    expect(normalizarTelefone("+55 11 98765-4321")).toBe("11987654321");
    expect(normalizarTelefone("61 3493-9002")).toBe("6134939002");
    expect(normalizarTelefone("(20) 98765-4321")).toBeNull(); // DDD inexistente
    expect(normalizarTelefone("98765-4321")).toBeNull();
    expect(normalizarTelefone("ramal 21")).toBeNull();
    expect(formatarTelefone("11987654321")).toBe("(11) 98765-4321");
    expect(formatarTelefone("6134939002")).toBe("(61) 3493-9002");
    expect(formatarTelefone("ramal 21")).toBe("ramal 21"); // valor antigo fica como está
  });

  it("CEP com 8 dígitos", () => {
    expect(normalizarCep("01310-100")).toBe("01310100");
    expect(normalizarCep("0131010")).toBeNull();
    expect(formatarCep("01310100")).toBe("01310-100");
  });

  it("máscaras de quem só vê (OPEN-002)", () => {
    expect(mascararDocumento("PESSOA_FISICA", "52998224725")).toBe("***.982.247-**");
    expect(mascararDocumento("PESSOA_JURIDICA", "11222333000181")).toBe("11.***.***/0001-**");
    expect(mascararDocumento("PESSOA_JURIDICA", "12ABC34501DE35")).toBe("12.***.***/01DE-**");
    expect(mascararEmailDoCliente("ana.cliente@exemplo.com")).toBe("a***@exemplo.com");
    expect(mascararEmailDoCliente("sem-arroba")).toBe("•••ba");
    expect(mascararTelefoneDoCliente("11987654321")).toBe("•••21");
  });

  const pf: DadosParaNota = {
    tipo: "PESSOA_FISICA",
    nome: "Ana",
    documento: "52998224725",
    situacaoIe: null,
    inscricaoEstadual: null,
    cep: "01310100",
    logradouro: "Avenida Paulista",
    numero: "1000",
    bairro: "Bela Vista",
    municipio: "São Paulo",
    uf: "SP",
  };

  it("pessoa física: nome, CPF e endereço completo; complemento não conta", () => {
    expect(completoParaNota(pf)).toBe(true);
    expect(faltandoParaNota({ ...pf, documento: null })).toEqual(["CPF"]);
    expect(faltandoParaNota({ ...pf, documento: null, cep: null, logradouro: null, numero: null, bairro: null, municipio: null, uf: null })).toEqual(["CPF", "endereço"]);
    expect(faltandoParaNota({ ...pf, numero: " ", uf: null })).toEqual(["número do endereço", "UF"]);
    expect(textoDoQueFalta(["CPF", "número do endereço"])).toBe("Faltam: CPF, número do endereço");
    expect(textoDoQueFalta(["CPF"])).toBe("Falta: CPF");
  });

  it("empresa: CNPJ e a situação na inscrição estadual (com o número, se contribuinte)", () => {
    const pj: DadosParaNota = { ...pf, tipo: "PESSOA_JURIDICA", nome: "Padaria Bom Pão Ltda", documento: "11222333000181", situacaoIe: "ISENTO" };
    expect(completoParaNota(pj)).toBe(true);
    expect(faltandoParaNota({ ...pj, situacaoIe: null })).toEqual(["inscrição estadual"]);
    expect(faltandoParaNota({ ...pj, situacaoIe: "CONTRIBUINTE" })).toEqual(["inscrição estadual"]);
    expect(completoParaNota({ ...pj, situacaoIe: "CONTRIBUINTE", inscricaoEstadual: "110042490114" })).toBe(true);
    expect(faltandoParaNota({ ...pj, documento: null })).toEqual(["CNPJ"]);
  });

  it("nome de exibição: na empresa, o nome fantasia quando houver (OPEN-009)", () => {
    expect(nomeDeExibicao({ tipo: "PESSOA_JURIDICA", nome: "Padaria Bom Pão Ltda", nomeFantasia: "Bom Pão" })).toBe("Bom Pão");
    expect(nomeDeExibicao({ tipo: "PESSOA_JURIDICA", nome: "Padaria Bom Pão Ltda", nomeFantasia: null })).toBe("Padaria Bom Pão Ltda");
    expect(nomeDeExibicao({ tipo: "PESSOA_FISICA", nome: "Ana", nomeFantasia: "ignorado" })).toBe("Ana");
  });
});

describe("validação do cadastro (5.2, 5.8)", () => {
  it("só o nome é obrigatório; pessoa física é o padrão", () => {
    expect(validarCliente({ nome: "  Ana   Maria " })).toMatchObject({ ok: true, dados: { tipo: "PESSOA_FISICA", nome: "Ana Maria", documento: null, email: null, telefone: null, cep: null } });
    expect(validarCliente({ nome: " " })).toEqual({ ok: false, erros: { nome: M.nomeObrigatorio } });
    expect(validarCliente({ tipo: "PESSOA_JURIDICA", nome: "" })).toEqual({ ok: false, erros: { nome: M.razaoSocialObrigatoria } });
    expect(validarCliente({ nome: "A".repeat(121) })).toMatchObject({ ok: false, erros: { nome: M.nomeLongo(120) } });
    expect(validarCliente({ tipo: "PESSOA_JURIDICA", nome: "A".repeat(150) }).ok).toBe(true);
    expect(validarCliente({ tipo: "OUTRO", nome: "A" })).toMatchObject({ ok: false, erros: { tipo: M.tipoInvalido } });
  });

  it("documento coerente com o tipo (INV-001)", () => {
    expect(validarCliente({ nome: "Ana", documento: "529.982.247-25" })).toMatchObject({ ok: true, dados: { documento: "52998224725" } });
    expect(validarCliente({ nome: "Ana", documento: "11.222.333/0001-81" })).toMatchObject({ ok: false, erros: { documento: M.cpfInvalido } });
    expect(validarCliente({ tipo: "PESSOA_JURIDICA", nome: "X", documento: "529.982.247-25" })).toMatchObject({ ok: false, erros: { documento: M.cnpjInvalido } });
    expect(validarCliente({ tipo: "PESSOA_JURIDICA", nome: "X", documento: "12.abc.345/01de-35" })).toMatchObject({ ok: true, dados: { documento: "12ABC34501DE35" } });
  });

  it("empresa: inscrições, nome fantasia e quem compra; na pessoa física, esses campos são descartados", () => {
    const pj = { tipo: "PESSOA_JURIDICA", nome: "Padaria", nomeFantasia: "Bom Pão", nomeContato: "Carla", inscricaoMunicipal: "1.234.567-8" };
    expect(validarCliente({ ...pj, situacaoIe: "CONTRIBUINTE", inscricaoEstadual: "110.042.490.114" })).toMatchObject({
      ok: true,
      dados: { situacaoIe: "CONTRIBUINTE", inscricaoEstadual: "110042490114", inscricaoMunicipal: "12345678", nomeFantasia: "Bom Pão", nomeContato: "Carla" },
    });
    expect(validarCliente({ ...pj, situacaoIe: "CONTRIBUINTE" })).toMatchObject({ ok: false, erros: { inscricaoEstadual: M.inscricaoEstadualObrigatoria } });
    expect(validarCliente({ ...pj, situacaoIe: "CONTRIBUINTE", inscricaoEstadual: "1".repeat(15) })).toMatchObject({ ok: false, erros: { inscricaoEstadual: M.inscricaoEstadualInvalida } });
    expect(validarCliente({ ...pj, situacaoIe: "ISENTO", inscricaoEstadual: "123" })).toMatchObject({ ok: true, dados: { situacaoIe: "ISENTO", inscricaoEstadual: null } });
    expect(validarCliente({ ...pj, situacaoIe: "TALVEZ" })).toMatchObject({ ok: false, erros: { situacaoIe: M.situacaoIeInvalida } });
    expect(validarCliente({ ...pj, inscricaoMunicipal: "1".repeat(21) })).toMatchObject({ ok: false, erros: { inscricaoMunicipal: M.inscricaoMunicipalInvalida } });
    expect(validarCliente({ ...pj, tipo: "PESSOA_FISICA", situacaoIe: "CONTRIBUINTE", inscricaoEstadual: "1" })).toMatchObject({
      ok: true,
      dados: { tipo: "PESSOA_FISICA", situacaoIe: null, inscricaoEstadual: null, inscricaoMunicipal: null, nomeFantasia: null, nomeContato: null },
    });
  });

  it("contato e endereço", () => {
    expect(validarCliente({ nome: "Ana", email: "Ana@Exemplo.com", telefone: "(11) 98765-4321", cep: "01310-100", uf: "sp" })).toMatchObject({
      ok: true,
      dados: { email: "ana@exemplo.com", telefone: "11987654321", cep: "01310100", uf: "SP" },
    });
    expect(validarCliente({ nome: "Ana", email: "ana@", telefone: "4321", cep: "123", uf: "XX" })).toEqual({
      ok: false,
      erros: { email: M.emailInvalido, telefone: M.telefoneInvalido, cep: M.cepInvalido, uf: M.ufInvalida },
    });
    expect(validarCliente({ nome: "Ana", numero: "1".repeat(31), logradouro: "R".repeat(121) })).toMatchObject({
      ok: false,
      erros: { numero: M.campoLongo(30), logradouro: M.campoLongo(120) },
    });
  });

  it("valor antigo fora do formato é mantido se não mudar (5.2, item 10)", () => {
    const atuais = { email: "fala comigo no insta", telefone: "ramal 21" };
    expect(validarCliente({ nome: "Ana", email: "fala comigo no insta", telefone: "ramal 21" }, atuais)).toMatchObject({
      ok: true,
      dados: { email: "fala comigo no insta", telefone: "ramal 21" },
    });
    expect(validarCliente({ nome: "Ana", email: "outro texto", telefone: "ramal 22" }, atuais)).toMatchObject({
      ok: false,
      erros: { email: M.emailInvalido, telefone: M.telefoneInvalido },
    });
  });
});

describe("T06 — consultas de CEP e CNPJ (adaptador falso; INV-004)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("CNPJ: endereço, telefone e e-mail públicos; nunca os sócios", () => {
    const d = mapearEmpresaBrasilApi({ ...respostaReal, email: "Contato@Exemplo.com" });
    expect(d).toEqual({
      razaoSocial: "BANCO DO BRASIL SA",
      nomeFantasia: "DIRECAO GERAL",
      cep: "70040912",
      logradouro: "Saun Quadra 5 Bloco B Torre I, II, III",
      numero: "S/N",
      complemento: null,
      bairro: null,
      municipio: "Brasilia",
      uf: "DF",
      telefone: "6134939002",
      email: "contato@exemplo.com",
    });
    expect(JSON.stringify(d)).not.toContain(respostaReal.qsa[0].nome_socio);
    expect(mapearEmpresaBrasilApi({ razao_social: "X", logradouro: "AVENIDA DOM PEDRO II", bairro: "VILA XAVIER", municipio: "SAO JOSE DOS CAMPOS" })).toMatchObject({
      logradouro: "Avenida Dom Pedro II",
      bairro: "Vila Xavier",
      municipio: "Sao Jose dos Campos",
    });
    expect(mapearEmpresaBrasilApi({ razao_social: "X", descricao_tipo_de_logradouro: "RUA", logradouro: "DAS FLORES", ddd_telefone_1: "123" })).toMatchObject({
      logradouro: "Rua das Flores",
      telefone: null,
    });
  });

  it("CEP: rua, bairro, município e UF", () => {
    expect(mapearCepBrasilApi("01310100", { street: "Avenida Paulista", neighborhood: "Bela Vista", city: "São Paulo", state: "SP" })).toEqual({
      cep: "01310100",
      logradouro: "Avenida Paulista",
      bairro: "Bela Vista",
      municipio: "São Paulo",
      uf: "SP",
    });
  });

  it("as URLs levam só o CEP ou o CNPJ, na base configurável", async () => {
    const buscar = vi.fn().mockResolvedValue(resposta(200, respostaReal));
    await criarConsultaBrasilApi({ fetch: buscar, base: "http://localhost:4010" }).consultarEmpresa("12ABC34501DE35");
    await criarConsultaCepBrasilApi({ fetch: buscar }).consultar("01310100");
    expect(buscar.mock.calls.map((c) => c[0])).toEqual(["http://localhost:4010/cnpj/v1/12ABC34501DE35", "https://brasilapi.com.br/api/cep/v1/01310100"]);
  });

  it("não encontrado e indisponível", async () => {
    expect(await criarConsultaCepBrasilApi({ fetch: vi.fn().mockResolvedValue(resposta(404)) }).consultar("00000000")).toEqual({ ok: false, erro: "NaoEncontrado" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await criarConsultaBrasilApi({ fetch: vi.fn().mockRejectedValue(new TypeError("fetch failed")) }).consultarEmpresa("11222333000181")).toEqual({ ok: false, erro: "Indisponivel" });
  });

  const deps = (extra: Partial<DependenciasDoCliente> = {}): DependenciasDoCliente => ({
    clientes: { criar: vi.fn(), editar: vi.fn(), excluir: vi.fn(), atuais: vi.fn() },
    consultaCep: { consultar: vi.fn(async (cep: string) => ({ ok: true as const, endereco: { cep, logradouro: "Avenida Paulista", bairro: "Bela Vista", municipio: "São Paulo", uf: "SP" } })) },
    consultaCnpj: { consultarEmpresa: vi.fn(async () => ({ ok: false as const, erro: "NaoEncontrado" as const })) },
    ...extra,
  });

  it("serviços: CEP e CNPJ inválidos não saem do sistema; falha vira o aviso para preencher à mão", async () => {
    const d = deps();
    expect(await consultarCep("123", d)).toEqual({ status: "erro", mensagem: M.cepInvalido });
    expect(await consultarEmpresa("529.982.247-25", d)).toEqual({ status: "erro", mensagem: M.cnpjInvalido }); // um CPF nunca é consultado
    expect(await consultarEmpresa("11.222.333/0001-80", d)).toEqual({ status: "erro", mensagem: M.cnpjInvalido });
    expect(d.consultaCep.consultar).not.toHaveBeenCalled();
    expect(d.consultaCnpj.consultarEmpresa).not.toHaveBeenCalled();
    expect(await consultarCep("01310-100", d)).toMatchObject({ status: "ok", endereco: { municipio: "São Paulo" } });
    expect(d.consultaCep.consultar).toHaveBeenCalledWith("01310100");
    expect(await consultarEmpresa("12.abc.345/01de-35", d)).toEqual({ status: "erro", mensagem: F.cnpjIndisponivel });
    expect(d.consultaCnpj.consultarEmpresa).toHaveBeenCalledWith("12ABC34501DE35");
    const semCep = deps({ consultaCep: { consultar: vi.fn(async () => ({ ok: false as const, erro: "NaoEncontrado" as const })) } });
    expect(await consultarCep("99999999", semCep)).toEqual({ status: "erro", mensagem: F.cepNaoEncontrado });
  });

  it("nenhum adaptador recebe CPF: as integrações não importam nada de CPF", () => {
    for (const arquivo of ["src/lib/integracoes/consulta-cep.ts", "src/lib/integracoes/consulta-cnpj.ts", "src/lib/clientes/servicos.ts"]) {
      expect(readFileSync(arquivo, "utf-8")).not.toMatch(/normalizarCpf|cpfValido/);
    }
  });
});

describe("Endereço do CNPJ completado pelo CEP (homologação, observação 1)", () => {
  const empresa: DadosDaEmpresa = {
    razaoSocial: "PADARIA BOM PAO LTDA",
    nomeFantasia: null,
    cep: "01310100",
    logradouro: "Avenida Sao Joao Quadra 5 Bloco B",
    numero: "120",
    complemento: null,
    bairro: "Centro",
    municipio: "Sao Paulo",
    uf: "SP",
    telefone: null,
    email: null,
  };
  const deps = (cep: Awaited<ReturnType<DependenciasDoCliente["consultaCep"]["consultar"]>>, dados = empresa): DependenciasDoCliente => ({
    clientes: { criar: vi.fn(), editar: vi.fn(), excluir: vi.fn(), atuais: vi.fn() },
    consultaCep: { consultar: vi.fn(async () => cep) },
    consultaCnpj: { consultarEmpresa: vi.fn(async () => ({ ok: true as const, dados })) },
  });
  const doCep = (endereco: Partial<{ logradouro: string | null; bairro: string | null; municipio: string | null; uf: string | null }>) => ({
    ok: true as const,
    endereco: { cep: "01310100", logradouro: null, bairro: null, municipio: null, uf: null, ...endereco },
  });

  it("município, bairro e UF vêm do CEP, com acento; a rua também, mantendo o que vem depois dela", async () => {
    expect(await consultarEmpresa("11222333000181", deps(doCep({ logradouro: "Avenida São João" }), { ...empresa, logradouro: "Avenida Sao Joaozinho" }))).toMatchObject({
      dados: { logradouro: "Avenida Sao Joaozinho" }, // outra rua: só vale em palavras inteiras
    });
    const d = deps(doCep({ logradouro: "Avenida São João", bairro: "República", municipio: "São Paulo", uf: "SP" }));
    const r = await consultarEmpresa("11.222.333/0001-81", d);
    expect(r).toMatchObject({ status: "ok", dados: { logradouro: "Avenida São João Quadra 5 Bloco B", bairro: "República", municipio: "São Paulo", uf: "SP", numero: "120" } });
    expect(d.consultaCep.consultar).toHaveBeenCalledWith("01310100");
  });

  it("rua diferente fica a do CNPJ; CEP sem rua (de cidade pequena) mantém a rua e o bairro do CNPJ", async () => {
    expect(await consultarEmpresa("11222333000181", deps(doCep({ logradouro: "Rua das Flores", municipio: "São Paulo" })))).toMatchObject({
      dados: { logradouro: "Avenida Sao Joao Quadra 5 Bloco B", municipio: "São Paulo" },
    });
    expect(await consultarEmpresa("11222333000181", deps(doCep({ municipio: "Pirapora do Bom Jesus", uf: "SP" })))).toMatchObject({
      dados: { logradouro: "Avenida Sao Joao Quadra 5 Bloco B", bairro: "Centro", municipio: "Pirapora do Bom Jesus" },
    });
  });

  it("sem CEP no CNPJ, não consulta; se a consulta do CEP falhar, ficam os dados do CNPJ", async () => {
    const semCep = deps(doCep({ municipio: "São Paulo" }), { ...empresa, cep: null });
    expect(await consultarEmpresa("11222333000181", semCep)).toMatchObject({ dados: { municipio: "Sao Paulo" } });
    expect(semCep.consultaCep.consultar).not.toHaveBeenCalled();
    expect(await consultarEmpresa("11222333000181", deps({ ok: false, erro: "Indisponivel" }))).toEqual({ status: "ok", dados: empresa });
  });
});

describe("T10 — permissões das ações (INV-007)", () => {
  const acoes = readFileSync("src/lib/clientes/acoes.ts", "utf-8");
  it.each([
    ["acaoCadastrarCliente", "criar"],
    ["acaoEditarCliente", "editar"],
    ["acaoExcluirCliente", "excluir"],
  ])("%s exige Vendas — %s", (nome, acao) => {
    expect(acoes).toMatch(new RegExp(`export const ${nome} = acaoComPermissao\\("vendas", "${acao}"`));
  });

  it("consultas de CEP e CNPJ: a guarda pede Vendas — ver, e o corpo exige criar ou editar", () => {
    expect(acoes).toMatch(/export const acaoConsultarCep = acaoComPermissao\("vendas", "ver", async \(membro, cep: string\): Promise<EstadoDoCep> => \{\n\s+if \(!podeConsultar\(membro\)\)/);
    expect(acoes).toMatch(/export const acaoConsultarEmpresa = acaoComPermissao\("vendas", "ver", async \(membro, cnpj: string\): Promise<EstadoDaEmpresa> => \{\n\s+if \(!podeConsultar\(membro\)\)/);
    expect(acoes).toMatch(/const podeConsultar = \(m: ContextoDoMembro\) => pode\(m\.permissoes, "vendas", "criar"\) \|\| pode\(m\.permissoes, "vendas", "editar"\);/);
  });
});
