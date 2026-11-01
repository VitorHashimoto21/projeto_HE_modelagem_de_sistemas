import "server-only";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { financeiro, fornecedores } from "@/lib/db";
import type { OpcoesDoVinculo } from "@/lib/dominio/contas";
import { pode } from "@/lib/dominio/permissoes";

/**
 * Listas dos seletores de fornecedor e cliente das contas e das despesas fixas (SPEC-026, 5.4), e o
 * que a pessoa pode cadastrar sem sair do formulário: fornecedor com Financeiro — criar; cliente com
 * Vendas — criar (5.2, itens 5 e 6). No modo suporte, nada é cadastrado.
 */
export async function opcoesDoVinculo(membro: ContextoDoMembro): Promise<OpcoesDoVinculo> {
  const [listaDeFornecedores, listaDeClientes] = await Promise.all([fornecedores(membro).opcoes(), financeiro(membro).opcoesDeClientes()]);
  const suporte = membro.modoSuporte === true;
  return {
    fornecedores: listaDeFornecedores,
    clientes: listaDeClientes,
    podeCriarFornecedor: !suporte && pode(membro.permissoes, "financeiro", "criar"),
    podeCriarCliente: !suporte && pode(membro.permissoes, "vendas", "criar"),
  };
}
