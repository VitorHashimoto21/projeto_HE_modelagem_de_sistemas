import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { ROTULO_CATEGORIA, rotuloUnidade } from "@/components/catalogo/rotulos";
import { FormularioMinimo } from "@/components/estoque/formularios";
import { quantidade, ROTULO_MOTIVO, ROTULO_MOVIMENTACAO, SeloDeSituacao } from "@/components/estoque/situacao";
import { AvisoDoHistorico } from "@/components/planos/avisos";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoBotao } from "@/components/ui/estilos";
import { Numero } from "@/components/ui/numero";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { estoque } from "@/lib/db";
import { ItemNaoEncontrado } from "@/lib/db/catalogo";
import { dataBrasileira, hoje } from "@/lib/dominio/datas";
import { diasEntre, JANELA_DIAS } from "@/lib/dominio/estoque";
import { pode } from "@/lib/dominio/permissoes";
import { inicioDoHistorico } from "@/lib/dominio/planos";
import { comRetorno, retornoSeguro, rotuloDoRetorno } from "@/lib/estrutura/retorno";
import { planoDoMembro } from "@/lib/planos/servidor";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Estoque do produto" };

const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

const DICA_SITUACAO = {
  SEM_ESTOQUE: "Sem estoque: reponha o quanto antes.",
  BAIXO: "Estoque baixo: o saldo chegou ao mínimo.",
  NORMAL: "Saldo acima do mínimo.",
  SEM_MINIMO: "Alerta ativado após a primeira entrada e saída, ou ao definir um mínimo manual.",
} as const;

