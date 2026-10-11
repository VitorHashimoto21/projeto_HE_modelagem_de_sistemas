import Link from "next/link";
import { Saldo } from "@/components/financeiro/exibicao";
import type { VendasDoDia } from "@/lib/db/dashboard";
import type { EstadoDoSemaforo, VisaoDoGrafico } from "@/lib/dashboard/servicos";
import { MENSAGENS_DASHBOARD } from "@/lib/dashboard/servicos";
import type { CorDoSemaforo, Projecao, Serie } from "@/lib/dominio/dashboard";
import { reaisDeCentavos as reais } from "@/lib/dominio/venda";
import { cn } from "@/lib/utils";

// Cartões do Dashboard (SPEC-012). Sem "use client": desenhados no servidor, o gráfico
// inclusive (OPEN-002). Status sempre com ícone e texto, nunca só cor (RNF01).

const NOMES_DOS_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const nomeDoMes = (comp: string) => `${NOMES_DOS_MESES[Number(comp.slice(5, 7)) - 1]} de ${comp.slice(0, 4)}`;
const mesCurto = (comp: string) => `${NOMES_DOS_MESES[Number(comp.slice(5, 7)) - 1].slice(0, 3)}/${comp.slice(2, 4)}`;
const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

const cartao = "rounded-2xl border bg-card p-6 shadow-sm";
const titulo = "font-display text-xl font-semibold text-card-foreground";
const link = "font-medium text-primary underline-offset-2 hover:underline";

export function CartaoComFalha({ rotulo }: { rotulo: string }) {
  return (
    <section aria-label={rotulo} className={cartao}>
      <h2 className={titulo}>{rotulo}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{MENSAGENS_DASHBOARD.falhaNoCartao}</p>
    </section>
  );
}

// ---------- Resumo do dia (RF42, RF63) ----------

