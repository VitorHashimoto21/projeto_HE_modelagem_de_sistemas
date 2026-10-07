"use server";

import { redirect } from "next/navigation";
import { acaoComSessao, acaoDoDono } from "@/lib/auth/acao";
import { ROTA_INICIAL, ROTA_MEUS_NEGOCIOS } from "@/lib/auth/rotas";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { dependenciasDoNegocio } from "./servidor";
import * as servicos from "./servicos";
import type { EstadoDaConsulta, EstadoDoFormularioDeNegocio } from "./servicos";

// Server Actions do negócio (SPEC-004). Só leem o formulário e chamam os fluxos de
// servicos.ts, que validam tudo de novo e confirmam a sessão e a filiação. O nível de
// acesso é declarado na fábrica (SPEC-005, OPEN-008).

export const acaoConsultarCnpj = acaoComSessao(async (_ctx, _: EstadoDaConsulta, form: FormData) =>
  servicos.consultarCnpj(camposDoFormulario(form), await dependenciasDoNegocio()),
);

export const acaoCadastrarNegocio = acaoComSessao(async (_ctx, _: EstadoDoFormularioDeNegocio, form: FormData) => {
  const estado = await servicos.cadastrarNegocio(camposDoFormulario(form), await dependenciasDoNegocio());
  if (estado.status === "salvo") redirect(ROTA_INICIAL);
  return estado;
});

export const acaoTrocarNegocio = acaoComSessao(async (_ctx, form: FormData) => {
  const id = form.get("negocioId");
  const { ok } = await servicos.trocarNegocio(typeof id === "string" ? id : "", await dependenciasDoNegocio());
  redirect(ok ? ROTA_INICIAL : ROTA_MEUS_NEGOCIOS);
});

/** Edita o negócio ativo (Configurações — só o Dono); o id vem do contexto validado, nunca do formulário. */
export const acaoEditarNegocio = acaoDoDono(async ({ negocioId }, _: EstadoDoFormularioDeNegocio, form: FormData) => {
  const estado = await servicos.editarNegocio(negocioId, camposDoFormulario(form), await dependenciasDoNegocio());
  if (estado.status === "salvo") redirect(`${ROTA_INICIAL}?salvo=1`);
  return estado;
});
