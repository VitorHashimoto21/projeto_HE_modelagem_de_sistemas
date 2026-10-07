import type { Metadata } from "next";
import Link from "next/link";
import { FormularioCadastro } from "@/components/acesso/formularios";
import { TituloDeAcesso } from "@/components/acesso/titulo";

export const metadata: Metadata = { title: "Criar conta" };

export default async function Cadastro({ searchParams }: PageProps<"/cadastro">) {
  const { email } = await searchParams;
  return (
    <>
      <TituloDeAcesso titulo="Crie sua conta" subtitulo="Gratuito, sem limite de produtos, vendas ou lançamentos" />
      <FormularioCadastro email={typeof email === "string" ? email : undefined} />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Já tem uma conta?{" "}
        <Link href="/entrar" className="font-semibold text-primary underline-offset-2 hover:text-primary-hover hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
