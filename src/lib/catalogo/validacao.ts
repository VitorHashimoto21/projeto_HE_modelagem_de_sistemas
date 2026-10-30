import type { CategoriaItem, TipoItem } from "@/generated/prisma/enums";
import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { pode, type Matriz } from "@/lib/dominio/permissoes";
import { casasDecimais, codigoValido, ehUnidade, lerNumero, normalizarCodigo, normalizarNome, type Unidade } from "@/lib/dominio/catalogo";
import { lerNcm } from "@/lib/dominio/ncm";

/**
 * Validação do catálogo (SPEC-006, 5.6). Roda no navegador e no servidor. Os materiais
 * chegam num campo "materiais" com JSON [{ materialId, quantidade }], montado pela tela.
 */

/** Lista fixa (RF11), na ordem de exibição; Acessórios logo depois de Vestuário (SPEC-020, OPEN-001). */
export const CATEGORIAS: CategoriaItem[] = [
  "SERVICOS",
  "PRODUTOS",
  "ALIMENTACAO",
  "VESTUARIO",
  "ACESSORIOS",
  "BELEZA",
  "SAUDE",
  "CASA",
  "TECNOLOGIA",
  "OUTROS",
];

export const ROTULO_CATEGORIA: Record<CategoriaItem, string> = {
  SERVICOS: "Serviços",
  PRODUTOS: "Produtos",
  ALIMENTACAO: "Alimentação",
  VESTUARIO: "Vestuário",
  ACESSORIOS: "Acessórios",
  BELEZA: "Beleza",
  SAUDE: "Saúde",
  CASA: "Casa",
  TECNOLOGIA: "Tecnologia",
  OUTROS: "Outros",
};

const TIPOS: TipoItem[] = ["PRODUTO_FISICO", "SERVICO"];
/** Subcategoria (SPEC-020, OPEN-002): até 40 caracteres. */
export const MAX_NOME_SUBCATEGORIA = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  subcategoriaNomeObrigatorio: "Informe o nome da subcategoria",
  subcategoriaNomeLongo: `Use no máximo ${MAX_NOME_SUBCATEGORIA} caracteres`,
  subcategoriaInvalida: "Escolha uma subcategoria da lista",
  ncmInvalido: "Informe os 8 dígitos do NCM.",
  ncmSoProduto: "NCM vale só para produto físico.",
  ncmObrigatorio: "Informe o NCM: o negócio emite nota fiscal de produtos.",
  ncmForaDaTabela: "Código não encontrado na tabela NCM vigente.",
  codigoInvalido: "Use até 20 caracteres: letras sem acento, números, hífen (-), ponto (.), barra (/) ou sublinhado (_), sem espaços.",
} as const;

/** Código interno em uso por outro item ativo (SPEC-024, 5.2). */
export const codigoEmUso = (codigo: string, nome: string) => `O código ${codigo} já é usado por “${nome}”. Use outro código.`;
/** Reativar um item cujo código outro item ativo já usa (SPEC-024, 5.2). */
export const codigoEmUsoAoReativar = (codigo: string) => `Já existe um item ativo com o código ${codigo}. Troque o código de um deles antes de reativar.`;

/** Subcategoria da categoria do item (SPEC-020, 5.5). */
export const subcategoriaDeOutraCategoria = (categoria: CategoriaItem) =>
  `Escolha uma subcategoria de ${ROTULO_CATEGORIA[categoria]}`;

export type MaterialInformado = { materialId: string; quantidade: number };

