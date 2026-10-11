import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Aviso } from "@/components/acesso/campos";
import { OfertaDoPlanoPago } from "@/components/planos/avisos";
import { classeDoCampo } from "@/components/ui/classes";
import { exigirMembro } from "@/lib/auth/servidor";
import { ROTA_SEM_ACESSO } from "@/lib/auth/rotas";
import { podeNoPlano } from "@/lib/dominio/planos";
import { ATALHOS_DE_PERIODO, diaBrasileiro, lerPeriodo, RELATORIOS, type OrdemDaRentabilidade } from "@/lib/dominio/relatorios";
import { reaisDeCentavos as reais } from "@/lib/dominio/venda";
import { planoDoMembro } from "@/lib/planos/servidor";
import { carregarRentabilidade, relatoriosPermitidos } from "@/lib/relatorios/servicos";
import { dependenciasDosRelatorios } from "@/lib/relatorios/servidor";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Relatórios" };

const cartao = "rounded-2xl border bg-card p-6 shadow-sm";
const ORDENS: { chave: OrdemDaRentabilidade; rotulo: string }[] = [
  { chave: "margem", rotulo: "Margem" },
  { chave: "faturamento", rotulo: "Faturamento" },
  { chave: "quantidade", rotulo: "Quantidade" },
];
const pct = (p: number | null) => (p === null ? "—" : `${p.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

// Relatórios do plano pago (SPEC-013, RF70, RF71): no gratuito, a oferta de upgrade
// (OPEN-004); cada relatório exige as permissões do OPEN-003, conferidas também na rota
// de exportação.
export default async function Relatorios({ searchParams }: PageProps<"/relatorios">) {
  const membro = await exigirMembro();
  const permitidos = relatoriosPermitidos(membro.permissoes);
  if (permitidos.length === 0) redirect(ROTA_SEM_ACESSO);
  const [plano, busca] = await Promise.all([planoDoMembro(membro), searchParams]);
  const ehDono = membro.papel === "DONO";

  const cabecalho = (
    <div>
      <h1 className="font-display text-3xl font-semibold text-foreground">Relatórios</h1>
      <p className="mt-1 text-sm text-muted-foreground">Rentabilidade por item e exportação em CSV (planilha) e PDF.</p>
    </div>
  );

  if (!podeNoPlano(plano, "relatorios")) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {cabecalho}
        <OfertaDoPlanoPago
          funcionalidade="relatorios"
          ehDono={ehDono}
          descricao={
            <>
              <p>Veja quanto cada produto e serviço realmente deixa de margem — faturamento menos o custo gravado em cada venda.</p>
              <p>Exporte vendas, fluxo de caixa e contas de qualquer período para planilha (CSV) ou PDF, e veja o histórico completo, além dos últimos 12 meses.</p>
            </>
          }
        />
      </div>
    );
  }

  const deps = await dependenciasDosRelatorios(membro);
  const p = lerPeriodo({ periodo: texto(busca.periodo), de: texto(busca.de), ate: texto(busca.ate) }, deps.hoje);
  const periodo = p.ok ? p : lerPeriodo({}, deps.hoje);
  if (!periodo.ok) redirect("/relatorios");
  const ordem = ORDENS.some((o) => o.chave === busca.ordem) ? (busca.ordem as OrdemDaRentabilidade) : "margem";
  const vePermitido = (r: keyof typeof RELATORIOS) => permitidos.includes(r);
  const rent = vePermitido("rentabilidade") ? await carregarRentabilidade(periodo.de, periodo.ate, ordem, deps) : null;
  const q = (extra: Record<string, string>) => {
    const base: Record<string, string> = periodo.chave === "datas" ? { de: periodo.de, ate: periodo.ate } : { periodo: periodo.chave };
    return new URLSearchParams({ ...base, ...extra }).toString();
  };

  return (
    <div className="space-y-6">
      {cabecalho}
      {typeof busca.erro === "string" && <Aviso tipo="erro">{busca.erro}</Aviso>}
      {!p.ok && <Aviso tipo="erro">{p.erro}</Aviso>}

      <section aria-label="Período" className={cartao}>
        <nav aria-label="Atalhos de período" className="flex flex-wrap gap-2">
          {ATALHOS_DE_PERIODO.map((a) => (
            <Link
              key={a.chave}
              href={`/relatorios?${new URLSearchParams({ periodo: a.chave, ordem })}`}
              aria-current={periodo.chave === a.chave ? "page" : undefined}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", periodo.chave === a.chave ? "bg-primary text-primary-foreground" : "border text-foreground hover:bg-accent")}
            >
              {a.rotulo}
            </Link>
          ))}
        </nav>
        <form action="/relatorios" className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="ordem" value={ordem} />
          <div>
            <label htmlFor="de" className="text-sm font-medium text-foreground">
              De
            </label>
            <input id="de" name="de" type="date" required defaultValue={periodo.de} className={`${classeDoCampo()} mt-1.5`} />
          </div>
          <div>
            <label htmlFor="ate" className="text-sm font-medium text-foreground">
              Até
            </label>
            <input id="ate" name="ate" type="date" required defaultValue={periodo.ate} className={`${classeDoCampo()} mt-1.5`} />
          </div>
          <button type="submit" className="rounded-xl border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-accent">
            Aplicar
          </button>
        </form>
        <p className="mt-3 text-sm text-muted-foreground">
          {diaBrasileiro(periodo.de)} a {diaBrasileiro(periodo.ate)}
        </p>
      </section>

      {rent && (
        <section aria-labelledby="titulo-rentabilidade" className={cartao}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="titulo-rentabilidade" className="font-display text-xl font-semibold text-card-foreground">
              Rentabilidade por item
            </h2>
            <nav aria-label="Ordenar por" className="flex flex-wrap items-center gap-1 text-sm">
              <span className="mr-1 text-muted-foreground">Ordenar por</span>
              {ORDENS.map((o) => (
                <Link
                  key={o.chave}
                  href={`/relatorios?${q({ ordem: o.chave })}`}
                  aria-current={ordem === o.chave ? "page" : undefined}
                  className={cn("rounded-lg px-2.5 py-1 font-medium", ordem === o.chave ? "bg-primary text-primary-foreground" : "text-primary hover:bg-accent")}
                >
                  {o.rotulo}
                </Link>
              ))}
            </nav>
          </div>
          {rent.itens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda concluída no período.</p>
          ) : (
            <>
            {/* Celular: um cartão por item, com todas as colunas visíveis (RNF01). */}
            <ul className="divide-y sm:hidden" aria-label="Rentabilidade por item">
              {rent.itens.map((i) => (
                <li key={i.itemId} className="py-3 text-sm">
                  <p className="font-medium break-words text-foreground">
                    {i.nome}
                    {i.arquivado && <span className="ml-2 rounded-full border px-2 py-0.5 text-xs font-normal text-muted-foreground">arquivado</span>}
                  </p>
                  {i.linhasSemCusto > 0 && (
                    <p className="text-xs text-status-warn">
                      <span aria-hidden="true">▲ </span>custo não informado em {i.linhasSemCusto} {i.linhasSemCusto === 1 ? "venda" : "vendas"}
                    </p>
                  )}
                  <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <dt className="text-muted-foreground">Margem</dt>
                    <dd className={cn("text-right font-semibold tabular-nums", i.margemCentavos < 0 ? "text-status-danger" : "text-foreground")}>
                      {reais(i.margemCentavos)} · {pct(i.margemPercentual)}
                    </dd>
                    <dt className="text-muted-foreground">Faturamento</dt>
                    <dd className="text-right tabular-nums">{reais(i.faturamentoCentavos)}</dd>
                    <dt className="text-muted-foreground">Custo</dt>
                    <dd className="text-right tabular-nums">{reais(i.custoCentavos)}</dd>
                    <dt className="text-muted-foreground">Quantidade</dt>
                    <dd className="text-right tabular-nums">{i.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</dd>
                  </dl>
                </li>
              ))}
              <li className="py-3 text-sm font-semibold">
                <p>Total</p>
                <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <dt className="font-normal text-muted-foreground">Margem</dt>
                  <dd className="text-right tabular-nums">
                    {reais(rent.totais.margemCentavos)} · {pct(rent.totais.margemPercentual)}
                  </dd>
                  <dt className="font-normal text-muted-foreground">Faturamento</dt>
                  <dd className="text-right tabular-nums">{reais(rent.totais.faturamentoCentavos)}</dd>
                  <dt className="font-normal text-muted-foreground">Custo</dt>
                  <dd className="text-right tabular-nums">{reais(rent.totais.custoCentavos)}</dd>
                </dl>
              </li>
            </ul>
            <div className="-mx-6 hidden overflow-x-auto px-6 sm:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="sr-only">Rentabilidade por item no período</caption>
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th scope="col" className="py-2 font-medium">
                      Item
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Qtd.
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Faturamento
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Custo
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Margem
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Margem %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rent.itens.map((i) => (
                    <tr key={i.itemId} className="border-b last:border-b-0">
                      <td className="py-2 pr-3">
                        <span className="font-medium text-foreground">{i.nome}</span>
                        {i.arquivado && <span className="ml-2 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">arquivado</span>}
                        {i.linhasSemCusto > 0 && (
                          <span className="block text-xs text-status-warn">
                            <span aria-hidden="true">▲ </span>custo não informado em {i.linhasSemCusto} {i.linhasSemCusto === 1 ? "venda" : "vendas"}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums">{i.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</td>
                      <td className="py-2 text-right tabular-nums">{reais(i.faturamentoCentavos)}</td>
                      <td className="py-2 text-right tabular-nums">{reais(i.custoCentavos)}</td>
                      <td className={cn("py-2 text-right font-semibold tabular-nums", i.margemCentavos < 0 ? "text-status-danger" : "text-foreground")}>{reais(i.margemCentavos)}</td>
                      <td className="py-2 text-right tabular-nums">{pct(i.margemPercentual)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <th scope="row" className="py-2 text-left">
                      Total
                    </th>
                    <td className="py-2 text-right tabular-nums">{rent.totais.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</td>
                    <td className="py-2 text-right tabular-nums">{reais(rent.totais.faturamentoCentavos)}</td>
                    <td className="py-2 text-right tabular-nums">{reais(rent.totais.custoCentavos)}</td>
                    <td className="py-2 text-right tabular-nums">{reais(rent.totais.margemCentavos)}</td>
                    <td className="py-2 text-right tabular-nums">{pct(rent.totais.margemPercentual)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            </>
          )}
        </section>
      )}

      <section aria-labelledby="titulo-exportar" className={cartao}>
        <h2 id="titulo-exportar" className="font-display text-xl font-semibold text-card-foreground">
          Exportar
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Do período acima. O CSV abre no Excel ou no LibreOffice; o PDF, em qualquer leitor.
        </p>
        <ul className="mt-4 divide-y">
          {permitidos.map((r) => (
            <li key={r} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="text-sm font-medium text-foreground">{RELATORIOS[r].rotulo}</span>
              <span className="flex gap-2">
                {(["csv", "pdf"] as const).map((f) => (
                  <a
                    key={f}
                    href={`/relatorios/exportar?${q({ relatorio: r, formato: f })}`}
                    download
                    className="rounded-lg border px-3 py-1.5 text-sm font-medium text-primary hover:bg-accent"
                  >
                    <span aria-hidden="true">↓ </span>
                    {f.toUpperCase()}
                    <span className="sr-only"> de {RELATORIOS[r].rotulo}</span>
                  </a>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
