"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acaoComPermissao } from "@/lib/auth/acao";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { financeiro } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";
import * as servicos from "./servicos";
import type { EstadoDoFinanceiro } from "./servicos";

// Server Actions do Financeiro (SPEC-009). A fábrica exige a permissão do módulo Financeiro
// (OPEN-006): criar → avulso, saldo inicial, nova conta, pagamento, nova despesa; editar →
// conta manual e despesa fixa; excluir → estornar e cancelar. O negócio vem do contexto
// validado e "hoje" do relógio do servidor, nunca do formulário.

const deps = (m: ContextoDoMembro): servicos.DependenciasDoFinanceiro => {
  const agora = new Date();
  return { financeiro: financeiro({ negocioId: m.negocioId, usuarioId: m.usuarioId }), usuarioId: m.usuarioId, hoje: hoje(agora), agora };
};

const texto = (form: FormData, campo: string) => {
  const v = form.get(campo);
  return typeof v === "string" ? v : "";
};

async function atualizar(fluxo: Promise<EstadoDoFinanceiro>): Promise<EstadoDoFinanceiro> {
  const r = await fluxo;
  if (r.status === "salvo") {
    revalidatePath("/financeiro", "layout");
    revalidatePath("/painel");
  }
  return r;
}

export const acaoLancarAvulso = acaoComPermissao("financeiro", "criar", async (membro, _: EstadoDoFinanceiro, form: FormData) =>
  atualizar(servicos.lancarAvulso(camposDoFormulario(form), deps(membro))),
);

export const acaoInformarSaldoInicial = acaoComPermissao("financeiro", "criar", async (membro, _: EstadoDoFinanceiro, form: FormData) => {
  const r = await atualizar(servicos.informarSaldoInicial(camposDoFormulario(form), deps(membro)));
  // O cartão do saldo inicial some depois de informado: a confirmação vai pela página.
  if (r.status === "salvo") redirect("/financeiro?saldoInicial=1");
  return r;
});

export const acaoEstornar = acaoComPermissao("financeiro", "excluir", async (membro, _: EstadoDoFinanceiro, form: FormData) =>
  atualizar(servicos.estornar(texto(form, "lancamentoId"), deps(membro))),
);

export const acaoCriarConta = acaoComPermissao("financeiro", "criar", async (membro, _: EstadoDoFinanceiro, form: FormData) => {
  const r = await atualizar(servicos.criarConta(camposDoFormulario(form), deps(membro)));
  // Sem "ver", fica no formulário com a confirmação (o detalhe da conta exige ver).
  if (r.status === "salvo" && pode(membro.permissoes, "financeiro", "ver")) redirect(`/financeiro/contas/${r.id}?nova=1`);
  return r;
});

export const acaoEditarConta = acaoComPermissao("financeiro", "editar", async (membro, _: EstadoDoFinanceiro, form: FormData) =>
  atualizar(servicos.editarConta(texto(form, "contaId"), camposDoFormulario(form), deps(membro))),
);

export const acaoCancelarConta = acaoComPermissao("financeiro", "excluir", async (membro, _: EstadoDoFinanceiro, form: FormData) =>
  atualizar(servicos.cancelarConta(texto(form, "contaId"), deps(membro))),
);

export const acaoRegistrarPagamento = acaoComPermissao("financeiro", "criar", async (membro, _: EstadoDoFinanceiro, form: FormData) =>
  atualizar(servicos.registrarPagamento(texto(form, "contaId"), camposDoFormulario(form), deps(membro))),
);

export const acaoCriarDespesa = acaoComPermissao("financeiro", "criar", async (membro, _: EstadoDoFinanceiro, form: FormData) =>
  atualizar(servicos.criarDespesa(camposDoFormulario(form), deps(membro))),
);

export const acaoEditarDespesa = acaoComPermissao("financeiro", "editar", async (membro, _: EstadoDoFinanceiro, form: FormData) =>
  atualizar(servicos.editarDespesa(texto(form, "despesaId"), camposDoFormulario(form), deps(membro))),
);

export const acaoDefinirAtivo = acaoComPermissao("financeiro", "editar", async (membro, _: EstadoDoFinanceiro, form: FormData) =>
  atualizar(servicos.definirAtivo(texto(form, "despesaId"), texto(form, "ativo") === "true", deps(membro))),
);
