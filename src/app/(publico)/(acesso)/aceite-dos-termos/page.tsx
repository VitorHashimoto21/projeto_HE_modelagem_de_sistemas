import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormularioAceiteDosTermos } from "@/components/acesso/aceite-dos-termos";
import { TituloDeAcesso } from "@/components/acesso/titulo";
import { acaoSair } from "@/lib/auth/acoes";
import { ROTA_ADMIN, ROTA_INICIAL } from "@/lib/auth/rotas";
import { exigirConta } from "@/lib/auth/servidor";
import { VERSAO_TERMOS } from "@/lib/auth/validacao";

export const metadata: Metadata = { title: "Atualizamos nossos termos", robots: { index: false } };

const link = "font-semibold text-primary underline-offset-2 hover:text-primary-hover hover:underline";

// Novo aceite (SPEC-018, 5.7 — RF78, OPEN-011): quem aceitou uma versão anterior da política e dos
// termos só volta ao app depois de aceitar a vigente; até lá, pode abrir Minha conta (exportar os
// dados ou excluir a conta) ou sair.
export default async function AceiteDosTermos({ searchParams }: PageProps<"/aceite-dos-termos">) {
  const contexto = await exigirConta();
  if (!contexto.termosPendentes) redirect(contexto.administrador ? ROTA_ADMIN : ROTA_INICIAL);
  const { proximo } = await searchParams;

  return (
    <>
      <TituloDeAcesso titulo="Atualizamos nossos termos" subtitulo="Leia o que mudou e aceite para continuar usando o Health Enterprise." />
      <div className="space-y-6">
        <div className="rounded-lg bg-muted px-4 py-4 text-sm text-foreground">
          <p className="font-semibold">O que mudou nesta versão ({VERSAO_TERMOS})</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">Acesso do suporte:</strong> quando você precisar de ajuda, o Dono pode liberar o suporte do HE para ver (sem alterar) os
              módulos escolhidos, por um prazo de até 7 dias.
            </li>
            <li>O suporte nunca entra sem essa liberação, vê nomes e contatos de clientes mascarados e não tem acesso à sua senha.</li>
            <li>Cada tela que o suporte abre fica registrada, e o Dono acompanha e pode revogar o acesso a qualquer momento.</li>
          </ul>
          <p className="mt-3">
            Textos completos:{" "}
            <Link href="/privacidade" target="_blank" className={link}>
              Política de Privacidade
            </Link>{" "}
            e{" "}
            <Link href="/termos" target="_blank" className={link}>
              Termos de Uso
            </Link>
            .
          </p>
        </div>

        <FormularioAceiteDosTermos versao={VERSAO_TERMOS} proximo={typeof proximo === "string" ? proximo : undefined} />

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/conta" className={link}>
            Exportar meus dados ou excluir a conta
          </Link>
          <form action={acaoSair}>
            <button type="submit" className={link}>
              Sair
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
