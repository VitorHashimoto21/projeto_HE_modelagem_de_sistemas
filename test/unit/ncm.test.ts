import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { MENSAGENS_FLUXO_CATALOGO as F } from "@/lib/catalogo/servicos";
import { MENSAGENS_CATALOGO as M, podeUsarTabelaNcm, validarItem } from "@/lib/catalogo/validacao";
import { condicaoDaBusca } from "@/lib/db/catalogo";
import {
  descricaoDoNcm,
  formatarNcm,
  lerNcm,
  limparDescricao,
  prefixoDeNcmNaBusca,
  termosDaBusca,
  textoSemAcentos,
  vigenteNoDia,
} from "@/lib/dominio/ncm";
import { MATRIZ_VAZIA, PREDEFINICOES, type Acao, type Matriz } from "@/lib/dominio/permissoes";
import { CAMINHO_DA_TABELA_NCM, lerTabelaNcm, TabelaNcmInvalida } from "@/lib/ncm/arquivo";

// SPEC-021 — testes unitários (seção 12): T01 (NCM e validação do item), T02 (arquivo da tabela)
// e a guarda das Server Actions (T08, T12 — INV-007, INV-010).

describe("T01 — ler, formatar e buscar o NCM (5.2, INV-001)", () => {
  it("8 dígitos, com ou sem pontos, traços e espaços; o resto não é um código", () => {
    for (const t of ["71171900", "7117.19.00", " 7117 19 00 ", "7117-19-00"]) expect(lerNcm(t)).toBe("71171900");
    for (const t of ["", "   ", "7117.19", "711719000", "7117.19.0a", "abcdefgh", null, undefined]) expect(lerNcm(t)).toBeNull();
    expect(formatarNcm("71171900")).toBe("7117.19.00");
    expect(formatarNcm("7117")).toBe("7117");
  });

  it("busca: só dígitos (2 ou mais) = começo do código; com letras (3 ou mais) = todas as palavras, sem acentos", () => {
    expect(termosDaBusca("71.17")).toEqual({ tipo: "codigo", prefixo: "7117" });
    expect(termosDaBusca("7")).toEqual({ tipo: "curta" });
    expect(termosDaBusca("711719001234")).toEqual({ tipo: "codigo", prefixo: "71171900" });
    expect(termosDaBusca("Bijutéria  DE metais")).toEqual({ tipo: "palavras", palavras: ["bijuteria", "de", "metais"] });
    expect(termosDaBusca("ab")).toEqual({ tipo: "curta" });
    expect(termosDaBusca("  ")).toEqual({ tipo: "curta" });
    expect(textoSemAcentos("  Pérolas   ÇÃO ")).toBe("perolas cao");
  });

  it("Catálogo e Estoque: o começo do NCM entra na busca só quando o texto é um código (5.5)", () => {
    expect(prefixoDeNcmNaBusca("7117")).toBe("7117");
    expect(prefixoDeNcmNaBusca("7117.19")).toBe("711719");
    expect(prefixoDeNcmNaBusca("brinco 2")).toBeNull();
    expect(prefixoDeNcmNaBusca("1")).toBeNull();
    expect(condicaoDaBusca("7117.19")).toEqual({
      OR: [
        { nome: { contains: "7117.19", mode: "insensitive" } },
        { subcategoria: { nome: { contains: "7117.19", mode: "insensitive" } } },
        { codigo: { contains: "7117.19", mode: "insensitive" } },
        { ncm: { startsWith: "711719" } },
      ],
    });
    expect(condicaoDaBusca("brinc").OR).toHaveLength(3); // nome, subcategoria e código interno (SPEC-024)
  });

  it("descrição para mostrar: sem os traços, sem o capítulo; vigência inclusive nas pontas", () => {
    expect(limparDescricao("-- Outras:")).toBe("Outras");
    expect(limparDescricao("- De metais comuns, mesmo prateados, dourados ou platinados:")).toBe("De metais comuns, mesmo prateados, dourados ou platinados");
    expect(descricaoDoNcm(["Pérolas…", "Bijuterias", "De metais comuns"], "Outras")).toBe("Bijuterias › De metais comuns › Outras");
    const v = { vigenteDesde: "2022-04-01", vigenteAte: "2027-12-31" };
    expect(vigenteNoDia(v, "2022-04-01")).toBe(true);
    expect(vigenteNoDia(v, "2027-12-31")).toBe(true);
    expect(vigenteNoDia(v, "2028-01-01")).toBe(false);
    expect(vigenteNoDia(v, "2022-03-31")).toBe(false);
    expect(vigenteNoDia({ vigenteDesde: "2022-04-01", vigenteAte: null }, "2099-01-01")).toBe(true);
  });

  it("no item: opcional; só produto físico; obrigatório quando o negócio emite nota (RN35)", () => {
    const produto = { tipo: "PRODUTO_FISICO", nome: "Brinco argola", categoria: "ACESSORIOS", unidadeMedida: "un", custoBase: "25" };
    const servico = { ...produto, tipo: "SERVICO", nome: "Limpeza de joias", unidadeMedida: "atend" };
    expect(validarItem(produto, { tipo: "criar" })).toMatchObject({ ok: true, dados: { ncm: null } });
    expect(validarItem({ ...produto, ncm: "7117.19.00" }, { tipo: "criar" })).toMatchObject({ ok: true, dados: { ncm: "71171900" } });
    expect(validarItem({ ...produto, ncm: "7117.19" }, { tipo: "criar" })).toEqual({ ok: false, erros: { ncm: M.ncmInvalido } });
    expect(validarItem({ ...servico, ncm: "71171900" }, { tipo: "criar" })).toEqual({ ok: false, erros: { ncm: M.ncmSoProduto } });
    expect(validarItem(produto, { tipo: "criar" }, { exigeNcm: true })).toEqual({ ok: false, erros: { ncm: M.ncmObrigatorio } });
    expect(validarItem(produto, { tipo: "editar", tipoDoItem: "PRODUTO_FISICO" }, { exigeNcm: true })).toEqual({ ok: false, erros: { ncm: M.ncmObrigatorio } });
    expect(validarItem(servico, { tipo: "criar" }, { exigeNcm: true })).toMatchObject({ ok: true, dados: { ncm: null } });
    expect(M.ncmObrigatorio).toBe("Informe o NCM: o negócio emite nota fiscal de produtos.");
  });
});

