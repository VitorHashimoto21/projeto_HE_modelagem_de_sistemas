"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acaoComPermissao } from "@/lib/auth/acao";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { ROTA_SEM_ACESSO } from "@/lib/auth/rotas";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { compras } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";
import * as servicos from "./servicos";
import type { EstadoDaCompra } from "./servicos";

// Server Actions da compra (SPEC-027, OPEN-007): registrar exige Estoque — criar e Financeiro — criar.
// A fábrica confere o Estoque (e recusa o suporte e o negócio suspenso, SPEC-019); o Financeiro é
// conferido aqui. O negócio vem do contexto validado e "hoje" do relógio do servidor.

const deps = (m: ContextoDoMembro): servicos.DependenciasDaCompra => {
  const agora = new Date();
  return { compras: compras({ negocioId: m.negocioId, usuarioId: m.usuarioId }), usuarioId: m.usuarioId, hoje: hoje(agora), agora };
};

const comFinanceiro = (m: ContextoDoMembro) => {
  if (!pode(m.permissoes, "financeiro", "criar")) redirect(ROTA_SEM_ACESSO);
};

export const acaoRevisarCompra = acaoComPermissao("estoque", "criar", async (membro, _: EstadoDaCompra, form: FormData) => {
  comFinanceiro(membro);
  return servicos.revisarCompra(camposDoFormulario(form), deps(membro));
});

export const acaoRegistrarCompra = acaoComPermissao("estoque", "criar", async (membro, _: EstadoDaCompra, form: FormData) => {
  comFinanceiro(membro);
  const estado = await servicos.registrarCompra(camposDoFormulario(form), deps(membro));
  if (estado.status === "registrada") {
    revalidatePath("/compras", "layout");
    revalidatePath("/estoque", "layout");
    revalidatePath("/catalogo", "layout");
    revalidatePath("/financeiro", "layout");
    revalidatePath("/painel");
  }
  return estado;
});
