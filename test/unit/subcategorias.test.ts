import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoriaItem } from "@/generated/prisma/enums";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { MENSAGENS_FLUXO_CATALOGO as F } from "@/lib/catalogo/servicos";
import {
  CATEGORIAS,
  MAX_NOME_SUBCATEGORIA,
  MENSAGENS_CATALOGO as M,
  podeCriarSubcategoria,
  ROTULO_CATEGORIA,
  validarItem,
  validarNomeDaSubcategoria,
  validarSubcategoria,
} from "@/lib/catalogo/validacao";
import { condicaoDaBusca, condicaoDaSubcategoria } from "@/lib/db/catalogo";
import { MATRIZ_VAZIA, PREDEFINICOES, type Acao, type Matriz } from "@/lib/dominio/permissoes";
import { CAMINHO_DO_ARQUIVO, validarParametros } from "@/lib/fiscal/arquivo";

// SPEC-020 — testes unitários (seção 12): T01, T02, T03 e a guarda das Server Actions (T04, INV-005).

const ID = "8f6f2c1e-3b5a-4f5e-9c1d-2a7b6c5d4e3f";

describe("T01 — nome da subcategoria (5.5, INV-003)", () => {
  it("obrigatório, até 40 caracteres, sem espaços nas pontas nem repetidos; chave normalizada", () => {
    expect(validarNomeDaSubcategoria("")).toEqual({ ok: false, erros: { nome: M.subcategoriaNomeObrigatorio } });
    expect(validarNomeDaSubcategoria("   ")).toEqual({ ok: false, erros: { nome: M.subcategoriaNomeObrigatorio } });
    expect(validarNomeDaSubcategoria(undefined)).toEqual({ ok: false, erros: { nome: M.subcategoriaNomeObrigatorio } });
    expect(validarNomeDaSubcategoria("x".repeat(MAX_NOME_SUBCATEGORIA + 1))).toEqual({ ok: false, erros: { nome: M.subcategoriaNomeLongo } });
    expect(validarNomeDaSubcategoria(`  ${"x".repeat(MAX_NOME_SUBCATEGORIA)}  `)).toMatchObject({ ok: true });
    expect(validarNomeDaSubcategoria("  Brincos   de  ARGOLA ")).toEqual({ ok: true, dados: { nome: "Brincos de ARGOLA", nomeChave: "brincos de argola" } });
    expect(M.subcategoriaNomeLongo).toBe("Use no máximo 40 caracteres");
  });

  it("nova subcategoria: categoria da lista fixa e nome", () => {
    expect(validarSubcategoria({ categoria: "ACESSORIOS", nome: "Brincos" })).toEqual({
      ok: true,
      dados: { categoria: "ACESSORIOS", nome: "Brincos", nomeChave: "brincos" },
    });
    expect(validarSubcategoria({ categoria: "JOIAS", nome: "" })).toEqual({
      ok: false,
      erros: { categoria: M.categoriaObrigatoria, nome: M.subcategoriaNomeObrigatorio },
    });
  });
});

describe("T02 — subcategoria no item (5.5, INV-002)", () => {
  const campos = { tipo: "PRODUTO_FISICO", nome: "Brinco argola", categoria: "ACESSORIOS", unidadeMedida: "un", custoBase: "25" };

  it("vazia → sem subcategoria; id válido passa (a categoria e o negócio são conferidos no servidor); texto qualquer é recusado", () => {
    expect(validarItem(campos, { tipo: "criar" })).toMatchObject({ ok: true, dados: { subcategoriaId: null } });
    expect(validarItem({ ...campos, subcategoriaId: "  " }, { tipo: "criar" })).toMatchObject({ ok: true, dados: { subcategoriaId: null } });
    expect(validarItem({ ...campos, subcategoriaId: ID }, { tipo: "editar", tipoDoItem: "PRODUTO_FISICO" })).toMatchObject({ ok: true, dados: { subcategoriaId: ID } });
    expect(validarItem({ ...campos, subcategoriaId: "brincos" }, { tipo: "criar" })).toEqual({ ok: false, erros: { subcategoriaId: M.subcategoriaInvalida } });
  });

  it("filtro e busca das listas (5.4): 'sem', id e valor inválido; busca no nome ou na subcategoria", () => {
    expect(condicaoDaSubcategoria("sem")).toEqual({ subcategoriaId: null });
    expect(condicaoDaSubcategoria(ID)).toEqual({ subcategoriaId: ID });
    expect(condicaoDaSubcategoria("x' OR 1=1")).toEqual({});
    expect(condicaoDaSubcategoria(undefined)).toEqual({});
    expect(condicaoDaBusca("  ")).toEqual({});
    expect(condicaoDaBusca(" brinc ")).toEqual({
      OR: [
        { nome: { contains: "brinc", mode: "insensitive" } },
        { subcategoria: { nome: { contains: "brinc", mode: "insensitive" } } },
        // SPEC-024 (5.4): também pelo código interno.
        { codigo: { contains: "brinc", mode: "insensitive" } },
      ],
    });
  });
});