/** Arquivo no formato do Classif, com os níveis do capítulo 71 e uma posição sem desdobramento. */
const arquivo = (extra: object[] = [], cabecalho: object = {}) => ({
  Data_Ultima_Atualizacao_NCM: "Vigente em 21/10/2026",
  Ato: "Resolução Gecex nº 926/2026",
  ...cabecalho,
  Nomenclaturas: [
    { Codigo: "71", Descricao: "Pérolas naturais…; bijuterias; moedas." },
    { Codigo: "71.17", Descricao: "Bijuterias." },
    { Codigo: "7117.1", Descricao: "- De metais comuns, mesmo prateados, dourados ou platinados:" },
    { Codigo: "7117.11.00", Descricao: "-- Abotoaduras (botões de punho) e artigos semelhantes" },
    { Codigo: "7117.19.00", Descricao: "-- Outras" },
    { Codigo: "02", Descricao: "Carnes e miudezas, comestíveis." },
    { Codigo: "0205.00.00", Descricao: "Carnes de animais das espécies cavalar, asinina e muar." },
    ...extra,
  ].map((n) => ({ Data_Inicio: "01/04/2022", Data_Fim: "31/12/9999", Tipo_Ato_Ini: "Res Gecex", Numero_Ato_Ini: "272", Ano_Ato_Ini: "2021", ...n })),
});

