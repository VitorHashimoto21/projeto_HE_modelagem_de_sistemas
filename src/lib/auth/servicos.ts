import { lerCodigo, MENSAGENS_DO_SEGUNDO_FATOR } from "@/lib/dominio/segundo-fator";
import type { AdaptadorDeAutenticacao } from "./adaptador";
import { destinoSeguro, ROTA_ENTRAR, ROTA_INICIAL } from "./rotas";
import {
  esquemaCadastro,
  esquemaEmail,
  esquemaEntrar,
  esquemaNovaSenha,
  MENSAGENS,
  validar,
  VERSAO_TERMOS,
  type ErrosDeCampo,
} from "./validacao";

/**
 * Fluxos de acesso (SPEC-002, seção 5), independentes do Next.js: as Server Actions
 * só leem o formulário, chamam estas funções e redirecionam. Os testes de integração
 * as exercitam com um dublê do provedor de autenticação.
 */

export const MENSAGENS_DE_RESPOSTA = {
  cadastroEnviado: "Enviamos um link para seu e-mail. Abra-o para confirmar a conta e entrar.",
  recuperacaoEnviada: "Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha.",
  confirmacaoReenviada: "Se houver uma conta pendente com esse e-mail, enviamos um novo link de confirmação.",
  credenciaisInvalidas: "E-mail ou senha incorretos",
  emailNaoConfirmado: "Confirme seu e-mail para entrar",
  muitasTentativas: "Muitas tentativas. Tente novamente em alguns minutos",
  falhaInterna: "Não foi possível concluir agora. Tente novamente.",
  senhaRecusada: "Essa senha não pode ser usada. Escolha outra.",
  mesmaSenha: "A nova senha precisa ser diferente da atual",
  linkExpirado: "O link expirou ou já foi usado. Peça um novo.",
} as const;

export type EstadoDoFormulario =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: ErrosDeCampo; codigo?: "EmailNaoConfirmado"; valores?: Record<string, string> }
  | { status: "enviado"; mensagem: string }
  | { status: "autenticado"; destino: string };

export const ESTADO_INICIAL: EstadoDoFormulario = { status: "ocioso" };

export type DependenciasDeAcesso = {
  auth: AdaptadorDeAutenticacao;
  /** INV-008: conta excluída (ou sem Usuario) não entra. */
  usuarioBloqueado(usuarioId: string): Promise<boolean>;
  /** Aviso ao dono de um e-mail já cadastrado (5.1). Falhas não mudam a resposta. */
  avisarContaExistente(email: string): Promise<void>;
  /** Endereço da aplicação na requisição atual (para os links dos e-mails). */
  origem: string;
};

export const urlsDosLinks = (origem: string) => ({
  confirmacao: `${origem}/auth/confirmar`,
  recuperacao: `${origem}/auth/recuperar`,
});

const erroDeLimiteOuInterno = (erro: "MuitasTentativas" | "FalhaInterna"): EstadoDoFormulario => ({
  status: "erro",
  mensagem: erro === "MuitasTentativas" ? MENSAGENS_DE_RESPOSTA.muitasTentativas : MENSAGENS_DE_RESPOSTA.falhaInterna,
});

/** Cadastrar (CA-01 a CA-04). A resposta de sucesso é a mesma com ou sem conta prévia (INV-004). */
export async function cadastrar(campos: Record<string, string>, deps: DependenciasDeAcesso): Promise<EstadoDoFormulario> {
  const v = validar(esquemaCadastro, campos);
  const valores = { nome: campos.nome ?? "", email: campos.email ?? "" };
  if (!v.ok) {
    return { status: "erro", erros: v.erros, valores, mensagem: v.erros.aceite ? MENSAGENS.aceiteObrigatorio : undefined };
  }

  const { nome, email, senha } = v.dados;
  const r = await deps.auth.cadastrar({
    nome,
    email,
    senha,
    versaoTermos: VERSAO_TERMOS,
    urlDeConfirmacao: urlsDosLinks(deps.origem).confirmacao,
  });

  if (!r.ok) {
    if (r.erro === "SenhaRecusada") {
      return { status: "erro", erros: { senha: MENSAGENS_DE_RESPOSTA.senhaRecusada }, valores };
    }
    return { ...erroDeLimiteOuInterno(r.erro), valores } as EstadoDoFormulario;
  }

  if (r.contaJaExistia) {
    await deps.avisarContaExistente(email).catch(() => undefined);
  }
  return { status: "enviado", mensagem: MENSAGENS_DE_RESPOSTA.cadastroEnviado };
}

