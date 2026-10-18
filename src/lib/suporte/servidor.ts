import "server-only";
import { cookies } from "next/headers";
import { after } from "next/server";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { COOKIE_SUPORTE } from "@/lib/auth/contexto";
import { origemDaRequisicao } from "@/lib/auth/servidor";
import { suporte } from "@/lib/db";
import { enviarEmail, type MensagemDeEmail } from "@/lib/integracoes/email";
import type { DependenciasDoAdministrador, DependenciasDoDono } from "./servicos";

/** E-mail depois da resposta (OPEN-009): a falha no envio nunca bloqueia nada. */
const avisar = (m: MensagemDeEmail) => after(() => enviarEmail(m, "suporte").then(() => undefined));

export async function dependenciasDoDono(membro: ContextoDoMembro): Promise<DependenciasDoDono> {
  const s = suporte();
  return { membro, agora: () => new Date(), liberar: s.liberar, revogar: s.revogar, dono: s.donoDoNegocio, avisar, origem: await origemDaRequisicao() };
}

export async function dependenciasDoAdministrador(administradorId: string): Promise<DependenciasDoAdministrador> {
  const s = suporte();
  return {
    administradorId,
    agora: () => new Date(),
    liberacaoAtiva: (negocioId) => s.liberacaoAtiva(negocioId, new Date()),
    entrar: s.entrar,
    liberacao: s.liberacaoDoContexto,
    sair: s.sair,
    dono: s.donoDoNegocio,
    avisar,
    origem: await origemDaRequisicao(),
  };
}

/** Cookie do modo suporte (5.5): só o id da liberação, httpOnly, vale até o fim do prazo. */
export async function gravarModoSuporte(acessoId: string, expiraEm: Date) {
  (await cookies()).set(COOKIE_SUPORTE, acessoId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiraEm,
  });
}

export async function lerModoSuporte(): Promise<string | null> {
  return (await cookies()).get(COOKIE_SUPORTE)?.value ?? null;
}

export async function limparModoSuporte() {
  (await cookies()).delete(COOKIE_SUPORTE);
}
