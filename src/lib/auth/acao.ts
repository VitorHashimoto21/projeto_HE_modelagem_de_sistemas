import "server-only";
import { correcoes } from "@/lib/db";
import type { IdDaCorrecao } from "@/lib/dominio/correcoes";
import type { Acao, Modulo } from "@/lib/dominio/permissoes";
import { MENSAGENS_DO_SEGUNDO_FATOR, reconfirmacaoValida } from "@/lib/dominio/segundo-fator";
import type { ContextoDoMembro } from "./autorizacao";
import type { ContextoComPapel } from "./contexto";
import { exigirNivel } from "./servidor";

/**
 * Fábrica de Server Actions (SPEC-005, 5.5; OPEN-008). Toda Server Action é criada por
 * uma destas funções, que declaram o nível de acesso e executam a guarda no servidor
 * antes do corpo da ação: sem a permissão, a ação é recusada (redireciona) e nada é
 * gravado. O teste test/unit/acoes.test.ts falha se alguma Server Action escapar (INV-005).
 */

type Corpo<C, A extends unknown[], R> = (contexto: C, ...args: A) => Promise<R>;

/** Ação aberta a todos (login, cadastro, recuperação de senha). */
export function acaoPublica<A extends unknown[], R>(corpo: (...args: A) => Promise<R>) {
  // Nenhuma guarda a executar: declarar "pública" já é a decisão explícita exigida.
  return async (...args: A): Promise<R> => corpo(...args);
}

/**
 * Ação que exige sessão, mas não negócio ativo (cadastrar negócio, aceitar convite…). Recusada
 * para a conta de Administrador (SPEC-018, INV-004) e no modo suporte (INV-002).
 */
export function acaoComSessao<A extends unknown[], R>(corpo: Corpo<ContextoComPapel, A, R>) {
  return async (...args: A): Promise<R> => {
    const { contexto } = await exigirNivel({ tipo: "sessao", origem: "acao" });
    return corpo(contexto!, ...args);
  };
}

/**
 * Configurações do negócio: só o Dono do negócio ativo (OPEN-002). Com o negócio suspenso (SPEC-019, 5.7),
 * recusada (`NegocioSuspenso`), salvo `naSuspensao`: o acesso do suporte (liberar, revogar, encerrar a
 * emergência) e o desfazer, que recusa com a explicação (OPEN-018).
 */
export function acaoDoDono<A extends unknown[], R>(corpo: Corpo<ContextoDoMembro, A, R>, opcoes?: { naSuspensao: true }) {
  return async (...args: A): Promise<R> => {
    const { membro } = await exigirNivel({ tipo: "dono", origem: "acao", naSuspensao: opcoes?.naSuspensao });
    return corpo(membro!, ...args);
  };
}

/** O `redirect()` do Next é um erro com o digest NEXT_REDIRECT: na correção, conta como sucesso. */
function ehRedirecionamento(e: unknown): boolean {
  const digest = typeof e === "object" && e !== null ? (e as { digest?: unknown }).digest : undefined;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

/**
 * Ação de módulo: exige a permissão (módulo, ação) no negócio ativo (RF06). No modo suporte, nunca
 * (SPEC-018, INV-002), exceto as correções da lista fechada nos módulos em "ver e corrigir" (SPEC-019,
 * 5.4): `correcao` diz qual é. A correção roda pelo motor, numa transação única com o evento
 * `CORRECAO` e o antes e o depois (INV-004). "consulta" marca as consultas dos formulários (o NCM).
 */
export function acaoComPermissao<A extends unknown[], R>(modulo: Modulo, acao: Acao, corpo: Corpo<ContextoDoMembro, A, R>, correcao?: IdDaCorrecao | "consulta") {
  return async (...args: A): Promise<R> => {
    const { membro } = await exigirNivel({ tipo: "permissao", modulo, acao, origem: "acao", correcao });
    const m = membro!;
    if (m.suporte && m.correcao) {
      const contexto = { negocioId: m.negocioId, administradorId: m.usuarioId, acessoId: m.suporte.acessoId };
      return correcoes().executar(contexto, m.correcao, args, () => corpo(m, ...args), ehRedirecionamento);
    }
    return corpo(m, ...args);
  };
}

/** Minha conta (SPEC-014) e o novo aceite dos termos (SPEC-018, RF78): sessão, mesmo com os termos pendentes. */
export function acaoDaConta<A extends unknown[], R>(corpo: Corpo<ContextoComPapel, A, R>) {
  return async (...args: A): Promise<R> => {
    const { contexto } = await exigirNivel({ tipo: "conta" });
    return corpo(contexto!, ...args);
  };
}

/** SPEC-019 (5.1): telas do 2º fator — conta de Administrador, com ou sem o código já verificado. */
export function acaoDoSegundoFator<A extends unknown[], R>(corpo: Corpo<ContextoComPapel, A, R>) {
  return async (...args: A): Promise<R> => {
    const { contexto } = await exigirNivel({ tipo: "segundoFator" });
    return corpo(contexto!, ...args);
  };
}

/** Resposta de uma ação crítica sem o código recente: a tela pede o código e repete a ação. */
export type ReconfirmacaoNecessaria = { status: "reconfirmar"; mensagem: string };

/**
 * SPEC-019 (OPEN-003, INV-002): ação crítica do Administrador. Além do 2º fator da sessão, exige um
 * código verificado nos últimos 10 min; sem ele, nada é executado e a tela pede o código de novo.
 */
export function acaoCritica<A extends unknown[], R>(corpo: Corpo<ContextoComPapel, A, R>) {
  return async (...args: A): Promise<R | ReconfirmacaoNecessaria> => {
    const { contexto } = await exigirNivel({ tipo: "administrador" });
    if (!reconfirmacaoValida(contexto!.codigoVerificadoEm, new Date())) return { status: "reconfirmar", mensagem: MENSAGENS_DO_SEGUNDO_FATOR.reconfirmar };
    return corpo(contexto!, ...args);
  };
}

/** Painel do Administrador da plataforma e o modo suporte (SPEC-018). */
export function acaoDoAdministrador<A extends unknown[], R>(corpo: Corpo<ContextoComPapel, A, R>) {
  return async (...args: A): Promise<R> => {
    const { contexto } = await exigirNivel({ tipo: "administrador" });
    return corpo(contexto!, ...args);
  };
}
