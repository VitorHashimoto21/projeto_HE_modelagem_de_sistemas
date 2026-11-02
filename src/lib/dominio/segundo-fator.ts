/**
 * 2º fator do Administrador (SPEC-019, 5.1; OPEN-001 a OPEN-003, OPEN-017). Regras puras, sem
 * framework: o servidor e os testes as usam direto. Os fatores ficam no Supabase Auth (MFA TOTP);
 * aqui só se leem as claims do JWT validado e se conferem os prazos (RNF03: nenhum segredo no HE).
 */

/** Validade da reconfirmação nas ações críticas (OPEN-003). */
export const MINUTOS_DA_RECONFIRMACAO = 10;

/** Emissor mostrado no aplicativo autenticador quando o ambiente não define outro (revisão de 01/11/2026). */
export const EMISSOR_PADRAO = "Health Enterprise";

export const MAX_NOME_DO_AUTENTICADOR = 40;

/** Nível de garantia da sessão no Supabase Auth: `aal2` só depois do código verificado. */
export type NivelDaSessao = "aal1" | "aal2";

export type InstantesDaSessao = {
  nivel: NivelDaSessao | null;
  /** Login com senha (o método `password` do `amr`): conta as 8 h da sessão (RNF12). */
  senhaEm: Date | null;
  /** Último código verificado (o método do TOTP no `amr`): conta os 10 min da reconfirmação. */
  codigoEm: Date | null;
};

/** O SDK prevê os dois nomes para o método do código (revisão de 01/11/2026). */
const METODOS_DO_CODIGO = new Set(["totp", "mfa/totp"]);

function instanteDoMetodo(amr: unknown[], aceita: (metodo: string) => boolean): Date | null {
  const instantes = amr
    .filter((a): a is { method?: unknown; timestamp?: unknown } => typeof a === "object" && a !== null)
    .filter((a) => typeof a.method === "string" && aceita(a.method))
    .map((a) => a.timestamp)
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t));
  return instantes.length ? new Date(Math.max(...instantes) * 1000) : null;
}

/**
 * Nível e horários da sessão a partir das claims do JWT do Supabase. O `amr` guarda, por método, o
 * momento da autenticação, e não muda quando a sessão é renovada; um novo código atualiza o do TOTP.
 */
export function instantesDasClaims(claims: Record<string, unknown> | null | undefined): InstantesDaSessao {
  const aal = claims?.aal;
  const nivel: NivelDaSessao | null = aal === "aal1" || aal === "aal2" ? aal : null;
  const amr = Array.isArray(claims?.amr) ? (claims.amr as unknown[]) : [];
  return {
    nivel,
    senhaEm: instanteDoMetodo(amr, (m) => m === "password"),
    codigoEm: instanteDoMetodo(amr, (m) => METODOS_DO_CODIGO.has(m)),
  };
}

/** Código verificado nos últimos 10 min (INV-002). Um horário no futuro além de 1 min não vale. */
export function reconfirmacaoValida(codigoEm: Date | null | undefined, agora: Date): boolean {
  if (!codigoEm || Number.isNaN(codigoEm.getTime())) return false;
  const decorrido = agora.getTime() - codigoEm.getTime();
  return decorrido >= -60_000 && decorrido < MINUTOS_DA_RECONFIRMACAO * 60_000;
}

/**
 * Redefinição pelo workflow (OPEN-002): a sessão aberta (login com senha) antes da redefinição deixa
 * de valer. Sem o horário do login, também não vale (falha fechada). O JWT guarda o login em segundos
 * inteiros: um login no mesmo segundo da redefinição conta como depois dela.
 */
export function sessaoAnteriorARedefinicao(senhaEm: Date | null, redefinidoEm: Date | null | undefined): boolean {
  if (!redefinidoEm) return false;
  if (!senhaEm) return true;
  return Math.floor(senhaEm.getTime() / 1000) < Math.floor(redefinidoEm.getTime() / 1000);
}

export const MENSAGENS_DO_SEGUNDO_FATOR = {
  codigoFormato: "Digite os 6 números que aparecem no aplicativo.",
  codigoInvalido: "Código incorreto ou vencido. Confira o aplicativo e digite o código atual.",
  muitasTentativas: "Muitas tentativas. Aguarde alguns minutos.",
  falhaInterna: "Não foi possível concluir agora. Tente novamente.",
  nomeObrigatorio: "Dê um nome ao autenticador (ex.: Celular).",
  nomeLongo: `Use até ${MAX_NOME_DO_AUTENTICADOR} caracteres.`,
  nomeRepetido: "Você já tem um autenticador com esse nome. Escolha outro.",
  muitosFatores: "Limite de autenticadores atingido. Remova um antes de cadastrar outro.",
  ultimoAutenticador: "Não é possível remover o último autenticador.",
  reconfirmar: "Por segurança, digite o código do autenticador para continuar.",
  fatorAtivado: "2º fator ativado.",
  autenticadorCadastrado: "Autenticador cadastrado.",
  autenticadorRemovido: "Autenticador removido.",
} as const;

/** Código de 6 dígitos; espaços (como o aplicativo mostra, "123 456") são ignorados. */
export function lerCodigo(texto: unknown): { ok: true; codigo: string } | { ok: false; erro: string } {
  const limpo = typeof texto === "string" ? texto.replace(/\s/g, "") : "";
  return /^\d{6}$/.test(limpo) ? { ok: true, codigo: limpo } : { ok: false, erro: MENSAGENS_DO_SEGUNDO_FATOR.codigoFormato };
}

export function lerNomeDoAutenticador(texto: unknown): { ok: true; nome: string } | { ok: false; erro: string } {
  const nome = typeof texto === "string" ? texto.trim().replace(/\s+/g, " ") : "";
  if (!nome) return { ok: false, erro: MENSAGENS_DO_SEGUNDO_FATOR.nomeObrigatorio };
  if (nome.length > MAX_NOME_DO_AUTENTICADOR) return { ok: false, erro: MENSAGENS_DO_SEGUNDO_FATOR.nomeLongo };
  return { ok: true, nome };
}

/** Emissor do ambiente (ex.: "HE Homologação"), limpo e curto; sem ele, o padrão. */
export function emissorDoAmbiente(valor: string | undefined): string {
  const limpo = (valor ?? "").trim().replace(/[:\s]+/g, " ").slice(0, 40).trim();
  return limpo || EMISSOR_PADRAO;
}
