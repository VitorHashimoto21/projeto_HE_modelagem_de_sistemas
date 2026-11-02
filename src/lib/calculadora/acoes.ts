"use server";

import { revalidatePath } from "next/cache";
import { acaoComPermissao } from "@/lib/auth/acao";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { dependenciasDaCalculadora as deps } from "./servidor";
import * as servicos from "./servicos";
import type { EstadoDaConfirmacao, EstadoDosParametros } from "./servicos";

// Server Actions da Calculadora (SPEC-010). A fábrica exige a permissão do módulo Calculadora
// (OPEN-003): criar → confirmar o preço; editar → parâmetros de precificação. O cálculo em si
// é feito na página (ver), sempre no servidor; daqui só vêm a margem e a escolha do arredondamento.
// SPEC-019 (5.4): as duas são correções que o suporte pode fazer com a Calculadora em "ver e corrigir".

const texto = (form: FormData, campo: string) => {
  const v = form.get(campo);
  return typeof v === "string" ? v : "";
};

export const acaoConfirmarPreco = acaoComPermissao("calculadora", "criar", async (membro, _: EstadoDaConfirmacao, form: FormData) => {
  const r = await servicos.confirmar(texto(form, "itemId"), camposDoFormulario(form), deps(membro));
  if (r.status === "confirmado") {
    revalidatePath("/calculadora", "layout");
    revalidatePath("/catalogo", "layout");
    revalidatePath("/vendas/nova");
  }
  return r;
}, "calculadora.confirmarPreco");

export const acaoSalvarParametros = acaoComPermissao("calculadora", "editar", async (membro, _: EstadoDosParametros, form: FormData) => {
  const r = await servicos.salvarParametros(camposDoFormulario(form), deps(membro));
  if (r.status === "salvo") revalidatePath("/calculadora", "layout");
  return r;
}, "calculadora.salvarParametros");
