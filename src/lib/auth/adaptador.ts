/**
 * Contrato com o provedor de autenticação (SPEC-002, seção 9). A implementação real
 * usa o Supabase Auth (adaptador-supabase.ts); os testes usam um dublê que grava no
 * auth.users do banco local, exercitando o gatilho de criação do Usuario.
 */

export type ErroDeLimite = "MuitasTentativas";
export type ErroInterno = "FalhaInterna";

export type ResultadoCadastro =
  /** `contaJaExistia`: o e-mail já tinha conta; nada foi criado (CA-04). */
  | { ok: true; contaJaExistia: boolean }
  | { ok: false; erro: "SenhaRecusada" | ErroDeLimite | ErroInterno };

export type ResultadoEntrar =
  | { ok: true; usuarioId: string }
  | { ok: false; erro: "CredenciaisInvalidas" | "EmailNaoConfirmado" | ErroDeLimite | ErroInterno };

export type ResultadoEnvio = { ok: true } | { ok: false; erro: ErroDeLimite | ErroInterno };

export type ResultadoNovaSenha =
  | { ok: true }
  | { ok: false; erro: "SenhaRecusada" | "MesmaSenha" | "SemSessao" | ErroInterno };

/** Tipo do link recebido por e-mail. */
export type TipoDeLink = "email" | "recovery";

export type DadosDoLink = { tokenHash?: string; codigo?: string; tipo: TipoDeLink };

export interface AdaptadorDeAutenticacao {
  cadastrar(dados: {
    nome: string;
    email: string;
    senha: string;
    versaoTermos: string;
    urlDeConfirmacao: string;
  }): Promise<ResultadoCadastro>;
  entrar(email: string, senha: string): Promise<ResultadoEntrar>;
  /** "local": esta sessão; "outras": todas as outras sessões do usuário (CA-10). */
  sair(escopo: "local" | "outras"): Promise<void>;
  reenviarConfirmacao(email: string, urlDeConfirmacao: string): Promise<ResultadoEnvio>;
  pedirRecuperacao(email: string, urlDeRetorno: string): Promise<ResultadoEnvio>;
  /** Valida o link do e-mail e abre a sessão. */
  confirmarLink(dados: DadosDoLink): Promise<{ ok: boolean }>;
  definirSenha(senha: string): Promise<ResultadoNovaSenha>;
  /** Id do usuário da sessão validada no servidor, ou null. */
  usuarioDaSessao(): Promise<string | null>;
}
