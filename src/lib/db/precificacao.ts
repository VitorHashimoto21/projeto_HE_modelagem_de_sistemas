import type { AnexoSimples, AtividadeMei, CategoriaItem, RegimeTributario, TipoItem } from "@/generated/prisma/enums";
import { custoTotal } from "@/lib/dominio/catalogo";
import { intervaloDaCompetencia } from "@/lib/dominio/datas";
import { centavosDe } from "@/lib/dominio/financeiro";
import { janelaDoRbt12 } from "@/lib/dominio/precificacao";
import { ItemNaoEncontrado } from "./catalogo";
import type { ClienteDoNegocio } from "./cliente-do-negocio";

/**
 * Dados da Calculadora de precificação (SPEC-010) do negócio ativo. Leituras pelo cliente do
 * negócio; os agregados por competência são consultas SQL diretas que filtram o negocioId à
 * mão — uma ida ao banco por agregado (RNF06). Dinheiro sai daqui em centavos.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (d: unknown) => (d === null || d === undefined ? null : Number(String(d)));

export type ItemCalculavel = {
  id: string;
  nome: string;
  tipo: TipoItem;
  categoria: CategoriaItem;
  custoBaseCentavos: number;
  custoTotalCentavos: number;
  comissao: number | null;
  precoAtualCentavos: number | null;
  materiais: { nome: string; quantidade: number; custoCentavos: number; unidadeMedida: string }[];
};

export type ParametrosDePrecificacao = {
  regime: RegimeTributario;
  anexoSimples: AnexoSimples | null;
  sujeitoFatorR: boolean;
  atividadeMei: AtividadeMei | null;
  impostoManual: number | null;
  taxaCartao: number;
  capacidadeMensal: number | null;
  unidadeCapacidade: string | null;
  ticketMedioCentavos: number | null;
  faturamentoEstimadoCentavos: number | null;
  cmvEstimado: number | null;
  margemMeta: number | null;
};

export type DadosDeParametros = {
  taxaCartao: number;
  capacidadeMensal: number | null;
  unidadeCapacidade: string | null;
  ticketMedioCentavos: number | null;
  faturamentoEstimadoCentavos: number | null;
  cmvEstimado: number | null;
  margemMeta: number | null;
};

export type HistoricoDoNegocio = {
  /** Faturamento (vendas não canceladas) por competência da janela do RBT12. */
  porCompetencia: Record<string, number>;
  /** Custo dos itens vendidos (custo unitário gravado × quantidade) na janela. */
  custoVendidoCentavos: number;
  /** Competência da primeira venda não cancelada, ou null. */
  primeiraCompetencia: string | null;
  /** Folha: saídas da categoria Salário menos os estornos delas, na janela (OPEN-007). */
  folhaCentavos: number;
};

const reais = (centavos: number | null) => (centavos === null ? null : (centavos / 100).toFixed(2));

