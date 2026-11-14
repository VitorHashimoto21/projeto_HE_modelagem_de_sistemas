"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acaoComPermissao } from "@/lib/auth/acao";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { clientes } from "@/lib/db";
import { pode } from "@/lib/dominio/permissoes";
import { ambiente } from "@/lib/env";
import { criarConsultaCepBrasilApi } from "@/lib/integracoes/consulta-cep";
import { criarConsultaBrasilApi } from "@/lib/integracoes/consulta-cnpj";
import * as servicos from "./servicos";
import type { EstadoDaEmpresa, EstadoDoCep, EstadoDoCliente } from "./servicos";

// Server Actions do cliente (SPEC-022, OPEN-001): as permissões são as de Vendas — criar para
// cadastrar, editar para editar e excluir para excluir. No modo suporte, nenhuma roda (SPEC-018).

const deps = (m: ContextoDoMembro): servicos.DependenciasDoCliente => {
  const base = ambiente().BRASILAPI_URL;
  return {
    clientes: clientes(m),
    consultaCep: criarConsultaCepBrasilApi({ base }),
    consultaCnpj: criarConsultaBrasilApi({ base }),
  };
};

const texto = (form: FormData, campo: string) => {
  const v = form.get(campo);
  return typeof v === "string" ? v : "";
};

/** Cadastro: na tela de Clientes vai para o detalhe; no "Novo cliente" da venda, devolve o cliente. */
export const acaoCadastrarCliente = acaoComPermissao("vendas", "criar", async (membro, _: EstadoDoCliente, form: FormData) => {
  const estado = await servicos.cadastrarCliente(camposDoFormulario(form), deps(membro));
  if (estado.status === "salvo") {
    revalidatePath("/vendas", "layout");
    if (texto(form, "destino") === "detalhe") redirect(`/vendas/clientes/${estado.cliente.id}?salvo=1`);
  }
  return estado;
});

export const acaoEditarCliente = acaoComPermissao("vendas", "editar", async (membro, _: EstadoDoCliente, form: FormData) => {
  const id = texto(form, "clienteId");
  const estado = await servicos.editarCliente(id, camposDoFormulario(form), deps(membro));
  if (estado.status === "salvo") {
    revalidatePath("/vendas", "layout");
    redirect(`/vendas/clientes/${id}?salvo=1`);
  }
  return estado;
});

export const acaoExcluirCliente = acaoComPermissao("vendas", "excluir", async (membro, _: unknown, form: FormData) => {
  const r = await servicos.excluirCliente(texto(form, "clienteId"), deps(membro));
  if (r === "naoEncontrado") return { status: "erro" as const, mensagem: servicos.MENSAGENS_FLUXO_CLIENTE.naoEncontrado };
  revalidatePath("/vendas", "layout");
  redirect(`/vendas/clientes?excluido=${r}`);
});

/** Consultas de CEP e CNPJ (OPEN-004): a guarda pede Vendas — ver; o corpo, criar ou editar. */
const podeConsultar = (m: ContextoDoMembro) => pode(m.permissoes, "vendas", "criar") || pode(m.permissoes, "vendas", "editar");

export const acaoConsultarCep = acaoComPermissao("vendas", "ver", async (membro, cep: string): Promise<EstadoDoCep> => {
  if (!podeConsultar(membro)) return { status: "erro", mensagem: servicos.MENSAGENS_FLUXO_CLIENTE.semPermissaoDeConsulta };
  return servicos.consultarCep(cep, deps(membro));
});

export const acaoConsultarEmpresa = acaoComPermissao("vendas", "ver", async (membro, cnpj: string): Promise<EstadoDaEmpresa> => {
  if (!podeConsultar(membro)) return { status: "erro", mensagem: servicos.MENSAGENS_FLUXO_CLIENTE.semPermissaoDeConsulta };
  return servicos.consultarEmpresa(cnpj, deps(membro));
});
