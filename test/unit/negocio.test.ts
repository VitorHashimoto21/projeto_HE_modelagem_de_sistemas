import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cnpjValido, formatarCnpj, normalizarCnpj, removerCpfDaRazaoSocial } from "@/lib/dominio/cnpj";
import { criarConsultaBrasilApi, mapearRespostaBrasilApi, type DadosDoCnpj } from "@/lib/integracoes/consulta-cnpj";
import { atividadeMeiDoAnexo, MENSAGENS_ENQUADRAMENTO, sugerirEnquadramento } from "@/lib/negocio/enquadramento";
import { MENSAGENS_NEGOCIO as M, validarNegocio } from "@/lib/negocio/validacao";

// SPEC-004 — testes unitários (seção 12).

const respostaReal = JSON.parse(readFileSync("test/apoio/fixtures/brasilapi-cnpj-banco-do-brasil.json", "utf-8"));

describe("T01 — CNPJ (INV-003)", () => {
  it.each(["00000000000191", "00.000.000/0001-91", "11.222.333/0001-81"])("%s é válido", (c) => {
    expect(cnpjValido(c)).toBe(true);
  });

  it.each(["00000000000192", "11.222.333/0001-80", "11111111111111", "123", "", "0000000000019"])("%s é inválido", (c) => {
    expect(cnpjValido(c)).toBe(false);
  });

  it("normaliza e formata", () => {
    expect(normalizarCnpj("00.000.000/0001-91")).toBe("00000000000191");
    expect(normalizarCnpj("123")).toBeNull();
    expect(formatarCnpj("00000000000191")).toBe("00.000.000/0001-91");
  });

  it("retira o CPF do fim da razão social do MEI (OPEN-004)", () => {
    expect(removerCpfDaRazaoSocial("MARIA DA SILVA 12345678901")).toBe("MARIA DA SILVA");
    expect(removerCpfDaRazaoSocial("MARIA DA SILVA 123.456.789-01")).toBe("MARIA DA SILVA");
    expect(removerCpfDaRazaoSocial("PADARIA BOM PAO LTDA")).toBe("PADARIA BOM PAO LTDA");
    expect(removerCpfDaRazaoSocial("LOJA 2000 COMERCIO")).toBe("LOJA 2000 COMERCIO");
  });
});

describe("T02 — validação por regime (5.3, INV-002)", () => {
  const mei = { nome: "Studio Gisele", regime: "MEI", cnpj: "00.000.000/0001-91", atividadeMei: "SERVICOS" };
  const simples = { nome: "Dev Lucas", regime: "SIMPLES_NACIONAL", cnpj: "00000000000191", anexoSimples: "V", sujeitoFatorR: "on", cnaePrincipal: "6201501" };
  const autonomo = { nome: "Thiago Personal", regime: "AUTONOMO", impostoPercentual: "6,5" };

  it("aceita cada regime com os campos certos e normaliza", () => {
    expect(validarNegocio(mei)).toMatchObject({ ok: true, dados: { regime: "MEI", cnpj: "00000000000191", atividadeMei: "SERVICOS", anexoSimples: null } });
    expect(validarNegocio(simples)).toMatchObject({ ok: true, dados: { anexoSimples: "V", sujeitoFatorR: true, cnaePrincipal: "6201-5/01" } });
    expect(validarNegocio(autonomo)).toMatchObject({ ok: true, dados: { regime: "AUTONOMO", cnpj: null, impostoPercentualManual: 6.5 } });
  });

  it.each<[string, Record<string, string>, string, string]>([
    ["MEI sem atividade", { ...mei, atividadeMei: "" }, "atividadeMei", M.atividadeObrigatoria],
    ["MEI sem CNPJ", { ...mei, cnpj: "" }, "cnpj", M.cnpjObrigatorio],
    ["CNPJ com dígito errado", { ...mei, cnpj: "00000000000192" }, "cnpj", M.cnpjInvalido],
    ["MEI com Anexo", { ...mei, anexoSimples: "III" }, "anexoSimples", M.campoForaDoRegime],
    ["Simples sem Anexo", { ...simples, anexoSimples: "" }, "anexoSimples", M.anexoObrigatorio],
    ["Simples com Imposto%", { ...simples, impostoPercentual: "5" }, "impostoPercentual", M.campoForaDoRegime],
    ["Autônomo com CNPJ", { ...autonomo, cnpj: "00000000000191" }, "cnpj", M.cnpjNaoPermitido],
    ["Autônomo sem Imposto%", { ...autonomo, impostoPercentual: "" }, "impostoPercentual", M.impostoObrigatorio],
    ["Imposto% acima de 99,99", { ...autonomo, impostoPercentual: "100" }, "impostoPercentual", M.impostoInvalido],
    ["Imposto% negativo", { ...autonomo, impostoPercentual: "-1" }, "impostoPercentual", M.impostoInvalido],
    ["nome vazio", { ...autonomo, nome: " " }, "nome", M.nomeObrigatorio],
    ["regime inexistente", { ...autonomo, regime: "LUCRO_REAL" }, "regime", M.regimeObrigatorio],
    ["CNAE inválido", { ...simples, cnaePrincipal: "123" }, "cnaePrincipal", M.cnaeInvalido],
  ])("recusa %s", (_, campos, campo, mensagem) => {
    const r = validarNegocio(campos);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[campo]).toBe(mensagem);
  });

  it("Fator R só vale no Simples", () => {
    const r = validarNegocio({ ...mei, sujeitoFatorR: "on" });
    expect(r.ok && r.dados.sujeitoFatorR).toBe(false);
  });
});

