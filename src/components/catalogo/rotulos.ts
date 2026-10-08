import type { CategoriaItem, OrigemPreco, TipoItem } from "@/generated/prisma/enums";
import { UNIDADES } from "@/lib/dominio/catalogo";

// Textos de exibição do catálogo (SPEC-006).

export const ROTULO_TIPO: Record<TipoItem, string> = { PRODUTO_FISICO: "Produto físico", SERVICO: "Serviço" };

export const ROTULO_CATEGORIA: Record<CategoriaItem, string> = {
  SERVICOS: "Serviços",
  PRODUTOS: "Produtos",
  ALIMENTACAO: "Alimentação",
  VESTUARIO: "Vestuário",
  BELEZA: "Beleza",
  SAUDE: "Saúde",
  CASA: "Casa",
  TECNOLOGIA: "Tecnologia",
  OUTROS: "Outros",
};

export const ROTULO_ORIGEM: Record<OrigemPreco, string> = { MANUAL: "Manual", CALCULADORA: "Calculadora" };

export const rotuloUnidade = (u: string) => (Object.hasOwn(UNIDADES, u) ? UNIDADES[u as keyof typeof UNIDADES] : u);

/** "R$ 12,50" ou "—" */
export const reais = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Número com vírgula, sem zeros à direita: 0,25 · 2 · 1,5 */
export const numero = (v: number | null) => (v === null ? "" : v.toLocaleString("pt-BR", { maximumFractionDigits: 3 }));
