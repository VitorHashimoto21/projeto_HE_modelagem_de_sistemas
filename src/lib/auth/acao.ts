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

/** Ação que exige sessão, mas não negócio ativo (cadastrar negócio, aceitar convite…). */
export function acaoComSessao<A extends unknown[], R>(corpo: Corpo<ContextoComPapel, A, R>) {
  return async (...args: A): Promise<R> => {
    const { contexto } = await exigirNivel({ tipo: "sessao" });
    return corpo(contexto!, ...args);
  };
}

/** Configurações do negócio: só o Dono do negócio ativo (OPEN-002). */
export function acaoDoDono<A extends unknown[], R>(corpo: Corpo<ContextoDoMembro, A, R>) {
  return async (...args: A): Promise<R> => {
    const { membro } = await exigirNivel({ tipo: "dono" });
    return corpo(membro!, ...args);
  };
}

/** Ação de módulo: exige a permissão (módulo, ação) no negócio ativo (RF06). */
export function acaoComPermissao<A extends unknown[], R>(modulo: Modulo, acao: Acao, corpo: Corpo<ContextoDoMembro, A, R>) {
  return async (...args: A): Promise<R> => {
    const { membro } = await exigirNivel({ tipo: "permissao", modulo, acao });
    return corpo(membro!, ...args);
  };
}
