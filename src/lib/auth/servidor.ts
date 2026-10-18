import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";
import { consultasDeAcesso, suporte, type ContextoDeNegocio } from "@/lib/db";
import { ambiente } from "@/lib/env";
import { criarAdaptadorSupabase } from "./adaptador-supabase";
import type { Acao, Modulo } from "@/lib/dominio/permissoes";
import { descreverTela } from "@/lib/dominio/suporte";
import { autorizar, type ContextoDoMembro, type MotivoDaRecusa, type NivelDeAcesso } from "./autorizacao";
import { COOKIE_NEGOCIO_ATIVO, COOKIE_SUPORTE, resolverContextoDaRequisicao, type ContextoComPapel } from "./contexto";
import { enviarAvisoDeContaExistente } from "./emails";
import {
  CABECALHO_CAMINHO,
  ROTA_ACEITE_DOS_TERMOS,
  ROTA_ADMIN,
  ROTA_ENTRAR,
  ROTA_MEUS_NEGOCIOS,
  ROTA_SEM_ACESSO,
  ROTA_SESSAO_EXPIRADA,
} from "./rotas";
import type { DependenciasDeAcesso } from "./servicos";
import { VERSAO_TERMOS } from "./validacao";

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
 * SPEC-018: também o papel de Administrador, a liberação do modo suporte (sempre conferida
 * no banco — INV-001), a pendência dos termos (RF78) e a sessão de 8 h do Administrador (RNF12).
 */
export const obterContexto = cache(async (): Promise<ContextoComPapel | null> => {
  const auth = await adaptadorDoServidor();
  const sessao = await auth.sessaoAtual();
  const loja = await cookies();
  const acesso = consultasDeAcesso();
  return resolverContextoDaRequisicao(
    {
      usuarioId: sessao?.usuarioId ?? null,
      negocioDoCookie: loja.get(COOKIE_NEGOCIO_ATIVO)?.value,
      suporteDoCookie: loja.get(COOKIE_SUPORTE)?.value,
      autenticadoEm: sessao?.autenticadoEm ?? null,
      agora: new Date(),
      versaoDosTermos: VERSAO_TERMOS,
    },
    {
      filiacao: (u, n) => acesso.filiacao(u, n),
      conta: (u) => acesso.estadoDaConta(u),
      liberacao: (id) => suporte().liberacaoDoContexto(id),
    },
  );
});

/** Para onde vai quem foi recusado (SPEC-005, 5.5; SPEC-018). */
function destinoDaRecusa(motivo: MotivoDaRecusa, contexto: ContextoComPapel | null): string {
  switch (motivo) {
    case "SemSessao":
      return ROTA_ENTRAR;
    case "SemNegocio":
      if (!contexto?.administrador) return ROTA_MEUS_NEGOCIOS;
      return contexto.suporteEncerrado ? `${ROTA_ADMIN}?suporte=${contexto.suporteEncerrado}` : ROTA_ADMIN;
    case "ContaDeAdministrador":
      return ROTA_ADMIN;
    case "TermosPendentes":
      return ROTA_ACEITE_DOS_TERMOS;
    case "SessaoExpirada":
      return ROTA_SESSAO_EXPIRADA;
    case "SomenteDono":
    case "SemPermissao":
    case "SomenteLeitura":
    case "SomenteAdministrador":
      return ROTA_SEM_ACESSO;
  }
}

/**
 * Registro de cada tela aberta em modo suporte (SPEC-018, INV-005): uma vez por requisição,
 * na guarda da página, antes de qualquer dado do negócio ser lido. Se o registro falhar, o
 * erro sobe e a página não é mostrada.
 */
const registrarTelaDoSuporte = cache(async (acessoId: string, negocioId: string, administradorId: string): Promise<void> => {
  const caminho = (await headers()).get(CABECALHO_CAMINHO) ?? "/";
  await suporte().registrarTela(negocioId, acessoId, administradorId, descreverTela(caminho));
});

/** Guarda comum de páginas e Server Actions: recusa redirecionando (nada é executado). */
export async function exigirNivel(nivel: NivelDeAcesso) {
  const contexto = await obterContexto();
  const r = autorizar(contexto, nivel);
  if (!r.ok) redirect(destinoDaRecusa(r.motivo, contexto));
  const leituraDoNegocio = nivel.tipo === "sessao" || nivel.tipo === "dono" || nivel.tipo === "permissao";
  if (contexto?.suporte && leituraDoNegocio && nivel.origem !== "acao") {
    await registrarTelaDoSuporte(contexto.suporte.acessoId, contexto.suporte.negocioId, contexto.usuarioId);
  }
  return r;
}

/**
 * Para o layout e páginas autenticadas: sem sessão válida, vai para o login (INV-005); com a
 * sessão do Administrador vencida, encerra a sessão (SPEC-018, RNF12).
 */
export async function exigirSessao(): Promise<ContextoComPapel> {
  const contexto = await obterContexto();
  if (!contexto) redirect(ROTA_ENTRAR);
  if (contexto.sessaoExpirada) redirect(ROTA_SESSAO_EXPIRADA);
  return contexto;
}

/** Minha conta e o novo aceite (SPEC-014, SPEC-018): basta a sessão, mesmo com os termos pendentes. */
export async function exigirConta(): Promise<ContextoComPapel> {
  return (await exigirNivel({ tipo: "conta" })).contexto!;
}

/** "Meus negócios" e cadastro de negócio: só usuários comuns; o Administrador vai ao painel (INV-004). */
export async function exigirUsuarioComum(): Promise<ContextoComPapel> {
  const { contexto } = await exigirNivel({ tipo: "sessao" });
  if (contexto!.administrador) redirect(ROTA_ADMIN);
  return contexto!;
}

/** Painel do Administrador da plataforma (SPEC-018, 5.3). */
export async function exigirAdministrador(): Promise<ContextoComPapel> {
  return (await exigirNivel({ tipo: "administrador" })).contexto!;
}

/**
 * Contexto para o cliente do negócio (SPEC-001): exige sessão e negócio ativo
 * autorizado; caso contrário, leva a "Meus negócios" (CA-11).
 */
export async function exigirNegocio(): Promise<ContextoDeNegocio> {
  const { negocioId, usuarioId, modoSuporte } = await exigirMembro();
  return { negocioId, usuarioId, modoSuporte };
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
