"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acaoDaConta, acaoDoAdministrador, acaoDoDono, type ReconfirmacaoNecessaria } from "@/lib/auth/acao";
import { ROTA_ADMIN, destinoSeguro } from "@/lib/auth/rotas";
import { camposDoFormulario, VERSAO_TERMOS } from "@/lib/auth/validacao";
import { consultasDeAcesso, correcoes, DesfazerRecusado, suporte } from "@/lib/db";
import { MENSAGENS_DAS_CORRECOES } from "@/lib/dominio/correcoes";
import { MENSAGENS_DA_EMERGENCIA } from "@/lib/dominio/emergencia";
import { dependenciasDoAdministrador, dependenciasDoDono, gravarModoSuporte, lerModoSuporte, limparModoSuporte } from "./servidor";
import * as servicos from "./servicos";

// Server Actions do acesso de suporte (SPEC-018). A fábrica executa a guarda (Dono,
// Administrador ou conta) antes do corpo; os fluxos de servicos.ts validam tudo de novo.

const texto = (form: FormData, campo: string) => {
  const v = form.get(campo);
  return typeof v === "string" ? v : "";
};

/** Dono: liberar o acesso do suporte (RF75). */
export const acaoLiberarSuporte = acaoDoDono(
  async (membro, _: servicos.EstadoDaLiberacao, form: FormData) => {
    const estado = await servicos.liberar(camposDoFormulario(form), await dependenciasDoDono(membro));
    revalidatePath("/", "layout");
    return estado;
  },
  // SPEC-019 (5.7): com o negócio suspenso, o Dono continua podendo liberar e revogar, para pedir ajuda.
  { naSuspensao: true },
);

/** Dono: revogar a liberação ativa (5.4). */
export const acaoRevogarSuporte = acaoDoDono(
  async (membro, form: FormData) => {
    const r = await servicos.revogar(texto(form, "acessoId"), await dependenciasDoDono(membro));
    revalidatePath("/", "layout");
    redirect(`/negocio/suporte?${r.status === "ok" ? "revogado=1" : "erro=1"}`);
  },
  { naSuspensao: true },
);

/**
 * Dono: desfazer uma correção do suporte (SPEC-019, 5.5). Até 30 dias, uma vez, e só se o registro
 * continua como a correção deixou; a compensação é feita em nome do Dono. A recusa explica o motivo.
 */
export const acaoDesfazerCorrecao = acaoDoDono(
  async (membro, _: servicos.EstadoDoDesfazer, form: FormData): Promise<servicos.EstadoDoDesfazer> => {
    try {
      await correcoes().desfazer(texto(form, "correcaoId"), membro.negocioId, membro.usuarioId, new Date());
    } catch (e) {
      if (e instanceof DesfazerRecusado) return { status: "erro", mensagem: e.mensagem };
      throw e;
    }
    revalidatePath("/", "layout");
    return { status: "ok", mensagem: MENSAGENS_DAS_CORRECOES.desfeita };
  },
  // SPEC-019 (OPEN-018): na suspensão, o desfazer chega ao banco e é recusado com a explicação (o prazo continua).
  { naSuspensao: true },
);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Dono: encerrar o acesso de emergência a qualquer momento (SPEC-019, 5.6). A próxima requisição do
 * Administrador já não tem o contexto e volta ao painel (INV-010).
 */
export const acaoEncerrarEmergencia = acaoDoDono(
  async (membro, _: servicos.EstadoDoEncerramento, form: FormData): Promise<servicos.EstadoDoEncerramento> => {
    const acessoId = texto(form, "acessoId");
    const ok = UUID.test(acessoId) && (await suporte().encerrarEmergencia(membro.negocioId, acessoId, membro.usuarioId, new Date(), "DONO"));
    revalidatePath("/", "layout");
    return ok ? { status: "ok", mensagem: MENSAGENS_DA_EMERGENCIA.encerrada } : { status: "erro", mensagem: MENSAGENS_DA_EMERGENCIA.jaEncerrada };
  },
  // SPEC-019 (5.7): a emergência continua possível no negócio suspenso, e o Dono pode encerrá-la.
  { naSuspensao: true },
);

/**
 * Administrador: entrar em modo suporte num negócio com liberação ativa (5.5). Com correção (SPEC-019,
 * 5.3), responde "reconfirmar" sem o código recente, e a tela pede o código e repete a entrada.
 */
export const acaoEntrarEmModoSuporte = acaoDoAdministrador(async (contexto, _: ReconfirmacaoNecessaria | undefined, form: FormData): Promise<ReconfirmacaoNecessaria | undefined> => {
  const negocioId = texto(form, "negocioId");
  const r = await servicos.entrar(negocioId, await dependenciasDoAdministrador(contexto.usuarioId), contexto.codigoVerificadoEm ?? null);
  if (!r.ok && r.reconfirmar) return { status: "reconfirmar", mensagem: r.mensagem };
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
