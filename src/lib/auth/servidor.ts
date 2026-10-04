import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";
import { consultasDeAcesso, type ContextoDeNegocio } from "@/lib/db";
import { ambiente } from "@/lib/env";
import { criarAdaptadorSupabase } from "./adaptador-supabase";
import { COOKIE_NEGOCIO_ATIVO, resolverContexto, type ContextoDaRequisicao } from "./contexto";
import { enviarAvisoDeContaExistente } from "./emails";
import { ROTA_ENTRAR, ROTA_INICIAL } from "./rotas";
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
async function origemDaRequisicao(): Promise<string> {
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

/** Contexto da requisição (5.5), calculado uma vez por requisição. */
export const obterContexto = cache(async (): Promise<ContextoDaRequisicao | null> => {
  const auth = await adaptadorDoServidor();
  const usuarioId = await auth.usuarioDaSessao();
  const negocio = (await cookies()).get(COOKIE_NEGOCIO_ATIVO)?.value;
  return resolverContexto(usuarioId, negocio, (u, n) => consultasDeAcesso().ehMembro(u, n));
});

/** Para páginas e ações autenticadas: sem sessão válida, vai para o login (INV-005). */
export async function exigirSessao(): Promise<ContextoDaRequisicao> {
  const contexto = await obterContexto();
  if (!contexto) redirect(ROTA_ENTRAR);
  return contexto;
}

/**
 * Contexto para o cliente do negócio (SPEC-001): exige sessão e negócio ativo
 * autorizado; caso contrário, leva a "Meus negócios" (CA-11).
 */
export async function exigirNegocio(): Promise<ContextoDeNegocio> {
  const contexto = await exigirSessao();
  if (!contexto.negocioId) redirect(ROTA_INICIAL);
  return { negocioId: contexto.negocioId, usuarioId: contexto.usuarioId };
}
