import type { OrigemPreco, TipoItem } from "@/generated/prisma/enums";
import { UNIDADES } from "@/lib/dominio/catalogo";

// Textos de exibição do catálogo (SPEC-006).

export const ROTULO_TIPO: Record<TipoItem, string> = { PRODUTO_FISICO: "Produto físico", SERVICO: "Serviço" };

// Rótulos das categorias: ficam no domínio do catálogo, porque as mensagens do servidor também os usam (SPEC-020).
export { ROTULO_CATEGORIA } from "@/lib/catalogo/validacao";

export const ROTULO_ORIGEM: Record<OrigemPreco, string> = { MANUAL: "Manual", CALCULADORA: "Calculadora" };

export const rotuloUnidade = (u: string) => (Object.hasOwn(UNIDADES, u) ? UNIDADES[u as keyof typeof UNIDADES] : u);

/** "R$ 12,50" ou "—" */
export const reais = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Número com vírgula, sem zeros à direita: 0,25 · 2 · 1,5 */
export const numero = (v: number | null) => (v === null ? "" : v.toLocaleString("pt-BR", { maximumFractionDigits: 3 }));
