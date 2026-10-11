import "server-only";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { negocios, relatorios } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import type { DependenciasDosRelatorios } from "./servicos";

/** Dependências dos relatórios para o membro: negócio do contexto e "hoje" do servidor (SPEC-013). */
export async function dependenciasDosRelatorios(m: ContextoDoMembro): Promise<DependenciasDosRelatorios> {
  const n = await negocios().dadosFiscais(m.negocioId);
  return { relatorios: relatorios({ negocioId: m.negocioId, usuarioId: m.usuarioId }), negocio: n?.nome ?? "Negócio", hoje: hoje(), agora: new Date() };
}