export function criarConsultasDePrecificacao(cliente: ClienteDoNegocio, negocioId: string) {
  return {
    /** Itens ativos para a escolha na Calculadora. */
    async itens(): Promise<{ id: string; nome: string; tipo: TipoItem; precoAtualCentavos: number | null }[]> {
      const lista = await cliente.item.findMany({
        where: { arquivadoEm: null },
        select: { id: true, nome: true, tipo: true, precoAtual: true },
        orderBy: { nome: "asc" },
        take: 2000,
      });
      return lista.map((i) => ({ id: i.id, nome: i.nome, tipo: i.tipo, precoAtualCentavos: i.precoAtual === null ? null : centavosDe(i.precoAtual) }));
    },

    /** Item ativo com custo total (RF35) e comissão (RF52). */
    async item(id: string): Promise<ItemCalculavel> {
      if (!UUID.test(id)) throw new ItemNaoEncontrado();
      const i = await cliente.item.findFirst({
        where: { id, arquivadoEm: null },
        select: {
          id: true,
          nome: true,
          tipo: true,
          categoria: true,
          custoBase: true,
          comissaoPercentual: true,
          precoAtual: true,
          materiais: { select: { quantidade: true, material: { select: { nome: true, custoBase: true, unidadeMedida: true } } } },
        },
      });
      if (!i) throw new ItemNaoEncontrado();
      const materiais = i.materiais.map((m) => ({ nome: m.material.nome, quantidade: num(m.quantidade)!, custo: num(m.material.custoBase)!, unidadeMedida: m.material.unidadeMedida }));
      return {
        id: i.id,
        nome: i.nome,
        tipo: i.tipo,
        categoria: i.categoria,
        custoBaseCentavos: centavosDe(i.custoBase),
        custoTotalCentavos: Math.round(custoTotal(num(i.custoBase)!, materiais) * 100),
        comissao: num(i.comissaoPercentual),
        precoAtualCentavos: i.precoAtual === null ? null : centavosDe(i.precoAtual),
        materiais: materiais.map((m) => ({ nome: m.nome, quantidade: m.quantidade, custoCentavos: Math.round(m.custo * 100), unidadeMedida: m.unidadeMedida })),
      };
    },

    async parametros(): Promise<ParametrosDePrecificacao> {
      const n = await cliente.negocio.findFirstOrThrow({
        select: {
          regimeTributario: true,
          anexoSimples: true,
          sujeitoFatorR: true,
          atividadeMei: true,
          impostoPercentualManual: true,
          taxaCartaoMedia: true,
          capacidadeMensal: true,
          unidadeCapacidade: true,
          ticketMedioEstimado: true,
          faturamentoMensalEstimado: true,
          cmvEstimado: true,
          margemLucroMeta: true,
        },
      });
      const centavos = (v: unknown) => (v === null ? null : centavosDe(v));
      return {
        regime: n.regimeTributario,
        anexoSimples: n.anexoSimples,
        sujeitoFatorR: n.sujeitoFatorR,
        atividadeMei: n.atividadeMei,
        impostoManual: num(n.impostoPercentualManual),
        taxaCartao: num(n.taxaCartaoMedia) ?? 0,
        capacidadeMensal: num(n.capacidadeMensal),
        unidadeCapacidade: n.unidadeCapacidade,
        ticketMedioCentavos: centavos(n.ticketMedioEstimado),
        faturamentoEstimadoCentavos: centavos(n.faturamentoMensalEstimado),
        cmvEstimado: num(n.cmvEstimado),
        margemMeta: num(n.margemLucroMeta),
      };
    },

    /** Parâmetros de precificação (UC16, 5.5). */
    async salvarParametros(d: DadosDeParametros): Promise<void> {
      await cliente.negocio.updateMany({
        data: {
          taxaCartaoMedia: d.taxaCartao.toFixed(2),
          capacidadeMensal: d.capacidadeMensal === null ? null : d.capacidadeMensal.toFixed(2),
          unidadeCapacidade: d.unidadeCapacidade,
          ticketMedioEstimado: reais(d.ticketMedioCentavos),
          faturamentoMensalEstimado: reais(d.faturamentoEstimadoCentavos),
          cmvEstimado: d.cmvEstimado === null ? null : d.cmvEstimado.toFixed(2),
          margemLucroMeta: d.margemMeta === null ? null : d.margemMeta.toFixed(2),
        },
      });
    },

    /**
     * Vendas, custo vendido e folha das 12 competências anteriores (INV-005): o mesmo período
     * para RBT12, CMV% e Fator R; competências no fuso de São Paulo; canceladas fora.
     */
    async historico(compAtual: string): Promise<HistoricoDoNegocio> {
      const janela = janelaDoRbt12(compAtual);
      const desde = intervaloDaCompetencia(janela[0]).inicio;
      const ate = intervaloDaCompetencia(compAtual).inicio;
      const [vendas, [custo], [primeira], [folha]] = await Promise.all([
        cliente.$queryRaw<{ comp: string; total: unknown }[]>`
          SELECT to_char(("data" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS comp, SUM("valorTotal") AS total
          FROM "Venda"
          WHERE "negocioId" = ${negocioId}::uuid AND status <> 'CANCELADA' AND "data" >= ${desde} AND "data" < ${ate}
          GROUP BY 1`,
        cliente.$queryRaw<{ custo: unknown }[]>`
          SELECT COALESCE(SUM(iv."custoUnitario" * iv.quantidade), 0) AS custo
          FROM "ItemVenda" iv JOIN "Venda" v ON v.id = iv."vendaId"
          WHERE v."negocioId" = ${negocioId}::uuid AND v.status <> 'CANCELADA' AND v."data" >= ${desde} AND v."data" < ${ate}`,
        cliente.$queryRaw<{ comp: string | null }[]>`
          SELECT to_char((MIN("data") AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS comp
          FROM "Venda" WHERE "negocioId" = ${negocioId}::uuid AND status <> 'CANCELADA'`,
        cliente.$queryRaw<{ folha: unknown }[]>`
          SELECT COALESCE(SUM(CASE WHEN tipo = 'SAIDA' THEN valor ELSE -valor END), 0) AS folha
          FROM "LancamentoFinanceiro"
          WHERE "negocioId" = ${negocioId}::uuid AND categoria = 'SALARIO' AND (tipo = 'SAIDA' OR origem = 'ESTORNO')
            AND "data" >= ${desde} AND "data" < ${ate}`,
      ]);
      return {
        porCompetencia: Object.fromEntries(vendas.map((v) => [v.comp, centavosDe(v.total)])),
        custoVendidoCentavos: Math.round(num(custo.custo)! * 100),
        primeiraCompetencia: primeira?.comp ?? null,
        folhaCentavos: centavosDe(folha.folha),
      };
    },

    /** Soma das despesas fixas manuais ativas (o DAS entra pelo parâmetro vigente — OPEN-006). */
    async despesasFixasManuaisCentavos(): Promise<number> {
      const r = await cliente.despesaFixa.aggregate({ where: { ativo: true, origem: "MANUAL" }, _sum: { valorMensal: true } });
      return r._sum.valorMensal === null ? 0 : centavosDe(r._sum.valorMensal);
    },

    /** Anexo efetivo do último preço confirmado pela Calculadora (aviso do OPEN-008). */
    async ultimoAnexoConfirmado(): Promise<string | null> {
      const h = await cliente.historicoPreco.findFirst({
        where: { origem: "CALCULADORA" },
        orderBy: { dataConfirmacao: "desc" },
        select: { memoriaCalculo: true },
      });
      const anexo = (h?.memoriaCalculo as { anexoEfetivo?: unknown } | null)?.anexoEfetivo;
      return typeof anexo === "string" ? anexo : null;
    },
  };
}

export type ConsultasDePrecificacao = ReturnType<typeof criarConsultasDePrecificacao>;
