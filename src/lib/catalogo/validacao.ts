import type { CategoriaItem, TipoItem } from "@/generated/prisma/enums";
import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { casasDecimais, ehUnidade, lerNumero, normalizarNome, type Unidade } from "@/lib/dominio/catalogo";

/**
 * Validação do catálogo (SPEC-006, 5.6). Roda no navegador e no servidor. Os materiais
 * chegam num campo "materiais" com JSON [{ materialId, quantidade }], montado pela tela.
 */

export const CATEGORIAS: CategoriaItem[] = [
  "SERVICOS",
  "PRODUTOS",
  "ALIMENTACAO",
  "VESTUARIO",
  "BELEZA",
  "SAUDE",
  "CASA",
  "TECNOLOGIA",
  "OUTROS",
];
const TIPOS: TipoItem[] = ["PRODUTO_FISICO", "SERVICO"];
export const VALOR_MAXIMO = 9_999_999.99;

export const MENSAGENS_CATALOGO = {
  tipoObrigatorio: "Escolha se é um produto físico ou um serviço",
  nomeObrigatorio: "Informe o nome do item",
  nomeLongo: "Use no máximo 120 caracteres",
  categoriaObrigatoria: "Escolha a categoria",
  unidadeObrigatoria: "Escolha a unidade de medida",
  custoObrigatorio: "Informe o custo (pode ser 0)",
  valorInvalido: "Use um valor entre R$ 0,00 e R$ 9.999.999,99, com até 2 casas",
  precoInvalido: "Use um preço maior que zero, até R$ 9.999.999,99, com até 2 casas",
  comissaoInvalida: "Use um percentual entre 0 e 99,99",
  estoqueInvalido: "Use um número maior ou igual a zero, com até 3 casas",
  estoqueSoProduto: "Estoque mínimo vale só para produto físico",
  materiaisSoServico: "Só serviços têm materiais",
  materiaisInvalidos: "Revise os materiais do serviço",
  materialRepetido: "Este material já está no serviço",
  quantidadeInvalida: "Use uma quantidade maior que zero, com até 3 casas",
} as const;

export type MaterialInformado = { materialId: string; quantidade: number };

export type DadosDoItem = {
  tipo: TipoItem;
  nome: string;
  nomeChave: string;
  categoria: CategoriaItem;
  unidadeMedida: Unidade;
  custoBase: number;
  comissaoPercentual: number | null;
  estoqueMinimo: number | null;
  /** Só no cadastro (5.1/5.2): o preço tem fluxo próprio depois (5.4). */
  precoInicial: number | null;
  materiais: MaterialInformado[];
};

export type Validacao<T> = { ok: true; dados: T } | { ok: false; erros: ErrosDeCampo };

const vazio = (v: string | undefined) => !v || !v.trim();

/** Valor em reais: ≥ 0 (ou > 0 para preço), até o máximo, no máximo 2 casas. */
export function lerReais(texto: string | undefined, { positivo = false } = {}): number | null {
  const n = lerNumero(texto);
  if (n === null || n > VALOR_MAXIMO || casasDecimais(n) > 2) return null;
  if (positivo ? n <= 0 : n < 0) return null;
  return n;
}

function lerQuantidade(v: unknown): number | null {
  const n = typeof v === "number" ? v : lerNumero(typeof v === "string" ? v : undefined);
  if (n === null || !(n > 0) || n > 9_999_999 || casasDecimais(n) > 3) return null;
  return n;
}

function lerMateriais(texto: string | undefined, erros: ErrosDeCampo): MaterialInformado[] {
  if (vazio(texto)) return [];
  let lista: unknown;
  try {
    lista = JSON.parse(texto!);
  } catch {
    erros.materiais = MENSAGENS_CATALOGO.materiaisInvalidos;
    return [];
  }
  if (!Array.isArray(lista)) {
    erros.materiais = MENSAGENS_CATALOGO.materiaisInvalidos;
    return [];
  }
  const vistos = new Set<string>();
  const materiais: MaterialInformado[] = [];
  for (const m of lista) {
    const id = typeof m?.materialId === "string" ? m.materialId : "";
    const quantidade = lerQuantidade(m?.quantidade);
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      erros.materiais = MENSAGENS_CATALOGO.materiaisInvalidos;
    } else if (vistos.has(id)) {
      erros.materiais = MENSAGENS_CATALOGO.materialRepetido;
    } else if (quantidade === null) {
      erros.materiais = MENSAGENS_CATALOGO.quantidadeInvalida;
    } else {
      vistos.add(id);
      materiais.push({ materialId: id, quantidade });
    }
  }
  return materiais;
}

