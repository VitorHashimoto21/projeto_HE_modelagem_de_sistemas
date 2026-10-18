"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acaoDaConta, acaoDoAdministrador, acaoDoDono } from "@/lib/auth/acao";
import { ROTA_ADMIN, destinoSeguro } from "@/lib/auth/rotas";
import { camposDoFormulario, VERSAO_TERMOS } from "@/lib/auth/validacao";
import { consultasDeAcesso } from "@/lib/db";
import { dependenciasDoAdministrador, dependenciasDoDono, gravarModoSuporte, lerModoSuporte, limparModoSuporte } from "./servidor";
import * as servicos from "./servicos";

// Server Actions do acesso de suporte (SPEC-018). A fábrica executa a guarda (Dono,
// Administrador ou conta) antes do corpo; os fluxos de servicos.ts validam tudo de novo.

const texto = (form: FormData, campo: string) => {
  const v = form.get(campo);
  return typeof v === "string" ? v : "";
};

/** Dono: liberar o acesso do suporte (RF75). */
export const acaoLiberarSuporte = acaoDoDono(async (membro, _: servicos.EstadoDaLiberacao, form: FormData) => {
  const estado = await servicos.liberar(camposDoFormulario(form), await dependenciasDoDono(membro));
  revalidatePath("/", "layout");
  return estado;
});

/** Dono: revogar a liberação ativa (5.4). */
export const acaoRevogarSuporte = acaoDoDono(async (membro, form: FormData) => {
  const r = await servicos.revogar(texto(form, "acessoId"), await dependenciasDoDono(membro));
  revalidatePath("/", "layout");
  redirect(`/negocio/suporte?${r.status === "ok" ? "revogado=1" : "erro=1"}`);
});

/** Administrador: entrar em modo suporte num negócio com liberação ativa (5.5). */
export const acaoEntrarEmModoSuporte = acaoDoAdministrador(async (contexto, form: FormData) => {
  const negocioId = texto(form, "negocioId");
  const r = await servicos.entrar(negocioId, await dependenciasDoAdministrador(contexto.usuarioId));
  if (!r.ok) redirect(`${ROTA_ADMIN}/negocios/${encodeURIComponent(negocioId)}?erro=${encodeURIComponent(r.mensagem)}`);
  await gravarModoSuporte(r.acessoId, r.expiraEm);
  redirect(r.destino);
});

/** Administrador: sair do modo suporte (5.5). */
export const acaoSairDoModoSuporte = acaoDoAdministrador(async (contexto) => {
  const negocioId = await servicos.sair(await lerModoSuporte(), await dependenciasDoAdministrador(contexto.usuarioId));
  await limparModoSuporte();
  redirect(negocioId ? `${ROTA_ADMIN}/negocios/${negocioId}` : ROTA_ADMIN);
});

/** Todos: novo aceite da política e dos termos (RF78). */
export const acaoAceitarTermos = acaoDaConta(async (contexto, _: { erro?: string }, form: FormData): Promise<{ erro?: string }> => {
  if (form.get("aceite") !== "on") return { erro: "Para continuar, marque que leu e aceita a Política de Privacidade e os Termos de Uso." };
  await consultasDeAcesso().aceitarTermos(contexto.usuarioId, VERSAO_TERMOS, new Date());
  redirect(contexto.administrador ? ROTA_ADMIN : destinoSeguro(form.get("proximo")));
});
