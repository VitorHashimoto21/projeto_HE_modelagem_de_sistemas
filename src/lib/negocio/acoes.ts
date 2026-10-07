"use server";

import { redirect } from "next/navigation";
import { ROTA_INICIAL, ROTA_MEUS_NEGOCIOS } from "@/lib/auth/rotas";
import { exigirNegocio } from "@/lib/auth/servidor";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { dependenciasDoNegocio } from "./servidor";
import * as servicos from "./servicos";
import type { EstadoDaConsulta, EstadoDoFormularioDeNegocio } from "./servicos";

// Server Actions do negócio (SPEC-004). Só leem o formulário e chamam os fluxos de
// servicos.ts, que validam tudo de novo e confirmam a sessão e a filiação.

export async function acaoConsultarCnpj(_: EstadoDaConsulta, form: FormData) {
  return servicos.consultarCnpj(camposDoFormulario(form), await dependenciasDoNegocio());
}

export async function acaoCadastrarNegocio(_: EstadoDoFormularioDeNegocio, form: FormData) {
  const estado = await servicos.cadastrarNegocio(camposDoFormulario(form), await dependenciasDoNegocio());
  if (estado.status === "salvo") redirect(ROTA_INICIAL);
  return estado;
}

export async function acaoTrocarNegocio(form: FormData) {
  const id = form.get("negocioId");
  const { ok } = await servicos.trocarNegocio(typeof id === "string" ? id : "", await dependenciasDoNegocio());
  redirect(ok ? ROTA_INICIAL : ROTA_MEUS_NEGOCIOS);
}

/** Edita o negócio ativo; o id vem do contexto validado, nunca do formulário. */
export async function acaoEditarNegocio(_: EstadoDoFormularioDeNegocio, form: FormData) {
  const { negocioId } = await exigirNegocio();
  const estado = await servicos.editarNegocio(negocioId, camposDoFormulario(form), await dependenciasDoNegocio());
  if (estado.status === "salvo") redirect(`${ROTA_INICIAL}?salvo=1`);
  return estado;
}
