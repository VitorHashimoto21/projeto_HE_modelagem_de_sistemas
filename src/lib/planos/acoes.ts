"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acaoDoDono } from "@/lib/auth/acao";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { dependenciasDoPlano } from "./servidor";
import * as servicos from "./servicos";

// Server Actions do plano (SPEC-013): só o Dono (RN02). O resultado volta pela URL para a
// página do plano ou da equipe; o menu e as guardas leem o plano novo na requisição seguinte.

const voltar = (destino: string, r: servicos.ResultadoDoPlano) => {
  revalidatePath("/", "layout");
  redirect(`${destino}?${new URLSearchParams(r.ok ? { aviso: r.aviso } : { erro: r.erro })}`);
};

export const acaoAlterarPlano = acaoDoDono(async (membro, form: FormData) => {
  voltar("/negocio/plano", await servicos.alterarPlano(camposDoFormulario(form), dependenciasDoPlano(membro)));
});

export const acaoTrocarAcesso = acaoDoDono(async (membro, form: FormData) => {
  voltar("/negocio/equipe", await servicos.trocarAcesso(camposDoFormulario(form), dependenciasDoPlano(membro)));
});
