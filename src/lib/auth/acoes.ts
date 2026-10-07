"use server";

import { redirect } from "next/navigation";
import { ROTA_ENTRAR } from "./rotas";
import { adaptadorDoServidor, dependenciasDeAcesso } from "./servidor";
import * as servicos from "./servicos";
import type { EstadoDoFormulario } from "./servicos";
import { camposDoFormulario } from "./validacao";

// Server Actions das telas de acesso (SPEC-002). Só leem o formulário, chamam os
// fluxos de src/lib/auth/servicos.ts (que validam tudo de novo) e redirecionam.

function seAutenticadoRedirecionar(estado: EstadoDoFormulario): EstadoDoFormulario {
  if (estado.status === "autenticado") redirect(estado.destino);
  return estado;
}

export async function acaoCadastrar(_: EstadoDoFormulario, form: FormData) {
  return servicos.cadastrar(camposDoFormulario(form), await dependenciasDeAcesso());
}

export async function acaoEntrar(_: EstadoDoFormulario, form: FormData) {
  const estado = await servicos.entrar(camposDoFormulario(form), form.get("proximo"), await dependenciasDeAcesso());
  return seAutenticadoRedirecionar(estado);
}

export async function acaoReenviarConfirmacao(_: EstadoDoFormulario, form: FormData) {
  return servicos.reenviarConfirmacao(camposDoFormulario(form), await dependenciasDeAcesso());
}

export async function acaoPedirRecuperacao(_: EstadoDoFormulario, form: FormData) {
  return servicos.pedirRecuperacao(camposDoFormulario(form), await dependenciasDeAcesso());
}

export async function acaoDefinirNovaSenha(_: EstadoDoFormulario, form: FormData) {
  const estado = await servicos.definirNovaSenha(camposDoFormulario(form), await dependenciasDeAcesso());
  return seAutenticadoRedirecionar(estado);
}

/** Sair (5.3, CA-09): encerra a sessão no Supabase e apaga os cookies. */
export async function acaoSair() {
  const auth = await adaptadorDoServidor();
  await auth.sair("local");
  redirect(ROTA_ENTRAR);
}
