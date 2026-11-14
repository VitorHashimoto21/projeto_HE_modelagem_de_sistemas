import { ContaNaGaveta, LancamentoNaGaveta } from "@/components/financeiro/formularios-na-gaveta";
import { exigirPermissao } from "@/lib/auth/servidor";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";
import { SEM_OPCOES } from "@/lib/dominio/contas";
import { opcoesDoVinculo } from "@/lib/financeiro/opcoes";

// Formulários curtos do Financeiro em gaveta (SPEC-016, OPEN-003). As mesmas guardas das
// páginas (Financeiro — criar); pelo link direto, as páginas /financeiro/lancar e
// /financeiro/contas/nova continuam valendo.

export const TEXTO_DO_LANCAMENTO = "Para despesas e receitas fora das vendas e das contas, como uma compra de material. Vendas e pagamentos de contas entram no caixa sozinhos.";
export const TEXTO_DA_CONTA = "Um compromisso com vencimento, como um boleto de fornecedor. As parcelas do cartão e as despesas fixas geram as próprias contas.";

// SPEC-019 (5.4): no modo suporte, com o Financeiro em "ver e corrigir", as duas são correções da lista.
export async function LancamentoEmGaveta() {
  const membro = await exigirPermissao("financeiro", "criar", "financeiro.lancarAvulso");
  const titulo = pode(membro.permissoes, "financeiro", "ver") ? "Novo lançamento" : "Lançar despesa";
  return <LancamentoNaGaveta titulo={titulo} descricao={TEXTO_DO_LANCAMENTO} hoje={hoje()} />;
}

export async function ContaEmGaveta({ tipo }: { tipo?: string | string[] }) {
  const membro = await exigirPermissao("financeiro", "criar", "financeiro.criarConta");
  const suporte = membro.modoSuporte === true;
  const opcoes = suporte ? SEM_OPCOES : await opcoesDoVinculo(membro);
  return <ContaNaGaveta descricao={TEXTO_DA_CONTA} hoje={hoje()} tipoPadrao={tipo === "RECEBER" ? "RECEBER" : "PAGAR"} opcoes={opcoes} vinculoComoEsta={suporte} />;
}
