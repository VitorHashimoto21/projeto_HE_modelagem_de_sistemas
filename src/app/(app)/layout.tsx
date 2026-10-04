import Link from "next/link";
import { Logo } from "@/components/marca/logo";
import { AlternarTema } from "@/components/tema/alternar-tema";
import { Button } from "@/components/ui/button";
import { acaoSair } from "@/lib/auth/acoes";
import { exigirSessao } from "@/lib/auth/servidor";
import { consultasDeAcesso } from "@/lib/db";

// Área autenticada (SPEC-002, 5.5): a sessão é validada no servidor em toda página,
// além do proxy (INV-005).
export default async function LayoutDaAplicacao({ children }: LayoutProps<"/">) {
  const contexto = await exigirSessao();
  const perfil = await consultasDeAcesso().perfil(contexto.usuarioId);

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/negocios" aria-label="Health Enterprise — Meus negócios">
            <Logo className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            {perfil && (
              <span className="hidden text-sm text-muted-foreground sm:inline" title={perfil.email}>
                {perfil.nome}
              </span>
            )}
            <AlternarTema />
            <form action={acaoSair}>
              <Button type="submit" variant="outline">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
    </div>
  );
}
