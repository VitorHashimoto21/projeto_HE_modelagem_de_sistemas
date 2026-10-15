import type { Metadata } from "next";
import Link from "next/link";
import type { CategoriaLancamento, TipoLancamento } from "@/generated/prisma/enums";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CabecalhoDoFinanceiro, reais, ROTULO_CATEGORIA, ROTULO_ORIGEM, Saldo, ValorComSinal } from "@/components/financeiro/exibicao";
import { ProjecaoDoCaixa } from "@/components/financeiro/projecao";
import { Legenda, TabelaDeValores } from "@/components/graficos/comuns";
import { GraficoDeFluxo } from "@/components/graficos/fluxo";
import { Aviso } from "@/components/acesso/campos";
import { AvisoDoHistorico } from "@/components/planos/avisos";
import { BotaoEstornar, FormularioSaldoInicial } from "@/components/financeiro/formularios";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao, classeDoLink } from "@/components/ui/estilos";
import { Numero } from "@/components/ui/numero";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { carregarProjecao, cartaoSeguro } from "@/lib/dashboard/servicos";
import { dependenciasDoDashboard } from "@/lib/dashboard/servidor";
import { financeiro } from "@/lib/db";
import { dataBrasileira, hoje } from "@/lib/dominio/datas";
import { CATEGORIAS, competenciaBrasileira, competenciaDoDia, somarMeses } from "@/lib/dominio/financeiro";
import { pode } from "@/lib/dominio/permissoes";
import { conferirFinanceiro } from "@/lib/financeiro/conferencia";
import { inicioDoHistorico, limitarCompetencia } from "@/lib/dominio/planos";
import { planoDoMembro } from "@/lib/planos/servidor";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Financeiro" };

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const NOMES_DOS_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dataBr = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const nomeDoMes = (comp: string) => `${NOMES_DOS_MESES[Number(comp.slice(5, 7)) - 1]} de ${comp.slice(0, 4)}`;

