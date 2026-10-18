import "server-only";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { catalogo, parametrosFiscais, precificacao } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import type { DependenciasDaCalculadora } from "./servicos";

/** Dependências da Calculadora (SPEC-010) para o membro: negócio do contexto e "hoje" do servidor. */
export function dependenciasDaCalculadora(m: ContextoDoMembro): DependenciasDaCalculadora {
  const contexto = { negocioId: m.negocioId, usuarioId: m.usuarioId };
  return { precificacao: precificacao(contexto), catalogo: catalogo(contexto), fiscais: parametrosFiscais(), usuarioId: m.usuarioId, hoje: hoje() };
}
