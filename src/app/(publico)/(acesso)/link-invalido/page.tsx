import type { Metadata } from "next";
import Link from "next/link";
import { FormularioEsqueciASenha, FormularioReenviarConfirmacao } from "@/components/acesso/formularios";
import { TituloDeAcesso } from "@/components/acesso/titulo";

export const metadata: Metadata = { title: "Link expirado" };

// Link de confirmação ou de recuperação expirado ou já usado (5.1 e 5.4).
export default async function LinkInvalido({ searchParams }: PageProps<"/link-invalido">) {
  const { tipo } = await searchParams;
  const recuperacao = tipo === "recuperacao";
  return (
    <>
      <TituloDeAcesso
        titulo="Este link expirou"
        subtitulo={
          recuperacao
            ? "O link de nova senha expirou ou já foi usado. Peça um novo abaixo."
            : "O link de confirmação expirou ou já foi usado. Se a conta ainda não foi confirmada, peça um novo abaixo."
        }
      />
      {recuperacao ? <FormularioEsqueciASenha /> : <FormularioReenviarConfirmacao />}
      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link href="/entrar" className="font-semibold text-primary underline-offset-2 hover:text-primary-hover hover:underline">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
