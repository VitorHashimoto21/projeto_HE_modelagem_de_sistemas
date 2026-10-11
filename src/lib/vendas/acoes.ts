"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acaoComPermissao } from "@/lib/auth/acao";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { ROTA_SEM_ACESSO } from "@/lib/auth/rotas";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { vendas } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";
import * as servicos from "./servicos";
import type { EstadoDaVenda, EstadoDoCancelamento, EstadoDoCliente } from "./servicos";

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

// SPEC-011 (OPEN-005): cancelar exige Vendas — excluir/cancelar; trocar exige também criar,
// porque registra uma venda nova. O Colaborador predefinido não cancela (RF65).
const texto = (form: FormData, campo: string) => {
  const v = form.get(campo);
  return typeof v === "string" ? v : "";
};

function depoisDoCancelamento(vendaId: string, r: EstadoDoCancelamento) {
  if (r.status !== "cancelada") return;
  revalidatePath("/vendas", "layout");
  revalidatePath("/estoque", "layout");
  revalidatePath("/financeiro", "layout");
  revalidatePath("/painel");
  redirect(r.trocaId ? `/vendas/${r.trocaId}?troca=1` : `/vendas/${vendaId}?cancelada=1`);
}

export const acaoCancelarVenda = acaoComPermissao("vendas", "excluir", async (membro, _: EstadoDoCancelamento, form: FormData) => {
  const vendaId = texto(form, "vendaId");
  const r = await servicos.cancelarVenda(vendaId, camposDoFormulario(form), deps(membro));
  depoisDoCancelamento(vendaId, r);
  return r;
});

export const acaoTrocarVenda = acaoComPermissao("vendas", "excluir", async (membro, _: EstadoDoCancelamento, form: FormData) => {
  if (!pode(membro.permissoes, "vendas", "criar")) redirect(ROTA_SEM_ACESSO);
  const vendaId = texto(form, "vendaId");
  const r = await servicos.trocarVenda(vendaId, camposDoFormulario(form), deps(membro));
  depoisDoCancelamento(vendaId, r);
  return r;
});
