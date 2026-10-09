import type { Metadata } from "next";
import Link from "next/link";
import type { CategoriaLancamento, TipoLancamento } from "@/generated/prisma/enums";
import { botaoPrimario, CabecalhoDoFinanceiro, reais, ROTULO_CATEGORIA, ROTULO_ORIGEM, Saldo, ValorComSinal } from "@/components/financeiro/exibicao";
import { Aviso } from "@/components/acesso/campos";
import { BotaoEstornar, FormularioSaldoInicial } from "@/components/financeiro/formularios";
import { classeDoCampo } from "@/components/ui/classes";
import { exigirPermissao } from "@/lib/auth/servidor";
import { financeiro } from "@/lib/db";
import { dataBrasileira, hoje } from "@/lib/dominio/datas";
import { CATEGORIAS, competenciaBrasileira, competenciaDoDia, somarMeses } from "@/lib/dominio/financeiro";
import { pode } from "@/lib/dominio/permissoes";
import { conferirFinanceiro } from "@/lib/financeiro/conferencia";

export const metadata: Metadata = { title: "Financeiro" };

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const NOMES_DOS_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeDoMes = (comp: string) => `${NOMES_DOS_MESES[Number(comp.slice(5, 7)) - 1]} de ${comp.slice(0, 4)}`;

