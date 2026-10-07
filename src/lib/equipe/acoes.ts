"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acaoComSessao, acaoDoDono } from "@/lib/auth/acao";
import { ROTA_INICIAL, ROTA_MEUS_NEGOCIOS } from "@/lib/auth/rotas";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { dependenciasDaEquipe } from "./servidor";
import * as servicos from "./servicos";
import type { EstadoDaAcao, EstadoDoConvite } from "./servicos";

// Server Actions da equipe (SPEC-005). A fábrica executa a guarda (Dono ou sessão) antes
// do corpo; os fluxos de servicos.ts conferem o papel de novo e validam tudo (RN02).

/** Atualiza as telas da equipe depois de uma mudança (as matrizes e listas vêm do servidor). */
async function atualizarEquipe<T>(fluxo: Promise<T>): Promise<T> {
  const estado = await fluxo;
  revalidatePath("/negocio/equipe", "layout");
  return estado;
}

const texto = (form: FormData, campo: string) => {
  const v = form.get(campo);
  return typeof v === "string" ? v : "";
};

export const acaoConvidar = acaoDoDono(async (membro, _: EstadoDoConvite, form: FormData) =>
  atualizarEquipe(
    servicos.convidar(camposDoFormulario(form), await dependenciasDaEquipe(membro)),
  ),
);

export const acaoReenviarConvite = acaoDoDono(async (membro, _: EstadoDoConvite, form: FormData) =>
  atualizarEquipe(
    servicos.reenviarConvite(texto(form, "conviteId"), await dependenciasDaEquipe(membro)),
  ),
);

export const acaoCancelarConvite = acaoDoDono(async (membro, _: EstadoDaAcao, form: FormData) =>
  atualizarEquipe(
    servicos.cancelarConvite(texto(form, "conviteId"), await dependenciasDaEquipe(membro)),
  ),
);

export const acaoAlterarPapel = acaoDoDono(async (membro, _: EstadoDaAcao, form: FormData) =>
  atualizarEquipe(
    servicos.alterarPapel(texto(form, "membroId"), texto(form, "papel"), await dependenciasDaEquipe(membro)),
  ),
);

export const acaoAlterarPermissoes = acaoDoDono(async (membro, _: EstadoDaAcao, form: FormData) =>
  atualizarEquipe(
    servicos.alterarPermissoes(texto(form, "membroId"), camposDoFormulario(form), await dependenciasDaEquipe(membro)),
  ),
);

export const acaoRemoverMembro = acaoDoDono(async (membro, form: FormData) => {
  const r = await servicos.removerMembro(texto(form, "membroId"), await dependenciasDaEquipe(membro));
  redirect(`/negocio/equipe?${r.status === "ok" ? "removido=1" : "erro=1"}`);
});

/** Aceitar pelo link (token) ou em "Convites para você" (id). */
export const acaoAceitarConvite = acaoComSessao(async (_ctx, _: EstadoDaAcao, form: FormData) => {
  const token = texto(form, "token");
  const alvo = token ? { token } : { conviteId: texto(form, "conviteId") };
  const r = await servicos.aceitarConvite(alvo, await dependenciasDaEquipe());
  if (r.status === "aceito") redirect(ROTA_INICIAL);
  return { status: "erro", mensagem: r.mensagem } satisfies EstadoDaAcao;
});

export const acaoSairDoNegocio = acaoComSessao(async (_ctx, form: FormData) => {
  await servicos.sairDoNegocio(texto(form, "negocioId"), await dependenciasDaEquipe());
  redirect(`${ROTA_MEUS_NEGOCIOS}?saiu=1`);
});