describe("T03 — Acessórios na lista fixa e no arquivo fiscal (INV-007, CA-01)", () => {
  it("a lista tem todas as categorias do banco, com Acessórios logo depois de Vestuário, e todas com rótulo", () => {
    expect([...CATEGORIAS].sort()).toEqual(Object.values(CategoriaItem).sort());
    expect(CATEGORIAS.indexOf("ACESSORIOS")).toBe(CATEGORIAS.indexOf("VESTUARIO") + 1);
    expect(CATEGORIAS.map((c) => ROTULO_CATEGORIA[c])).toEqual([
      "Serviços",
      "Produtos",
      "Alimentação",
      "Vestuário",
      "Acessórios",
      "Beleza",
      "Saúde",
      "Casa",
      "Tecnologia",
      "Outros",
    ]);
  });

  it("o arquivo fiscal tem a margem de Acessórios: 8% (comércio), mesma fonte e vigência das demais de comércio", () => {
    const p = validarParametros(JSON.parse(readFileSync(CAMINHO_DO_ARQUIVO, "utf-8")));
    const acessorios = p.margemPadraoCategoria.find((m) => m.categoria === "ACESSORIOS");
    const vestuario = p.margemPadraoCategoria.find((m) => m.categoria === "VESTUARIO");
    expect(acessorios).toEqual({ ...vestuario, categoria: "ACESSORIOS" });
    expect(acessorios).toMatchObject({ margemPadrao: 8, vigenteDesde: "2018-01-01" });
  });
});

// T04 (INV-005, CA-09): cada Server Action pede à guarda a permissão da OPEN-005, e a de criar confere
// "criar ou editar" antes de gravar. A guarda e o banco são dublês; o modo suporte é recusado pela
// própria guarda (SPEC-018) e pelo cliente do negócio (teste de integração).
const dubles = vi.hoisted(() => ({
  pedidos: [] as unknown[],
  membro: null as unknown,
  gravacoes: [] as string[],
}));

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
    async criarSubcategoria(d: { categoria: CategoriaItem; nome: string }) {
      dubles.gravacoes.push("criar");
      return { id: "s1", categoria: d.categoria, nome: d.nome };
    },
    async renomearSubcategoria(id: string, n: { nome: string }) {
      dubles.gravacoes.push("renomear");
      return { id, categoria: "ACESSORIOS", nome: n.nome };
    },
    async excluirSubcategoria() {
      dubles.gravacoes.push("excluir");
      return { itensAfetados: 2 };
    },
  }),
}));

const { acaoCriarSubcategoria, acaoExcluirSubcategoria, acaoRenomearSubcategoria } = await import("@/lib/catalogo/acoes");

const matrizCom = (...acoes: Acao[]): Matriz => ({ ...MATRIZ_VAZIA, catalogo: { ...MATRIZ_VAZIA.catalogo, ver: true, ...Object.fromEntries(acoes.map((a) => [a, true])) } });
const membro = (permissoes: Matriz): ContextoDoMembro => ({ usuarioId: "u1", negocioId: "n1", papel: "GERENTE", permissoes });
const formulario = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};
const pedido = (acao: Acao) => ({ tipo: "permissao", modulo: "catalogo", acao, origem: "acao" });

describe("T04 — permissões das Server Actions (OPEN-005, INV-005)", () => {
  beforeEach(() => {
    dubles.pedidos.length = 0;
    dubles.gravacoes.length = 0;
  });

  it("criar: a guarda exige Catálogo — ver; o corpo exige criar ou editar antes de gravar", async () => {
    const campos = formulario({ categoria: "ACESSORIOS", nome: "Brincos" });

    dubles.membro = membro(PREDEFINICOES.COLABORADOR);
    expect(await acaoCriarSubcategoria({ status: "ocioso" }, campos)).toEqual({ status: "erro", mensagem: F.semPermissaoSubcategoria });
    expect(dubles.pedidos).toEqual([pedido("ver")]);
    expect(dubles.gravacoes).toEqual([]);

    for (const permissoes of [matrizCom("criar"), matrizCom("editar"), PREDEFINICOES.GERENTE, PREDEFINICOES.DONO]) {
      dubles.membro = membro(permissoes);
      expect(await acaoCriarSubcategoria({ status: "ocioso" }, campos)).toMatchObject({ status: "salvo", subcategoria: { nome: "Brincos" } });
    }
    expect(dubles.gravacoes).toEqual(["criar", "criar", "criar", "criar"]);
  });

  it("renomear pede Catálogo — editar; excluir pede Catálogo — excluir", async () => {
    dubles.membro = membro(PREDEFINICOES.GERENTE);
    await acaoRenomearSubcategoria({ status: "ocioso" }, formulario({ subcategoriaId: ID, nome: "Anéis" }));
    await acaoExcluirSubcategoria({ status: "ocioso" }, formulario({ subcategoriaId: ID }));
    expect(dubles.pedidos).toEqual([pedido("editar"), pedido("excluir")]);
    expect(dubles.gravacoes).toEqual(["renomear", "excluir"]);
  });

  it("a regra de quem cria: Dono e Gerente sim; Colaborador predefinido não (só vê o Catálogo)", () => {
    expect(podeCriarSubcategoria(PREDEFINICOES.DONO)).toBe(true);
    expect(podeCriarSubcategoria(PREDEFINICOES.GERENTE)).toBe(true);
    expect(podeCriarSubcategoria(PREDEFINICOES.COLABORADOR)).toBe(false);
    expect(podeCriarSubcategoria(matrizCom("excluir"))).toBe(false);
  });
});