function Cartao({ rotulo, children, destaque }: { rotulo: string; children: React.ReactNode; destaque?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${destaque ? "bg-card ring-1 ring-primary/20" : "bg-card"}`}>
      <p className="text-sm text-muted-foreground">{rotulo}</p>
      <p className={`mt-1 font-semibold ${destaque ? "text-3xl" : "text-xl"}`}>{children}</p>
    </div>
  );
}

// Fluxo de caixa (SPEC-009, 5.1): Financeiro — ver. Saldo real (RN14), totais do mês e
// lançamentos com origem; estorno com "excluir"; saldo inicial e avulso com "criar".
export default async function Caixa({ searchParams }: PageProps<"/financeiro">) {
  const membro = await exigirPermissao("financeiro", "ver");
  const busca = await searchParams;
  const dia = hoje();
  const mesAtual = competenciaDoDia(dia);
  const mes = typeof busca.mes === "string" && MES.test(busca.mes) && busca.mes <= mesAtual ? busca.mes : mesAtual;
  const categoria = typeof busca.categoria === "string" && Object.hasOwn(CATEGORIAS, busca.categoria) ? (busca.categoria as CategoriaLancamento) : undefined;
  const tipo = busca.tipo === "ENTRADA" || busca.tipo === "SAIDA" ? (busca.tipo as TipoLancamento) : undefined;
  const pagina = Number(typeof busca.pagina === "string" ? busca.pagina : "1") || 1;

  await conferirFinanceiro(membro);
  const f = await financeiro(membro).fluxo({ mes, categoria, tipo, pagina }, dia);
  const podeCriar = pode(membro.permissoes, "financeiro", "criar");
  const podeEstornar = pode(membro.permissoes, "financeiro", "excluir");
  const link = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const tudo = { mes: mes === mesAtual ? undefined : mes, categoria, tipo, ...extra };
    for (const [k, v] of Object.entries(tudo)) if (v !== undefined && v !== "") p.set(k, String(v));
    const q = p.toString();
    return q ? `/financeiro?${q}` : "/financeiro";
  };

  return (
    <div className="space-y-8">
      <CabecalhoDoFinanceiro
        atual="caixa"
        titulo="Fluxo de caixa"
        acoes={
          podeCriar && (
            <Link href="/financeiro/lancar" className={botaoPrimario}>
              Novo lançamento
            </Link>
          )
        }
      />

      {busca.saldoInicial && <Aviso tipo="sucesso">Saldo inicial registrado. Para corrigi-lo, estorne o lançamento e informe de novo.</Aviso>}

      <section aria-label="Saldo" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao rotulo="Saldo atual" destaque>
          <Saldo centavos={f.saldoAtualCentavos} />
        </Cartao>
        <Cartao rotulo={`Entradas em ${competenciaBrasileira(mes)}`}>
          <ValorComSinal tipo="ENTRADA" centavos={f.entradasCentavos} />
        </Cartao>
        <Cartao rotulo={`Saídas em ${competenciaBrasileira(mes)}`}>
          <ValorComSinal tipo="SAIDA" centavos={f.saidasCentavos} />
        </Cartao>
        <Cartao rotulo="Resultado do mês">
          <Saldo centavos={f.entradasCentavos - f.saidasCentavos} />
        </Cartao>
      </section>
      <p className="-mt-4 text-xs text-muted-foreground">
        Só entra no saldo o que foi recebido ou pago de fato. Parcelas do cartão e contas a receber entram quando recebidas.
      </p>

      {podeCriar && !f.saldoInicialInformado && (
        <section aria-labelledby="titulo-saldo-inicial" className="rounded-2xl border border-status-warn/40 bg-status-warn-bg p-6 shadow-sm">
          <h2 id="titulo-saldo-inicial" className="font-display text-xl font-semibold text-card-foreground">
            Saldo inicial do caixa
          </h2>
          <p className="mt-1 mb-4 text-sm text-foreground">Quanto dinheiro o negócio tinha quando começou a usar o sistema? Informe uma vez; o saldo parte dele.</p>
          <FormularioSaldoInicial hoje={dia} />
        </section>
      )}

      <section aria-labelledby="titulo-lancamentos" className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Mês" className="flex items-center gap-2">
            <Link href={link({ mes: somarMeses(mes, -1), pagina: undefined })} className="rounded-lg px-2 py-1 text-sm font-medium text-primary hover:bg-accent" aria-label="Mês anterior">
              ←
            </Link>
            <h2 id="titulo-lancamentos" className="font-display text-xl font-semibold text-card-foreground first-letter:uppercase">
              {nomeDoMes(mes)}
            </h2>
            {mes < mesAtual ? (
              <Link href={link({ mes: somarMeses(mes, 1), pagina: undefined })} className="rounded-lg px-2 py-1 text-sm font-medium text-primary hover:bg-accent" aria-label="Próximo mês">
                →
              </Link>
            ) : (
              <span className="px-2 py-1 text-sm text-muted-foreground/40" aria-hidden="true">
                →
              </span>
            )}
          </nav>
          <form action="/financeiro" className="flex flex-wrap gap-2">
            {mes !== mesAtual && <input type="hidden" name="mes" value={mes} />}
            <label htmlFor="filtro-tipo" className="sr-only">
              Tipo
            </label>
            <select id="filtro-tipo" name="tipo" defaultValue={tipo ?? ""} className={`${classeDoCampo()} w-auto py-2`}>
              <option value="">Entradas e saídas</option>
              <option value="ENTRADA">Só entradas</option>
              <option value="SAIDA">Só saídas</option>
            </select>
            <label htmlFor="filtro-categoria" className="sr-only">
              Categoria
            </label>
            <select id="filtro-categoria" name="categoria" defaultValue={categoria ?? ""} className={`${classeDoCampo()} w-auto py-2`}>
              <option value="">Todas as categorias</option>
              {Object.entries(CATEGORIAS).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-xl border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
              Filtrar
            </button>
          </form>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl bg-muted/50 px-4 py-3 text-sm sm:flex sm:flex-wrap sm:justify-between">
          <div>
            <dt className="text-muted-foreground">Saldo no início do mês</dt>
            <dd className="font-medium">
              <Saldo centavos={f.saldoInicioCentavos} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Saldo no fim do mês</dt>
            <dd className="font-medium">
              <Saldo centavos={f.saldoFimCentavos} />
            </dd>
          </div>
        </dl>

        {f.lancamentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">{categoria || tipo ? "Nenhum lançamento com esses filtros neste mês." : "Nenhum lançamento neste mês."}</p>
        ) : (
          <ol className="divide-y">
            {f.lancamentos.map((l) => (
              <li key={l.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium break-words text-foreground ${l.estornado ? "line-through decoration-muted-foreground" : ""}`}>
                    {l.venda ? (
                      <Link href={`/vendas/${l.venda.id}`} className="text-primary underline-offset-2 hover:underline">
                        Venda nº {l.venda.numero}
                      </Link>
                    ) : l.conta ? (
                      <Link href={`/financeiro/contas/${l.conta.id}`} className="text-primary underline-offset-2 hover:underline">
                        {l.conta.descricao ?? "Conta"}
                      </Link>
                    ) : (
                      (l.descricao ?? ROTULO_ORIGEM[l.origem])
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dataBrasileira(l.data)} · {ROTULO_ORIGEM[l.origem]} · {ROTULO_CATEGORIA[l.categoria]}
                    {l.registradoPor ? ` · ${l.registradoPor}` : l.origem === "CONTA" ? " · automático" : ""}
                    {l.estornado && " · estornado"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <ValorComSinal tipo={l.tipo} centavos={l.valorCentavos} />
                  {podeEstornar && !l.estornado && (l.origem === "AVULSO" || l.origem === "SALDO_INICIAL") && (
                    <BotaoEstornar lancamentoId={l.id} descricao={`${l.descricao ?? ROTULO_ORIGEM[l.origem]} (${reais(l.valorCentavos)})`} />
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        {f.paginas > 1 && (
          <nav aria-label="Páginas dos lançamentos" className="mt-4 flex items-center justify-between text-sm">
            {f.pagina > 1 ? (
              <Link href={link({ pagina: f.pagina - 1 })} className="font-medium text-primary underline-offset-2 hover:underline">
                ← Mais novos
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">
              Página {f.pagina} de {f.paginas}
            </span>
            {f.pagina < f.paginas ? (
              <Link href={link({ pagina: f.pagina + 1 })} className="font-medium text-primary underline-offset-2 hover:underline">
                Mais antigos →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
