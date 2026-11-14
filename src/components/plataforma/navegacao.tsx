import { Segmentos } from "@/components/ui/segmentos";

export type SecaoDoPainel = "negocios" | "pedidos" | "emergencias" | "administradores";

/**
 * Seções do painel do Administrador (SPEC-019, 5.9). "Pedidos" mostra quantos pedidos de OUTRAS contas
 * aguardam uma decisão: os próprios só podem esperar.
 */
export function NavegacaoDoPainel({ atual, aguardando }: { atual: SecaoDoPainel; aguardando: number }) {
  return (
    <Segmentos
      rotulo="Seções do painel"
      itens={[
        { href: "/admin", rotulo: "Negócios", ativo: atual === "negocios" },
        {
          href: "/admin/pedidos",
          rotulo: (
            <>
              Pedidos
              {aguardando > 0 && (
                <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-ambar px-1.5 text-xs font-bold text-ambar-foreground">
                  {aguardando}
                  <span className="sr-only"> {aguardando === 1 ? "aguarda" : "aguardam"} a sua decisão</span>
                </span>
              )}
            </>
          ),
          ativo: atual === "pedidos",
        },
        { href: "/admin/emergencias", rotulo: "Emergências", ativo: atual === "emergencias" },
        { href: "/admin/administradores", rotulo: "Administradores", ativo: atual === "administradores" },
      ]}
    />
  );
}