describe("T02 — arquivo oficial da tabela NCM (5.1, CA-14)", () => {
  it("só os códigos de 8 dígitos, com o caminho, o texto de busca, a vigência e o ato", () => {
    const t = lerTabelaNcm(arquivo());
    expect(t.atualizadaEm).toBe("2026-10-21");
    expect(t.ato).toBe("Resolução Gecex nº 926/2026");
    expect(t.codigos.map((c) => c.codigo)).toEqual(["71171100", "71171900", "02050000"]);
    const outras = t.codigos.find((c) => c.codigo === "71171900")!;
    expect(outras).toEqual({
      codigo: "71171900",
      descricao: "Outras",
      caminho: ["Pérolas naturais…; bijuterias; moedas", "Bijuterias", "De metais comuns, mesmo prateados, dourados ou platinados"],
      textoBusca: "71171900 bijuterias de metais comuns, mesmo prateados, dourados ou platinados outras",
      vigenteDesde: "2022-04-01",
      vigenteAte: null,
      ato: "Res Gecex 272/2021",
    });
    // Posição sem desdobramento: o próprio código traz a descrição, e o caminho tem só o capítulo.
    expect(t.codigos.find((c) => c.codigo === "02050000")!.caminho).toEqual(["Carnes e miudezas, comestíveis"]);
  });

  it("recusa o arquivo com problemas, listando todos (nada é gravado)", () => {
    const ruim = arquivo([
      { Codigo: "7117.9", Descricao: "- Outras:" },
      { Codigo: "7117.19.00", Descricao: "-- Repetida" },
      { Codigo: "9999.99.99", Descricao: "Sem capítulo" },
      { Codigo: "71.17.x", Descricao: "Código torto" },
      { Codigo: "7117.90.00", Descricao: "-- Data errada", Data_Inicio: "31/02/2022" },
      { Codigo: "7117.90.10", Descricao: "-- Fim antes do início", Data_Fim: "01/01/2020" },
    ]);
    try {
      lerTabelaNcm(ruim);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(TabelaNcmInvalida);
      expect((e as TabelaNcmInvalida).problemas).toEqual([
        "7117.19.00: código repetido na mesma vigência",
        'código fora do formato: "71.17.x"',
        "7117.90.00: data de vigência ilegível",
        "7117.90.10: fim da vigência antes do início",
        "99999999: sem capítulo no arquivo",
      ]);
    }
    expect(() => lerTabelaNcm(arquivo([], { Data_Ultima_Atualizacao_NCM: "ontem" }))).toThrow(TabelaNcmInvalida);
    expect(() => lerTabelaNcm({ Nomenclaturas: [] })).toThrow(TabelaNcmInvalida);
  });

  it("o arquivo do repositório é válido: 10.516 códigos, vigente em 21/10/2026, e 7117.19.00 com o caminho de bijuterias", () => {
    const t = lerTabelaNcm(JSON.parse(readFileSync(CAMINHO_DA_TABELA_NCM, "utf-8")));
    expect(t.codigos.length).toBeGreaterThanOrEqual(10_000);
    expect(t.atualizadaEm).toBe("2026-10-21");
    const c = t.codigos.find((x) => x.codigo === "71171900")!;
    expect(descricaoDoNcm(c.caminho, c.descricao)).toBe("Bijuterias › De metais comuns, mesmo prateados, dourados ou platinados › Outras");
    expect(new Set(t.codigos.map((x) => `${x.codigo}|${x.vigenteDesde}`)).size).toBe(t.codigos.length);
  });
});

// T08 e T12 (INV-007, INV-010): buscar e conferir na tabela pedem à guarda "Catálogo — ver" e o corpo
// exige criar ou editar; a opção de nota fiscal é do Dono. A guarda e o banco são dublês; o modo
// suporte é recusado pela própria guarda (SPEC-018).
const dubles = vi.hoisted(() => ({ pedidos: [] as unknown[], membro: null as unknown, chamadas: [] as string[] }));

