import { pode, type Acao, type Matriz, type Modulo, type Papel } from "@/lib/dominio/permissoes";

/**
 * Menu da área autenticada pelas permissões efetivas (SPEC-005, 5.5). Cada item declara
 * o que exige; os módulos entram aqui conforme as specs deles forem implementadas.
 * Esconder um item é conveniência: a barreira é sempre a guarda no servidor (ADR-003).
 */
type Exigencia = "membro" | "dono" | { modulo: Modulo; acao: Acao };

export type ItemDoMenu = { rotulo: string; href: string };

const ITENS: (ItemDoMenu & { exige: Exigencia })[] = [
  // Página inicial provisória (SPEC-004): aberta a todo membro; o Dashboard (SPEC-012) a substitui.
  { rotulo: "Painel", href: "/painel", exige: "membro" },
  // Módulos (SPEC-006 em diante)
  { rotulo: "Catálogo", href: "/catalogo", exige: { modulo: "catalogo", acao: "ver" } },
  // Configurações do negócio (OPEN-002)
  { rotulo: "Equipe", href: "/negocio/equipe", exige: "dono" },
  { rotulo: "Dados do negócio", href: "/negocio/dados", exige: "dono" },
];

export function menuDoMembro(papel: Papel | null, permissoes: Matriz | null): ItemDoMenu[] {
  if (!papel || !permissoes) return [];
  return ITENS.filter(({ exige }) =>
    exige === "membro" ? true : exige === "dono" ? papel === "DONO" : pode(permissoes, exige.modulo, exige.acao),
  ).map(({ rotulo, href }) => ({ rotulo, href }));
}
