import type { Metadata } from "next";
import Link from "next/link";
import { TituloDeAcesso } from "@/components/acesso/titulo";
import { AceitarConvite } from "@/components/equipe/aceitar-convite";
import { acaoSair } from "@/lib/auth/acoes";
import { obterContexto } from "@/lib/auth/servidor";
import { equipe } from "@/lib/db";
import { ROTULO_PAPEL } from "@/lib/dominio/permissoes";
import { lerConvite } from "@/lib/equipe/servicos";

export const metadata: Metadata = { title: "Convite", robots: { index: false } };

const link = "font-semibold text-primary underline-offset-2 hover:text-primary-hover hover:underline";
const botao =
  "flex w-full items-center justify-center rounded-xl bg-primary py-3.5 text-sm font-semibold tracking-wide text-primary-foreground transition-colors hover:bg-primary-hover";

// Aceitação do convite (SPEC-005, 5.3): aberta com e sem sessão; decide sozinha o que mostrar.
export default async function Convite({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  const consultas = equipe();
  const [convite, contexto] = await Promise.all([lerConvite(token, { consultas, agora: () => new Date() }), obterContexto()]);

  if (convite.status === "invalido") {
    return (
      <>
        <TituloDeAcesso titulo="Este convite não vale mais" subtitulo="Ele expirou, foi cancelado ou já foi usado. Peça um novo ao Dono do negócio." />
        <p className="text-center text-sm text-muted-foreground">
          <Link href={contexto ? "/negocios" : "/entrar"} className={link}>
            {contexto ? "Ir para Meus negócios" : "Voltar para o login"}
          </Link>
        </p>
      </>
    );
  }

  const conta = contexto ? await consultas.usuario(contexto.usuarioId) : null;
  const destino = `/convite/${token}`;

  return (
    <>
      <TituloDeAcesso titulo={`Convite para ${convite.negocio}`} subtitulo={`${convite.convidadoPor} convidou você para a equipe como ${ROTULO_PAPEL[convite.papel]}.`} />
      <div className="space-y-6">
        <details className="rounded-xl border bg-card px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-card-foreground">O que você poderá fazer</summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {convite.permissoes.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>

        {!conta ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Para aceitar, entre ou crie uma conta com o e-mail <strong className="text-foreground">{convite.email}</strong>.
            </p>
            <Link href={`/entrar?proximo=${encodeURIComponent(destino)}&email=${encodeURIComponent(convite.email)}`} className={botao}>
              Já tenho conta
            </Link>
            <p className="text-center text-sm text-muted-foreground">
              Ainda não tem conta?{" "}
              <Link href={`/cadastro?email=${encodeURIComponent(convite.email)}`} className={link}>
                Criar conta
              </Link>
            </p>
            <p className="text-xs text-muted-foreground">
              Depois de confirmar a conta nova, o convite aparece em “Meus negócios”, em “Convites para você”.
            </p>
          </div>
        ) : conta.email.toLowerCase() === convite.email ? (
          <AceitarConvite token={token} />
        ) : (
          <div className="space-y-4">
            <p role="alert" className="rounded-xl border border-status-warn/30 bg-status-warn-bg px-4 py-3 text-sm text-status-warn">
              Este convite foi enviado para outro e-mail ({convite.emailMascarado}). Entre com essa conta para aceitar.
            </p>
            <form action={acaoSair}>
              <button type="submit" className={botao}>
                Sair e entrar com outra conta
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
