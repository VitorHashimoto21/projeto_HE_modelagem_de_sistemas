import type { CategoriaLancamento, FormaPagamento, OrigemLancamento, StatusConta, StatusVenda, TipoConta, TipoLancamento } from "@/generated/prisma/enums";
import { intervaloDoDia } from "@/lib/dominio/datas";
import { centavosDe } from "@/lib/dominio/financeiro";
import type { LinhaVendida } from "@/lib/dominio/relatorios";
import type { ClienteDoNegocio } from "./cliente-do-negocio";

/**
 * Leituras dos relatórios do plano pago (SPEC-013, 5.3 e 5.4). Só leitura, pelo cliente do
 * negócio; o SQL direto filtra o negocioId à mão (INV-008). Período em dias locais [de, ate].
 */

export type VendaExportada = {
  numero: number;
  data: Date;
  status: StatusVenda;
  totalCentavos: number;
  pagamentos: { forma: FormaPagamento; valorCentavos: number; parcelas: number }[];
  itens: { nome: string; quantidade: number }[];
  registradaPor: string;
};

export type LancamentoExportado = {
  data: Date;
  tipo: TipoLancamento;
  origem: OrigemLancamento;
  categoria: CategoriaLancamento;
  descricao: string | null;
  valorCentavos: number;
  vendaNumero: number | null;
  conta: string | null;
  estornado: boolean;
};

export type ContaExportada = {
  tipo: TipoConta;
  descricao: string | null;
  categoria: CategoriaLancamento;
  vencimento: Date;
  status: StatusConta;
  totalCentavos: number;
  pagoCentavos: number;
};

const num = (v: unknown) => Number(String(v));

export function criarConsultasDeRelatorios(cliente: ClienteDoNegocio, negocioId: string) {
  const periodo = (de: string, ate: string) => ({ gte: intervaloDoDia(de).inicio, lt: intervaloDoDia(ate).fim });

  return {
    /** Itens vendidos no período, só vendas concluídas (RF70, RN25). */
    async rentabilidade(de: string, ate: string): Promise<LinhaVendida[]> {
      const p = periodo(de, ate);
      const linhas = await cliente.$queryRaw<
        { itemId: string; nome: string; codigo: string | null; arquivado: boolean; quantidade: unknown; faturamento: unknown; custo: unknown; semCusto: bigint }[]
      >`
        SELECT i.id AS "itemId", i.nome, i.codigo, (i."arquivadoEm" IS NOT NULL) AS arquivado,
               SUM(iv.quantidade) AS quantidade,
               SUM(ROUND(iv."precoUnitario" * iv.quantidade, 2)) AS faturamento,
               SUM(ROUND(iv."custoUnitario" * iv.quantidade, 2)) AS custo,
               COUNT(*) FILTER (WHERE iv."custoUnitario" = 0) AS "semCusto"
        FROM "ItemVenda" iv
        JOIN "Venda" v ON v.id = iv."vendaId"
        JOIN "Item" i ON i.id = iv."itemId"
        WHERE v."negocioId" = ${negocioId}::uuid AND v.status = 'CONCLUIDA' AND v."data" >= ${p.gte} AND v."data" < ${p.lt}
        GROUP BY i.id, i.nome, i.codigo, i."arquivadoEm"`;
      return linhas.map((l) => ({
        itemId: l.itemId,
        nome: l.nome,
        codigo: l.codigo,
        arquivado: l.arquivado,
        quantidade: num(l.quantidade),
        faturamentoCentavos: centavosDe(l.faturamento),
        custoCentavos: centavosDe(l.custo),
        linhasSemCusto: Number(l.semCusto),
      }));
    },

    /** Vendas do período, canceladas inclusive (marcadas na exportação — INV-007). */
    async vendas(de: string, ate: string): Promise<VendaExportada[]> {
      const lista = await cliente.venda.findMany({
        where: { data: periodo(de, ate) },
        orderBy: [{ data: "asc" }, { numero: "asc" }],
        select: {
          numero: true,
          data: true,
          status: true,
          valorTotal: true,
          registradaPor: { select: { nome: true } },
          pagamentos: { select: { forma: true, valor: true, parcelas: true } },
          itens: { select: { quantidade: true, item: { select: { nome: true } } } },
        },
      });
      return lista.map((v) => ({
        numero: v.numero,
        data: v.data,
        status: v.status,
        totalCentavos: centavosDe(v.valorTotal),
        pagamentos: v.pagamentos.map((p) => ({ forma: p.forma, valorCentavos: centavosDe(p.valor), parcelas: p.parcelas })),
        itens: v.itens.map((i) => ({ nome: i.item.nome, quantidade: num(i.quantidade) })),
        registradaPor: v.registradaPor.nome,
      }));
    },

    /** Lançamentos do período (o mesmo extrato do fluxo de caixa — INV-007). */
    async lancamentos(de: string, ate: string): Promise<LancamentoExportado[]> {
      const lista = await cliente.lancamentoFinanceiro.findMany({
        where: { data: periodo(de, ate) },
        orderBy: [{ data: "asc" }, { id: "asc" }],
        select: {
          data: true,
          tipo: true,
          origem: true,
          categoria: true,
          descricao: true,
          valor: true,
          venda: { select: { numero: true } },
          conta: { select: { descricao: true } },
          estornadoPor: { select: { id: true } },
        },
      });
      return lista.map((l) => ({
        data: l.data,
        tipo: l.tipo,
        origem: l.origem,
        categoria: l.categoria,
        descricao: l.descricao,
        valorCentavos: centavosDe(l.valor),
        vendaNumero: l.venda?.numero ?? null,
        conta: l.conta?.descricao ?? null,
        estornado: l.estornadoPor !== null,
      }));
    },

    /** Contas com vencimento no período, em qualquer situação. */
    async contas(de: string, ate: string): Promise<ContaExportada[]> {
      const lista = await cliente.contaPagarReceber.findMany({
        where: { vencimento: periodo(de, ate) },
        orderBy: [{ vencimento: "asc" }, { id: "asc" }],
        select: { tipo: true, descricao: true, categoria: true, vencimento: true, status: true, valorTotal: true, valorPago: true },
      });
      return lista.map((c) => ({
        tipo: c.tipo,
        descricao: c.descricao,
        categoria: c.categoria,
        vencimento: c.vencimento,
        status: c.status,
        totalCentavos: centavosDe(c.valorTotal),
        pagoCentavos: centavosDe(c.valorPago),
      }));
    },
  };
}

export type ConsultasDeRelatorios = ReturnType<typeof criarConsultasDeRelatorios>;
