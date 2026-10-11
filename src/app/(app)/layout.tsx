import Link from "next/link";
import { Logo } from "@/components/marca/logo";
import { SeletorDeNegocio } from "@/components/negocio/seletor-negocio";
import { AlternarTema } from "@/components/tema/alternar-tema";
import { Button } from "@/components/ui/button";
import { acaoSair } from "@/lib/auth/acoes";
import { exigirSessao } from "@/lib/auth/servidor";
import { consultasDeAcesso, negocios, planos } from "@/lib/db";
import { menuDoMembro } from "@/lib/equipe/menu";

// Área autenticada (SPEC-002, 5.5): a sessão é validada no servidor em toda página,
// além do proxy (INV-005). O seletor troca o negócio ativo sem novo login (SPEC-004, UC2).
// O menu segue as permissões efetivas do membro (SPEC-005, 5.5) — é conveniência: a
// barreira é a guarda no servidor de cada página e ação.
export default async function LayoutDaAplicacao({ children }: LayoutProps<"/">) {
  const contexto = await exigirSessao();
  const [perfil, meusNegocios, plano] = await Promise.all([
    consultasDeAcesso().perfil(contexto.usuarioId),
    negocios().listarDoUsuario(contexto.usuarioId),
    contexto.negocioId ? planos().planoDoNegocio(contexto.negocioId) : Promise.resolve(null),
  ]);
  const menu = menuDoMembro(contexto.papel, contexto.permissoes, plano ?? "GRATUITO");

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <Link href={contexto.negocioId ? "/painel" : "/negocios"} aria-label="Health Enterprise — página inicial">
              <Logo className="h-8 w-auto" />
            </Link>
            <SeletorDeNegocio negocios={meusNegocios.filter((n) => !n.suspenso)} ativo={contexto.negocioId} />
          </div>
          <div className="flex items-center gap-3">
            <Link href="/negocios" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline">
              Meus negócios
            </Link>
            {perfil && (
              <span className="hidden text-sm text-muted-foreground lg:inline" title={perfil.email}>
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
        {menu.length > 0 && (
          <nav aria-label="Menu do negócio" className="mx-auto w-full max-w-5xl px-4 pb-2">
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {menu.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                    {item.rotulo}
                    {item.selo && (
                      <span className="ml-1.5 rounded-full bg-brand-amber/15 px-1.5 py-0.5 text-[10px] font-semibold text-foreground no-underline">
                        <span aria-hidden="true">★ </span>
                        {item.selo}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
    </div>
  );
}
