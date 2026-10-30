import type { CategoriaItem, OrigemPreco, TipoItem } from "@/generated/prisma/enums";
import type { DadosDaSubcategoria, DadosDoItem, MaterialInformado } from "@/lib/catalogo/validacao";
import { codigoExatoPrimeiro, custoTotal, normalizarNome } from "@/lib/dominio/catalogo";
import { hoje } from "@/lib/dominio/datas";
import { descricaoDoNcm, LIMITE_DA_BUSCA, prefixoDeNcmNaBusca, termosDaBusca } from "@/lib/dominio/ncm";
import type { ClienteDoNegocio } from "./cliente-do-negocio";

/**
 * Catálogo do negócio ativo (SPEC-006). Tudo passa pelo cliente do negócio (SPEC-001):
 * o negocioId vem do contexto e é somado a toda leitura e escrita (INV-007).
 */

export class ItemNaoEncontrado extends Error {
  constructor() {
    super("Item não encontrado.");
    this.name = "ItemNaoEncontrado";
  }
}
export class NomeDuplicado extends Error {
  constructor() {
    super("Já existe um item com esse nome.");
    this.name = "NomeDuplicado";
  }
}
export class MaterialInvalido extends Error {
  constructor() {
    super("Material inválido.");
    this.name = "MaterialInvalido";
  }
}
export class PrecoIgualAoAtual extends Error {
  constructor() {
    super("Esse já é o preço atual.");
    this.name = "PrecoIgualAoAtual";
  }
}
/** SPEC-020 (5.5): a subcategoria do item não é da categoria dele (ou não é do negócio). */
export class SubcategoriaInvalida extends Error {
  constructor(public readonly categoria: CategoriaItem) {
    super("Subcategoria inválida.");
    this.name = "SubcategoriaInvalida";
  }
}
export class SubcategoriaNaoEncontrada extends Error {
  constructor() {
    super("Subcategoria não encontrada.");
    this.name = "SubcategoriaNaoEncontrada";
  }
}
/** SPEC-021 (5.7): NCM novo ou trocado que não está na tabela vigente. */
export class NcmForaDaTabela extends Error {
  constructor() {
    super("NCM fora da tabela vigente.");
    this.name = "NcmForaDaTabela";
  }
}
/** SPEC-021 (RN35): o negócio emite nota fiscal de produtos e o produto físico está sem NCM. */
export class NcmObrigatorio extends Error {
  constructor() {
    super("NCM obrigatório.");
    this.name = "NcmObrigatorio";
  }
}
/** SPEC-024 (5.2): o código interno já é usado por outro item ativo do negócio. */
export class CodigoEmUso extends Error {
  constructor(
    public readonly codigo: string,
    public readonly nomeDoOutro: string,
  ) {
    super("Código interno em uso.");
    this.name = "CodigoEmUso";
  }
}
/** SPEC-024 (5.2): reativar um item cujo código outro item ativo já usa. */
export class CodigoEmUsoAoReativar extends Error {
  constructor(public readonly codigo: string) {
    super("Código interno em uso ao reativar.");
    this.name = "CodigoEmUsoAoReativar";
  }
}
/** Nome já usado na mesma categoria do negócio (INV-003). */
export class SubcategoriaRepetida extends Error {
  constructor(
    public readonly nome: string,
    public readonly categoria: CategoriaItem,
  ) {
    super("Já existe uma subcategoria com esse nome.");
    this.name = "SubcategoriaRepetida";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (d: { toString(): string } | null) => (d === null ? null : Number(d.toString()));
const ehUnicidade = (e: unknown) =>
  typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
const subcategoriaDoItem = { select: { id: true, nome: true } } as const;

/** SPEC-020 (5.4): o filtro de subcategoria é o id de uma subcategoria ou "sem" (itens sem subcategoria). */
export const SEM_SUBCATEGORIA = "sem";

/** SPEC-021 (5.5): produtos físicos ativos sem NCM, ou com NCM fora da tabela vigente. */
export type FiltroDeNcm = "sem" | "revisar";
export const FILTROS_DE_NCM: FiltroDeNcm[] = ["sem", "revisar"];

/** SPEC-024 (5.5): itens ativos sem código interno. */
export type FiltroDeCodigo = "sem";

export type FiltroDoCatalogo = {
  busca?: string;
  tipo?: TipoItem;
  categoria?: CategoriaItem;
  subcategoria?: string;
  arquivados?: boolean;
  ncm?: FiltroDeNcm;
  /** SPEC-024 (5.5): só os itens sem código interno. */
  codigo?: FiltroDeCodigo;
};

/** Condição do filtro de subcategoria (5.4); valor inválido não filtra. */
export function condicaoDaSubcategoria(subcategoria?: string): { subcategoriaId?: string | null } {
  if (subcategoria === SEM_SUBCATEGORIA) return { subcategoriaId: null };
  return subcategoria && UUID.test(subcategoria) ? { subcategoriaId: subcategoria } : {};
}

/**
 * Busca por texto no nome do item ou da subcategoria (SPEC-020, 5.4), sem diferenciar maiúsculas.
 * Só dígitos (com pontos ou espaços, ao menos 2): também pelo começo do NCM (SPEC-021, 5.5).
 * Também pelo código interno que contém o texto (SPEC-024, 5.4); o exato vem primeiro (`codigoExatoPrimeiro`).
 */
export function condicaoDaBusca(busca?: string) {
  const texto = busca?.trim();
  if (!texto) return {};
  const contem = { contains: texto, mode: "insensitive" as const };
  const prefixo = prefixoDeNcmNaBusca(texto);
  return {
    OR: [{ nome: contem }, { subcategoria: { nome: contem } }, { codigo: contem }, ...(prefixo ? [{ ncm: { startsWith: prefixo } }] : [])],
  };
}

/** Linha da tabela NCM vigente no dia (AAAA-MM-DD). */
export function condicaoNcmVigente(dia: string) {
  const data = new Date(`${dia}T00:00:00Z`);
  return { vigenteDesde: { lte: data }, OR: [{ vigenteAte: null }, { vigenteAte: { gte: data } }] };
}

/** NCM do item com a descrição da tabela (5.4); `vigente` false = "fora da tabela vigente — revise". */
export type NcmDoItem = { codigo: string; descricao: string | null; vigente: boolean };

/** Resultado da busca na tabela (5.2). */
export type ResultadoDaBuscaNcm =
  | { status: "curta" }
  | { status: "ok"; resultados: { codigo: string; descricao: string }[]; maisResultados: boolean; atualizadaEm: string | null };

/** Sugestão pela subcategoria (OPEN-004): o NCM vigente mais usado e quantos itens o usam. */
export type SugestaoDeNcm = { ncm: string; descricao: string; itens: number };

export type SubcategoriaDoItem = { id: string; nome: string } | null;

/** Subcategoria na lista e nas escolhas (5.3): itens ativos e arquivados que a usam. */
export type SubcategoriaResumida = { id: string; categoria: CategoriaItem; nome: string; itensAtivos: number; itensArquivados: number };

export type ItemResumido = {
  id: string;
  tipo: TipoItem;
  nome: string;
  /** SPEC-024: código interno, ou null. */
  codigo: string | null;
  categoria: CategoriaItem;
  subcategoria: SubcategoriaDoItem;
  unidadeMedida: string;
  custoBase: number;
  precoAtual: number | null;
  materiais: number;
  /** Custo próprio + materiais (5.2): é o custo que a lista mostra e que o preço deve cobrir. */
  custoTotal: number;
  arquivado: boolean;
};

export type RegistroDePreco = {
  id: string;
  preco: number;
  anterior: number | null;
  origem: OrigemPreco;
  usuario: string;
  data: Date;
};

export type DetalheDoItem = ItemResumido & {
  ncm: NcmDoItem | null;
  comissaoPercentual: number | null;
  estoqueMinimo: number | null;
  quantidadeEstoque: number;
  custoTotal: number;
  materiaisDoServico: { materialId: string; nome: string; unidadeMedida: string; custo: number; quantidade: number; arquivado: boolean }[];
  /** Serviços ativos que usam este produto como material (aviso ao arquivar — OPEN-006). */
  usadoEm: { id: string; nome: string }[];
  historico: RegistroDePreco[];
};

export type OpcaoDeMaterial = { id: string; nome: string; unidadeMedida: string; custo: number };

/**
 * O negocioId é repetido nas criações só para os tipos do Prisma: o cliente do negócio
 * confere que é o mesmo do contexto e recusa qualquer outro (NegocioDivergente).
 */
export function criarConsultasDoCatalogo(cliente: ClienteDoNegocio, negocioId: string) {
  /** Confere os materiais (INV-003): Produtos Físicos ativos do negócio, diferentes do próprio serviço. */
  async function conferirMateriais(tx: ClienteDoNegocio, materiais: MaterialInformado[], servicoId?: string) {
    if (materiais.length === 0) return;
    const ids = materiais.map((m) => m.materialId);
    if (servicoId && ids.includes(servicoId)) throw new MaterialInvalido();
    // Arquivado só vale se já estava neste serviço (o vínculo é mantido — OPEN-006).
    const validos = await tx.item.count({
      where: {
        id: { in: ids },
        tipo: "PRODUTO_FISICO",
        OR: [{ arquivadoEm: null }, ...(servicoId ? [{ usadoEm: { some: { servicoId } } }] : [])],
      },
    });
    if (validos !== ids.length) throw new MaterialInvalido();
  }

  const semMinimo = <T extends { estoqueMinimo: unknown }>(campos: T): Omit<T, "estoqueMinimo"> => {
    const copia: Partial<T> = { ...campos };
    delete copia.estoqueMinimo;
    return copia as Omit<T, "estoqueMinimo">;
  };

  /** A subcategoria informada é do negócio (cliente do negócio) e da categoria do item (INV-002). */
  async function conferirSubcategoria(tx: ClienteDoNegocio, d: DadosDoItem) {
    if (d.subcategoriaId === null) return;
    const s = await tx.subcategoria.findFirst({ where: { id: d.subcategoriaId }, select: { categoria: true } });
    if (!s || s.categoria !== d.categoria) throw new SubcategoriaInvalida(d.categoria);
  }

  /** Descrição e vigência de um código (5.4): a linha vigente no dia ou, se não houver, a mais recente. */
  async function descreverNcm(tx: ClienteDoNegocio, codigo: string, dia = hoje()): Promise<NcmDoItem> {
    const campos = { descricao: true, caminho: true } as const;
    const vigente = await tx.ncm.findFirst({ where: { codigo, ...condicaoNcmVigente(dia) }, select: campos });
    const linha = vigente ?? (await tx.ncm.findFirst({ where: { codigo }, orderBy: { vigenteDesde: "desc" }, select: campos }));
    return { codigo, descricao: linha ? descricaoDoNcm(linha.caminho, linha.descricao) : null, vigente: vigente !== null };
  }

  /**
   * SPEC-021 (5.7): com a opção de nota fiscal ligada, produto físico sem NCM é recusado (RN35);
   * um NCM novo ou trocado precisa estar vigente; o igual ao gravado fica, mesmo fora da tabela (OPEN-002).
   */
  async function conferirNcm(tx: ClienteDoNegocio, d: DadosDoItem, gravado: string | null) {
    if (d.tipo !== "PRODUTO_FISICO") return;
    if (d.ncm === null) {
      const negocio = await tx.negocio.findFirst({ select: { emiteNotaDeProduto: true } });
      if (negocio?.emiteNotaDeProduto) throw new NcmObrigatorio();
      return;
    }
    if (d.ncm === gravado) return;
    if ((await tx.ncm.count({ where: { codigo: d.ncm, ...condicaoNcmVigente(hoje()) } })) === 0) throw new NcmForaDaTabela();
  }

  /** Códigos usados por produtos físicos ativos que não estão na tabela vigente (5.5, "NCM a revisar"). */
  async function codigosForaDaTabela(dia = hoje()): Promise<string[]> {
    const usados = await cliente.item.findMany({
      where: { tipo: "PRODUTO_FISICO", arquivadoEm: null, ncm: { not: null } },
      select: { ncm: true },
      distinct: ["ncm"],
    });
    const codigos = usados.map((u) => u.ncm!);
    if (!codigos.length) return [];
    const vigentes = await cliente.ncm.findMany({ where: { codigo: { in: codigos }, ...condicaoNcmVigente(dia) }, select: { codigo: true } });
    const ok = new Set(vigentes.map((v) => v.codigo));
    return codigos.filter((c) => !ok.has(c));
  }

  /** O item ativo (outro que não `excetoId`) que já usa o código (SPEC-024, 5.2), ou null. */
  async function donoDoCodigo(tx: ClienteDoNegocio, codigo: string | null, excetoId?: string) {
    if (codigo === null) return null;
    return tx.item.findFirst({ where: { codigoChave: codigo, ...(excetoId ? { id: { not: excetoId } } : {}) }, select: { nome: true } });
  }

  /** Conflito de unicidade (P2002): o código, se outro item ativo o usa; senão, o nome (INV-001, OPEN-003 da SPEC-006). */
  async function erroDeUnicidade(codigo: string | null, excetoId?: string): Promise<Error> {
    const outro = await donoDoCodigo(cliente, codigo, excetoId);
    return outro && codigo ? new CodigoEmUso(codigo, outro.nome) : new NomeDuplicado();
  }

  const camposDoItem = (d: DadosDoItem) => ({
    nome: d.nome,
    nomeChave: d.nomeChave,
    codigo: d.codigo,
    codigoChave: d.codigo,
    categoria: d.categoria,
    subcategoriaId: d.subcategoriaId,
    ncm: d.tipo === "PRODUTO_FISICO" ? d.ncm : null,
    unidadeMedida: d.unidadeMedida,
    custoBase: d.custoBase,
    comissaoPercentual: d.comissaoPercentual,
    estoqueMinimo: d.tipo === "PRODUTO_FISICO" ? d.estoqueMinimo : null,
  });

  /** Grava um preço oficial e o registro do histórico na mesma transação (INV-004, INV-005). */
  async function gravarPreco(
    tx: ClienteDoNegocio,
    itemId: string,
    preco: number,
    usuarioId: string,
    origem: OrigemPreco,
    calculo: Record<string, unknown> = {},
  ) {
    await tx.historicoPreco.create({ data: { negocioId, itemId, usuarioId, preco, origem, ...calculo } });
    await tx.item.update({ where: { id: itemId }, data: { precoAtual: preco } });
  }

  return {
    async listar(filtro: FiltroDoCatalogo = {}): Promise<ItemResumido[]> {
      const foraDaTabela = filtro.ncm === "revisar" ? await codigosForaDaTabela() : [];
      const itens = await cliente.item.findMany({
        where: {
          arquivadoEm: filtro.arquivados ? { not: null } : null,
          ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
          // SPEC-021 (5.5): só produtos físicos sem NCM, ou com NCM fora da tabela vigente.
          ...(filtro.ncm === "sem" ? { tipo: "PRODUTO_FISICO" as const, ncm: null } : {}),
          ...(filtro.ncm === "revisar" ? { tipo: "PRODUTO_FISICO" as const, ncm: { in: foraDaTabela } } : {}),
          ...(filtro.categoria ? { categoria: filtro.categoria, ...condicaoDaSubcategoria(filtro.subcategoria) } : {}),
          // SPEC-024 (5.5): itens sem código interno.
          ...(filtro.codigo === "sem" ? { codigo: null } : {}),
          ...condicaoDaBusca(filtro.busca),
        },
        select: {
          id: true,
          tipo: true,
          nome: true,
          codigo: true,
          categoria: true,
          subcategoria: subcategoriaDoItem,
          unidadeMedida: true,
          custoBase: true,
          precoAtual: true,
          arquivadoEm: true,
          materiais: { select: { quantidade: true, material: { select: { custoBase: true } } } },
        },
        orderBy: { nome: "asc" },
        take: 1000,
      });
      const resumidos = itens.map((i) => ({
        id: i.id,
        tipo: i.tipo,
        nome: i.nome,
        codigo: i.codigo,
        categoria: i.categoria,
        subcategoria: i.subcategoria,
        unidadeMedida: i.unidadeMedida,
        custoBase: num(i.custoBase)!,
        precoAtual: num(i.precoAtual),
        materiais: i.materiais.length,
        custoTotal: custoTotal(
          num(i.custoBase)!,
          i.materiais.map((m) => ({ custo: num(m.material.custoBase)!, quantidade: num(m.quantidade)! })),
        ),
        arquivado: i.arquivadoEm !== null,
      }));
      // SPEC-024 (5.4): o item com o código exato da busca vem primeiro.
      return codigoExatoPrimeiro(resumidos, filtro.busca);
    },

    async detalhar(id: string): Promise<DetalheDoItem> {
      if (!UUID.test(id)) throw new ItemNaoEncontrado();
      const i = await cliente.item.findFirst({
        where: { id },
        include: {
          subcategoria: subcategoriaDoItem,
          materiais: { include: { material: true }, orderBy: { material: { nome: "asc" } } },
          usadoEm: { where: { servico: { arquivadoEm: null } }, include: { servico: { select: { id: true, nome: true } } } },
          historicoPrecos: { include: { usuario: { select: { nome: true } } }, orderBy: { dataConfirmacao: "desc" } },
          _count: { select: { materiais: true } },
        },
      });
      if (!i) throw new ItemNaoEncontrado();
      const materiaisDoServico = i.materiais.map((m) => ({
        materialId: m.materialId,
        nome: m.material.nome,
        unidadeMedida: m.material.unidadeMedida,
        custo: num(m.material.custoBase)!,
        quantidade: num(m.quantidade)!,
        arquivado: m.material.arquivadoEm !== null,
      }));
      const historico = i.historicoPrecos.map((h, idx, lista) => ({
        id: h.id,
        preco: num(h.preco)!,
        anterior: idx + 1 < lista.length ? num(lista[idx + 1].preco) : null,
        origem: h.origem,
        usuario: h.usuario.nome,
        data: h.dataConfirmacao,
      }));
      return {
        id: i.id,
        tipo: i.tipo,
        nome: i.nome,
        codigo: i.codigo,
        categoria: i.categoria,
        subcategoria: i.subcategoria,
        unidadeMedida: i.unidadeMedida,
        custoBase: num(i.custoBase)!,
        precoAtual: num(i.precoAtual),
        materiais: i._count.materiais,
        arquivado: i.arquivadoEm !== null,
        ncm: i.ncm ? await descreverNcm(cliente, i.ncm) : null,
        comissaoPercentual: num(i.comissaoPercentual),
        estoqueMinimo: num(i.estoqueMinimo),
        quantidadeEstoque: num(i.quantidadeEstoque)!,
        custoTotal: custoTotal(num(i.custoBase)!, materiaisDoServico),
        materiaisDoServico,
        usadoEm: i.usadoEm.map((u) => u.servico),
        historico,
      };
    },

    /** Produtos Físicos ativos que podem ser materiais (exceto o próprio item). */
    async opcoesDeMaterial(excetoId?: string): Promise<OpcaoDeMaterial[]> {
      const itens = await cliente.item.findMany({
        where: { tipo: "PRODUTO_FISICO", arquivadoEm: null, ...(excetoId ? { id: { not: excetoId } } : {}) },
        select: { id: true, nome: true, unidadeMedida: true, custoBase: true },
        orderBy: { nome: "asc" },
      });
      return itens.map((i) => ({ id: i.id, nome: i.nome, unidadeMedida: i.unidadeMedida, custo: num(i.custoBase)! }));
    },

    /** Cria o item (estoque zero — INV-001), os materiais e, se houver, o primeiro preço. */
    async criar(dados: DadosDoItem, usuarioId: string): Promise<string> {
      try {
        return await cliente.$transaction(async (tx) => {
          await conferirMateriais(tx as ClienteDoNegocio, dados.materiais);
          await conferirSubcategoria(tx as ClienteDoNegocio, dados);
          await conferirNcm(tx as ClienteDoNegocio, dados, null);
          const outro = await donoDoCodigo(tx as ClienteDoNegocio, dados.codigo);
          if (outro) throw new CodigoEmUso(dados.codigo!, outro.nome);
          const item = await tx.item.create({
            data: { ...camposDoItem(dados), negocioId, tipo: dados.tipo, quantidadeEstoque: 0 },
            select: { id: true },
          });
          if (dados.materiais.length) {
            await tx.materialServico.createMany({
              data: dados.materiais.map((m) => ({ negocioId, servicoId: item.id, materialId: m.materialId, quantidade: m.quantidade })),
            });
          }
          if (dados.precoInicial !== null) {
            await gravarPreco(tx as ClienteDoNegocio, item.id, dados.precoInicial, usuarioId, "MANUAL");
          }
          return item.id;
        });
      } catch (e) {
        if (ehUnicidade(e)) throw await erroDeUnicidade(dados.codigo);
        throw e;
      }
    },

    /** Edita os campos (nunca o tipo, o estoque ou o preço) e substitui os materiais. */
    async editar(id: string, dados: DadosDoItem): Promise<void> {
      if (!UUID.test(id)) throw new ItemNaoEncontrado();
      try {
        await cliente.$transaction(async (tx) => {
          const atual = await tx.item.findFirst({ where: { id }, select: { tipo: true, arquivadoEm: true, ncm: true } });
          if (!atual) throw new ItemNaoEncontrado();
          if (atual.tipo === "SERVICO") await conferirMateriais(tx as ClienteDoNegocio, dados.materiais, id);
          await conferirSubcategoria(tx as ClienteDoNegocio, dados);
          await conferirNcm(tx as ClienteDoNegocio, dados, atual.ncm);
          // SPEC-024 (5.2): o arquivado não ocupa o código, então só o item ativo confere a repetição.
          const outro = atual.arquivadoEm ? null : await donoDoCodigo(tx as ClienteDoNegocio, dados.codigo, id);
          if (outro) throw new CodigoEmUso(dados.codigo!, outro.nome);
          await tx.item.update({
            where: { id },
            // Arquivado não ocupa o nome nem o código (OPEN-003; SPEC-024, RN40): as chaves só voltam ao reativar.
            // O mínimo manual não muda pela edição do Catálogo: depois do cadastro, só pelo Estoque (SPEC-007, OPEN-001).
            data: {
              ...semMinimo(camposDoItem(dados)),
              nomeChave: atual.arquivadoEm ? null : dados.nomeChave,
              codigoChave: atual.arquivadoEm ? null : dados.codigo,
            },
          });
          if (atual.tipo === "SERVICO") {
            await tx.materialServico.deleteMany({ where: { servicoId: id } });
            if (dados.materiais.length) {
              await tx.materialServico.createMany({
                data: dados.materiais.map((m) => ({ negocioId, servicoId: id, materialId: m.materialId, quantidade: m.quantidade })),
              });
            }
          }
        });
      } catch (e) {
        if (ehUnicidade(e)) throw await erroDeUnicidade(dados.codigo, id);
        throw e;
      }
    },

    /** Contagens do link "Itens sem código" (SPEC-024, 5.5): itens ativos com e sem código interno. */
    async contagensDoCodigo(): Promise<{ comCodigo: number; semCodigo: number }> {
      const [comCodigo, semCodigo] = await Promise.all([
        cliente.item.count({ where: { arquivadoEm: null, codigo: { not: null } } }),
        cliente.item.count({ where: { arquivadoEm: null, codigo: null } }),
      ]);
      return { comCodigo, semCodigo };
    },

    /** Contagens do Catálogo (5.5): produtos físicos ativos sem NCM e com NCM fora da tabela vigente. */
    async contagensDoNcm(): Promise<{ semNcm: number; foraDaTabela: number }> {
      const [semNcm, fora] = await Promise.all([
        cliente.item.count({ where: { tipo: "PRODUTO_FISICO", arquivadoEm: null, ncm: null } }),
        codigosForaDaTabela(),
      ]);
      const foraDaTabela = fora.length ? await cliente.item.count({ where: { tipo: "PRODUTO_FISICO", arquivadoEm: null, ncm: { in: fora } } }) : 0;
      return { semNcm, foraDaTabela };
    },

    /** A opção "Emito nota fiscal de produtos" do negócio (OPEN-005, RN35). */
    async emiteNotaDeProduto(): Promise<boolean> {
      const n = await cliente.negocio.findFirst({ select: { emiteNotaDeProduto: true } });
      return n?.emiteNotaDeProduto ?? false;
    },

    /** Busca na tabela vigente (5.2): começo do código ou todas as palavras; até 20, em ordem de código. */
    async buscarNcm(texto: string, dia = hoje()): Promise<ResultadoDaBuscaNcm> {
      const termos = termosDaBusca(texto);
      if (termos.tipo === "curta") return { status: "curta" };
      const condicao =
        termos.tipo === "codigo" ? { codigo: { startsWith: termos.prefixo } } : { AND: termos.palavras.map((p) => ({ textoBusca: { contains: p } })) };
      const [linhas, versao] = await Promise.all([
        cliente.ncm.findMany({
          where: { ...condicao, ...condicaoNcmVigente(dia) },
          select: { codigo: true, descricao: true, caminho: true },
          orderBy: { codigo: "asc" },
          take: LIMITE_DA_BUSCA + 1,
        }),
        cliente.tabelaNcm.findFirst({ select: { atualizadaEm: true } }),
      ]);
      return {
        status: "ok",
        resultados: linhas.slice(0, LIMITE_DA_BUSCA).map((l) => ({ codigo: l.codigo, descricao: descricaoDoNcm(l.caminho, l.descricao) })),
        maisResultados: linhas.length > LIMITE_DA_BUSCA,
        atualizadaEm: versao ? versao.atualizadaEm.toISOString().slice(0, 10) : null,
      };
    },

    /** Confere um código digitado (5.2): descrição e vigência; null se o código não existe na tabela. */
    async conferirCodigoNcm(codigo: string, dia = hoje()): Promise<NcmDoItem | null> {
      const d = await descreverNcm(cliente, codigo, dia);
      return d.descricao === null ? null : d;
    },

    /**
     * Sugestões pela subcategoria (OPEN-004): por subcategoria, o NCM vigente mais usado pelos outros
     * produtos físicos ativos do negócio (no empate, o menor código). Não grava nada (INV-003).
     */
    async sugestoesDeNcm(excetoItemId?: string, dia = hoje()): Promise<Record<string, SugestaoDeNcm>> {
      const itens = await cliente.item.findMany({
        where: {
          tipo: "PRODUTO_FISICO",
          arquivadoEm: null,
          subcategoriaId: { not: null },
          ncm: { not: null },
          ...(excetoItemId ? { id: { not: excetoItemId } } : {}),
        },
        select: { subcategoriaId: true, ncm: true },
      });
      if (!itens.length) return {};
      const codigos = [...new Set(itens.map((i) => i.ncm!))];
      const vigentes = await cliente.ncm.findMany({
        where: { codigo: { in: codigos }, ...condicaoNcmVigente(dia) },
        select: { codigo: true, descricao: true, caminho: true },
      });
      const descricao = new Map(vigentes.map((v) => [v.codigo, descricaoDoNcm(v.caminho, v.descricao)]));
      const contagem = new Map<string, Map<string, number>>();
      for (const i of itens) {
        if (!descricao.has(i.ncm!)) continue;
        const porNcm = contagem.get(i.subcategoriaId!) ?? new Map<string, number>();
        porNcm.set(i.ncm!, (porNcm.get(i.ncm!) ?? 0) + 1);
        contagem.set(i.subcategoriaId!, porNcm);
      }
      const sugestoes: Record<string, SugestaoDeNcm> = {};
      for (const [subcategoriaId, porNcm] of contagem) {
        const [ncm, quantos] = [...porNcm].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
        sugestoes[subcategoriaId] = { ncm, descricao: descricao.get(ncm)!, itens: quantos };
      }
      return sugestoes;
    },

    async tipoDoItem(id: string): Promise<TipoItem> {
      if (!UUID.test(id)) throw new ItemNaoEncontrado();
      const i = await cliente.item.findFirst({ where: { id }, select: { tipo: true } });
      if (!i) throw new ItemNaoEncontrado();
      return i.tipo;
    },

    /** Preço oficial (5.4). A SPEC-010 usa a mesma função com origem "CALCULADORA". */
    async definirPreco(
      id: string,
      preco: number,
      usuarioId: string,
      origem: OrigemPreco = "MANUAL",
      calculo: Record<string, unknown> = {},
    ): Promise<{ custoTotal: number }> {
      if (!UUID.test(id)) throw new ItemNaoEncontrado();
      return cliente.$transaction(async (tx) => {
        const i = await tx.item.findFirst({
          where: { id },
          select: { precoAtual: true, custoBase: true, materiais: { select: { quantidade: true, material: { select: { custoBase: true } } } } },
        });
        if (!i) throw new ItemNaoEncontrado();
        // A confirmação pela Calculadora registra também o mesmo preço: documenta a revisão com os
        // parâmetros do dia (SPEC-010, 5.3). O preço manual igual ao atual continua recusado.
        if (origem === "MANUAL" && i.precoAtual !== null && num(i.precoAtual) === preco) throw new PrecoIgualAoAtual();
        await gravarPreco(tx as ClienteDoNegocio, id, preco, usuarioId, origem, calculo);
        return {
          custoTotal: custoTotal(
            num(i.custoBase)!,
            i.materiais.map((m) => ({ custo: num(m.material.custoBase)!, quantidade: num(m.quantidade)! })),
          ),
        };
      });
    },

    /** Arquiva (some das listas e escolhas; libera o nome) ou reativa (OPEN-001). */
    async arquivar(id: string, arquivar: boolean): Promise<{ usadoEm: { id: string; nome: string }[] }> {
      if (!UUID.test(id)) throw new ItemNaoEncontrado();
      let codigo: string | null = null;
      try {
        return await cliente.$transaction(async (tx) => {
          const i = await tx.item.findFirst({
            where: { id },
            select: {
              nome: true,
              codigo: true,
              usadoEm: { where: { servico: { arquivadoEm: null } }, select: { servico: { select: { id: true, nome: true } } } },
            },
          });
          if (!i) throw new ItemNaoEncontrado();
          codigo = i.codigo;
          // SPEC-024 (5.2, INV-006): reativar com o código em uso por outro item ativo é recusado.
          if (!arquivar && (await donoDoCodigo(tx as ClienteDoNegocio, i.codigo, id))) throw new CodigoEmUsoAoReativar(i.codigo!);
          await tx.item.update({
            where: { id },
            data: arquivar
              ? { arquivadoEm: new Date(), nomeChave: null, codigoChave: null }
              : { arquivadoEm: null, nomeChave: normalizarNome(i.nome), codigoChave: i.codigo },
          });
          return { usadoEm: arquivar ? i.usadoEm.map((u) => u.servico) : [] };
        });
      } catch (e) {
        if (ehUnicidade(e)) {
          const erro = await erroDeUnicidade(codigo, id);
          throw erro instanceof CodigoEmUso ? new CodigoEmUsoAoReativar(erro.codigo) : erro;
        }
        throw e;
      }
    },

    // Subcategorias do negócio (SPEC-020, RF79).

    /** Na ordem da lista fixa (a ordem do enum no banco) e por nome, com os itens que a usam. */
    async subcategorias(categoria?: CategoriaItem): Promise<SubcategoriaResumida[]> {
      const [lista, arquivados] = await Promise.all([
        cliente.subcategoria.findMany({
          where: categoria ? { categoria } : {},
          select: { id: true, categoria: true, nome: true, _count: { select: { itens: { where: { arquivadoEm: null } } } } },
          orderBy: [{ categoria: "asc" }, { nomeChave: "asc" }],
        }),
        cliente.item.groupBy({ by: ["subcategoriaId"], where: { subcategoriaId: { not: null }, arquivadoEm: { not: null } }, _count: { _all: true } }),
      ]);
      const porSubcategoria = new Map(arquivados.map((a) => [a.subcategoriaId, a._count._all]));
      return lista.map((s) => ({
        id: s.id,
        categoria: s.categoria,
        nome: s.nome,
        itensAtivos: s._count.itens,
        itensArquivados: porSubcategoria.get(s.id) ?? 0,
      }));
    },

    async criarSubcategoria(d: DadosDaSubcategoria): Promise<{ id: string; categoria: CategoriaItem; nome: string }> {
      try {
        return await cliente.subcategoria.create({
          data: { negocioId, categoria: d.categoria, nome: d.nome, nomeChave: d.nomeChave },
          select: { id: true, categoria: true, nome: true },
        });
      } catch (e) {
        if (ehUnicidade(e)) throw new SubcategoriaRepetida(d.nome, d.categoria);
        throw e;
      }
    },

    /** Renomeia (5.3): os itens passam a mostrar o nome novo; a categoria não muda. */
    async renomearSubcategoria(id: string, nome: { nome: string; nomeChave: string }): Promise<{ id: string; categoria: CategoriaItem; nome: string }> {
      if (!UUID.test(id)) throw new SubcategoriaNaoEncontrada();
      const atual = await cliente.subcategoria.findFirst({ where: { id }, select: { categoria: true } });
      if (!atual) throw new SubcategoriaNaoEncontrada();
      try {
        return await cliente.subcategoria.update({
          where: { id },
          data: { nome: nome.nome, nomeChave: nome.nomeChave },
          select: { id: true, categoria: true, nome: true },
        });
      } catch (e) {
        if (ehUnicidade(e)) throw new SubcategoriaRepetida(nome.nome, atual.categoria);
        throw e;
      }
    },

    /** Itens que usam a subcategoria, ativos e arquivados (confirmação da exclusão — 5.3). */
    async usoDaSubcategoria(id: string): Promise<{ nome: string; categoria: CategoriaItem; itensAtivos: number; itensArquivados: number }> {
      if (!UUID.test(id)) throw new SubcategoriaNaoEncontrada();
      const s = await cliente.subcategoria.findFirst({ where: { id }, select: { nome: true, categoria: true } });
      if (!s) throw new SubcategoriaNaoEncontrada();
      const [itensAtivos, itensArquivados] = await Promise.all([
        cliente.item.count({ where: { subcategoriaId: id, arquivadoEm: null } }),
        cliente.item.count({ where: { subcategoriaId: id, arquivadoEm: { not: null } } }),
      ]);
      return { ...s, itensAtivos, itensArquivados };
    },

    /**
     * Exclui (OPEN-004): os itens que a usavam ficam sem subcategoria na mesma transação
     * (a chave estrangeira faz o mesmo; a atualização explícita deixa a contagem no resultado).
     * Nenhum outro campo do item muda (INV-004).
     */
    async excluirSubcategoria(id: string): Promise<{ itensAfetados: number }> {
      if (!UUID.test(id)) throw new SubcategoriaNaoEncontrada();
      return cliente.$transaction(async (tx) => {
        const s = await tx.subcategoria.findFirst({ where: { id }, select: { id: true } });
        if (!s) throw new SubcategoriaNaoEncontrada();
        const { count } = await tx.item.updateMany({ where: { subcategoriaId: id }, data: { subcategoriaId: null } });
        await tx.subcategoria.delete({ where: { id } });
        return { itensAfetados: count };
      });
    },
  };
}

export type ConsultasDoCatalogo = ReturnType<typeof criarConsultasDoCatalogo>;
