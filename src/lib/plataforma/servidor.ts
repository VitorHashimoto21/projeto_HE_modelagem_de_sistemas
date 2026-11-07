import "server-only";
import { adaptadorDoServidor, origemDaRequisicao } from "@/lib/auth/servidor";
import { plataforma, suporte } from "@/lib/db";
import { avisar } from "@/lib/suporte/servidor";
import type { DependenciasDaPlataforma } from "./servicos";

/** Dependências reais dos pedidos da plataforma e da emergência para o Administrador da requisição (SPEC-019, 5.6 e 5.8). */
export async function dependenciasDaPlataforma(administradorId: string): Promise<DependenciasDaPlataforma> {
  const p = plataforma();
  const s = suporte();
  return {
    administradorId,
    agora: () => new Date(),
    pedirTrocaDePlano: p.pedirTrocaDePlano,
    pedirEmergencia: p.pedirEmergencia,
    decidir: p.decidir,
    cancelar: p.cancelar,
    entrarNaEmergencia: s.entrarNaEmergencia,
    registrarResultado: s.registrarResultado,
    dono: s.donoDoNegocio,
    avisar,
    origem: await origemDaRequisicao(),
  };
}

/** Autenticadores ativos da conta da sessão, para o diálogo do código das ações críticas (OPEN-003). */
export async function autenticadoresDaSessao(): Promise<{ id: string; nome: string }[]> {
  return (await (await adaptadorDoServidor()).fatores()).filter((f) => f.verificado).map(({ id, nome }) => ({ id, nome }));
}
