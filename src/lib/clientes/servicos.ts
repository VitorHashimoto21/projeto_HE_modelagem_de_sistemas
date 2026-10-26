import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { ClienteNaoEncontrado, DocumentoRepetido, type ConsultasDeClientes } from "@/lib/db/clientes";
import { cnpjValido, normalizarCnpj } from "@/lib/dominio/cnpj";
import { normalizarCep } from "@/lib/dominio/cliente";
import type { ConsultaCep, EnderecoDoCep } from "@/lib/integracoes/consulta-cep";
import type { ConsultaCnpj, DadosDaEmpresa } from "@/lib/integracoes/consulta-cnpj";
import { MENSAGENS_CLIENTE, validarCliente } from "./validacao";

/**
 * Fluxos do cliente (SPEC-022, seção 5), independentes do Next.js: as Server Actions só leem o
 * formulário e chamam estas funções, que validam tudo de novo no servidor (5.8).
 */

export const MENSAGENS_FLUXO_CLIENTE = {
  naoEncontrado: "Cliente não encontrado.",
  repetido: (tipo: "PESSOA_FISICA" | "PESSOA_JURIDICA", outro: string | null) =>
    `Já existe um cliente com este ${tipo === "PESSOA_FISICA" ? "CPF" : "CNPJ"}${outro ? `: ${outro}` : ""}.`,
  cepNaoEncontrado: "Não encontramos este CEP. Preencha o endereço.",
  cnpjIndisponivel: "Não foi possível consultar o CNPJ agora. Preencha os dados.",
  semPermissaoDeConsulta: "Você não tem permissão para cadastrar ou editar clientes.",
} as const;

export type EstadoDoCliente =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: ErrosDeCampo }
  | { status: "salvo"; cliente: { id: string; nome: string; faltando: string[] } };

export const CLIENTE_INICIAL: EstadoDoCliente = { status: "ocioso" };

export type EstadoDoCep = { status: "ok"; endereco: EnderecoDoCep } | { status: "erro"; mensagem: string };
export type EstadoDaEmpresa = { status: "ok"; dados: DadosDaEmpresa } | { status: "erro"; mensagem: string };

export type DependenciasDoCliente = {
  clientes: Pick<ConsultasDeClientes, "criar" | "editar" | "excluir" | "atuais">;
  consultaCep: ConsultaCep;
  consultaCnpj: Pick<ConsultaCnpj, "consultarEmpresa">;
};

function erroDaGravacao(e: unknown): EstadoDoCliente {
  if (e instanceof DocumentoRepetido) return { status: "erro", erros: { documento: MENSAGENS_FLUXO_CLIENTE.repetido(e.tipo, e.outro) } };
  if (e instanceof ClienteNaoEncontrado) return { status: "erro", mensagem: MENSAGENS_FLUXO_CLIENTE.naoEncontrado };
  throw e;
}

/** Cadastro (5.2): na tela de Clientes e no "Novo cliente" da Nova venda (5.10). */
export async function cadastrarCliente(campos: Record<string, string>, deps: DependenciasDoCliente): Promise<EstadoDoCliente> {
  const v = validarCliente(campos);
  if (!v.ok) return { status: "erro", erros: v.erros };
  try {
    return { status: "salvo", cliente: await deps.clientes.criar(v.dados) };
  } catch (e) {
    return erroDaGravacao(e);
  }
}

/** Edição (5.2): e-mail e telefone antigos fora do formato ficam, se não mudarem (item 10). */
export async function editarCliente(id: string, campos: Record<string, string>, deps: DependenciasDoCliente): Promise<EstadoDoCliente> {
  const atuais = await deps.clientes.atuais(id);
  if (!atuais) return { status: "erro", mensagem: MENSAGENS_FLUXO_CLIENTE.naoEncontrado };
  const v = validarCliente(campos, atuais);
  if (!v.ok) return { status: "erro", erros: v.erros };
  try {
    await deps.clientes.editar(id, v.dados);
    return { status: "salvo", cliente: { id, nome: v.dados.nome, faltando: [] } };
  } catch (e) {
    return erroDaGravacao(e);
  }
}

/** Exclusão (5.6, OPEN-005): sem vendas, apaga; com vendas, anonimiza. */
export async function excluirCliente(id: string, deps: DependenciasDoCliente): Promise<"apagado" | "anonimizado" | "naoEncontrado"> {
  try {
    return await deps.clientes.excluir(id);
  } catch (e) {
    if (e instanceof ClienteNaoEncontrado) return "naoEncontrado";
    throw e;
  }
}

/** Endereço pelo CEP (5.2, item 6): só o CEP sai do sistema. */
export async function consultarCep(texto: string, deps: DependenciasDoCliente): Promise<EstadoDoCep> {
  const cep = normalizarCep(texto);
  if (!cep) return { status: "erro", mensagem: MENSAGENS_CLIENTE.cepInvalido };
  const r = await deps.consultaCep.consultar(cep);
  return r.ok ? { status: "ok", endereco: r.endereco } : { status: "erro", mensagem: MENSAGENS_FLUXO_CLIENTE.cepNaoEncontrado };
}

/** Dados da empresa pelo CNPJ (5.2, item 7; OPEN-009). Nunca há consulta de CPF (INV-004). */
export async function consultarEmpresa(texto: string, deps: DependenciasDoCliente): Promise<EstadoDaEmpresa> {
  const cnpj = normalizarCnpj(texto);
  if (!cnpj || !cnpjValido(cnpj)) return { status: "erro", mensagem: MENSAGENS_CLIENTE.cnpjInvalido };
  const r = await deps.consultaCnpj.consultarEmpresa(cnpj);
  if (!r.ok) return { status: "erro", mensagem: MENSAGENS_FLUXO_CLIENTE.cnpjIndisponivel };
  return { status: "ok", dados: await completarPeloCep(r.dados, deps.consultaCep) };
}

const semAcento = (valor: string) => valor.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** A rua do CEP, com acentos, quando é a mesma do CNPJ; o que vier depois dela no CNPJ (quadra, bloco…) fica. */
function ruaComAcento(doCnpj: string | null, doCep: string | null): string | null {
  if (!doCnpj || !doCep) return doCnpj ?? doCep;
  const base = semAcento(doCep);
  const resto = doCnpj.slice(base.length);
  // Só a mesma rua, em palavras inteiras: "Rua A" não vale para "Rua Abc".
  return semAcento(doCnpj).startsWith(base) && !/^[\p{L}\p{N}]/u.test(resto) ? doCep + resto : doCnpj;
}

/**
 * A base pública do CNPJ guarda os nomes sem acento ("SAO PAULO"); a do CEP, com acento. Quando o
 * CNPJ traz o CEP, município, bairro e UF vêm do CEP, e a rua também, se for a mesma (homologação
 * da SPEC-022, observação 1). Se a consulta do CEP falhar, ficam os dados do CNPJ.
 */
async function completarPeloCep(dados: DadosDaEmpresa, consultaCep: ConsultaCep): Promise<DadosDaEmpresa> {
  if (!dados.cep) return dados;
  const r = await consultaCep.consultar(dados.cep);
  if (!r.ok) return dados;
  const e = r.endereco;
  return {
    ...dados,
    logradouro: ruaComAcento(dados.logradouro, e.logradouro),
    bairro: e.bairro ?? dados.bairro,
    municipio: e.municipio ?? dados.municipio,
    uf: e.uf ?? dados.uf,
  };
}
