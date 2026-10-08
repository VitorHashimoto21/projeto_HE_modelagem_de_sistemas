"use server";

import { redirect } from "next/navigation";
import { acaoPublica } from "./acao";
import { ROTA_ENTRAR } from "./rotas";
import { adaptadorDoServidor, dependenciasDeAcesso } from "./servidor";
import * as servicos from "./servicos";
import type { EstadoDoFormulario } from "./servicos";
import { camposDoFormulario } from "./validacao";

// Server Actions das telas de acesso (SPEC-002). Só leem o formulário, chamam os
// fluxos de src/lib/auth/servicos.ts (que validam tudo de novo) e redirecionam.
// Todas são públicas por natureza (SPEC-005, OPEN-008: nível declarado na fábrica).

function seAutenticadoRedirecionar(estado: EstadoDoFormulario): EstadoDoFormulario {
  if (estado.status === "autenticado") redirect(estado.destino);
  return estado;
}

export const acaoCadastrar = acaoPublica(async (_: EstadoDoFormulario, form: FormData) =>
  servicos.cadastrar(camposDoFormulario(form), await dependenciasDeAcesso()),
);

export const acaoEntrar = acaoPublica(async (_: EstadoDoFormulario, form: FormData) => {
  const estado = await servicos.entrar(camposDoFormulario(form), form.get("proximo"), await dependenciasDeAcesso());
  return seAutenticadoRedirecionar(estado);
});

export const acaoReenviarConfirmacao = acaoPublica(async (_: EstadoDoFormulario, form: FormData) =>
  servicos.reenviarConfirmacao(camposDoFormulario(form), await dependenciasDeAcesso()),
);

export const acaoPedirRecuperacao = acaoPublica(async (_: EstadoDoFormulario, form: FormData) =>
  servicos.pedirRecuperacao(camposDoFormulario(form), await dependenciasDeAcesso()),
);

export const acaoDefinirNovaSenha = acaoPublica(async (_: EstadoDoFormulario, form: FormData) => {
  const estado = await servicos.definirNovaSenha(camposDoFormulario(form), await dependenciasDeAcesso());
  return seAutenticadoRedirecionar(estado);
});

/** Sair (5.3, CA-09): encerra a sessão no Supabase e apaga os cookies. */
export const acaoSair = acaoPublica(async () => {
  const auth = await adaptadorDoServidor();
  await auth.sair("local");
  redirect(ROTA_ENTRAR);
});
