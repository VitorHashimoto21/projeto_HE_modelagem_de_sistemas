import type { Metadata } from "next";
import Link from "next/link";
import { FormularioEntrar } from "@/components/acesso/formularios";
import { TituloDeAcesso } from "@/components/acesso/titulo";

export const metadata: Metadata = { title: "Entrar" };

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const { proximo } = await searchParams;
  return (
    <>
      <TituloDeAcesso titulo="Bem-vindo de volta" subtitulo="Acesse sua conta para continuar" />
      <FormularioEntrar proximo={typeof proximo === "string" ? proximo : undefined} />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Não tem uma conta?{" "}
        <Link href="/cadastro" className="font-semibold text-primary underline-offset-2 hover:text-primary-hover hover:underline">
          Crie gratuitamente
        </Link>
      </p>
    </>
  );
}
