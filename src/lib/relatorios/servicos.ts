import type { ConsultasDeRelatorios } from "@/lib/db/relatorios";
import { pode, type Matriz } from "@/lib/dominio/permissoes";
import { podeNoPlano, type Plano } from "@/lib/dominio/planos";
import { custoDaMaquininha } from "@/lib/dominio/precificacao";
import { calcularRentabilidade, diaBrasileiro, lerPeriodo, nomeDoArquivo, somarFormas, type OrdemDaRentabilidade, type Relatorio, type Rentabilidade } from "@/lib/dominio/relatorios";
import { csvDaTabela, pdfDaTabela } from "./arquivos";
import { tabelaDeContas, tabelaDeRentabilidade, tabelaDeVendas, tabelaDoFluxo, type Tabela } from "./tabelas";

/**
 * Relatórios do plano pago (SPEC-013, 5.3–5.5). A guarda é sempre no servidor (INV-002):
 * plano pago + a permissão do OPEN-003 para cada relatório.
 */

export type DependenciasDosRelatorios = { relatorios: ConsultasDeRelatorios; negocio: string; hoje: string; agora: Date };

/** OPEN-003: rentabilidade = Vendas e Financeiro — ver; vendas = Vendas — ver; fluxo e contas = Financeiro — ver. */
export function podeVerRelatorio(m: Matriz, r: Relatorio): boolean {
  const vendas = pode(m, "vendas", "ver");
  const financeiro = pode(m, "financeiro", "ver");
  return r === "vendas" ? vendas : r === "rentabilidade" ? vendas && financeiro : financeiro;
}

export const relatoriosPermitidos = (m: Matriz): Relatorio[] => (["rentabilidade", "vendas", "fluxo", "contas"] as const).filter((r) => podeVerRelatorio(m, r));

export type Recusa = { motivo: "plano" | "permissao" | "periodo"; mensagem: string };

export function conferirAcesso(plano: Plano, m: Matriz, r: Relatorio): Recusa | null {
  if (!podeNoPlano(plano, "relatorios")) return { motivo: "plano", mensagem: "Os relatórios fazem parte do plano pago." };
  if (!podeVerRelatorio(m, r)) return { motivo: "permissao", mensagem: "Você não tem permissão para este relatório." };
  return null;
}

export async function carregarRentabilidade(de: string, ate: string, ordem: OrdemDaRentabilidade, deps: DependenciasDosRelatorios): Promise<Rentabilidade> {
  return calcularRentabilidade(await deps.relatorios.rentabilidade(de, ate), ordem);
}

export type FormasDoPeriodo = { itens: { nome: string; valorCentavos: number }[]; taxaCartao: number | null; taxaCentavos: number };

/**
 * Formas de pagamento das vendas do período (gráfico dos Relatórios — exige o relatório de
 * vendas). Com a taxa média da maquininha (só para quem vê o Financeiro, como no Painel —
 * SPEC-016, nota N5), soma também quanto ela fica das vendas no cartão.
 */
export async function carregarFormasDoPeriodo(de: string, ate: string, deps: DependenciasDosRelatorios, taxaCartao: number | null = null): Promise<FormasDoPeriodo> {
  const vendas = await deps.relatorios.vendas(de, ate);
  const cartao = vendas
    .filter((v) => v.status === "CONCLUIDA")
    .flatMap((v) => v.pagamentos)
    .filter((p) => p.forma === "CREDITO" || p.forma === "DEBITO")
    .reduce((s, p) => s + p.valorCentavos, 0);
  return { itens: somarFormas(vendas), taxaCartao, taxaCentavos: taxaCartao === null ? 0 : custoDaMaquininha(cartao, taxaCartao) };
}

async function tabela(r: Relatorio, de: string, ate: string, deps: DependenciasDosRelatorios): Promise<Tabela> {
  switch (r) {
    case "vendas":
      return tabelaDeVendas(await deps.relatorios.vendas(de, ate));
    case "fluxo":
      return tabelaDoFluxo(await deps.relatorios.lancamentos(de, ate));
    case "contas":
      return tabelaDeContas(await deps.relatorios.contas(de, ate));
    case "rentabilidade":
      return tabelaDeRentabilidade(await carregarRentabilidade(de, ate, "margem", deps));
  }
}

export type Arquivo = { nome: string; tipo: string; corpo: string | Uint8Array };

const RELATORIOS_VALIDOS = new Set(["vendas", "fluxo", "contas", "rentabilidade"]);

/** Exportação (RF71): lê relatório, formato e período da URL e devolve o arquivo ou a recusa. */
export async function exportar(
  busca: Record<string, string | undefined>,
  acesso: { plano: Plano; permissoes: Matriz },
  deps: DependenciasDosRelatorios,
): Promise<{ ok: true; arquivo: Arquivo } | { ok: false; recusa: Recusa }> {
  const r = busca.relatorio;
  const formato = busca.formato;
  if (!r || !RELATORIOS_VALIDOS.has(r) || (formato !== "csv" && formato !== "pdf")) return { ok: false, recusa: { motivo: "periodo", mensagem: "Relatório ou formato inválido." } };
  const recusa = conferirAcesso(acesso.plano, acesso.permissoes, r as Relatorio);
  if (recusa) return { ok: false, recusa };
  const p = lerPeriodo(busca, deps.hoje);
  if (!p.ok) return { ok: false, recusa: { motivo: "periodo", mensagem: p.erro } };

  const t = await tabela(r as Relatorio, p.de, p.ate, deps);
  const nome = nomeDoArquivo(r as Relatorio, p.de, p.ate, formato);
  if (formato === "csv") return { ok: true, arquivo: { nome, tipo: "text/csv; charset=utf-8", corpo: csvDaTabela(t) } };
  const geradoEm = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(deps.agora);
  const corpo = await pdfDaTabela(t, { negocio: deps.negocio, periodo: `${diaBrasileiro(p.de)} a ${diaBrasileiro(p.ate)}`, geradoEm });
  return { ok: true, arquivo: { nome, tipo: "application/pdf", corpo } };
}
