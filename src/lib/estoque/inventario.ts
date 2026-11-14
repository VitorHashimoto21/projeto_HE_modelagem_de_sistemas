import type { ConsultasDoEstoque } from "@/lib/db/estoque";
import { formatarCnpj } from "@/lib/dominio/cnpj";
import { lerDataDoInventario, montarInventario, notasDoInventario, type Inventario } from "@/lib/dominio/inventario";
import { pode, type Matriz } from "@/lib/dominio/permissoes";
import { diaBrasileiro } from "@/lib/dominio/relatorios";
import { csvDaTabela, pdfDaTabela } from "@/lib/relatorios/arquivos";
import type { Arquivo } from "@/lib/relatorios/servicos";
import { tabelaDoInventario } from "@/lib/relatorios/tabelas";

/**
 * Inventário do estoque numa data (SPEC-025). Tela e arquivos usam o mesmo inventário, então os
 * números são sempre os mesmos (INV-008). A guarda do modo suporte fica nas rotas (5.6).
 */

/** OPEN-005: o arquivo mostra o custo, que é do Catálogo; por isso as duas permissões. */
export const podeVerInventario = (m: Matriz): boolean => pode(m, "estoque", "ver") && pode(m, "catalogo", "ver");

export type DependenciasDoInventario = { estoque: ConsultasDoEstoque; hoje: string };

/** Lê a data (vazia = fim do mês anterior) e monta o inventário; a data recusada volta com a mensagem. */
export async function carregarInventario(
  dataPedida: string | undefined,
  deps: DependenciasDoInventario,
): Promise<{ ok: true; inventario: Inventario } | { ok: false; erro: string }> {
  const d = lerDataDoInventario(dataPedida, deps.hoje);
  if (!d.ok) return d;
  return { ok: true, inventario: montarInventario(d.data, await deps.estoque.inventario(d.data)) };
}

export type DadosDoArquivo = { negocio: string; cnpj: string | null; autor: string; agora: Date };

/** 5.5: `inventario-AAAA-MM-DD.csv` ou `.pdf`, com cabeçalho, total e notas. */
export async function arquivoDoInventario(
  busca: Record<string, string | undefined>,
  deps: DependenciasDoInventario & DadosDoArquivo,
): Promise<{ ok: true; arquivo: Arquivo } | { ok: false; erro: string }> {
  const formato = busca.formato;
  if (formato !== "csv" && formato !== "pdf") return { ok: false, erro: "Formato inválido." };
  const r = await carregarInventario(busca.data, deps);
  if (!r.ok) return r;
  const inv = r.inventario;
  const t = tabelaDoInventario(inv);
  const nome = `inventario-${inv.data}.${formato}`;
  if (formato === "csv") return { ok: true, arquivo: { nome, tipo: "text/csv; charset=utf-8", corpo: csvDaTabela(t) } };
  const geradoEm = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(deps.agora);
  const corpo = await pdfDaTabela(t, {
    negocio: deps.cnpj ? `${deps.negocio} · CNPJ ${formatarCnpj(deps.cnpj)}` : deps.negocio,
    rotuloDoPeriodo: "Posição",
    periodo: `fim do dia ${diaBrasileiro(inv.data)}`,
    geradoEm: `${geradoEm} por ${deps.autor}`,
    vazio: `Nenhum produto com quantidade em ${diaBrasileiro(inv.data)}.`,
    notas: notasDoInventario(inv.avisos),
  });
  return { ok: true, arquivo: { nome, tipo: "application/pdf", corpo } };
}
