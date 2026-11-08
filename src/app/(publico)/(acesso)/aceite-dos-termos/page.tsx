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

// Novo aceite (SPEC-018, 5.7 — RF78, OPEN-011; versão da SPEC-019, 5.11): quem aceitou uma versão anterior da política e dos
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
            {/* SPEC-019 (5.11): a versão 2026-11-07 trata das correções, da emergência, da suspensão e da troca de plano pela plataforma. */}
            <li>
              <strong className="text-foreground">Correções pelo suporte:</strong> ao liberar o acesso, o Dono pode deixar o suporte do HE corrigir alguns módulos, só
              nas ações de uma lista fechada. Cada correção aparece na hora em Acesso do suporte, com o antes e o depois, e pode ser desfeita em até 30 dias.
            </li>
            <li>
              <strong className="text-foreground">Acesso de emergência:</strong> sem a liberação do Dono, o suporte só entra por ordem judicial, incidente de segurança
              ou Dono sem acesso, com a aprovação de duas pessoas da equipe. É somente leitura, por até 4 horas, e o Dono vê tudo desde o pedido e pode encerrar.
            </li>
            <li>
              <strong className="text-foreground">Suspensão do negócio:</strong> o HE pode suspender um negócio por motivos de uma lista fechada. Ele fica somente
              leitura, nada é apagado, e exportar os dados e excluir a conta continuam.
            </li>
            <li>
              <strong className="text-foreground">Troca de plano pela plataforma:</strong> com a aprovação de duas pessoas da equipe, e o Dono é avisado. A exportação
              dos seus dados passa a trazer esses registros.
            </li>
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
