import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";
import { consultasDeAcesso, type ContextoDeNegocio } from "@/lib/db";
import { ambiente } from "@/lib/env";
import { criarAdaptadorSupabase } from "./adaptador-supabase";
import type { Acao, Modulo } from "@/lib/dominio/permissoes";
import { autorizar, type ContextoDoMembro, type MotivoDaRecusa, type NivelDeAcesso } from "./autorizacao";
import { COOKIE_NEGOCIO_ATIVO, resolverContextoComPapel, type ContextoComPapel } from "./contexto";
import { enviarAvisoDeContaExistente } from "./emails";
import { ROTA_ENTRAR, ROTA_MEUS_NEGOCIOS, ROTA_SEM_ACESSO } from "./rotas";
import type { DependenciasDeAcesso } from "./servicos";

/**
 * Ponto de entrada da autenticação no servidor (Server Components, Server Actions e
 * Route Handlers). Os cookies de sessão são gerenciados pelo @supabase/ssr.
 */

export async function clienteSupabaseDoServidor() {
  // cookies() primeiro: marca a página como dinâmica (nunca pré-renderizada no build).
  const loja = await cookies();
  const amb = ambiente();
  return createServerClient(amb.NEXT_PUBLIC_SUPABASE_URL, amb.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => loja.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) loja.set(name, value, options);
        } catch {
          // Server Components não podem gravar cookies; a renovação acontece no proxy.
        }
      },
    },
  });
}

export async function adaptadorDoServidor() {
  return criarAdaptadorSupabase(await clienteSupabaseDoServidor());
}

/** Endereço da aplicação nesta requisição (para os links dos e-mails). */
export async function origemDaRequisicao(): Promise<string> {
  const h = await headers();
  const origem = h.get("origin");
  if (origem) return origem;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

export async function dependenciasDeAcesso(): Promise<DependenciasDeAcesso> {
  const consultas = consultasDeAcesso();
  const origem = await origemDaRequisicao();
  return {
    auth: await adaptadorDoServidor(),
    usuarioBloqueado: (id) => consultas.usuarioBloqueado(id),
    // Depois da resposta: o tempo de resposta não revela se o e-mail já existia (INV-004).
    avisarContaExistente: async (email) => {
      after(() => enviarAvisoDeContaExistente(email, origem).catch(() => undefined));
    },
    origem,
  };
}

/**
 * Contexto da requisição (5.5), calculado uma vez por requisição, com o papel e as
 * permissões efetivas no negócio ativo lidos do banco na mesma consulta (SPEC-005, INV-004).
 */
export const obterContexto = cache(async (): Promise<ContextoComPapel | null> => {
  const auth = await adaptadorDoServidor();
  const usuarioId = await auth.usuarioDaSessao();
  const negocio = (await cookies()).get(COOKIE_NEGOCIO_ATIVO)?.value;
  return resolverContextoComPapel(usuarioId, negocio, (u, n) => consultasDeAcesso().filiacao(u, n));
});

/** Para onde vai quem foi recusado (SPEC-005, 5.5). */
const DESTINO_DA_RECUSA: Record<MotivoDaRecusa, string> = {
  SemSessao: ROTA_ENTRAR,
  SemNegocio: ROTA_MEUS_NEGOCIOS,
  SomenteDono: ROTA_SEM_ACESSO,
  SemPermissao: ROTA_SEM_ACESSO,
};

/** Guarda comum de páginas e Server Actions: recusa redirecionando (nada é executado). */
export async function exigirNivel(nivel: NivelDeAcesso) {
  const r = autorizar(await obterContexto(), nivel);
  if (!r.ok) redirect(DESTINO_DA_RECUSA[r.motivo]);
  return r;
}

/** Para páginas e ações autenticadas: sem sessão válida, vai para o login (INV-005). */
export async function exigirSessao(): Promise<ContextoComPapel> {
  const contexto = await obterContexto();
  if (!contexto) redirect(ROTA_ENTRAR);
  return contexto;
}

/**
 * Contexto para o cliente do negócio (SPEC-001): exige sessão e negócio ativo
 * autorizado; caso contrário, leva a "Meus negócios" (CA-11).
 */
export async function exigirNegocio(): Promise<ContextoDeNegocio> {
  const { negocioId, usuarioId } = await exigirMembro();
  return { negocioId, usuarioId };
}

/** Membro do negócio ativo, com papel e permissões efetivas (SPEC-005). */
export async function exigirMembro(): Promise<ContextoDoMembro> {
  const r = await exigirNivel({ tipo: "sessao" });
  if (!r.membro) redirect(ROTA_MEUS_NEGOCIOS);
  return r.membro;
}

/** Configurações do negócio: só o Dono (OPEN-002); os demais veem "Sem acesso". */
export async function exigirDono(): Promise<ContextoDoMembro> {
  return (await exigirNivel({ tipo: "dono" })).membro!;
}

/** Páginas e ações de módulo: exige a permissão (módulo, ação) no negócio ativo (5.5). */
export async function exigirPermissao(modulo: Modulo, acao: Acao): Promise<ContextoDoMembro> {
  return (await exigirNivel({ tipo: "permissao", modulo, acao })).membro!;
}
