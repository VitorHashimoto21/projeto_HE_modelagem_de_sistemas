import { pode, type Acao, type Matriz, type Modulo, type Papel } from "@/lib/dominio/permissoes";
import { podeNoPlano, type Plano } from "@/lib/dominio/planos";

/**
 * Menu da área autenticada pelas permissões efetivas (SPEC-005, 5.5). Cada item declara
 * o que exige; os módulos entram aqui conforme as specs deles forem implementadas.
 * Esconder um item é conveniência: a barreira é sempre a guarda no servidor (ADR-003).
 */
/** `semAcao`: o item some para quem também tem essa ação (ex.: "Lançar despesa" só sem Financeiro — ver). */
/** `algum`: basta uma das permissões (ex.: Relatórios — Vendas ou Financeiro — ver, SPEC-013). */
type Exigencia = "membro" | "dono" | { modulo: Modulo; acao: Acao; semAcao?: Acao } | { algum: { modulo: Modulo; acao: Acao }[] };

/** `selo`: aviso ao lado do item (ex.: "Plano pago" nos Relatórios do plano gratuito — SPEC-013, OPEN-004). */
export type ItemDoMenu = { rotulo: string; href: string; selo?: string };

/** Texto da dica do item no menu só com ícones (SPEC-016, N8.5): o nome e, se houver, o selo. */
export const textoDaDica = (item: ItemDoMenu) => (item.selo ? `${item.rotulo} — ${item.selo}` : item.rotulo);

const ITENS: (ItemDoMenu & { exige: Exigencia })[] = [
  // Página inicial (Dashboard — SPEC-012): aberta a todo membro; sem "Dashboard: ver", só atalhos (OPEN-005).
  { rotulo: "Painel", href: "/painel", exige: "membro" },
  // Módulos (SPEC-006 em diante)
  { rotulo: "Catálogo", href: "/catalogo", exige: { modulo: "catalogo", acao: "ver" } },
  { rotulo: "Estoque", href: "/estoque", exige: { modulo: "estoque", acao: "ver" } },
  { rotulo: "Nova venda", href: "/vendas/nova", exige: { modulo: "vendas", acao: "criar" } },
  { rotulo: "Vendas", href: "/vendas", exige: { modulo: "vendas", acao: "ver" } },
  { rotulo: "Calculadora", href: "/calculadora", exige: { modulo: "calculadora", acao: "ver" } },
  { rotulo: "Financeiro", href: "/financeiro", exige: { modulo: "financeiro", acao: "ver" } },
  // Relatórios do plano pago (SPEC-013, OPEN-003/OPEN-004): aparecem também no gratuito, com o selo.
  { rotulo: "Relatórios", href: "/relatorios", exige: { algum: [{ modulo: "vendas", acao: "ver" }, { modulo: "financeiro", acao: "ver" }] } },
  // RF06 (SPEC-009, OPEN-006): quem só lança despesa operacional, sem ver o caixa.
  { rotulo: "Lançar despesa", href: "/financeiro/lancar", exige: { modulo: "financeiro", acao: "criar", semAcao: "ver" } },
  // Configurações do negócio (OPEN-002)
  { rotulo: "Equipe", href: "/negocio/equipe", exige: "dono" },
  { rotulo: "Dados do negócio", href: "/negocio/dados", exige: "dono" },
  { rotulo: "Plano", href: "/negocio/plano", exige: "dono" },
  // SPEC-018 (5.4): liberar, revogar e acompanhar o acesso do suporte.
  { rotulo: "Acesso do suporte", href: "/negocio/suporte", exige: "dono" },
];

export function menuDoMembro(papel: Papel | null, permissoes: Matriz | null, plano: Plano = "PAGO"): ItemDoMenu[] {
  if (!papel || !permissoes) return [];
  const atende = (exige: Exigencia) =>
    exige === "membro"
      ? true
      : exige === "dono"
        ? papel === "DONO"
        : "algum" in exige
          ? exige.algum.some((e) => pode(permissoes, e.modulo, e.acao))
          : pode(permissoes, exige.modulo, exige.acao) && !(exige.semAcao && pode(permissoes, exige.modulo, exige.semAcao));
  return ITENS.filter(({ exige }) => atende(exige)).map(({ rotulo, href }) =>
    href === "/relatorios" && !podeNoPlano(plano, "relatorios") ? { rotulo, href, selo: "Plano pago" } : { rotulo, href },
  );
}

/**
 * Menu do modo suporte (SPEC-018, 5.5): só os módulos liberados, só o que se lê — sem
 * "Nova venda", "Lançar despesa" nem Configurações. O Painel entra só com o Dashboard liberado.
 * Relatórios (`algum`) cruzam módulos e ficam fora do modo suporte (decisão da homologação, 18/10/2026).
 */
export function menuDoSuporte(permissoes: Matriz): ItemDoMenu[] {
  return ITENS.filter(({ exige }) => {
    if (exige === "dono") return false;
    if (exige === "membro") return pode(permissoes, "dashboard", "ver");
    if ("algum" in exige) return false;
    return exige.acao === "ver" && pode(permissoes, exige.modulo, exige.acao) && !exige.semAcao;
  }).map(({ rotulo, href }) => ({ rotulo, href }));
}
