import "server-only";
import type { Acao, Modulo } from "@/lib/dominio/permissoes";
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

/** Configurações do negócio: só o Dono do negócio ativo (OPEN-002). */
export function acaoDoDono<A extends unknown[], R>(corpo: Corpo<ContextoDoMembro, A, R>) {
  return async (...args: A): Promise<R> => {
    const { membro } = await exigirNivel({ tipo: "dono", origem: "acao" });
    return corpo(membro!, ...args);
  };
}

/** Ação de módulo: exige a permissão (módulo, ação) no negócio ativo (RF06). Nunca no modo suporte (INV-002). */
export function acaoComPermissao<A extends unknown[], R>(modulo: Modulo, acao: Acao, corpo: Corpo<ContextoDoMembro, A, R>) {
  return async (...args: A): Promise<R> => {
    const { membro } = await exigirNivel({ tipo: "permissao", modulo, acao, origem: "acao" });
    return corpo(membro!, ...args);
  };
}

/** Minha conta (SPEC-014) e o novo aceite dos termos (SPEC-018, RF78): sessão, mesmo com os termos pendentes. */
export function acaoDaConta<A extends unknown[], R>(corpo: Corpo<ContextoComPapel, A, R>) {
  return async (...args: A): Promise<R> => {
    const { contexto } = await exigirNivel({ tipo: "conta" });
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
