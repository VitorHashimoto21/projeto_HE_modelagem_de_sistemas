"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acaoComPermissao } from "@/lib/auth/acao";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { camposDoFormulario } from "@/lib/auth/validacao";
import * as consultasDoCliente from "@/lib/clientes/servicos";
import type { EstadoDaEmpresa, EstadoDoCep } from "@/lib/clientes/servicos";
import { fornecedores } from "@/lib/db";
import { pode } from "@/lib/dominio/permissoes";
import { ambiente } from "@/lib/env";
import { criarConsultaCepBrasilApi } from "@/lib/integracoes/consulta-cep";
import { criarConsultaBrasilApi } from "@/lib/integracoes/consulta-cnpj";
import * as servicos from "./servicos";
import type { EstadoDoFornecedor } from "./servicos";

// Server Actions do fornecedor (SPEC-026, OPEN-005): as permissões são as do Financeiro — criar
// para cadastrar, editar para editar e excluir para excluir. No modo suporte, nenhuma roda (OPEN-011).

const deps = (m: ContextoDoMembro): servicos.DependenciasDoFornecedor => ({ fornecedores: fornecedores(m) });

const consultas = () => {
  const base = ambiente().BRASILAPI_URL;
  return { consultaCep: criarConsultaCepBrasilApi({ base }), consultaCnpj: criarConsultaBrasilApi({ base }) };
};

const texto = (form: FormData, campo: string) => {
  const v = form.get(campo);
  return typeof v === "string" ? v : "";
};

const revalidar = () => revalidatePath("/financeiro", "layout");

/** Cadastro: na tela de Fornecedores vai para o detalhe; na conta e na despesa fixa, devolve o fornecedor. */
export const acaoCadastrarFornecedor = acaoComPermissao("financeiro", "criar", async (membro, _: EstadoDoFornecedor, form: FormData) => {
  const estado = await servicos.cadastrarFornecedor(camposDoFormulario(form), deps(membro));
  if (estado.status === "salvo") {
    revalidar();
    if (texto(form, "destino") === "detalhe") redirect(`/financeiro/fornecedores/${estado.cliente.id}?salvo=1`);
  }
  return estado;
});

export const acaoEditarFornecedor = acaoComPermissao("financeiro", "editar", async (membro, _: EstadoDoFornecedor, form: FormData) => {
  const id = texto(form, "fornecedorId");
  const estado = await servicos.editarFornecedor(id, camposDoFormulario(form), deps(membro));
  if (estado.status === "salvo") {
    revalidar();
    redirect(`/financeiro/fornecedores/${id}?salvo=1`);
  }
  return estado;
});

export const acaoExcluirFornecedor = acaoComPermissao("financeiro", "excluir", async (membro, _: unknown, form: FormData) => {
  const r = await servicos.excluirFornecedor(texto(form, "fornecedorId"), deps(membro));
  if (r === "naoEncontrado") return { status: "erro" as const, mensagem: servicos.MENSAGENS_FLUXO_FORNECEDOR.naoEncontrado };
  revalidar();
  redirect(`/financeiro/fornecedores?excluido=${r}`);
});

/** Consultas de CEP e CNPJ (5.1, item 3): a guarda pede Financeiro — ver; o corpo, criar ou editar. */
const podeConsultar = (m: ContextoDoMembro) => pode(m.permissoes, "financeiro", "criar") || pode(m.permissoes, "financeiro", "editar");

export const acaoConsultarCepDoFornecedor = acaoComPermissao("financeiro", "ver", async (membro, cep: string): Promise<EstadoDoCep> => {
  if (!podeConsultar(membro)) return { status: "erro", mensagem: servicos.MENSAGENS_FLUXO_FORNECEDOR.semPermissaoDeConsulta };
  return consultasDoCliente.consultarCep(cep, consultas());
});

export const acaoConsultarEmpresaDoFornecedor = acaoComPermissao("financeiro", "ver", async (membro, cnpj: string): Promise<EstadoDaEmpresa> => {
  if (!podeConsultar(membro)) return { status: "erro", mensagem: servicos.MENSAGENS_FLUXO_FORNECEDOR.semPermissaoDeConsulta };
  return consultasDoCliente.consultarEmpresa(cnpj, consultas());
});