vi.mock("@/lib/auth/servidor", () => ({
  exigirNivel: async (nivel: unknown) => {
    dubles.pedidos.push(nivel);
    return { membro: dubles.membro };
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));
vi.mock("@/lib/db", () => ({
  catalogo: () => ({
    async buscarNcm(texto: string) {
      dubles.chamadas.push(`buscar ${texto}`);
      return { status: "ok", resultados: [], maisResultados: false, atualizadaEm: "2026-10-21" };
    },
    async conferirCodigoNcm(codigo: string) {
      dubles.chamadas.push(`conferir ${codigo}`);
      return codigo === "71171900" ? { codigo, descricao: "Bijuterias › Outras", vigente: true } : null;
    },
  }),
  negocios: () => ({
    async definirNotaFiscalDeProduto(_: string, emite: boolean) {
      dubles.chamadas.push(`nota ${emite}`);
    },
  }),
}));

const { acaoBuscarNcm, acaoConferirNcm } = await import("@/lib/catalogo/acoes");
const { acaoDefinirNotaFiscal } = await import("@/lib/negocio/acoes");

const matrizCom = (...acoes: Acao[]): Matriz => ({ ...MATRIZ_VAZIA, catalogo: { ...MATRIZ_VAZIA.catalogo, ver: true, ...Object.fromEntries(acoes.map((a) => [a, true])) } });
const membro = (permissoes: Matriz): ContextoDoMembro => ({ usuarioId: "u1", negocioId: "n1", papel: "GERENTE", permissoes });
const pedidoVer = { tipo: "permissao", modulo: "catalogo", acao: "ver", origem: "acao" };

describe("T08/T12 — permissões das Server Actions (5.7, INV-007, INV-010)", () => {
  beforeEach(() => {
    dubles.pedidos.length = 0;
    dubles.chamadas.length = 0;
  });

  it("buscar e conferir: a guarda exige Catálogo — ver; o corpo exige criar ou editar antes de consultar", async () => {
    dubles.membro = membro(PREDEFINICOES.COLABORADOR);
    expect(await acaoBuscarNcm("bijuteria")).toEqual({ status: "erro", mensagem: F.semPermissaoNcm });
    expect(await acaoConferirNcm("71171900")).toEqual({ status: "erro", mensagem: F.semPermissaoNcm });
    expect(dubles.pedidos).toEqual([pedidoVer, pedidoVer]);
    expect(dubles.chamadas).toEqual([]);

    for (const permissoes of [matrizCom("criar"), matrizCom("editar"), PREDEFINICOES.GERENTE, PREDEFINICOES.DONO]) {
      dubles.membro = membro(permissoes);
      expect(await acaoBuscarNcm("bijuteria")).toMatchObject({ status: "ok" });
    }
    expect(dubles.chamadas).toEqual(Array(4).fill("buscar bijuteria"));
    expect(podeUsarTabelaNcm(matrizCom("excluir"))).toBe(false);
  });

  it("conferir: formato antes do banco; existe → descrição; não existe → mensagem da tabela vigente", async () => {
    dubles.membro = membro(PREDEFINICOES.DONO);
    expect(await acaoConferirNcm("7117.19")).toEqual({ status: "invalido", mensagem: M.ncmInvalido });
    expect(await acaoConferirNcm("7117.19.00")).toEqual({ status: "ok", ncm: { codigo: "71171900", descricao: "Bijuterias › Outras", vigente: true } });
    expect(await acaoConferirNcm("99999999")).toEqual({ status: "nao-encontrado", mensagem: M.ncmForaDaTabela });
    expect(dubles.chamadas).toEqual(["conferir 71171900", "conferir 99999999"]);
  });

  it("a opção de nota fiscal pede a guarda do Dono e só aceita 0 ou 1", async () => {
    dubles.membro = membro(PREDEFINICOES.DONO);
    const f = (v?: string) => {
      const d = new FormData();
      if (v !== undefined) d.set("emiteNotaDeProduto", v);
      return d;
    };
    expect(await acaoDefinirNotaFiscal({ status: "ocioso" }, f("1"))).toEqual({ status: "salvo", emite: true });
    expect(await acaoDefinirNotaFiscal({ status: "ocioso" }, f("0"))).toEqual({ status: "salvo", emite: false });
    expect(await acaoDefinirNotaFiscal({ status: "ocioso" }, f("sim"))).toMatchObject({ status: "erro" });
    expect(dubles.pedidos).toEqual(Array(3).fill({ tipo: "dono", origem: "acao" }));
    expect(dubles.chamadas).toEqual(["nota true", "nota false"]);
  });
});