/**
 * Valida os campos do item. No modo "editar" o tipo vem do item gravado (INV-002) e o
 * preço não é aceito (tem fluxo próprio).
 */
export function validarItem(
  campos: Record<string, string>,
  modo: { tipo: "criar" } | { tipo: "editar"; tipoDoItem: TipoItem },
): Validacao<DadosDoItem> {
  const erros: ErrosDeCampo = {};
  const tipo = modo.tipo === "editar" ? modo.tipoDoItem : (campos.tipo as TipoItem);
  if (!TIPOS.includes(tipo)) erros.tipo = MENSAGENS_CATALOGO.tipoObrigatorio;

  const nome = (campos.nome ?? "").trim().replace(/\s+/g, " ");
  if (!nome) erros.nome = MENSAGENS_CATALOGO.nomeObrigatorio;
  else if (nome.length > 120) erros.nome = MENSAGENS_CATALOGO.nomeLongo;

  const categoria = campos.categoria as CategoriaItem;
  if (!CATEGORIAS.includes(categoria)) erros.categoria = MENSAGENS_CATALOGO.categoriaObrigatoria;

  const unidade = campos.unidadeMedida;
  if (!ehUnidade(unidade)) erros.unidadeMedida = MENSAGENS_CATALOGO.unidadeObrigatoria;

  let custoBase: number | null = null;
  if (vazio(campos.custoBase)) erros.custoBase = MENSAGENS_CATALOGO.custoObrigatorio;
  else if ((custoBase = lerReais(campos.custoBase)) === null) erros.custoBase = MENSAGENS_CATALOGO.valorInvalido;

  let comissaoPercentual: number | null = null;
  if (!vazio(campos.comissaoPercentual)) {
    const n = lerNumero(campos.comissaoPercentual);
    if (n === null || n < 0 || n > 99.99 || casasDecimais(n) > 2) erros.comissaoPercentual = MENSAGENS_CATALOGO.comissaoInvalida;
    else comissaoPercentual = n;
  }

  let estoqueMinimo: number | null = null;
  if (!vazio(campos.estoqueMinimo)) {
    if (tipo !== "PRODUTO_FISICO") erros.estoqueMinimo = MENSAGENS_CATALOGO.estoqueSoProduto;
    else {
      const n = lerNumero(campos.estoqueMinimo);
      if (n === null || n < 0 || casasDecimais(n) > 3) erros.estoqueMinimo = MENSAGENS_CATALOGO.estoqueInvalido;
      else estoqueMinimo = n;
    }
  }

  let precoInicial: number | null = null;
  if (modo.tipo === "criar" && !vazio(campos.preco)) {
    precoInicial = lerReais(campos.preco, { positivo: true });
    if (precoInicial === null) erros.preco = MENSAGENS_CATALOGO.precoInvalido;
  }

  let materiais: MaterialInformado[] = [];
  if (tipo === "SERVICO") materiais = lerMateriais(campos.materiais, erros);
  else if (!vazio(campos.materiais) && campos.materiais.trim() !== "[]") erros.materiais = MENSAGENS_CATALOGO.materiaisSoServico;

  if (Object.keys(erros).length) return { ok: false, erros };
  return {
    ok: true,
    dados: {
      tipo,
      nome,
      nomeChave: normalizarNome(nome),
      categoria,
      unidadeMedida: unidade as Unidade,
      custoBase: custoBase!,
      comissaoPercentual,
      estoqueMinimo,
      precoInicial,
      materiais,
    },
  };
}

/** Preço oficial informado manualmente (5.4). */
export function validarPreco(campos: Record<string, string>): Validacao<number> {
  const preco = lerReais(campos.preco, { positivo: true });
  return preco === null ? { ok: false, erros: { preco: MENSAGENS_CATALOGO.precoInvalido } } : { ok: true, dados: preco };
}
