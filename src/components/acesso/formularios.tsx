"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  acaoCadastrar,
  acaoDefinirNovaSenha,
  acaoEntrar,
  acaoPedirRecuperacao,
  acaoReenviarConfirmacao,
} from "@/lib/auth/acoes";
import { ESTADO_INICIAL } from "@/lib/auth/servicos";
import { esquemaCadastro, esquemaEmail, esquemaEntrar, esquemaNovaSenha, SENHA_MINIMA } from "@/lib/auth/validacao";
import { Aviso, BotaoEnviar, Campo, CampoSenha, MensagemDeCampo } from "./campos";
import { useFormulario } from "./use-formulario";

const link = "font-semibold text-primary underline-offset-2 hover:text-primary-hover hover:underline";

/** Login (protótipo revisado; CA-05 a CA-07). */
export function FormularioEntrar({ proximo }: { proximo?: string }) {
  const { estado, executar, erros, aoEnviar, limparErro } = useFormulario(acaoEntrar, esquemaEntrar);
  const valores = estado.status === "erro" ? estado.valores : undefined;

  return (
    <div className="space-y-5">
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}

      <form action={executar} onSubmit={aoEnviar} noValidate className="space-y-5">
        {proximo && <input type="hidden" name="proximo" value={proximo} />}
        <Campo
          nome="email"
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          placeholder="voce@empresa.com"
          defaultValue={valores?.email}
          erro={erros.email}
          onChange={() => limparErro("email")}
        />
        <CampoSenha
          nome="senha"
          rotulo="Senha"
          autoComplete="current-password"
          placeholder="Sua senha"
          erro={erros.senha}
          onChange={() => limparErro("senha")}
          extra={
            <Link href="/esqueci-a-senha" className="text-xs font-medium text-primary underline-offset-2 hover:text-primary-hover hover:underline">
              Esqueci a senha
            </Link>
          }
        />
        <BotaoEnviar enviando="Entrando…">Entrar</BotaoEnviar>
      </form>

      {estado.status === "erro" && estado.codigo === "EmailNaoConfirmado" && (
        <ReenviarConfirmacao email={valores?.email ?? ""} />
      )}
    </div>
  );
}

/** Botão para reenviar o link de confirmação (CA-05). */
export function ReenviarConfirmacao({ email }: { email: string }) {
  const [estado, executar, enviando] = useActionState(acaoReenviarConfirmacao, ESTADO_INICIAL);
  if (estado.status === "enviado") return <Aviso tipo="sucesso">{estado.mensagem}</Aviso>;
  return (
    <form action={executar} className="text-center text-sm text-muted-foreground">
      <input type="hidden" name="email" value={email} />
      Não recebeu o e-mail?{" "}
      <button type="submit" disabled={enviando} className={`${link} disabled:opacity-70`}>
        {enviando ? "Enviando…" : "Reenviar o link de confirmação"}
      </button>
      {estado.status === "erro" && estado.mensagem && <p className="mt-2 text-destructive">{estado.mensagem}</p>}
    </form>
  );
}

