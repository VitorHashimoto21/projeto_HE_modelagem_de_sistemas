import { ContaNaGaveta, LancamentoNaGaveta } from "@/components/financeiro/formularios-na-gaveta";
import { exigirPermissao } from "@/lib/auth/servidor";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";

// Formulários curtos do Financeiro em gaveta (SPEC-016, OPEN-003). As mesmas guardas das
// páginas (Financeiro — criar); pelo link direto, as páginas /financeiro/lancar e
// /financeiro/contas/nova continuam valendo.

export const TEXTO_DO_LANCAMENTO = "Para despesas e receitas fora das vendas e das contas, como uma compra de material. Vendas e pagamentos de contas entram no caixa sozinhos.";
export const TEXTO_DA_CONTA = "Um compromisso com vencimento, como um boleto de fornecedor. As parcelas do cartão e as despesas fixas geram as próprias contas.";

export async function LancamentoEmGaveta() {
  const membro = await exigirPermissao("financeiro", "criar");
  const titulo = pode(membro.permissoes, "financeiro", "ver") ? "Novo lançamento" : "Lançar despesa";
  return <LancamentoNaGaveta titulo={titulo} descricao={TEXTO_DO_LANCAMENTO} hoje={hoje()} />;
}

export async function ContaEmGaveta({ tipo }: { tipo?: string | string[] }) {
  await exigirPermissao("financeiro", "criar");
  return <ContaNaGaveta descricao={TEXTO_DA_CONTA} hoje={hoje()} tipoPadrao={tipo === "RECEBER" ? "RECEBER" : "PAGAR"} />;
}
