import type { ContaExportada, LancamentoExportado, VendaExportada } from "@/lib/db/relatorios";
import { diaLocal } from "@/lib/dominio/datas";
import { CATEGORIAS } from "@/lib/dominio/financeiro";
import { diaBrasileiro, quantidadeParaPlanilha as qtd, valorParaPlanilha as valor, type Rentabilidade } from "@/lib/dominio/relatorios";
import { FORMAS_DE_PAGAMENTO } from "@/lib/dominio/venda";

/**
 * Tabelas das exportações (SPEC-013, 5.4): a mesma tabela vira CSV e PDF, então os dois
 * formatos têm sempre as mesmas linhas e totais. Valores sem "R$", vírgula decimal (OPEN-006).
 */

export type Coluna = { titulo: string; largura: number; numero?: boolean };
export type Tabela = { titulo: string; colunas: Coluna[]; linhas: string[][]; totais: string[] };

const dia = (d: Date) => diaBrasileiro(diaLocal(d));
const FORMA: Record<string, string> = { ...FORMAS_DE_PAGAMENTO, CREDITO_TROCA: "Crédito de troca" };
const ORIGEM: Record<string, string> = { VENDA: "Venda", CONTA: "Conta", AVULSO: "Avulso", SALDO_INICIAL: "Saldo inicial", ESTORNO: "Estorno" };
const SITUACAO_CONTA: Record<string, Record<string, string>> = {
  PAGAR: { ABERTA: "A pagar", PARCIAL: "Paga em parte", QUITADA: "Paga", CANCELADA: "Cancelada" },
  RECEBER: { ABERTA: "A receber", PARCIAL: "Recebida em parte", QUITADA: "Recebida", CANCELADA: "Cancelada" },
};

export function tabelaDeVendas(vendas: VendaExportada[]): Tabela {
  const concluidas = vendas.filter((v) => v.status === "CONCLUIDA");
  return {
    titulo: "Vendas",
    colunas: [
      { titulo: "Nº", largura: 0.06, numero: true },
      { titulo: "Data", largura: 0.1 },
      { titulo: "Situação", largura: 0.1 },
      { titulo: "Total", largura: 0.1, numero: true },
      { titulo: "Pagamento", largura: 0.2 },
      { titulo: "Itens", largura: 0.3 },
      { titulo: "Registrada por", largura: 0.14 },
    ],
    linhas: vendas.map((v) => [
      String(v.numero),
      dia(v.data),
      v.status === "CANCELADA" ? "Cancelada" : "Concluída",
      valor(v.totalCentavos),
      v.pagamentos.map((p) => `${FORMA[p.forma] ?? p.forma}${p.parcelas > 1 ? ` ${p.parcelas}x` : ""} ${valor(p.valorCentavos)}`).join(" + "),
      v.itens.map((i) => `${qtd(i.quantidade)} ${i.nome}`).join(", "),
      v.registradaPor,
    ]),
    totais: ["", `${concluidas.length} concluídas`, vendas.length - concluidas.length ? `${vendas.length - concluidas.length} canceladas` : "", valor(concluidas.reduce((s, v) => s + v.totalCentavos, 0)), "", "", ""],
  };
}

export function tabelaDoFluxo(lancamentos: LancamentoExportado[]): Tabela {
  const comSinal = (l: LancamentoExportado) => (l.tipo === "ENTRADA" ? l.valorCentavos : -l.valorCentavos);
  const entradas = lancamentos.filter((l) => l.tipo === "ENTRADA").reduce((s, l) => s + l.valorCentavos, 0);
  const saidas = lancamentos.filter((l) => l.tipo === "SAIDA").reduce((s, l) => s + l.valorCentavos, 0);
  return {
    titulo: "Fluxo de caixa",
    colunas: [
      { titulo: "Data", largura: 0.1 },
      { titulo: "Tipo", largura: 0.08 },
      { titulo: "Origem", largura: 0.11 },
      { titulo: "Categoria", largura: 0.13 },
      { titulo: "Descrição", largura: 0.36 },
      { titulo: "Valor", largura: 0.12, numero: true },
      { titulo: "Estornado", largura: 0.1 },
    ],
    linhas: lancamentos.map((l) => [
      dia(l.data),
      l.tipo === "ENTRADA" ? "Entrada" : "Saída",
      ORIGEM[l.origem] ?? l.origem,
      CATEGORIAS[l.categoria],
      l.descricao ?? (l.vendaNumero !== null ? `Venda nº ${l.vendaNumero}` : (l.conta ?? "")),
      valor(comSinal(l)),
      l.estornado ? "Sim" : "",
    ]),
    totais: ["", "", "", "", `Entradas ${valor(entradas)} · Saídas ${valor(saidas)}`, valor(entradas - saidas), ""],
  };
}

export function tabelaDeContas(contas: ContaExportada[]): Tabela {
  const restante = (c: ContaExportada) => (c.status === "CANCELADA" ? 0 : c.totalCentavos - c.pagoCentavos);
  const somar = (tipo: "PAGAR" | "RECEBER") => contas.filter((c) => c.tipo === tipo).reduce((s, c) => s + restante(c), 0);
  return {
    titulo: "Contas a pagar e a receber",
    colunas: [
      { titulo: "Tipo", largura: 0.09 },
      { titulo: "Descrição", largura: 0.3 },
      { titulo: "Categoria", largura: 0.13 },
      { titulo: "Vencimento", largura: 0.1 },
      { titulo: "Situação", largura: 0.13 },
      { titulo: "Total", largura: 0.08, numero: true },
      { titulo: "Pago", largura: 0.08, numero: true },
      { titulo: "Restante", largura: 0.09, numero: true },
    ],
    linhas: contas.map((c) => [
      c.tipo === "PAGAR" ? "A pagar" : "A receber",
      c.descricao ?? "",
      CATEGORIAS[c.categoria],
      dia(c.vencimento),
      SITUACAO_CONTA[c.tipo][c.status],
      valor(c.totalCentavos),
      valor(c.pagoCentavos),
      valor(restante(c)),
    ]),
    totais: ["", `A receber ${valor(somar("RECEBER"))} · A pagar ${valor(somar("PAGAR"))}`, "", "", "", "", "", ""],
  };
}

export function tabelaDeRentabilidade(r: Rentabilidade): Tabela {
  const pct = (p: number | null) => (p === null ? "" : `${String(p).replace(".", ",")}%`);
  return {
    titulo: "Rentabilidade por item",
    colunas: [
      { titulo: "Item", largura: 0.3 },
      { titulo: "Quantidade", largura: 0.11, numero: true },
      { titulo: "Faturamento", largura: 0.13, numero: true },
      { titulo: "Custo", largura: 0.13, numero: true },
      { titulo: "Margem", largura: 0.13, numero: true },
      { titulo: "Margem %", largura: 0.1, numero: true },
      { titulo: "Observação", largura: 0.1 },
    ],
    linhas: r.itens.map((i) => [
      i.nome + (i.arquivado ? " (arquivado)" : ""),
      qtd(i.quantidade),
      valor(i.faturamentoCentavos),
      valor(i.custoCentavos),
      valor(i.margemCentavos),
      pct(i.margemPercentual),
      i.linhasSemCusto ? "sem custo" : "",
    ]),
    totais: ["Total", qtd(r.totais.quantidade), valor(r.totais.faturamentoCentavos), valor(r.totais.custoCentavos), valor(r.totais.margemCentavos), pct(r.totais.margemPercentual), ""],
  };
}
