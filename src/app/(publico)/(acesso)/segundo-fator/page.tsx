import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TituloDeAcesso } from "@/components/acesso/titulo";
import { CadastroDoAutenticador } from "@/components/segundo-fator/cadastro";
import { FormularioDoCodigo } from "@/components/segundo-fator/codigo";
import { acaoSair } from "@/lib/auth/acoes";
import { ROTA_ADMIN } from "@/lib/auth/rotas";
import { acaoEntrarComCodigo } from "@/lib/auth/segundo-fator-acoes";
import { adaptadorDoServidor, exigirSegundoFator } from "@/lib/auth/servidor";

export const metadata: Metadata = { title: "2º fator", robots: { index: false } };

const link = "font-semibold text-primary underline-offset-2 hover:text-primary-hover hover:underline";

function Sair() {
  return (
    <form action={acaoSair} className="mt-8 text-center">
      <button type="submit" className={`text-sm ${link}`}>
        Sair
      </button>
    </form>
  );
}

// 2º fator do Administrador (SPEC-019, 5.1; CA-01, CA-02): sem o código verificado nesta sessão, a
// conta de Administrador só vê esta tela e "Sair". Sem autenticador ativo, cadastra o primeiro; com
// um, digita o código; depois do primeiro cadastro, a tela sugere um segundo autenticador.
export default async function SegundoFator({ searchParams }: PageProps<"/segundo-fator">) {
  const contexto = await exigirSegundoFator();
  const auth = await adaptadorDoServidor();
  const ativos = (await auth.fatores()).filter((f) => f.verificado).map(({ id, nome }) => ({ id, nome }));
  const { outro } = await searchParams;

  if (ativos.length > 0 && contexto.segundoFatorPendente) {
    return (
      <>
        <TituloDeAcesso titulo="Digite o código do autenticador" subtitulo="Abra o aplicativo autenticador e digite o código de 6 números do Health Enterprise." />
        <FormularioDoCodigo autenticadores={ativos} acao={acaoEntrarComCodigo} />
        <p className="mt-6 text-sm text-muted-foreground">
          Perdeu os aparelhos? Peça a outra pessoa da equipe para redefinir o seu 2º fator pelo workflow &quot;Administradores&quot;.
        </p>
        <Sair />
      </>
    );
  }

  if (ativos.length === 0) {
    return (
      <>
        <TituloDeAcesso titulo="Configure o 2º fator" subtitulo="A conta de Administrador entra com a senha e com um código do aplicativo autenticador." />
        <p className="-mt-4 mb-6 text-sm text-muted-foreground">
          O aplicativo gera um código novo a cada 30 segundos, sem e-mail, SMS nem internet. Dê um nome ao aparelho para reconhecê-lo depois.
        </p>
        <CadastroDoAutenticador sugestao="Celular" />
        <Sair />
      </>
    );
  }

  // Com o código verificado: só o cadastro de outro autenticador fica aqui.
  if (outro !== "1") redirect(ROTA_ADMIN);
  return (
    <>
      <TituloDeAcesso
        titulo={ativos.length === 1 ? "Cadastre um segundo autenticador" : "Cadastre outro autenticador"}
        subtitulo="Em outro aparelho ou num gerenciador de senhas. Se perder um, você entra com o outro."
      />
      <CadastroDoAutenticador sugestao={ativos.length === 1 ? "Segundo aparelho" : "Outro aparelho"} />
      <p className="mt-8 text-center text-sm">
        <Link href={ROTA_ADMIN} className={link}>
          Agora não
        </Link>
      </p>
    </>
  );
}
