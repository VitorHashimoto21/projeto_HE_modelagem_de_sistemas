"use server";

import { redirect } from "next/navigation";
import { acaoComSessao } from "@/lib/auth/acao";
import { ROTA_ENTRAR } from "@/lib/auth/rotas";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { dependenciasDaLgpd } from "./servidor";
import * as servicos from "./servicos";

// Server Action da exclusão de conta (SPEC-014): o usuário vem da sessão, nunca do formulário.

export const acaoExcluirConta = acaoComSessao(async (contexto, _: servicos.EstadoDaExclusao, form: FormData) => {
  const estado = await servicos.excluirConta(camposDoFormulario(form), dependenciasDaLgpd(contexto.usuarioId));
  if (estado.status === "excluida") redirect(`${ROTA_ENTRAR}?excluida=1`);
  return estado;
});
