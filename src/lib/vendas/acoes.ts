"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acaoComPermissao } from "@/lib/auth/acao";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { vendas } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import * as servicos from "./servicos";
import type { EstadoDaVenda, EstadoDoCliente } from "./servicos";

// Server Actions da venda (SPEC-008). A fábrica exige Vendas — criar (SPEC-005); o negócio
// vem do contexto validado, "hoje" do relógio do servidor e o preço sempre do banco.

const deps = (m: ContextoDoMembro): servicos.DependenciasDaVenda => {
  const agora = new Date();
  return { vendas: vendas({ negocioId: m.negocioId, usuarioId: m.usuarioId }), usuarioId: m.usuarioId, hoje: hoje(agora), agora };
};

export const acaoRegistrarVenda = acaoComPermissao("vendas", "criar", async (membro, _: EstadoDaVenda, form: FormData) => {
  const estado = await servicos.registrarVenda(camposDoFormulario(form), deps(membro));
  if (estado.status === "registrada") {
    revalidatePath("/vendas", "layout");
    revalidatePath("/estoque", "layout");
    revalidatePath("/painel");
    redirect(`/vendas/${estado.vendaId}?${estado.jaExistia ? "jaRegistrada" : "nova"}=1`);
  }
  return estado;
});

export const acaoCadastrarCliente = acaoComPermissao("vendas", "criar", async (membro, _: EstadoDoCliente, form: FormData) =>
  servicos.cadastrarCliente(camposDoFormulario(form), deps(membro)),
);
