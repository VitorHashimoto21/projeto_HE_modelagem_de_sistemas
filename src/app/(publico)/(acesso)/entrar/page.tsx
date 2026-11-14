import type { Metadata } from "next";
import Link from "next/link";
import { Aviso } from "@/components/acesso/campos";
import { FormularioEntrar } from "@/components/acesso/formularios";
import { TituloDeAcesso } from "@/components/acesso/titulo";
import { MENSAGENS_LGPD } from "@/lib/dominio/lgpd";

export const metadata: Metadata = { title: "Entrar" };

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const { proximo, email, excluida, sessao, senha } = await searchParams;
  return (
    <>
      {excluida && (
        <div className="mb-6">
          <Aviso tipo="sucesso">{MENSAGENS_LGPD.excluida}</Aviso>
        </div>
      )}
      {sessao === "expirada" && (
        <div className="mb-6">
          {/* SPEC-018 (RNF12): a sessão do Administrador vale 8 h desde a entrada. */}
          <Aviso tipo="erro">Sua sessão de administrador expirou. Entre novamente.</Aviso>
        </div>
      )}
      {senha === "alterada" && (
        <div className="mb-6">
          {/* SPEC-019 (OPEN-017): a conta com 2º fator entra de novo depois da nova senha. */}
          <Aviso tipo="sucesso">Senha alterada. Entre com a senha nova.</Aviso>
        </div>
      )}
      <TituloDeAcesso titulo="Bem-vindo de volta" subtitulo="Acesse sua conta para continuar" />
      <FormularioEntrar proximo={typeof proximo === "string" ? proximo : undefined} email={typeof email === "string" ? email : undefined} />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Não tem uma conta?{" "}
        <Link href="/cadastro" className="font-semibold text-primary underline-offset-2 hover:text-primary-hover hover:underline">
          Crie gratuitamente
        </Link>
      </p>
    </>
  );
}
