import type { Metadata } from "next";
import { FormularioNovaSenha } from "@/components/acesso/formularios";
import { TituloDeAcesso } from "@/components/acesso/titulo";
import { exigirSessao } from "@/lib/auth/servidor";

export const metadata: Metadata = { title: "Nova senha" };

// Aberta pelo link de recuperação, que já criou a sessão (5.4).
export default async function NovaSenha() {
  await exigirSessao();
  return (
    <>
      <TituloDeAcesso titulo="Crie uma nova senha" subtitulo="Ao salvar, as outras sessões abertas da sua conta são encerradas" />
      <FormularioNovaSenha />
    </>
  );
}
