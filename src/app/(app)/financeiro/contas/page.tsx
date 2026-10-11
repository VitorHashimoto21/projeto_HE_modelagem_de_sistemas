import type { Metadata } from "next";
import Link from "next/link";
import { botaoPrimario, CabecalhoDoFinanceiro, reais, ROTULO_CATEGORIA, SeloDaConta } from "@/components/financeiro/exibicao";
import { exigirPermissao } from "@/lib/auth/servidor";
import { financeiro } from "@/lib/db";
import type { SituacaoFiltrada } from "@/lib/db/financeiro";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";
import { conferirFinanceiro } from "@/lib/financeiro/conferencia";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Contas a pagar e a receber" };

const SITUACOES: [SituacaoFiltrada, string][] = [
  ["abertas", "Em aberto"],
  ["atrasadas", "Atrasadas"],
  ["quitadas", "Quitadas"],
  ["canceladas", "Canceladas"],
  ["todas", "Todas"],
];

const ORIGEM = { venda: "Venda no cartão", despesa: "Despesa fixa", manual: "Manual" } as const;
const dataBr = (dia: string) => dia.split("-").reverse().join("/");

// Contas a pagar e a receber (SPEC-009, 5.3): Financeiro — ver; nova conta com "criar".
export default async function Contas({ searchParams }: PageProps<"/financeiro/contas">) {
  const membro = await exigirPermissao("financeiro", "ver");
  const busca = await searchParams;
  const tipo = busca.tipo === "RECEBER" ? "RECEBER" : "PAGAR";
  const situacao = SITUACOES.some(([s]) => s === busca.situacao) ? (busca.situacao as SituacaoFiltrada) : "abertas";
  const pagina = Number(typeof busca.pagina === "string" ? busca.pagina : "1") || 1;
  const dia = hoje();

  await conferirFinanceiro(membro);
  const r = await financeiro(membro).listarContas({ tipo, situacao, pagina }, dia);
  const link = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams({ tipo, situacao, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) });
    return `/financeiro/contas?${p}`;
  };

  return (
    <div className="space-y-8">
      <CabecalhoDoFinanceiro
        atual="contas"
        titulo="Contas"
        acoes={
          pode(membro.permissoes, "financeiro", "criar") && (
            <Link href={`/financeiro/contas/nova?tipo=${tipo}`} className={botaoPrimario}>
              Nova conta
            </Link>
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Tipo de conta" className="inline-flex rounded-xl border bg-card p-1">
          {(["PAGAR", "RECEBER"] as const).map((t) => (
            <Link
              key={t}
              role="tab"
              aria-selected={t === tipo}
              href={`/financeiro/contas?tipo=${t}&situacao=${situacao}`}
              className={cn("rounded-lg px-4 py-2 text-sm font-medium", t === tipo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {t === "PAGAR" ? "A pagar" : "A receber"}
            </Link>
          ))}
        </div>
        <nav aria-label="Situação" className="flex flex-wrap gap-1">
          {SITUACOES.map(([s, rotulo]) => (
            <Link
              key={s}
              href={`/financeiro/contas?tipo=${tipo}&situacao=${s}`}
              aria-current={s === situacao ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                s === situacao ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {rotulo}
              {s === "atrasadas" && r.atrasadas > 0 && <span className="ml-1 font-semibold text-status-danger">({r.atrasadas})</span>}
            </Link>
          ))}
        </nav>
      </div>

      {r.atrasadas > 0 && situacao !== "atrasadas" && (
        <p role="status" className="rounded-xl border border-status-danger/30 bg-status-danger-bg px-4 py-3 text-sm text-status-danger">
          <span aria-hidden="true">▲ </span>
          {r.atrasadas} {r.atrasadas === 1 ? "conta atrasada" : "contas atrasadas"} {tipo === "PAGAR" ? "a pagar" : "a receber"}.{" "}
          <Link href={`/financeiro/contas?tipo=${tipo}&situacao=atrasadas`} className="font-semibold underline underline-offset-2">
            Ver quais
          </Link>
        </p>
      )}

      <section aria-label="Lista de contas" className="rounded-2xl border bg-card shadow-sm">
        {r.contas.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhuma conta nesta situação.</p>
        ) : (
          <ul className="divide-y">
            {r.contas.map((c) => (
              <li key={c.id}>
                <Link href={`/financeiro/contas/${c.id}`} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-accent/50">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words text-foreground">{c.descricao ?? "Conta"}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence em {dataBr(c.vencimento)} · {ROTULO_CATEGORIA[c.categoria]} · {ORIGEM[c.origem]}
                    </p>
                    <div className="mt-1.5">
                      <SeloDaConta tipo={c.tipo} status={c.status} atrasada={c.atrasada} />
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold text-foreground tabular-nums">{reais(c.totalCentavos)}</p>
                    {c.status === "PARCIAL" && <p className="text-xs text-muted-foreground">Restam {reais(c.restanteCentavos)}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {r.paginas > 1 && (
        <nav aria-label="Páginas das contas" className="flex items-center justify-between text-sm">
          {r.pagina > 1 ? (
            <Link href={link({ pagina: r.pagina - 1 })} className="font-medium text-primary underline-offset-2 hover:underline">
              ← Anteriores
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Página {r.pagina} de {r.paginas}
          </span>
          {r.pagina < r.paginas ? (
            <Link href={link({ pagina: r.pagina + 1 })} className="font-medium text-primary underline-offset-2 hover:underline">
              Próximas →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
