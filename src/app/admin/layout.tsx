import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { Logo } from "@/components/marca/logo";
import { FaixaDoModoSuporte } from "@/components/suporte/faixas";
import { AlternarTema } from "@/components/tema/alternar-tema";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { AvisosFlutuantes } from "@/components/ui/avisos-flutuantes";
import { classeDoBotao } from "@/components/ui/estilos";
import { acaoSair } from "@/lib/auth/acoes";
import { adaptadorDoServidor, exigirAdministrador } from "@/lib/auth/servidor";
import { consultasDeAcesso } from "@/lib/db";

// Área do Administrador da plataforma (SPEC-018, 5.2 e 5.3): estrutura própria, separada da
// área do negócio. Toda página daqui exige a conta de Administrador no servidor; usuários
// comuns veem "Sem acesso".
export default async function LayoutDoAdministrador({ children }: LayoutProps<"/admin">) {
  const contexto = await exigirAdministrador();
  const [perfil, fatores] = await Promise.all([consultasDeAcesso().perfil(contexto.usuarioId), adaptadorDoServidor().then((auth) => auth.fatores())]);
  // SPEC-019 (5.1): com um autenticador só, o painel avisa até o segundo ser cadastrado.
  const soUmAutenticador = fatores.filter((f) => f.verificado).length === 1;
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <header className="bg-estrutura text-estrutura-foreground">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <Link href="/admin" className="flex items-center gap-3 rounded-full focus-visible:outline-2 focus-visible:outline-ambar">
            <Logo negativo className="h-8 w-auto" />
            <span className="rounded-full bg-estrutura-foreground/10 px-3 py-1 text-xs font-bold">Administração</span>
          </Link>
          <div className="flex items-center gap-2">
            {perfil && (
              <Link href="/conta" className={classeDoBotao("na-estrutura", "sm")} title={`${perfil.email} — Minha conta`}>
                <UserRound aria-hidden="true" />
                <span className="max-w-[10rem] truncate">{perfil.nome}</span>
              </Link>
            )}
            <form action={acaoSair}>
              <button type="submit" className={classeDoBotao("na-estrutura", "sm")}>
                <LogOut aria-hidden="true" />
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      {contexto.suporte && <FaixaDoModoSuporte negocio={contexto.suporte.negocio} expiraEm={contexto.suporte.expiraEm} />}
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-16 sm:px-6 lg:px-10 lg:pt-8">
        {soUmAutenticador && (
          <AvisoDaPagina tom="atencao" className="mb-6">
            Sua conta tem só um autenticador. <Link href="/segundo-fator?outro=1">Cadastre um segundo</Link>, em outro aparelho ou num gerenciador de senhas, para não
            perder o acesso.
          </AvisoDaPagina>
        )}
        {children}
      </main>
      <footer className="mx-auto flex w-full max-w-[1280px] justify-end px-4 pb-6 sm:px-6 lg:px-10">
        <AlternarTema />
      </footer>
      <AvisosFlutuantes />
    </div>
  );
}
