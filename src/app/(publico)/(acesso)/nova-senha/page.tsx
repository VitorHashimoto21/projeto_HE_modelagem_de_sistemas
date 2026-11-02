import type { Metadata } from "next";
import { FormularioNovaSenha } from "@/components/acesso/formularios";
import { TituloDeAcesso } from "@/components/acesso/titulo";
import { adaptadorDoServidor, exigirSessaoDaRecuperacao } from "@/lib/auth/servidor";

export const metadata: Metadata = { title: "Nova senha" };

// Aberta pelo link de recuperação, que já criou a sessão (5.4). SPEC-019 (OPEN-017): a conta com
// 2º fator digita também o código do autenticador e, depois de salvar, entra de novo.
export default async function NovaSenha() {
  await exigirSessaoDaRecuperacao();
  const auth = await adaptadorDoServidor();
  const [fatores, sessao] = await Promise.all([auth.fatores(), auth.sessaoAtual()]);
  const verificados = fatores.filter((f) => f.verificado).map(({ id, nome }) => ({ id, nome }));
  const pedeCodigo = verificados.length > 0 && sessao?.nivel !== "aal2";
  return (
    <>
      <TituloDeAcesso
        titulo="Crie uma nova senha"
        subtitulo={
          verificados.length > 0
            ? "Ao salvar, todas as sessões da sua conta são encerradas, e você entra de novo com a senha nova"
            : "Ao salvar, as outras sessões abertas da sua conta são encerradas"
        }
      />
      <FormularioNovaSenha autenticadores={pedeCodigo ? verificados : []} />
    </>
  );
}