/** Entrar (CA-05 a CA-07, CA-13). */
export async function entrar(
  campos: Record<string, string>,
  destino: unknown,
  deps: DependenciasDeAcesso,
): Promise<EstadoDoFormulario> {
  const v = validar(esquemaEntrar, campos);
  const valores = { email: campos.email ?? "" };
  if (!v.ok) return { status: "erro", erros: v.erros, valores };

  const r = await deps.auth.entrar(v.dados.email, v.dados.senha);
  if (!r.ok) {
    switch (r.erro) {
      case "CredenciaisInvalidas":
        return { status: "erro", mensagem: MENSAGENS_DE_RESPOSTA.credenciaisInvalidas, valores };
      case "EmailNaoConfirmado":
        return { status: "erro", mensagem: MENSAGENS_DE_RESPOSTA.emailNaoConfirmado, codigo: "EmailNaoConfirmado", valores };
      default:
        return { ...erroDeLimiteOuInterno(r.erro), valores } as EstadoDoFormulario;
    }
  }

  if (await deps.usuarioBloqueado(r.usuarioId)) {
    await deps.auth.sair("local");
    return { status: "erro", mensagem: MENSAGENS_DE_RESPOSTA.credenciaisInvalidas, valores };
  }

  return { status: "autenticado", destino: destinoSeguro(destino) };
}

/** Reenviar o link de confirmação (5.1 e 5.2). Resposta sempre igual (INV-004). */
export async function reenviarConfirmacao(campos: Record<string, string>, deps: DependenciasDeAcesso): Promise<EstadoDoFormulario> {
  const v = validar(esquemaEmail, campos);
  if (!v.ok) return { status: "erro", erros: v.erros, valores: { email: campos.email ?? "" } };
  const r = await deps.auth.reenviarConfirmacao(v.dados.email, urlsDosLinks(deps.origem).confirmacao);
  if (!r.ok && r.erro === "MuitasTentativas") return erroDeLimiteOuInterno(r.erro);
  return { status: "enviado", mensagem: MENSAGENS_DE_RESPOSTA.confirmacaoReenviada };
}

/** Pedir recuperação de senha (5.4, CA-10). Resposta sempre igual (INV-004). */
export async function pedirRecuperacao(campos: Record<string, string>, deps: DependenciasDeAcesso): Promise<EstadoDoFormulario> {
  const v = validar(esquemaEmail, campos);
  if (!v.ok) return { status: "erro", erros: v.erros, valores: { email: campos.email ?? "" } };
  const r = await deps.auth.pedirRecuperacao(v.dados.email, urlsDosLinks(deps.origem).recuperacao);
  if (!r.ok && r.erro === "MuitasTentativas") return erroDeLimiteOuInterno(r.erro);
  return { status: "enviado", mensagem: MENSAGENS_DE_RESPOSTA.recuperacaoEnviada };
}

/** Destino depois da nova senha de uma conta com 2º fator (SPEC-019, OPEN-017). */
export const ROTA_SENHA_ALTERADA = `${ROTA_ENTRAR}?senha=alterada`;

/**
 * Definir nova senha pelo link de recuperação (5.4, CA-10): encerra as outras sessões.
 * SPEC-019 (OPEN-017): a conta com 2º fator digita o código antes (o Supabase só troca a senha numa
 * sessão aal2) e, depois, entra de novo com a senha nova: a sessão da recuperação não tem o login
 * com senha, que conta as 8 h da sessão do Administrador.
 */
export async function definirNovaSenha(campos: Record<string, string>, deps: DependenciasDeAcesso): Promise<EstadoDoFormulario> {
  const v = validar(esquemaNovaSenha, campos);
  if (!v.ok) return { status: "erro", erros: v.erros };

  const fatores = (await deps.auth.fatores()).filter((f) => f.verificado);
  const comSegundoFator = fatores.length > 0;
  if (comSegundoFator && (await deps.auth.sessaoAtual())?.nivel !== "aal2") {
    const c = lerCodigo(campos.codigo);
    if (!c.ok) return { status: "erro", erros: { codigo: c.erro } };
    const fator = fatores.find((f) => f.id === campos.fator) ?? fatores[0];
    const verificado = await deps.auth.verificarCodigo(fator.id, c.codigo);
    if (!verificado.ok) {
      if (verificado.erro === "CodigoInvalido") return { status: "erro", erros: { codigo: MENSAGENS_DO_SEGUNDO_FATOR.codigoInvalido } };
      return erroDeLimiteOuInterno(verificado.erro);
    }
  }

  const r = await deps.auth.definirSenha(v.dados.senha);
  if (!r.ok) {
    switch (r.erro) {
      case "SenhaRecusada":
        return { status: "erro", erros: { senha: MENSAGENS_DE_RESPOSTA.senhaRecusada } };
      case "MesmaSenha":
        return { status: "erro", erros: { senha: MENSAGENS_DE_RESPOSTA.mesmaSenha } };
      case "SemSessao":
        return { status: "erro", mensagem: MENSAGENS_DE_RESPOSTA.linkExpirado };
      case "SegundoFatorNecessario":
        return { status: "erro", erros: { codigo: MENSAGENS_DO_SEGUNDO_FATOR.reconfirmar } };
      default:
        return erroDeLimiteOuInterno(r.erro);
    }
  }

  await deps.auth.sair("outras");
  if (comSegundoFator) {
    await deps.auth.sair("local");
    return { status: "autenticado", destino: ROTA_SENHA_ALTERADA };
  }
  return { status: "autenticado", destino: ROTA_INICIAL };
}