describe("T03 — adaptador da BrasilAPI (ADR-006, INV-004, INV-005)", () => {
  afterEach(() => vi.restoreAllMocks());
  const resposta = (status: number, corpo?: unknown) =>
    new Response(corpo === undefined ? "" : JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

  it("mapeia uma resposta real e descarta sócios, e-mail, telefone e endereço", async () => {
    const corpo = { ...respostaReal, email: "contato@exemplo.com" };
    const consulta = criarConsultaBrasilApi({ fetch: vi.fn().mockResolvedValue(resposta(200, corpo)) });
    const r = await consulta.consultar("00000000000191");
    expect(r).toEqual({
      ok: true,
      dados: {
        cnpj: "00000000000191",
        razaoSocial: "BANCO DO BRASIL SA",
        nomeFantasia: "DIRECAO GERAL",
        cnae: "6422-1/00",
        optanteMei: false,
        optanteSimples: false,
        situacao: "ATIVA",
      },
    });
    const tudo = JSON.stringify(r);
    for (const proibido of ["contato@exemplo.com", String(respostaReal.ddd_telefone_1), respostaReal.qsa[0].nome_socio, String(respostaReal.cep)]) {
      expect(tudo).not.toContain(proibido);
    }
  });

  it("identifica a aplicação no User-Agent (a BrasilAPI responde 403 ao padrão do fetch)", async () => {
    const buscar = vi.fn().mockResolvedValue(resposta(200, respostaReal));
    await criarConsultaBrasilApi({ fetch: buscar }).consultar("00000000000191");
    expect(buscar.mock.calls[0][1].headers["User-Agent"]).toMatch(/^HealthEnterprise\//);
  });

  it.each([404, 400])("%s → não encontrado", async (status) => {
    const consulta = criarConsultaBrasilApi({ fetch: vi.fn().mockResolvedValue(resposta(status, { message: "x" })) });
    expect(await consulta.consultar("00000000000191")).toEqual({ ok: false, erro: "NaoEncontrado" });
  });

  it("5xx e falha de rede → indisponível, sem dados no log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await criarConsultaBrasilApi({ fetch: vi.fn().mockResolvedValue(resposta(503)) }).consultar("00000000000191")).toEqual({ ok: false, erro: "Indisponivel" });
    expect(await criarConsultaBrasilApi({ fetch: vi.fn().mockRejectedValue(new TypeError("fetch failed")) }).consultar("00000000000191")).toEqual({ ok: false, erro: "Indisponivel" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("00000000000191");
  });

  it("tempo esgotado → indisponível em pouco tempo (INV-005)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const nuncaResponde = vi.fn((_: string, init?: RequestInit) =>
      new Promise<Response>((_r, rejeitar) => init?.signal?.addEventListener("abort", () => rejeitar(init.signal!.reason))),
    );
    const inicio = Date.now();
    const r = await criarConsultaBrasilApi({ fetch: nuncaResponde as unknown as typeof fetch, tempoLimiteMs: 50 }).consultar("00000000000191");
    expect(r).toEqual({ ok: false, erro: "Indisponivel" });
    expect(Date.now() - inicio).toBeLessThan(2_000);
  });
});

describe("T04 — sugestão de enquadramento (5.1)", () => {
  const base: DadosDoCnpj = mapearRespostaBrasilApi("00000000000191", respostaReal);
  const mei: DadosDoCnpj = { ...base, razaoSocial: "GISELE MENDES 12345678901", nomeFantasia: null, cnae: "9602-5/02", optanteMei: true, optanteSimples: true };

  it("MEI: atividade pelo Anexo do CNAE e razão social sem CPF (CA-01)", () => {
    const r = sugerirEnquadramento(mei, { anexo: "III", sujeitoFatorR: false });
    expect(r).toMatchObject({
      ok: true,
      sugestao: { regime: "MEI", atividadeMei: "SERVICOS", anexoSimples: null, nome: "GISELE MENDES", razaoSocial: "GISELE MENDES" },
    });
  });

  it("Simples com CNAE sujeito ao Fator R: Anexo V e aviso do RN24 (CA-02)", () => {
    const r = sugerirEnquadramento({ ...base, optanteSimples: true, cnae: "6201-5/01" }, { anexo: "V", sujeitoFatorR: true });
    expect(r).toMatchObject({ ok: true, sugestao: { regime: "SIMPLES_NACIONAL", anexoSimples: "V", sujeitoFatorR: true, cnaeForaDaTabela: false } });
    expect(r.ok && r.sugestao.avisos).toContain(MENSAGENS_ENQUADRAMENTO.anexoUnico);
  });

  it("CNAE fora da tabela: Anexo em branco e aviso (CA-04)", () => {
    const r = sugerirEnquadramento({ ...base, optanteSimples: true }, null);
    expect(r).toMatchObject({ ok: true, sugestao: { anexoSimples: null, cnaeForaDaTabela: true } });
    expect(r.ok && r.sugestao.avisos).toContain(MENSAGENS_ENQUADRAMENTO.cnaeForaDaTabela);
  });

  it("fora do Simples e do MEI não segue (OPEN-002)", () => {
    expect(sugerirEnquadramento(base, null)).toMatchObject({ ok: false, motivo: "ForaDoSimples" });
  });

  it("BAIXADA e NULA bloqueiam; INAPTA e SUSPENSA avisam (OPEN-003)", () => {
    expect(sugerirEnquadramento({ ...mei, situacao: "BAIXADA" }, null)).toMatchObject({ ok: false, motivo: "SituacaoImpeditiva" });
    expect(sugerirEnquadramento({ ...mei, situacao: "NULA" }, null)).toMatchObject({ ok: false, motivo: "SituacaoImpeditiva" });
    const inapta = sugerirEnquadramento({ ...mei, situacao: "INAPTA" }, null);
    expect(inapta.ok && inapta.sugestao.avisos[0]).toMatch(/INAPTA/);
  });

  it("atividade do MEI por Anexo", () => {
    expect(atividadeMeiDoAnexo("I")).toBe("COMERCIO_INDUSTRIA");
    expect(atividadeMeiDoAnexo("II")).toBe("COMERCIO_INDUSTRIA");
    expect(atividadeMeiDoAnexo("IV")).toBe("SERVICOS");
    expect(atividadeMeiDoAnexo(undefined)).toBeNull();
  });
});