export type DadosDoItem = {
  tipo: TipoItem;
  nome: string;
  nomeChave: string;
  /** SPEC-024: opcional, já normalizado (em maiúsculas); o servidor confere a repetição entre os ativos. */
  codigo: string | null;
  categoria: CategoriaItem;
  /** SPEC-020: opcional; o servidor confere que é da mesma categoria e do mesmo negócio. */
  subcategoriaId: string | null;
  /** SPEC-021: 8 dígitos, só produto físico; o servidor confere na tabela vigente e a obrigatoriedade (RN35). */
  ncm: string | null;
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
 * preço não é aceito (tem fluxo próprio). `exigeNcm`: o negócio emite nota fiscal de produtos
 * (SPEC-021, RN35); o servidor confere de novo, com o valor gravado no negócio.
 */
export function validarItem(
  campos: Record<string, string>,
  modo: { tipo: "criar" } | { tipo: "editar"; tipoDoItem: TipoItem },
  { exigeNcm = false }: { exigeNcm?: boolean } = {},
): Validacao<DadosDoItem> {
  const erros: ErrosDeCampo = {};
  const tipo = modo.tipo === "editar" ? modo.tipoDoItem : (campos.tipo as TipoItem);
  if (!TIPOS.includes(tipo)) erros.tipo = MENSAGENS_CATALOGO.tipoObrigatorio;

  const nome = (campos.nome ?? "").trim().replace(/\s+/g, " ");
  if (!nome) erros.nome = MENSAGENS_CATALOGO.nomeObrigatorio;
  else if (nome.length > 120) erros.nome = MENSAGENS_CATALOGO.nomeLongo;

  // SPEC-024 (5.2): opcional; espaços das pontas tirados e em maiúsculas.
  const codigo = vazio(campos.codigo) ? null : normalizarCodigo(campos.codigo);
  if (codigo !== null && !codigoValido(codigo)) erros.codigo = MENSAGENS_CATALOGO.codigoInvalido;

  const categoria = campos.categoria as CategoriaItem;
  if (!CATEGORIAS.includes(categoria)) erros.categoria = MENSAGENS_CATALOGO.categoriaObrigatoria;

  const subcategoriaId = vazio(campos.subcategoriaId) ? null : campos.subcategoriaId.trim();
  if (subcategoriaId !== null && !UUID.test(subcategoriaId)) erros.subcategoriaId = MENSAGENS_CATALOGO.subcategoriaInvalida;

  const unidade = campos.unidadeMedida;
  if (!ehUnidade(unidade)) erros.unidadeMedida = MENSAGENS_CATALOGO.unidadeObrigatoria;

  // SPEC-021 (5.7): 8 dígitos, com ou sem pontos; só produto físico; obrigatório se o negócio emite nota.
  let ncm: string | null = null;
  if (!vazio(campos.ncm)) {
    if (tipo !== "PRODUTO_FISICO") erros.ncm = MENSAGENS_CATALOGO.ncmSoProduto;
    else if ((ncm = lerNcm(campos.ncm)) === null) erros.ncm = MENSAGENS_CATALOGO.ncmInvalido;
  } else if (exigeNcm && tipo === "PRODUTO_FISICO") {
    erros.ncm = MENSAGENS_CATALOGO.ncmObrigatorio;
  }

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
      codigo,
      categoria,
      subcategoriaId,
      ncm,
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

export type DadosDaSubcategoria = { categoria: CategoriaItem; nome: string; nomeChave: string };

/** Nome da subcategoria (5.5): espaços das pontas tirados e repetidos juntados; 1 a 40 caracteres. */
export function validarNomeDaSubcategoria(texto: string | undefined): Validacao<{ nome: string; nomeChave: string }> {
  const nome = (texto ?? "").trim().replace(/\s+/g, " ");
  if (!nome) return { ok: false, erros: { nome: MENSAGENS_CATALOGO.subcategoriaNomeObrigatorio } };
  if (nome.length > MAX_NOME_SUBCATEGORIA) return { ok: false, erros: { nome: MENSAGENS_CATALOGO.subcategoriaNomeLongo } };
  return { ok: true, dados: { nome, nomeChave: normalizarNome(nome) } };
}

/** Nova subcategoria (5.3): uma das categorias fixas e o nome. */
export function validarSubcategoria(campos: Record<string, string>): Validacao<DadosDaSubcategoria> {
  const erros: ErrosDeCampo = {};
  const categoria = campos.categoria as CategoriaItem;
  if (!CATEGORIAS.includes(categoria)) erros.categoria = MENSAGENS_CATALOGO.categoriaObrigatoria;
  const nome = validarNomeDaSubcategoria(campos.nome);
  if (!nome.ok) Object.assign(erros, nome.erros);
  if (Object.keys(erros).length || !nome.ok) return { ok: false, erros };
  return { ok: true, dados: { categoria, ...nome.dados } };
}

/**
 * Quem cria subcategoria (OPEN-005): quem cadastra ou edita itens — Catálogo: criar ou editar.
 * Renomear exige editar e excluir exige excluir (a própria guarda da Server Action).
 */
export const podeCriarSubcategoria = (permissoes: Matriz) => pode(permissoes, "catalogo", "criar") || pode(permissoes, "catalogo", "editar");

/** Buscar e conferir na tabela NCM (SPEC-021, 5.7): quem cadastra ou edita itens — a mesma combinação. */
export const podeUsarTabelaNcm = podeCriarSubcategoria;