/** Cadastro (CA-01 a CA-04). */
export function FormularioCadastro() {
  const { estado, executar, erros, aoEnviar, limparErro } = useFormulario(acaoCadastrar, esquemaCadastro);
  const valores = estado.status === "erro" ? estado.valores : undefined;

  if (estado.status === "enviado") {
    return (
      <div className="space-y-5">
        <Aviso tipo="sucesso">{estado.mensagem}</Aviso>
        <p className="text-sm text-muted-foreground">
          O link vale por tempo limitado. Depois de confirmar, você entra direto no sistema. Já confirmou?{" "}
          <Link href="/entrar" className={link}>
            Entrar
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}

      <form action={executar} onSubmit={aoEnviar} noValidate className="space-y-5">
        <Campo
          nome="nome"
          rotulo="Nome"
          autoComplete="name"
          placeholder="Seu nome"
          defaultValue={valores?.nome}
          erro={erros.nome}
          onChange={() => limparErro("nome")}
        />
        <Campo
          nome="email"
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          placeholder="voce@empresa.com"
          defaultValue={valores?.email}
          erro={erros.email}
          onChange={() => limparErro("email")}
        />
        <CampoSenha
          nome="senha"
          rotulo="Senha"
          autoComplete="new-password"
          placeholder={`Pelo menos ${SENHA_MINIMA} caracteres`}
          erro={erros.senha}
          onChange={() => limparErro("senha")}
        />
        <CampoSenha
          nome="confirmacao"
          rotulo="Confirme a senha"
          autoComplete="new-password"
          placeholder="Repita a senha"
          erro={erros.confirmacao}
          onChange={() => limparErro("confirmacao")}
        />

        <div>
          <div className="flex items-start gap-3">
            <input
              id="aceite"
              name="aceite"
              type="checkbox"
              aria-invalid={erros.aceite ? true : undefined}
              aria-describedby={erros.aceite ? "aceite-erro" : undefined}
              onChange={() => limparErro("aceite")}
              className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
            />
            <label htmlFor="aceite" className="text-sm text-foreground">
              Li e aceito a{" "}
              <Link href="/privacidade" target="_blank" className={link}>
                Política de Privacidade
              </Link>{" "}
              e os{" "}
              <Link href="/termos" target="_blank" className={link}>
                Termos de Uso
              </Link>
              .
            </label>
          </div>
          <MensagemDeCampo id="aceite-erro" erro={erros.aceite} />
        </div>

        <BotaoEnviar enviando="Criando a conta…">Criar conta</BotaoEnviar>
      </form>
    </div>
  );
}

/** Pedido de recuperação de senha (5.4). */
export function FormularioEsqueciASenha() {
  const { estado, executar, erros, aoEnviar, limparErro } = useFormulario(acaoPedirRecuperacao, esquemaEmail);
  const valores = estado.status === "erro" ? estado.valores : undefined;

  if (estado.status === "enviado") {
    return (
      <div className="space-y-5">
        <Aviso tipo="sucesso">{estado.mensagem}</Aviso>
        <p className="text-sm text-muted-foreground">
          <Link href="/entrar" className={link}>
            Voltar para o login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <form action={executar} onSubmit={aoEnviar} noValidate className="space-y-5">
        <Campo
          nome="email"
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          placeholder="voce@empresa.com"
          defaultValue={valores?.email}
          erro={erros.email}
          onChange={() => limparErro("email")}
        />
        <BotaoEnviar enviando="Enviando…">Enviar link</BotaoEnviar>
      </form>
    </div>
  );
}

/** Nova senha pelo link de recuperação (5.4, CA-10). */
export function FormularioNovaSenha() {
  const { estado, executar, erros, aoEnviar, limparErro } = useFormulario(acaoDefinirNovaSenha, esquemaNovaSenha);

  return (
    <div className="space-y-5">
      {estado.status === "erro" && estado.mensagem && (
        <Aviso tipo="erro">
          {estado.mensagem}{" "}
          <Link href="/esqueci-a-senha" className={link}>
            Pedir novo link
          </Link>
        </Aviso>
      )}
      <form action={executar} onSubmit={aoEnviar} noValidate className="space-y-5">
        <CampoSenha
          nome="senha"
          rotulo="Nova senha"
          autoComplete="new-password"
          placeholder={`Pelo menos ${SENHA_MINIMA} caracteres`}
          erro={erros.senha}
          onChange={() => limparErro("senha")}
        />
        <CampoSenha
          nome="confirmacao"
          rotulo="Confirme a nova senha"
          autoComplete="new-password"
          placeholder="Repita a senha"
          erro={erros.confirmacao}
          onChange={() => limparErro("confirmacao")}
        />
        <BotaoEnviar enviando="Salvando…">Salvar e entrar</BotaoEnviar>
      </form>
    </div>
  );
}

/** Reenvio de confirmação a partir de um link expirado (5.1). */
export function FormularioReenviarConfirmacao() {
  const { estado, executar, erros, aoEnviar, limparErro } = useFormulario(acaoReenviarConfirmacao, esquemaEmail);
  if (estado.status === "enviado") return <Aviso tipo="sucesso">{estado.mensagem}</Aviso>;
  return (
    <div className="space-y-5">
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <form action={executar} onSubmit={aoEnviar} noValidate className="space-y-5">
        <Campo
          nome="email"
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          placeholder="voce@empresa.com"
          erro={erros.email}
          onChange={() => limparErro("email")}
        />
        <BotaoEnviar enviando="Enviando…">Reenviar link de confirmação</BotaoEnviar>
      </form>
    </div>
  );
}
