import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { Aviso } from "@/components/acesso/campos";
import { OfertaDoPlanoPago } from "@/components/planos/avisos";
import { BarraEmpilhada, BarrasHorizontais } from "@/components/graficos/barras-de-parte";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao } from "@/components/ui/estilos";
import { Segmentos } from "@/components/ui/segmentos";
import { Selo } from "@/components/ui/selo";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { exigirMembro } from "@/lib/auth/servidor";
import { ROTA_SEM_ACESSO } from "@/lib/auth/rotas";
import { podeNoPlano } from "@/lib/dominio/planos";
import { ATALHOS_DE_PERIODO, diaBrasileiro, lerPeriodo, RELATORIOS, type OrdemDaRentabilidade } from "@/lib/dominio/relatorios";
import { reaisDeCentavos as reais } from "@/lib/dominio/venda";
import { planoDoMembro } from "@/lib/planos/servidor";
import { carregarFormasDoPeriodo, carregarRentabilidade, relatoriosPermitidos } from "@/lib/relatorios/servicos";
import { dependenciasDosRelatorios } from "@/lib/relatorios/servidor";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Relatórios" };

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

  const cabecalho = <CabecalhoDePagina titulo="Relatórios" descricao="Rentabilidade por item, formas de pagamento e exportação em CSV (planilha) e PDF." />;

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
  const [rent, formas] = await Promise.all([
    vePermitido("rentabilidade") ? carregarRentabilidade(periodo.de, periodo.ate, ordem, deps) : null,
    vePermitido("vendas") ? carregarFormasDoPeriodo(periodo.de, periodo.ate, deps) : null,
  ]);
  // "O que mais deixa lucro" (5.5): sempre pela margem, os 8 primeiros, os 3 primeiros em destaque.
  const ranking = rent ? [...rent.itens].sort((a, b) => b.margemCentavos - a.margemCentavos).slice(0, 8) : [];
  const q = (extra: Record<string, string>) => {
    const base: Record<string, string> = periodo.chave === "datas" ? { de: periodo.de, ate: periodo.ate } : { periodo: periodo.chave };
    return new URLSearchParams({ ...base, ...extra }).toString();
  };

  return (
    <div className="space-y-6">
      {cabecalho}
      {typeof busca.erro === "string" && <Aviso tipo="erro">{busca.erro}</Aviso>}
      {!p.ok && <Aviso tipo="erro">{p.erro}</Aviso>}

      <section aria-label="Período" className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Segmentos
            rotulo="Atalhos de período"
            itens={ATALHOS_DE_PERIODO.map((a) => ({ href: `/relatorios?${new URLSearchParams({ periodo: a.chave, ordem })}`, rotulo: a.rotulo, ativo: periodo.chave === a.chave }))}
          />
          <p className="px-1 text-sm text-muted-foreground">
            {diaBrasileiro(periodo.de)} a {diaBrasileiro(periodo.ate)}
          </p>
        </div>
        <form action="/relatorios" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="ordem" value={ordem} />
          <div>
            <label htmlFor="de" className="mb-1.5 block text-sm font-medium text-foreground">
              De
            </label>
            <input id="de" name="de" type="date" required defaultValue={periodo.de} className={cn(classeDoCampo(), "h-11 py-0")} />
          </div>
          <div>
            <label htmlFor="ate" className="mb-1.5 block text-sm font-medium text-foreground">
              Até
            </label>
            <input id="ate" name="ate" type="date" required defaultValue={periodo.ate} className={cn(classeDoCampo(), "h-11 py-0")} />
          </div>
          <button type="submit" className={classeDoBotao("secundario")}>
            Aplicar
          </button>
        </form>
      </section>

      {(ranking.length > 0 || formas) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {ranking.length > 0 && (
            <Superficie aria-labelledby="titulo-ranking">
              <TituloDaSuperficie id="titulo-ranking" titulo="O que mais deixa lucro" descricao="Margem no período: faturamento menos o custo gravado em cada venda." />
              <BarrasHorizontais itens={ranking.map((i) => ({ chave: i.itemId, nome: i.nome, valorCentavos: i.margemCentavos, detalhe: pct(i.margemPercentual) }))} />
            </Superficie>
          )}
          {formas && (
            <Superficie aria-labelledby="titulo-formas">
              <TituloDaSuperficie id="titulo-formas" titulo="Como os clientes pagam" descricao="Vendas concluídas no período, por forma de pagamento." />
              <BarraEmpilhada itens={formas} descricao={`Formas de pagamento no período: ${formas.map((f) => `${f.nome} ${reais(f.valorCentavos)}`).join(", ")}`} />
            </Superficie>
          )}
        </div>
      )}

      {rent && (
        <Superficie aria-labelledby="titulo-rentabilidade">
          <TituloDaSuperficie
            id="titulo-rentabilidade"
            titulo="Rentabilidade por item"
            acoes={
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Ordenar por</span>
                <Segmentos rotulo="Ordenar por" itens={ORDENS.map((o) => ({ href: `/relatorios?${q({ ordem: o.chave })}`, rotulo: o.rotulo, ativo: ordem === o.chave }))} />
              </div>
            }
          />
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
                    {i.arquivado && (
                      <Selo tom="neutro" semIcone className="ml-2">
                        arquivado
                      </Selo>
                    )}
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
                        {i.arquivado && (
                          <Selo tom="neutro" semIcone className="ml-2">
                            arquivado
                          </Selo>
                        )}
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
        </Superficie>
      )}

      <Superficie aria-labelledby="titulo-exportar">
        <TituloDaSuperficie id="titulo-exportar" titulo="Exportar" descricao="Do período acima. O CSV abre no Excel ou no LibreOffice; o PDF, em qualquer leitor." />
        <ul className="divide-y">
          {permitidos.map((r) => (
            <li key={r} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="text-sm font-medium text-foreground">{RELATORIOS[r].rotulo}</span>
              <span className="flex gap-2">
                {(["csv", "pdf"] as const).map((f) => (
                  <a
                    key={f}
                    href={`/relatorios/exportar?${q({ relatorio: r, formato: f })}`}
                    download
                    className={classeDoBotao("secundario", "sm")}
                  >
                    <Download aria-hidden="true" />
                    {f.toUpperCase()}
                    <span className="sr-only"> de {RELATORIOS[r].rotulo}</span>
                  </a>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Superficie>
    </div>
  );
}
