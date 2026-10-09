import type { Metadata } from "next";
import Link from "next/link";
import { classeDoCampo } from "@/components/ui/classes";
import { brl, ROTULO_FORMA } from "@/components/vendas/rotulos";
import { exigirPermissao } from "@/lib/auth/servidor";
import { vendas } from "@/lib/db";
import { hoje as hojeLocal, intervaloDoDia } from "@/lib/dominio/datas";
import { diasEntre, somarDias } from "@/lib/dominio/estoque";
import { pode } from "@/lib/dominio/permissoes";

export const metadata: Metadata = { title: "Vendas" };

const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const ehDia = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

const PERIODOS = [
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "ontem", rotulo: "Ontem" },
  { chave: "7dias", rotulo: "Últimos 7 dias" },
  { chave: "mes", rotulo: "Este mês" },
] as const;

/** Período do histórico em dias locais de São Paulo (RN29): [de, ate], inclusivo. */
function periodo(p: Record<string, string | string[] | undefined>, hoje: string): { de: string; ate: string; chave: string } {
  if (ehDia(p.de) && ehDia(p.ate) && diasEntre(p.de, p.ate) >= 0 && diasEntre(p.de, p.ate) <= 366) return { de: p.de, ate: p.ate, chave: "datas" };
  switch (p.periodo) {
    case "ontem":
      return { de: somarDias(hoje, -1), ate: somarDias(hoje, -1), chave: "ontem" };
    case "7dias":
      return { de: somarDias(hoje, -6), ate: hoje, chave: "7dias" };
    case "mes":
      return { de: `${hoje.slice(0, 7)}-01`, ate: hoje, chave: "mes" };
    default:
      return { de: hoje, ate: hoje, chave: "hoje" };
  }
}

// Histórico de vendas (SPEC-008, 5.4): Vendas — ver.
export default async function Vendas({ searchParams }: PageProps<"/vendas">) {
  const membro = await exigirPermissao("vendas", "ver");
  const hoje = hojeLocal();
  const { de, ate, chave } = periodo(await searchParams, hoje);
  const { vendas: lista, totalConcluidas } = await vendas(membro).listar(intervaloDoDia(de).inicio, intervaloDoDia(ate).fim);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold text-foreground">Vendas</h1>
        {pode(membro.permissoes, "vendas", "criar") && (
          <Link
            href="/vendas/nova"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Nova venda
          </Link>
        )}
      </div>

      <nav aria-label="Período" className="flex flex-wrap gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p.chave}
            href={`/vendas?periodo=${p.chave}`}
            aria-current={chave === p.chave ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${chave === p.chave ? "border-primary bg-primary text-primary-foreground" : "border-input text-foreground hover:bg-muted"}`}
          >
            {p.rotulo}
          </Link>
        ))}
      </nav>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="de" className="mb-1 block text-xs text-muted-foreground">
            De
          </label>
          <input id="de" name="de" type="date" defaultValue={de} max={hoje} className={classeDoCampo()} />
        </div>
        <div>
          <label htmlFor="ate" className="mb-1 block text-xs text-muted-foreground">
            Até
          </label>
          <input id="ate" name="ate" type="date" defaultValue={ate} max={hoje} className={classeDoCampo()} />
        </div>
        <button type="submit" className="rounded-xl border border-input px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted">
          Ver período
        </button>
      </form>

      <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label="Resumo do período">
        <p className="text-sm text-muted-foreground">
          {lista.filter((v) => v.status === "CONCLUIDA").length} {lista.length === 1 ? "venda" : "vendas"} no período
        </p>
        <p className="text-3xl font-semibold text-foreground">{brl(totalConcluidas)}</p>
      </section>

      {lista.length === 0 ? (
        <p className="rounded-2xl border bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-sm">Nenhuma venda neste período.</p>
      ) : (
        <ul className="grid gap-3" aria-label="Vendas do período">
          {lista.map((v) => (
            <li key={v.id}>
              <Link
                href={`/vendas/${v.id}`}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-primary"
              >
                <div className="min-w-0">
                  <p className="font-medium text-card-foreground">
                    Venda nº {v.numero}
                    {v.status === "CANCELADA" && <span className="ml-2 text-xs font-medium text-status-danger">cancelada</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {quando.format(v.data)} · {v.itens} {v.itens === 1 ? "item" : "itens"} · {v.formas.map((f) => ROTULO_FORMA[f]).join(" + ")}
                    {v.cliente && ` · ${v.cliente}`} · por {v.registradaPor}
                  </p>
                </div>
                <p className={`font-semibold ${v.status === "CANCELADA" ? "text-muted-foreground line-through" : "text-foreground"}`}>{brl(v.valorTotal)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
