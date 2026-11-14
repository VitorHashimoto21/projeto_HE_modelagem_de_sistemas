import type { EstadoDoCliente } from "@/lib/clientes/servicos";
import { validarCliente } from "@/lib/clientes/validacao";
import { DocumentoDoFornecedorRepetido, FornecedorNaoEncontrado, type ConsultasDeFornecedores } from "@/lib/db/fornecedores";

/**
 * Fluxos do fornecedor (SPEC-026, 5.1 e 5.3), independentes do Next.js: as Server Actions só leem
 * o formulário e chamam estas funções, que validam tudo de novo no servidor. O cadastro é o mesmo
 * do cliente (OPEN-002), com os textos de fornecedor.
 */

export const MENSAGENS_FLUXO_FORNECEDOR = {
  naoEncontrado: "Fornecedor não encontrado.",
  repetido: (tipo: "PESSOA_FISICA" | "PESSOA_JURIDICA", outro: string | null) =>
    `Já existe um fornecedor com este ${tipo === "PESSOA_FISICA" ? "CPF" : "CNPJ"}${outro ? `: ${outro}` : ""}.`,
  semPermissaoDeConsulta: "Você não tem permissão para cadastrar ou editar fornecedores.",
} as const;

/** O mesmo estado do formulário do cliente: o componente é compartilhado. */
export type EstadoDoFornecedor = EstadoDoCliente;

export type DependenciasDoFornecedor = {
  fornecedores: Pick<ConsultasDeFornecedores, "criar" | "editar" | "excluir" | "atuais">;
};

function erroDaGravacao(e: unknown): EstadoDoFornecedor {
  if (e instanceof DocumentoDoFornecedorRepetido) return { status: "erro", erros: { documento: MENSAGENS_FLUXO_FORNECEDOR.repetido(e.tipo, e.outro) } };
  if (e instanceof FornecedorNaoEncontrado) return { status: "erro", mensagem: MENSAGENS_FLUXO_FORNECEDOR.naoEncontrado };
  throw e;
}

/** Cadastro (5.1): na tela de Fornecedores e no "Novo fornecedor" da conta e da despesa fixa (5.4, item 7). */
export async function cadastrarFornecedor(campos: Record<string, string>, deps: DependenciasDoFornecedor): Promise<EstadoDoFornecedor> {
  const v = validarCliente(campos, null, "fornecedor");
  if (!v.ok) return { status: "erro", erros: v.erros };
  try {
    return { status: "salvo", cliente: await deps.fornecedores.criar(v.dados) };
  } catch (e) {
    return erroDaGravacao(e);
  }
}

/** Edição (5.1): e-mail e telefone antigos fora do formato ficam, se não mudarem. */
export async function editarFornecedor(id: string, campos: Record<string, string>, deps: DependenciasDoFornecedor): Promise<EstadoDoFornecedor> {
  const atuais = await deps.fornecedores.atuais(id);
  if (!atuais) return { status: "erro", mensagem: MENSAGENS_FLUXO_FORNECEDOR.naoEncontrado };
  const v = validarCliente(campos, atuais, "fornecedor");
  if (!v.ok) return { status: "erro", erros: v.erros };
  try {
    await deps.fornecedores.editar(id, v.dados);
    return { status: "salvo", cliente: { id, nome: v.dados.nome, faltando: [] } };
  } catch (e) {
    return erroDaGravacao(e);
  }
}

/** Exclusão (5.3, OPEN-004): sem contas nem despesas, apaga; com elas, anonimiza. */
export async function excluirFornecedor(id: string, deps: DependenciasDoFornecedor): Promise<"apagado" | "anonimizado" | "naoEncontrado"> {
  try {
    return await deps.fornecedores.excluir(id);
  } catch (e) {
    if (e instanceof FornecedorNaoEncontrado) return "naoEncontrado";
    throw e;
  }
}
