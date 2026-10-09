import { pode, type Acao, type Matriz, type Modulo, type Papel } from "@/lib/dominio/permissoes";

/**
 * Menu da área autenticada pelas permissões efetivas (SPEC-005, 5.5). Cada item declara
 * o que exige; os módulos entram aqui conforme as specs deles forem implementadas.
 * Esconder um item é conveniência: a barreira é sempre a guarda no servidor (ADR-003).
 */
/** `semAcao`: o item some para quem também tem essa ação (ex.: "Lançar despesa" só sem Financeiro — ver). */
type Exigencia = "membro" | "dono" | { modulo: Modulo; acao: Acao; semAcao?: Acao };

export type ItemDoMenu = { rotulo: string; href: string };

const ITENS: (ItemDoMenu & { exige: Exigencia })[] = [
  // Página inicial provisória (SPEC-004): aberta a todo membro; o Dashboard (SPEC-012) a substitui.
  { rotulo: "Painel", href: "/painel", exige: "membro" },
  // Módulos (SPEC-006 em diante)
  { rotulo: "Catálogo", href: "/catalogo", exige: { modulo: "catalogo", acao: "ver" } },
  { rotulo: "Estoque", href: "/estoque", exige: { modulo: "estoque", acao: "ver" } },
  { rotulo: "Nova venda", href: "/vendas/nova", exige: { modulo: "vendas", acao: "criar" } },
  { rotulo: "Vendas", href: "/vendas", exige: { modulo: "vendas", acao: "ver" } },
  { rotulo: "Financeiro", href: "/financeiro", exige: { modulo: "financeiro", acao: "ver" } },
  // RF06 (SPEC-009, OPEN-006): quem só lança despesa operacional, sem ver o caixa.
  { rotulo: "Lançar despesa", href: "/financeiro/lancar", exige: { modulo: "financeiro", acao: "criar", semAcao: "ver" } },
  // Configurações do negócio (OPEN-002)
  { rotulo: "Equipe", href: "/negocio/equipe", exige: "dono" },
  { rotulo: "Dados do negócio", href: "/negocio/dados", exige: "dono" },
];

export function menuDoMembro(papel: Papel | null, permissoes: Matriz | null): ItemDoMenu[] {
  if (!papel || !permissoes) return [];
  return ITENS.filter(({ exige }) =>
    exige === "membro"
      ? true
      : exige === "dono"
        ? papel === "DONO"
        : pode(permissoes, exige.modulo, exige.acao) && !(exige.semAcao && pode(permissoes, exige.modulo, exige.semAcao)),
  ).map(({ rotulo, href }) => ({ rotulo, href }));
}
