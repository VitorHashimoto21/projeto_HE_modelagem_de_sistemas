import "server-only";
import { adaptadorDoServidor, origemDaRequisicao } from "@/lib/auth/servidor";
import { plataforma, suporte } from "@/lib/db";
import { avisar } from "@/lib/suporte/servidor";
import type { DependenciasDaPlataforma } from "./servicos";

/** Dependências reais dos pedidos da plataforma para o Administrador da requisição (SPEC-019, 5.8). */
export async function dependenciasDaPlataforma(administradorId: string): Promise<DependenciasDaPlataforma> {
  const p = plataforma();
  return {
    administradorId,
    agora: () => new Date(),
    pedirTrocaDePlano: p.pedirTrocaDePlano,
    decidirTrocaDePlano: p.decidirTrocaDePlano,
    cancelar: p.cancelar,
    dono: suporte().donoDoNegocio,
    avisar,
    origem: await origemDaRequisicao(),
  };
}

/** Autenticadores ativos da conta da sessão, para o diálogo do código das ações críticas (OPEN-003). */
export async function autenticadoresDaSessao(): Promise<{ id: string; nome: string }[]> {
  return (await (await adaptadorDoServidor()).fatores()).filter((f) => f.verificado).map(({ id, nome }) => ({ id, nome }));
}
