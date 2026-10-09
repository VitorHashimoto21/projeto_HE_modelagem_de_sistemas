import type { CategoriaItem, MotivoSaidaManual, TipoMovimentacao } from "@/generated/prisma/enums";
import { diaLocal, intervaloDoDia } from "@/lib/dominio/datas";
import {
  emAlerta,
  inicioDaJanela,
  minimoEmVigor,
  situacaoDoEstoque,
  sugestaoDeMinimo,
  type MinimoEmVigor,
  type ResumoDoConsumo,
  type Situacao,
} from "@/lib/dominio/estoque";
import { ItemNaoEncontrado } from "./catalogo";
import type { ClienteDoNegocio } from "./cliente-do-negocio";

/**
 * Estoque do negócio ativo (SPEC-007). Leituras e escritas pelo cliente do negócio; as
 * consultas SQL diretas (atualização condicional e agregados) filtram o negocioId à mão,
 * porque o cliente do negócio só intercepta as operações de modelo.
 */

export class EstoqueInsuficiente extends Error {
  constructor(public readonly saldo: number) {
    super("Estoque insuficiente.");
    this.name = "EstoqueInsuficiente";
  }
}
export class ItemSemEstoque extends Error {
  constructor() {
    super("Este item não tem estoque controlado.");
    this.name = "ItemSemEstoque";
  }
}
export class ItemArquivado extends Error {
  constructor() {
    super("Item arquivado.");
    this.name = "ItemArquivado";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (d: unknown) => (d === null || d === undefined ? null : Number(String(d)));

/** Transação (ou cliente) do negócio, como chega das SPECs 007, 008 e 011. */
type Tx = Pick<ClienteDoNegocio, "$queryRaw" | "item" | "movimentacaoEstoque">;

export type Movimento = {
  itemId: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  usuarioId: string;
  /** Instante da ocorrência (OPEN-005). */
  data: Date;
  motivo?: MotivoSaidaManual | null;
  observacao?: string | null;
  vendaId?: string | null;
  /** Movimentação manual exige item não arquivado; o estorno de venda (SPEC-011) pode dispensar. */
  exigirAtivo?: boolean;
};

/**
 * Primitiva de movimentação (5.1, 5.2, INV-001 a INV-003): atualização condicional do saldo
 * com RETURNING e inserção da movimentação, na transação de quem chama. A linha do item fica
 * travada até o fim da transação, então saídas simultâneas nunca leem o mesmo saldo e o saldo
 * nunca fica negativo. A venda (SPEC-008) e o estorno (SPEC-011) usam esta mesma função; ela
 * não verifica permissão — quem chama já passou pela guarda do próprio módulo.
 */
export async function movimentar(tx: Tx, negocioId: string, m: Movimento): Promise<{ saldoAnterior: number; saldoPosterior: number }> {
  if (!UUID.test(m.itemId)) throw new ItemNaoEncontrado();
  const q = m.quantidade.toFixed(3);
  const exigirAtivo = m.exigirAtivo ?? true;
  const entrada = m.tipo === "ENTRADA" || m.tipo === "ENTRADA_ESTORNO";

  const linhas = entrada
    ? await tx.$queryRaw<{ anterior: unknown; posterior: unknown }[]>`
        UPDATE "Item" SET "quantidadeEstoque" = "quantidadeEstoque" + ${q}::numeric
        WHERE id = ${m.itemId}::uuid AND "negocioId" = ${negocioId}::uuid AND tipo = 'PRODUTO_FISICO'
          AND (${!exigirAtivo} OR "arquivadoEm" IS NULL)
        RETURNING "quantidadeEstoque" - ${q}::numeric AS anterior, "quantidadeEstoque" AS posterior`
    : await tx.$queryRaw<{ anterior: unknown; posterior: unknown }[]>`
        UPDATE "Item" SET "quantidadeEstoque" = "quantidadeEstoque" - ${q}::numeric
        WHERE id = ${m.itemId}::uuid AND "negocioId" = ${negocioId}::uuid AND tipo = 'PRODUTO_FISICO'
          AND (${!exigirAtivo} OR "arquivadoEm" IS NULL) AND "quantidadeEstoque" >= ${q}::numeric
        RETURNING "quantidadeEstoque" + ${q}::numeric AS anterior, "quantidadeEstoque" AS posterior`;

  if (linhas.length === 0) {
    // Nada foi alterado: descobre o motivo para responder com o erro certo.
    const item = await tx.item.findFirst({ where: { id: m.itemId }, select: { tipo: true, arquivadoEm: true, quantidadeEstoque: true } });
    if (!item) throw new ItemNaoEncontrado();
    if (item.tipo !== "PRODUTO_FISICO") throw new ItemSemEstoque();
    if (exigirAtivo && item.arquivadoEm) throw new ItemArquivado();
    throw new EstoqueInsuficiente(num(item.quantidadeEstoque)!);
  }

  const { anterior, posterior } = linhas[0];
  await tx.movimentacaoEstoque.create({
    data: {
      negocioId,
      itemId: m.itemId,
      tipo: m.tipo,
      quantidade: q,
      saldoAnterior: String(anterior),
      saldoPosterior: String(posterior),
      motivo: m.tipo === "SAIDA_MANUAL" ? m.motivo! : null,
      usuarioId: m.usuarioId,
      data: m.data,
      observacao: m.observacao ?? null,
      vendaId: m.vendaId ?? null,
    },
  });
  return { saldoAnterior: num(anterior)!, saldoPosterior: num(posterior)! };
}

/** Instante gravado para a data da ocorrência: agora, se for hoje; senão, meio-dia local daquele dia. */
export function instanteDaOcorrencia(dia: string, agora = new Date()): Date {
  if (dia === diaLocal(agora)) return agora;
  return new Date(intervaloDoDia(dia).inicio.getTime() + 12 * 3_600_000);
}

export type FiltroDoEstoque = { busca?: string; categoria?: CategoriaItem; situacao?: "baixo" | "sem-estoque" };

export type ProdutoEmEstoque = {
  id: string;
  nome: string;
  categoria: CategoriaItem;
  unidadeMedida: string;
  saldo: number;
  minimoManual: number | null;
  sugestao: number | null;
  minimo: MinimoEmVigor;
  situacao: Situacao;
};

export type MovimentacaoExibida = {
  id: string;
  tipo: TipoMovimentacao;
  motivo: MotivoSaidaManual | null;
  quantidade: number;
  saldoAnterior: number;
  saldoPosterior: number;
  usuario: string;
  data: Date;
  registradoEm: Date;
  observacao: string | null;
  vendaId: string | null;
};

export type DetalheDoEstoque = ProdutoEmEstoque & {
  consumoNaJanela: { saidas: number; estornos: number; primeiroDia: string | null };
  diasCobertura: number;
  movimentacoes: MovimentacaoExibida[];
  pagina: number;
  paginas: number;
};

export const MOVIMENTACOES_POR_PAGINA = 50;

export function criarConsultasDoEstoque(cliente: ClienteDoNegocio, negocioId: string) {
  /** Uma consulta agregada para todos os itens (RNF06): ciclo, primeira data e consumo da janela. */
  async function resumos(hoje: string, itemId?: string): Promise<Map<string, ResumoDoConsumo>> {
    const desde = intervaloDoDia(inicioDaJanela(hoje)).inicio;
    const linhas = await cliente.$queryRaw<
      { itemId: string; primeira: Date; entrada: boolean; saida: boolean; saidas: unknown; estornos: unknown }[]
    >`
      SELECT "itemId",
             MIN("data") AS primeira,
             BOOL_OR(tipo = 'ENTRADA') AS entrada,
             BOOL_OR(tipo IN ('SAIDA_MANUAL', 'SAIDA_VENDA')) AS saida,
             COALESCE(SUM(quantidade) FILTER (WHERE tipo IN ('SAIDA_MANUAL', 'SAIDA_VENDA') AND "data" >= ${desde}), 0) AS saidas,
             COALESCE(SUM(quantidade) FILTER (WHERE tipo = 'ENTRADA_ESTORNO' AND "data" >= ${desde}), 0) AS estornos
      FROM "MovimentacaoEstoque"
      WHERE "negocioId" = ${negocioId}::uuid AND (${itemId ?? null}::uuid IS NULL OR "itemId" = ${itemId ?? null}::uuid)
      GROUP BY "itemId"`;
    return new Map(
      linhas.map((l) => [
        l.itemId,
        {
          cicloCompleto: l.entrada && l.saida,
          primeiroDia: diaLocal(l.primeira),
          saidasNaJanela: num(l.saidas)!,
          estornosNaJanela: num(l.estornos)!,
        },
      ]),
    );
  }

  async function diasCobertura(): Promise<number> {
    const n = await cliente.negocio.findFirst({ select: { diasCoberturaEstoque: true } });
    return n?.diasCoberturaEstoque ?? 7;
  }

  const VAZIO: ResumoDoConsumo = { cicloCompleto: false, primeiroDia: null, saidasNaJanela: 0, estornosNaJanela: 0 };

  function montar(
    i: { id: string; nome: string; categoria: CategoriaItem; unidadeMedida: string; quantidadeEstoque: unknown; estoqueMinimo: unknown },
    r: ResumoDoConsumo,
    dias: number,
    hoje: string,
  ): ProdutoEmEstoque {
    const saldo = num(i.quantidadeEstoque)!;
    const minimoManual = num(i.estoqueMinimo);
    const sugestao = sugestaoDeMinimo(r, dias, hoje);
    const minimo = minimoEmVigor(minimoManual, sugestao);
    return {
      id: i.id,
      nome: i.nome,
      categoria: i.categoria,
      unidadeMedida: i.unidadeMedida,
      saldo,
      minimoManual,
      sugestao,
      minimo,
      situacao: situacaoDoEstoque(saldo, minimo),
    };
  }

  const camposDoProduto = { id: true, nome: true, categoria: true, unidadeMedida: true, quantidadeEstoque: true, estoqueMinimo: true } as const;

  return {
    async listar(filtro: FiltroDoEstoque, hoje: string): Promise<ProdutoEmEstoque[]> {
      const [itens, mapa, dias] = await Promise.all([
        cliente.item.findMany({
          where: {
            tipo: "PRODUTO_FISICO",
            arquivadoEm: null,
            ...(filtro.categoria ? { categoria: filtro.categoria } : {}),
            ...(filtro.busca?.trim() ? { nome: { contains: filtro.busca.trim(), mode: "insensitive" as const } } : {}),
          },
          select: camposDoProduto,
          orderBy: { nome: "asc" },
          take: 2000,
        }),
        resumos(hoje),
        diasCobertura(),
      ]);
      const lista = itens.map((i) => montar(i, mapa.get(i.id) ?? VAZIO, dias, hoje));
      if (filtro.situacao === "baixo") return lista.filter((p) => emAlerta(p.situacao));
      if (filtro.situacao === "sem-estoque") return lista.filter((p) => p.situacao === "SEM_ESTOQUE");
      return lista;
    },

    async detalhar(id: string, hoje: string, pagina = 1): Promise<DetalheDoEstoque> {
      if (!UUID.test(id)) throw new ItemNaoEncontrado();
      const item = await cliente.item.findFirst({ where: { id, tipo: "PRODUTO_FISICO" }, select: camposDoProduto });
      if (!item) throw new ItemNaoEncontrado();
      const [mapa, dias, total] = await Promise.all([resumos(hoje, id), diasCobertura(), cliente.movimentacaoEstoque.count({ where: { itemId: id } })]);
      const paginas = Math.max(1, Math.ceil(total / MOVIMENTACOES_POR_PAGINA));
      const atual = Math.min(Math.max(1, Math.floor(pagina) || 1), paginas);
      const movimentacoes = await cliente.movimentacaoEstoque.findMany({
        where: { itemId: id },
        orderBy: { registradoEm: "desc" },
        skip: (atual - 1) * MOVIMENTACOES_POR_PAGINA,
        take: MOVIMENTACOES_POR_PAGINA,
        include: { usuario: { select: { nome: true } } },
      });
      const r = mapa.get(id) ?? VAZIO;
      return {
        ...montar(item, r, dias, hoje),
        consumoNaJanela: { saidas: r.saidasNaJanela, estornos: r.estornosNaJanela, primeiroDia: r.primeiroDia },
        diasCobertura: dias,
        pagina: atual,
        paginas,
        movimentacoes: movimentacoes.map((m) => ({
          id: m.id,
          tipo: m.tipo,
          motivo: m.motivo,
          quantidade: num(m.quantidade)!,
          saldoAnterior: num(m.saldoAnterior)!,
          saldoPosterior: num(m.saldoPosterior)!,
          usuario: m.usuario.nome,
          data: m.data,
          registradoEm: m.registradoEm,
          observacao: m.observacao,
          vendaId: m.vendaId,
        })),
      };
    },

    /** Registrar entrada ou saída manual (5.1, 5.2) — uma transação por movimentação. */
    async registrar(m: Movimento) {
      return cliente.$transaction((tx) => movimentar(tx as unknown as Tx, negocioId, m));
    },

    /** Mínimo manual (5.3): valor ≥ 0 ou null para voltar à sugestão. */
    async definirMinimo(id: string, valor: number | null): Promise<void> {
      if (!UUID.test(id)) throw new ItemNaoEncontrado();
      const { count } = await cliente.item.updateMany({
        where: { id, tipo: "PRODUTO_FISICO", arquivadoEm: null },
        data: { estoqueMinimo: valor === null ? null : valor.toFixed(3) },
      });
      if (count === 0) throw new ItemNaoEncontrado();
    },

    /** Contagem para o cartão do Painel (OPEN-009) e, depois, o Dashboard (SPEC-012). */
    async contarAlertas(hoje: string): Promise<{ baixo: number; semEstoque: number }> {
      const lista = await this.listar({}, hoje);
      return {
        baixo: lista.filter((p) => p.situacao === "BAIXO").length,
        semEstoque: lista.filter((p) => p.situacao === "SEM_ESTOQUE").length,
      };
    },

    /** Situação de um produto (indicador no detalhe do Catálogo — RF21). */
    async situacaoDoProduto(id: string, hoje: string): Promise<ProdutoEmEstoque | null> {
      if (!UUID.test(id)) return null;
      const item = await cliente.item.findFirst({ where: { id, tipo: "PRODUTO_FISICO" }, select: camposDoProduto });
      if (!item) return null;
      const [mapa, dias] = await Promise.all([resumos(hoje, id), diasCobertura()]);
      return montar(item, mapa.get(id) ?? VAZIO, dias, hoje);
    },
  };
}

export type ConsultasDoEstoque = ReturnType<typeof criarConsultasDoEstoque>;