export function CartaoVendasDoDia({ dados, podeVer, podeVender }: { dados: VendasDoDia; podeVer: boolean; podeVender: boolean }) {
  return (
    <section aria-labelledby="titulo-vendas-dia" className={cartao}>
      <h2 id="titulo-vendas-dia" className="text-sm text-muted-foreground">
        Vendas de hoje
      </h2>
      <p className="mt-1 text-3xl font-semibold text-foreground tabular-nums">{reais(dados.totalCentavos)}</p>
      {dados.quantidade === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Nenhuma venda hoje.
          {podeVender && (
            <>
              {" "}
              <Link href="/vendas/nova" className={link}>
                Nova venda
              </Link>
            </>
          )}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            {dados.quantidade} {dados.quantidade === 1 ? "venda" : "vendas"} · ticket médio {reais(dados.ticketMedioCentavos ?? 0)}
          </p>
          {podeVer && (
            <p className="mt-2 text-sm">
              <Link href="/vendas?periodo=hoje" className={link}>
                Ver as vendas de hoje
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function CartaoSaldo({ centavos }: { centavos: number }) {
  return (
    <section aria-labelledby="titulo-saldo" className={cn(cartao, centavos < 0 && "border-status-danger/30 bg-status-danger-bg")}>
      <h2 id="titulo-saldo" className="text-sm text-muted-foreground">
        Saldo em caixa
      </h2>
      <p className="mt-1 text-3xl font-semibold">
        <Saldo centavos={centavos} />
      </p>
      {centavos < 0 && (
        <p className="mt-1 text-sm font-medium text-status-danger">
          <span aria-hidden="true">▼ </span>Saldo negativo
        </p>
      )}
      <p className="mt-2 text-sm">
        <Link href="/financeiro" className={link}>
          Abrir o fluxo de caixa
        </Link>
      </p>
    </section>
  );
}

export function CartaoEstoque({ alertas }: { alertas: { baixo: number; semEstoque: number } }) {
  const total = alertas.baixo + alertas.semEstoque;
  return (
    <section aria-labelledby="titulo-alertas" className={cn(cartao, total > 0 && "border-status-warn/40 bg-status-warn-bg")}>
      <h2 id="titulo-alertas" className="text-sm text-muted-foreground">
        Estoque
      </h2>
      {total > 0 ? (
        <>
          <p className="mt-1 text-lg font-semibold text-status-warn">
            <span aria-hidden="true">▲ </span>
            {total} {total === 1 ? "produto" : "produtos"} com estoque baixo
          </p>
          {alertas.semEstoque > 0 && <p className="text-sm text-status-warn">{alertas.semEstoque} sem estoque</p>}
          <p className="mt-2 text-sm">
            <Link href="/estoque?situacao=baixo" className="font-semibold text-status-warn underline underline-offset-2">
              Ver quais
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 text-lg font-semibold text-foreground">
            <span aria-hidden="true">✓ </span>Nenhum produto com estoque baixo
          </p>
          <p className="mt-2 text-sm">
            <Link href="/estoque" className={link}>
              Abrir o estoque
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

// ---------- Semáforo (RF57, OPEN-003) ----------

const COR: Record<CorDoSemaforo, { icone: string; rotulo: string; classes: string; barra: string }> = {
  vermelho: { icone: "▼", rotulo: "Vermelho — Déficit", classes: "border-status-danger/30 bg-status-danger-bg text-status-danger", barra: "bg-status-danger" },
  amarelo: { icone: "◆", rotulo: "Amarelo — Alerta", classes: "border-status-warn/40 bg-status-warn-bg text-status-warn", barra: "bg-status-warn" },
  verde: { icone: "✓", rotulo: "Verde — Saudável", classes: "border-status-ok/30 bg-status-ok-bg text-status-ok", barra: "bg-status-ok" },
  equilibrio: { icone: "✓", rotulo: "Ponto de equilíbrio atingido", classes: "border-status-ok/30 bg-status-ok-bg text-status-ok", barra: "bg-status-ok" },
};

const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export function CartaoSemaforo({
  estado,
  competencia,
  linkParametros,
  linkDadosDoNegocio,
}: {
  estado: EstadoDoSemaforo;
  competencia: string;
  linkParametros: boolean;
  linkDadosDoNegocio: boolean;
}) {
  const cabecalho = (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="titulo-semaforo" className={titulo}>
        Saúde financeira
      </h2>
      <p className="text-sm text-muted-foreground first-letter:uppercase">{nomeDoMes(competencia)}</p>
    </div>
  );

  if (estado.status === "indisponivel") {
    const dados = ["imposto-nao-informado", "anexo-nao-informado", "atividade-mei-nao-informada", "acima-do-simples"].includes(estado.motivo);
    return (
      <section aria-labelledby="titulo-semaforo" className={cartao}>
        {cabecalho}
        <p className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
          <span aria-hidden="true">○</span> Indisponível
        </p>
        <p className="mt-3 text-sm text-foreground">{estado.mensagem}</p>
        {dados
          ? linkDadosDoNegocio && (
              <p className="mt-2 text-sm">
                <Link href="/negocio/dados" className={link}>
                  Abrir os dados do negócio
                </Link>
              </p>
            )
          : linkParametros && (
              <p className="mt-2 text-sm">
                <Link href="/calculadora/parametros" className={link}>
                  Abrir os parâmetros de precificação
                </Link>
              </p>
            )}
      </section>
    );
  }

  const s = estado.semaforo;
  const c = COR[s.cor];
  const texto =
    s.cor === "vermelho"
      ? `Faltam ${reais(s.faltaParaPeCentavos)} para cobrir as despesas do mês.`
      : s.cor === "amarelo"
        ? `Despesas cobertas. Faltam ${reais(s.faltaParaMetaCentavos ?? 0)} para a meta de ${pct(estado.margemMeta ?? 0)} de lucro.`
        : s.cor === "verde"
          ? "Meta do mês atingida."
          : "As vendas do mês já cobrem as despesas.";

  return (
    <section aria-labelledby="titulo-semaforo" className={cartao}>
      {cabecalho}
      <div className={cn("rounded-xl border p-4", c.classes)}>
        <p className="flex items-center gap-2 font-semibold">
          <span aria-hidden="true" className="text-lg">
            {c.icone}
          </span>
          {c.rotulo}
        </p>
        <p className="mt-1 text-sm text-foreground">{texto}</p>
      </div>

      <div className="mt-4" aria-hidden="true">
        <div className="relative h-3 rounded-full bg-muted">
          <div className={cn("h-3 rounded-full", c.barra)} style={{ width: `${Math.round(s.progresso * 100)}%` }} />
          {s.marcaDoPe !== null && <div className="absolute -top-1 h-5 w-0.5 bg-foreground" style={{ left: `${Math.round(s.marcaDoPe * 100)}%` }} />}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Faturamento do mês</dt>
          <dd className="text-lg font-semibold text-foreground tabular-nums">{reais(s.faturamentoCentavos)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ponto de equilíbrio</dt>
          <dd className="text-lg font-semibold text-foreground tabular-nums">{reais(s.pontoDeEquilibrioCentavos)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Meta{estado.margemMeta !== null && ` (${pct(estado.margemMeta)} de lucro)`}</dt>
          <dd className="text-lg font-semibold text-foreground tabular-nums">{s.metaCentavos === null ? "—" : reais(s.metaCentavos)}</dd>
        </div>
      </dl>

      {s.ritmoCentavos !== null && (
        <p className="mt-3 text-sm text-muted-foreground">
          No ritmo atual, o mês fecha em <strong className="text-foreground">{reais(s.ritmoCentavos)}</strong> (estimativa pela média por dia).
        </p>
      )}
      {s.metaCentavos === null && (
        <p className="mt-3 text-sm text-muted-foreground">
          {MENSAGENS_DASHBOARD.semMeta}
          {linkParametros && (
            <>
              {" "}
              <Link href="/calculadora/parametros" className={link}>
                Configurar
              </Link>
            </>
          )}
        </p>
      )}
    </section>
  );
}

// ---------- Gráfico de vendas (RF43, OPEN-002) ----------

export function CartaoGrafico({ serie, visao, hoje }: { serie: Serie; visao: VisaoDoGrafico; hoje: string }) {
  const n = serie.pontos.length;
  const maior = Math.max(serie.maiorCentavos, 1);
  const rotulo = (periodo: string) => (visao === "dias" ? diaCurto(periodo) : mesCurto(periodo));
  const parcial = (periodo: string) => (visao === "dias" ? periodo === hoje : periodo === hoje.slice(0, 7));
  const descricao = visao === "dias" ? "por dia nos últimos 30 dias" : "por mês nos últimos 12 meses";
  const meio = Math.floor((n - 1) / 2);
  const aba = (v: VisaoDoGrafico, texto: string) => (
    <Link
      href={v === "dias" ? "/painel" : "/painel?grafico=meses"}
      aria-current={visao === v ? "page" : undefined}
      scroll={false}
      className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", visao === v ? "bg-primary text-primary-foreground" : "text-primary hover:bg-accent")}
    >
      {texto}
    </Link>
  );

  return (
    <section aria-labelledby="titulo-grafico" className={cartao}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-grafico" className={titulo}>
          Vendas
        </h2>
        <nav aria-label="Período do gráfico" className="flex gap-1">
          {aba("dias", "30 dias")}
          {aba("meses", "12 meses")}
        </nav>
      </div>
      <p className="text-sm text-muted-foreground">
        Total {visao === "dias" ? "nos 30 dias" : "nos 12 meses"}: <strong className="text-foreground">{reais(serie.totalCentavos)}</strong> · maior {visao === "dias" ? "dia" : "mês"}:{" "}
        <strong className="text-foreground">{reais(serie.maiorCentavos)}</strong>
      </p>

      <svg
        role="img"
        aria-label={`Gráfico de barras: vendas ${descricao}. Total ${reais(serie.totalCentavos)}.`}
        viewBox={`0 0 ${n * 10} 100`}
        preserveAspectRatio="none"
        className="mt-4 h-40 w-full"
      >
        <line x1="0" y1="99.5" x2={n * 10} y2="99.5" className="stroke-border" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {serie.pontos.map((p, i) => {
          const h = p.totalCentavos > 0 ? Math.max(1.5, (p.totalCentavos / maior) * 96) : 0;
          return (
            <rect key={p.periodo} x={i * 10 + 1.5} y={100 - h} width="7" height={h} rx="1" className={parcial(p.periodo) ? "fill-chart-1/55" : "fill-chart-1"}>
              <title>{`${rotulo(p.periodo)}${parcial(p.periodo) ? " (até agora)" : ""}: ${reais(p.totalCentavos)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground" aria-hidden="true">
        <span>{rotulo(serie.pontos[0].periodo)}</span>
        <span>{rotulo(serie.pontos[meio].periodo)}</span>
        <span>{visao === "dias" ? "hoje" : `${rotulo(serie.pontos[n - 1].periodo)} (até hoje)`}</span>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium text-primary">Ver os valores</summary>
        <div className="mt-2 max-h-72 overflow-y-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Vendas {descricao}</caption>
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="py-1.5 font-medium">
                  {visao === "dias" ? "Dia" : "Mês"}
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Vendas
                </th>
              </tr>
            </thead>
            <tbody>
              {[...serie.pontos].reverse().map((p) => (
                <tr key={p.periodo} className="border-b last:border-b-0">
                  <td className="py-1.5">
                    {rotulo(p.periodo)}
                    {parcial(p.periodo) && <span className="text-muted-foreground"> (até agora)</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{reais(p.totalCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

// ---------- Projeção de caixa (RF68, OPEN-004) ----------

export function CartaoProjecao({ projecao }: { projecao: Projecao }) {
  const a = projecao.atrasadas;
  return (
    <section aria-labelledby="titulo-projecao" className={cartao}>
      <h2 id="titulo-projecao" className={titulo}>
        Projeção de caixa
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Saldo atual: <Saldo centavos={projecao.saldoAtualCentavos} className="font-semibold" />
      </p>

      <div className="hidden grid-cols-[1.4fr_1fr_1fr_1.2fr] gap-x-4 mt-4 border-b pb-2 text-xs text-muted-foreground sm:grid" aria-hidden="true">
        <span>Mês</span>
        <span>Entradas previstas</span>
        <span>Saídas previstas</span>
        <span className="text-right">Saldo projetado</span>
      </div>
      <ol className="divide-y">
        {projecao.meses.map((m, i) => (
          <li key={m.competencia} className="grid grid-cols-2 gap-x-4 gap-y-1 py-3 text-sm sm:grid-cols-[1.4fr_1fr_1fr_1.2fr] sm:items-baseline">
            <p className="col-span-2 font-medium text-foreground first-letter:uppercase sm:col-span-1">
              {nomeDoMes(m.competencia)}
              {i === 0 && <span className="font-normal text-muted-foreground"> (atual)</span>}
            </p>
            <p className="text-muted-foreground">
              <span className="sm:sr-only">Entradas </span>
              <span className="whitespace-nowrap text-status-ok tabular-nums">
                <span aria-hidden="true">+ </span>
                {reais(m.entradasCentavos)}
              </span>
            </p>
            <p className="text-muted-foreground">
              <span className="sm:sr-only">Saídas </span>
              <span className="whitespace-nowrap text-status-danger tabular-nums">
                <span aria-hidden="true">− </span>
                {reais(m.saidasCentavos)}
              </span>
              {m.saidasEstimadasCentavos > 0 && <span className="block text-xs">{reais(m.saidasEstimadasCentavos)} de despesas fixas (estimado)</span>}
            </p>
            <div className="col-span-2 sm:col-span-1 sm:text-right">
              <p className="font-semibold">
                <span className="font-normal text-muted-foreground sm:sr-only">Saldo projetado </span>
                <Saldo centavos={m.saldoProjetadoCentavos} />
              </p>
              {m.negativo && (
                <p className="text-xs font-medium text-status-danger">
                  <span aria-hidden="true">▼ </span>Caixa negativo previsto
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {a.quantidade > 0 && (
        <p className="mt-3 rounded-xl border border-status-warn/40 bg-status-warn-bg px-4 py-2 text-sm text-status-warn">
          <span aria-hidden="true">▲ </span>
          {a.quantidade} {a.quantidade === 1 ? "conta atrasada entra" : "contas atrasadas entram"} no mês atual
          {a.entradasCentavos > 0 && ` · ${reais(a.entradasCentavos)} a receber`}
          {a.saidasCentavos > 0 && ` · ${reais(a.saidasCentavos)} a pagar`}.{" "}
          <Link href={`/financeiro/contas?tipo=${a.saidasCentavos > 0 ? "PAGAR" : "RECEBER"}&situacao=atrasadas`} className="font-semibold underline underline-offset-2">
            Ver as contas
          </Link>
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{MENSAGENS_DASHBOARD.rodapeProjecao}</p>
    </section>
  );
}