// Fluxo de caixa (SPEC-009, 5.1): Financeiro — ver. Saldo real (RN14), totais do mês e
// lançamentos com origem; estorno com "excluir"; saldo inicial e avulso com "criar".
export default async function Caixa({ searchParams }: PageProps<"/financeiro">) {
  const membro = await exigirPermissao("financeiro", "ver");
  const busca = await searchParams;
  const dia = hoje();
  const mesAtual = competenciaDoDia(dia);
  const pedido = typeof busca.mes === "string" && MES.test(busca.mes) && busca.mes <= mesAtual ? busca.mes : mesAtual;
  // Plano gratuito: os últimos 12 meses (SPEC-013, OPEN-005); o saldo continua com tudo.
  const inicio = inicioDoHistorico(await planoDoMembro(membro), dia);
  const { comp: mes, ajustado } = limitarCompetencia(pedido, inicio);
  const noLimite = inicio !== null && mes === inicio.slice(0, 7);
  const categoria = typeof busca.categoria === "string" && Object.hasOwn(CATEGORIAS, busca.categoria) ? (busca.categoria as CategoriaLancamento) : undefined;
  const tipo = busca.tipo === "ENTRADA" || busca.tipo === "SAIDA" ? (busca.tipo as TipoLancamento) : undefined;
  const pagina = Number(typeof busca.pagina === "string" ? busca.pagina : "1") || 1;

  await conferirFinanceiro(membro);
  const consultas = financeiro(membro);
  const [f, diario, projecao] = await Promise.all([
    consultas.fluxo({ mes, categoria, tipo, pagina }, dia),
    consultas.fluxoDiario(mes),
    cartaoSeguro("projecao", () => carregarProjecao(dependenciasDoDashboard(membro))),
  ]);
  const podeCriar = pode(membro.permissoes, "financeiro", "criar");
  const podeEstornar = pode(membro.permissoes, "financeiro", "excluir");
  const link = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const tudo = { mes: mes === mesAtual ? undefined : mes, categoria, tipo, ...extra };
    for (const [k, v] of Object.entries(tudo)) if (v !== undefined && v !== "") p.set(k, String(v));
    const q = p.toString();
    return q ? `/financeiro?${q}` : "/financeiro";
  };

  const comMovimento = diario.filter((d) => d.entradasCentavos || d.saidasCentavos);
  const navegacaoDoMes = (
    <nav aria-label="Mês" className="inline-flex items-center gap-1 rounded-full bg-card p-1">
      {noLimite ? (
        <span className={classeDoBotao("fantasma", "icone-sm", "pointer-events-none opacity-30")} aria-hidden="true">
          <ChevronLeft />
        </span>
      ) : (
        <Link href={link({ mes: somarMeses(mes, -1), pagina: undefined })} scroll={false} className={classeDoBotao("fantasma", "icone-sm")} aria-label="Mês anterior">
          <ChevronLeft aria-hidden="true" />
        </Link>
      )}
      <span className="min-w-36 px-2 text-center text-sm font-bold first-letter:uppercase">{nomeDoMes(mes)}</span>
      {mes < mesAtual ? (
        <Link href={link({ mes: somarMeses(mes, 1), pagina: undefined })} scroll={false} className={classeDoBotao("fantasma", "icone-sm")} aria-label="Próximo mês">
          <ChevronRight aria-hidden="true" />
        </Link>
      ) : (
        <span className={classeDoBotao("fantasma", "icone-sm", "pointer-events-none opacity-30")} aria-hidden="true">
          <ChevronRight />
        </span>
      )}
    </nav>
  );

  return (
    <div className="space-y-6">
      <CabecalhoDoFinanceiro
        atual="caixa"
        titulo="Fluxo de caixa"
        acoes={
          podeCriar && (
            <Link href="/financeiro/lancar" scroll={false} className={classeDoBotao("principal")}>
              <Plus aria-hidden="true" />
              Novo lançamento
            </Link>
          )
        }
      />

      {(ajustado || noLimite) && <AvisoDoHistorico ehDono={membro.papel === "DONO"} />}
      {busca.saldoInicial && <Aviso tipo="sucesso">Saldo inicial registrado. Para corrigi-lo, estorne o lançamento e informe de novo.</Aviso>}

      <Superficie tom="estrutura" aria-label="Saldo">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
          <Numero rotulo="Saldo atual" tamanho="xl" valor={<span className={f.saldoAtualCentavos < 0 ? "text-ambar" : undefined}>{reais(f.saldoAtualCentavos)}</span>} />
          <dl className="grid grid-cols-3 gap-x-4 gap-y-3 md:max-w-xl md:flex-1 md:gap-x-6">
            <div>
              <dt className="text-sm text-estrutura-suave">Entrou em {competenciaBrasileira(mes)}</dt>
              <dd className="mt-0.5 text-base font-extrabold tabular-nums sm:text-lg">+ {reais(f.entradasCentavos)}</dd>
            </div>
            <div>
              <dt className="text-sm text-estrutura-suave">Saiu em {competenciaBrasileira(mes)}</dt>
              <dd className="mt-0.5 text-base font-extrabold tabular-nums sm:text-lg">− {reais(f.saidasCentavos)}</dd>
            </div>
            <div>
              <dt className="text-sm text-estrutura-suave">Resultado do mês</dt>
              <dd className={cn("mt-0.5 text-base font-extrabold tabular-nums sm:text-lg", f.entradasCentavos - f.saidasCentavos < 0 && "text-ambar")}>{reais(f.entradasCentavos - f.saidasCentavos)}</dd>
            </div>
          </dl>
        </div>
        <p className="mt-5 text-xs text-estrutura-suave">Só entra no saldo o que foi recebido ou pago de fato. Parcelas do cartão e contas a receber entram quando recebidas.</p>
      </Superficie>

      {podeCriar && !f.saldoInicialInformado && (
        <Superficie tom="atencao" aria-labelledby="titulo-saldo-inicial">
          <TituloDaSuperficie
            id="titulo-saldo-inicial"
            titulo="Saldo inicial do caixa"
            descricao="Quanto dinheiro o negócio tinha quando começou a usar o sistema? Informe uma vez; o saldo parte dele."
          />
          <FormularioSaldoInicial hoje={dia} />
        </Superficie>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {navegacaoDoMes}
        <p className="text-sm text-muted-foreground tabular-nums">
          Começou com <Saldo centavos={f.saldoInicioCentavos} className="font-bold" /> e terminou com <Saldo centavos={f.saldoFimCentavos} className="font-bold" />
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <Superficie aria-labelledby="titulo-fluxo">
          <TituloDaSuperficie id="titulo-fluxo" titulo={`Fluxo de ${nomeDoMes(mes).split(" de ")[0]}`} descricao="Entradas acima e saídas abaixo da linha do zero, dia a dia." />
          <GraficoDeFluxo dias={diario} ate={mes === mesAtual ? dia : diario[diario.length - 1].dia} descricao={`Entradas e saídas por dia em ${nomeDoMes(mes)}`} />
          <Legenda
            className="mt-2"
            itens={[
              { rotulo: "Entradas", marca: "barra", cor: "var(--chart-1)" },
              { rotulo: "Saídas", marca: "barra", cor: "var(--chart-2)" },
            ]}
          />
          <TabelaDeValores
            className="mt-3"
            legenda={`Entradas e saídas por dia em ${nomeDoMes(mes)}`}
            colunas={["Dia", "Entradas", "Saídas"]}
            linhas={comMovimento.length ? comMovimento.map((d) => [dataBr(d.dia), reais(d.entradasCentavos), reais(d.saidasCentavos)]) : [["Nenhum movimento no mês", "—", "—"]]}
          />
        </Superficie>
        {projecao.ok && <ProjecaoDoCaixa dados={projecao.dados} />}
      </div>

      <Superficie aria-labelledby="titulo-lancamentos" espaco="nenhum">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3 sm:px-6 sm:pt-6">
          <h2 id="titulo-lancamentos" className="text-[17px] font-bold text-card-foreground">
            Lançamentos de {nomeDoMes(mes)}
          </h2>
          <form action="/financeiro" className="flex flex-wrap gap-2">
            {mes !== mesAtual && <input type="hidden" name="mes" value={mes} />}
            <label htmlFor="filtro-tipo" className="sr-only">
              Tipo
            </label>
            <select id="filtro-tipo" name="tipo" defaultValue={tipo ?? ""} className={cn(classeDoCampo(), "h-10 w-auto rounded-full py-0")}>
              <option value="">Entradas e saídas</option>
              <option value="ENTRADA">Só entradas</option>
              <option value="SAIDA">Só saídas</option>
            </select>
            <label htmlFor="filtro-categoria" className="sr-only">
              Categoria
            </label>
            <select id="filtro-categoria" name="categoria" defaultValue={categoria ?? ""} className={cn(classeDoCampo(), "h-10 w-auto rounded-full py-0")}>
              <option value="">Todas as categorias</option>
              {Object.entries(CATEGORIAS).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
            <button type="submit" className={classeDoBotao("secundario", "sm", "h-10")}>
              Filtrar
            </button>
          </form>
        </div>

        {f.lancamentos.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-muted-foreground sm:px-6">{categoria || tipo ? "Nenhum lançamento com esses filtros neste mês." : "Nenhum lançamento neste mês."}</p>
        ) : (
          <ol className="divide-y border-t">
            {f.lancamentos.map((l) => {
              const entrada = l.tipo === "ENTRADA";
              const Icone = entrada ? ArrowDownLeft : ArrowUpRight;
              return (
                <li key={l.id} className="flex items-start gap-3 px-5 py-3.5 text-sm sm:px-6">
                  <span aria-hidden="true" className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", entrada ? "bg-status-ok-bg text-status-ok" : "bg-status-danger-bg text-status-danger")}>
                    <Icone className="size-4" strokeWidth={2.4} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-semibold break-words text-foreground", l.estornado && "line-through decoration-muted-foreground")}>
                      {l.venda ? (
                        <Link href={`/vendas/${l.venda.id}`} className={classeDoLink()}>
                          {/* O reembolso de venda cancelada (SPEC-011) tem descrição própria. */}
                          {l.descricao ?? `Venda nº ${l.venda.numero}`}
                        </Link>
                      ) : l.conta ? (
                        <Link href={`/financeiro/contas/${l.conta.id}`} className={classeDoLink()}>
                          {l.conta.descricao ?? "Conta"}
                        </Link>
                      ) : (
                        (l.descricao ?? ROTULO_ORIGEM[l.origem])
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dataBrasileira(l.data)}, {ROTULO_ORIGEM[l.origem].toLowerCase()}, {ROTULO_CATEGORIA[l.categoria].toLowerCase()}
                      {l.registradoPor ? `, ${l.registradoPor}` : l.origem === "CONTA" ? ", automático" : ""}
                      {l.estornado && ", estornado"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ValorComSinal tipo={l.tipo} centavos={l.valorCentavos} />
                    {podeEstornar && !l.estornado && (l.origem === "AVULSO" || l.origem === "SALDO_INICIAL") && (
                      <BotaoEstornar lancamentoId={l.id} descricao={`${l.descricao ?? ROTULO_ORIGEM[l.origem]} (${reais(l.valorCentavos)})`} />
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {f.paginas > 1 && (
          <nav aria-label="Páginas dos lançamentos" className="flex items-center justify-between gap-2 border-t px-5 py-3 text-sm sm:px-6">
            {f.pagina > 1 ? (
              <Link href={link({ pagina: f.pagina - 1 })} className={classeDoBotao("fantasma", "sm")}>
                <ChevronLeft aria-hidden="true" />
                Mais novos
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">
              Página {f.pagina} de {f.paginas}
            </span>
            {f.pagina < f.paginas ? (
              <Link href={link({ pagina: f.pagina + 1 })} className={classeDoBotao("fantasma", "sm")}>
                Mais antigos
                <ChevronRight aria-hidden="true" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </Superficie>
    </div>
  );
}