// Detalhe do estoque (SPEC-007, 5.1–5.5): Estoque — ver; entrada/saída com "criar";
// mínimo manual com "editar".
export default async function EstoqueDoProduto({ params, searchParams }: PageProps<"/estoque/[id]">) {
  const membro = await exigirPermissao("estoque", "ver");
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  const dia = hoje();
  const pagina = Number(typeof busca.pagina === "string" ? busca.pagina : "1") || 1;
  // "Voltar" para a lista filtrada ou o item do Catálogo de onde a pessoa veio (correção da homologação T12).
  const voltar = retornoSeguro(busca.voltar, "/estoque");
  const retorno = voltar === "/estoque" ? null : voltar;
  // Plano gratuito: movimentações dos últimos 12 meses (SPEC-013, OPEN-005).
  const desde = inicioDoHistorico(await planoDoMembro(membro), dia);
  const d = await estoque(membro)
    .detalhar(id, dia, pagina, desde)
    .catch((e) => {
      if (e instanceof ItemNaoEncontrado) notFound();
      throw e;
    });
  const unidade = rotuloUnidade(d.unidadeMedida);
  const podeMovimentar = pode(membro.permissoes, "estoque", "criar");
  const podeEditarMinimo = pode(membro.permissoes, "estoque", "editar");
  const diasConsumo = d.consumoNaJanela.primeiroDia ? Math.min(JANELA_DIAS, diasEntre(d.consumoNaJanela.primeiroDia, dia) + 1) : 0;

  const minimo = d.minimo?.valor ?? null;
  // Régua do saldo: o mínimo fica no meio, para "quanto falta" e "quanto sobra" lerem igual.
  const escala = minimo ? Math.max(minimo * 2, d.saldo) : 0;
  const preenchido = escala ? Math.min(100, (Math.max(0, d.saldo) / escala) * 100) : 0;
  const marca = escala && minimo ? (minimo / escala) * 100 : 0;

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        voltar={{ href: voltar, rotulo: rotuloDoRetorno(voltar) }}
        titulo={d.nome}
        descricao={`${ROTULO_CATEGORIA[d.categoria]}${d.subcategoria ? ` › ${d.subcategoria.nome}` : ""}`}
        acoes={
          <Link href={comRetorno(`/catalogo/${d.id}`, `/estoque/${d.id}`)} className={classeDoBotao("secundario", "sm")}>
            Ver no Catálogo
          </Link>
        }
      />

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Resumo do estoque">
        <Superficie tom="estrutura" as="div">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Numero
              rotulo="Saldo"
              tamanho="xl"
              valor={
                <>
                  {quantidade(d.saldo)} <span className="text-lg font-semibold text-estrutura-suave">{unidade}</span>
                </>
              }
            />
            <SeloDeSituacao situacao={d.situacao} />
          </div>
          {minimo !== null && (
            <div className="mt-5" aria-hidden="true">
              <div className="relative h-2.5 rounded-full bg-estrutura-foreground/15">
                <div className="h-full rounded-full bg-estrutura-foreground" style={{ width: `${preenchido}%` }} />
                <div className="absolute -top-1 h-4.5 w-0.5 rounded-full bg-ambar" style={{ left: `${marca}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-estrutura-suave tabular-nums" style={{ paddingLeft: `max(0px, calc(${marca}% - 2.5rem))` }}>
                mínimo {quantidade(minimo)}
              </p>
            </div>
          )}
          <p className="mt-4 text-sm text-estrutura-suave">{DICA_SITUACAO[d.situacao]}</p>
          {podeMovimentar && (
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/estoque/${d.id}/entrada`} scroll={false} className={classeDoBotao("ambar")}>
                <Plus aria-hidden="true" />
                Registrar entrada
              </Link>
              <Link href={`/estoque/${d.id}/saida`} scroll={false} className={classeDoBotao("na-estrutura")}>
                <Minus aria-hidden="true" />
                Registrar saída
              </Link>
            </div>
          )}
        </Superficie>

        <Superficie as="div">
          <Numero
            rotulo="Estoque mínimo em uso"
            tamanho="lg"
            valor={
              <>
                {d.minimo ? quantidade(d.minimo.valor) : "—"}
                {d.minimo && <span className="ml-2 text-base font-semibold text-muted-foreground">{d.minimo.origem}</span>}
              </>
            }
          />
          <p className="mt-3 text-sm text-muted-foreground">
            {d.sugestao === null
              ? "Sugestão disponível após a primeira entrada e saída."
              : `Sugerido: ${d.sugestao} = consumo de ${quantidade(Math.max(0, d.consumoNaJanela.saidas - d.consumoNaJanela.estornos))} em ${diasConsumo} ${diasConsumo === 1 ? "dia" : "dias"} × ${d.diasCobertura} dias de cobertura, arredondado para cima.`}
            {d.minimoManual !== null && d.sugestao !== null && " O mínimo manual tem prioridade."}
          </p>
          {podeEditarMinimo && (
            <div className="mt-5 border-t pt-4">
              <p className="mb-1.5 text-sm font-medium text-foreground">Mínimo manual</p>
              <FormularioMinimo itemId={d.id} atual={d.minimoManual} />
            </div>
          )}
        </Superficie>
      </section>

      <Superficie aria-labelledby="titulo-movimentacoes">
        <TituloDaSuperficie id="titulo-movimentacoes" titulo="Movimentações" />
        {d.ocultasPeloPlano > 0 && (
          <div className="mb-3">
            <AvisoDoHistorico ehDono={membro.papel === "DONO"} />
          </div>
        )}
        {d.movimentacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação ainda. A primeira entrada já começa o histórico.</p>
        ) : (
          <ol className="divide-y">
            {d.movimentacoes.map((m) => {
              const entrada = m.tipo === "ENTRADA" || m.tipo === "ENTRADA_ESTORNO";
              const registradoNoDia = dataBrasileira(m.registradoEm) === dataBrasileira(m.data);
              const Icone = entrada ? ArrowDownLeft : ArrowUpRight;
              return (
                <li key={m.id} className="flex items-start gap-3 py-3 text-sm">
                  <span
                    aria-hidden="true"
                    className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", entrada ? "bg-status-ok-bg text-status-ok" : "bg-muted text-muted-foreground")}
                  >
                    <Icone className="size-4" strokeWidth={2.4} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <p>
                        <span className={cn("font-extrabold tabular-nums", entrada ? "text-status-ok" : "text-foreground")}>
                          {entrada ? "+" : "−"}
                          {quantidade(m.quantidade)}
                        </span>
                        <span className="ml-2 font-semibold text-foreground">
                          {ROTULO_MOVIMENTACAO[m.tipo]}
                          {m.motivo && `, ${ROTULO_MOTIVO[m.motivo].toLowerCase()}`}
                        </span>
                        <span className="ml-2 text-muted-foreground tabular-nums">
                          {quantidade(m.saldoAnterior)} → {quantidade(m.saldoPosterior)}
                        </span>
                      </p>
                      {m.observacao && <p className="text-xs break-words text-muted-foreground">{m.observacao}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {m.usuario}, {registradoNoDia ? quando.format(m.registradoEm) : `ocorrida em ${dataBrasileira(m.data)}, registrada ${quando.format(m.registradoEm)}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {d.paginas > 1 && (
          <nav aria-label="Páginas das movimentações" className="mt-4 flex items-center justify-between gap-2 border-t pt-4 text-sm">
            {d.pagina > 1 ? (
              <Link href={comRetorno(`/estoque/${d.id}?pagina=${d.pagina - 1}`, retorno)} className={classeDoBotao("fantasma", "sm")}>
                <ChevronLeft aria-hidden="true" />
                Mais novas
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">
              Página {d.pagina} de {d.paginas}
            </span>
            {d.pagina < d.paginas ? (
              <Link href={comRetorno(`/estoque/${d.id}?pagina=${d.pagina + 1}`, retorno)} className={classeDoBotao("fantasma", "sm")}>
                Mais antigas
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
