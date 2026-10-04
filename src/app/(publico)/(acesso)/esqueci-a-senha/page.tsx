import type { Metadata } from "next";
import Link from "next/link";
import { FormularioEsqueciASenha } from "@/components/acesso/formularios";
import { TituloDeAcesso } from "@/components/acesso/titulo";

export const metadata: Metadata = { title: "Esqueci a senha" };

export default function EsqueciASenha() {
  return (
    <>
      <TituloDeAcesso titulo="Esqueci a senha" subtitulo="Informe seu e-mail para receber um link de nova senha" />
      <FormularioEsqueciASenha />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Lembrou?{" "}
        <Link href="/entrar" className="font-semibold text-primary underline-offset-2 hover:text-primary-hover hover:underline">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
