import { reais, numero, ROTULO_CATEGORIA, rotuloUnidade } from "@/components/catalogo/rotulos";
import { ROTULO_MOTIVO, ROTULO_MOVIMENTACAO } from "@/components/estoque/situacao";
import type { Estado } from "@/lib/db";
import { CATEGORIAS, competenciaBrasileira } from "@/lib/dominio/financeiro";
import { formatarNcm } from "@/lib/dominio/ncm";

// O antes e o depois das correções do suporte, como o Dono lê (SPEC-019, 5.3 e 5.10). Só os
// campos da lista, na ordem do formulário; os ids ficam de fora (o nome vem ao lado).

const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const texto = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
const deUmMapa = (mapa: Record<string, string>) => (v: unknown) => (typeof v === "string" && Object.hasOwn(mapa, v) ? mapa[v] : texto(v));

type Material = { nome?: string; quantidade?: string };

const TIPOS: Record<string, string> = { PAGAR: "A pagar", RECEBER: "A receber", ENTRADA: "Entrada", SAIDA: "Saída" };
/** As categorias do item (Catálogo) e as do Financeiro usam a mesma chave. */
const categoria = deUmMapa({ ...CATEGORIAS, ...ROTULO_CATEGORIA });
const dataDoDia = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split("-").reverse().join("/") : texto(v));
const percentual = (v: unknown) => (n(v) === null ? "—" : `${numero(n(v))}%`);

const CAMPOS: [chave: string, rotulo: string, formatar: (v: unknown) => string][] = [
  ["nome", "Nome", texto],
  ["descricao", "Descrição", texto],
  ["tipo", "Tipo", deUmMapa(TIPOS)],
  ["codigo", "Código interno", texto],
  ["categoria", "Categoria", categoria],
  ["subcategoria", "Subcategoria", (v) => (v ? String(v) : "Sem subcategoria")],
  ["ncm", "NCM", (v) => (typeof v === "string" && v ? formatarNcm(v) : "—")],
  ["unidadeMedida", "Unidade", (v) => (typeof v === "string" ? rotuloUnidade(v) : "—")],
  ["custoBase", "Custo", (v) => reais(n(v))],
  ["comissaoPercentual", "Comissão", percentual],
  ["materiais", "Materiais", (v) => (Array.isArray(v) && v.length ? (v as Material[]).map((m) => `${m.nome ?? "Material"} × ${numero(n(m.quantidade))}`).join("; ") : "Nenhum")],
  ["preco", "Preço", (v) => reais(n(v))],
  ["arquivado", "Situação", (v) => (v === true ? "Arquivado" : v === false ? "Ativo" : "—")],
  ["estoqueMinimo", "Estoque mínimo", (v) => (n(v) === null ? "Sem mínimo" : numero(n(v)))],
  ["item", "Item", texto],
  ["movimento", "Movimentação", deUmMapa(ROTULO_MOVIMENTACAO)],
  ["quantidade", "Quantidade", (v) => (n(v) === null ? "—" : numero(n(v)))],
  ["motivo", "Motivo", (v) => (v ? deUmMapa(ROTULO_MOTIVO)(v) : "—")],
  // Financeiro
  ["valor", "Valor", (v) => reais(n(v))],
  ["data", "Data", dataDoDia],
  ["vencimento", "Vencimento", dataDoDia],
  ["diaVencimento", "Dia de vencimento", (v) => (n(v) === null ? "—" : `Dia ${n(v)}`)],
  ["ativo", "Situação", (v) => (v === true ? "Ativa" : v === false ? "Desativada" : "—")],
  ["geradas", "Contas geradas", (v) => (Array.isArray(v) && v.length ? (v as string[]).map(competenciaBrasileira).join(", ") : "Nenhuma")],
  // Calculadora
  ["taxaCartao", "Taxa média do cartão", percentual],
  ["capacidadeMensal", "Capacidade mensal", (v) => (n(v) === null ? "—" : numero(n(v)))],
  ["unidadeCapacidade", "Unidade da capacidade", texto],
  ["ticketMedio", "Ticket médio estimado", (v) => reais(n(v))],
  ["faturamentoEstimado", "Faturamento mensal estimado", (v) => reais(n(v))],
  ["cmvEstimado", "CMV estimado", percentual],
  ["margemMeta", "Margem de lucro meta", percentual],
];

export type LinhaDaCorrecao = { campo: string; antes: string; depois: string };

/** Uma linha por campo que a correção mudou (ou que a criação gravou). Sem o antes, "—". */
export function linhasDaCorrecao(antes: Estado, depois: Estado): LinhaDaCorrecao[] {
  return CAMPOS.filter(([chave]) => (antes !== null && chave in antes) || (depois !== null && chave in depois)).map(([chave, campo, formatar]) => ({
    campo,
    antes: antes === null ? "—" : formatar(antes[chave]),
    depois: depois === null ? "—" : formatar(depois[chave]),
  }));
}
