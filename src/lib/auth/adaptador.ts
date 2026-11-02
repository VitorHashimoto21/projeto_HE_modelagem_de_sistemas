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
  /** SPEC-019 (OPEN-017): conta com 2º fator só troca a senha depois do código (sessão `aal2`). */
  | { ok: false; erro: "SenhaRecusada" | "MesmaSenha" | "SemSessao" | "SegundoFatorNecessario" | ErroInterno };

/** Autenticador (fator TOTP) da conta, como o Supabase Auth informa (SPEC-019, 5.1). */
export type FatorDoUsuario = { id: string; nome: string; criadoEm: Date; verificado: boolean };

export type ResultadoDoCadastroDoFator =
  /** `qrCode`: imagem SVG em data URI; `segredo`: para digitar se a câmera falhar. */
  | { ok: true; fatorId: string; qrCode: string; segredo: string }
  | { ok: false; erro: "NomeRepetido" | "MuitosFatores" | "SegundoFatorNecessario" | ErroDeLimite | ErroInterno };

export type ResultadoDoCodigo = { ok: true } | { ok: false; erro: "CodigoInvalido" | ErroDeLimite | ErroInterno };

export type ResultadoDaRemocaoDoFator = { ok: true } | { ok: false; erro: "SegundoFatorNecessario" | ErroInterno };

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
  /** Sessão validada no servidor, com o momento da entrada (SPEC-018, RNF12), ou null. */
  sessaoAtual(): Promise<SessaoAtual | null>;

  // SPEC-019 (5.1): 2º fator pelo MFA TOTP do Supabase Auth.
  /** Autenticadores TOTP da conta da sessão, verificados ou não. */
  fatores(): Promise<FatorDoUsuario[]>;
  /** Novo autenticador: apaga os cadastros não concluídos e gera o QR code com o emissor do ambiente. */
  iniciarCadastroDoFator(nome: string, emissor: string): Promise<ResultadoDoCadastroDoFator>;
  /** Confere o código de um autenticador; com sucesso, a sessão passa a `aal2` e o horário do código é renovado. */
  verificarCodigo(fatorId: string, codigo: string): Promise<ResultadoDoCodigo>;
  removerFator(fatorId: string): Promise<ResultadoDaRemocaoDoFator>;
}

/**
 * `autenticadoEm`: quando a pessoa entrou com a senha nesta sessão; null se o provedor não informar.
 * SPEC-019: `nivel` da sessão (`aal2` depois do código) e `codigoEm`, o último código verificado.
 */
export type SessaoAtual = { usuarioId: string; autenticadoEm: Date | null; nivel?: "aal1" | "aal2" | null; codigoEm?: Date | null };
