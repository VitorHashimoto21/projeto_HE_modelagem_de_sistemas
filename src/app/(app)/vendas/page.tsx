import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Receipt } from "lucide-react";
import { GraficoDeBarras } from "@/components/graficos/barras";
import { AvisoDoHistorico } from "@/components/planos/avisos";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoCampo } from "@/components/ui/classes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao } from "@/components/ui/estilos";
import { Numero } from "@/components/ui/numero";
import { Segmentos } from "@/components/ui/segmentos";
import { Selo } from "@/components/ui/selo";
import { Superficie } from "@/components/ui/superficie";
import { brl, ROTULO_FORMA } from "@/components/vendas/rotulos";
import { exigirPermissao } from "@/lib/auth/servidor";
import { vendas } from "@/lib/db";
import { diaLocal, hoje as hojeLocal, intervaloDoDia } from "@/lib/dominio/datas";
import { diasEntre, somarDias } from "@/lib/dominio/estoque";
import { pode } from "@/lib/dominio/permissoes";
import { inicioDoHistorico, limitarDia } from "@/lib/dominio/planos";
import { planoDoMembro } from "@/lib/planos/servidor";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Vendas" };

const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const ehDia = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

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

// Histórico de vendas (SPEC-008, 5.4; redesenhado na SPEC-016): Vendas — ver.
export default async function Vendas({ searchParams }: PageProps<"/vendas">) {
  const membro = await exigirPermissao("vendas", "ver");
  const hoje = hojeLocal();
  const pedido = periodo(await searchParams, hoje);
  // Plano gratuito: histórico dos últimos 12 meses (SPEC-013, OPEN-005); datas anteriores vão ao limite.
  const inicio = inicioDoHistorico(await planoDoMembro(membro), hoje);
  const limDe = limitarDia(pedido.de, inicio);
  const limAte = limitarDia(pedido.ate, inicio);
  const { de, ate, chave } = { ...pedido, de: limDe.dia, ate: limAte.dia };
  const { vendas: lista, totalConcluidas } = await vendas(membro).listar(intervaloDoDia(de).inicio, intervaloDoDia(ate).fim);
  const concluidas = lista.filter((v) => v.status === "CONCLUIDA");

  // Gráfico por dia quando o período tem mais de um dia (SPEC-016, 5.5).
  const dias = diasEntre(de, ate) + 1;
  const porDia = new Map<string, number>();
  for (const v of concluidas) porDia.set(diaLocal(v.data), (porDia.get(diaLocal(v.data)) ?? 0) + Math.round(v.valorTotal * 100));
  const pontos =
    dias > 1 && dias <= 62
      ? Array.from({ length: dias }, (_, i) => somarDias(de, i)).map((d) => ({ chave: d, rotulo: diaCurto(d), valorCentavos: porDia.get(d) ?? 0, parcial: d === hoje }))
      : null;

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        titulo="Vendas"
        acoes={
          pode(membro.permissoes, "vendas", "criar") && (
            <Link href="/vendas/nova" className={classeDoBotao("principal")}>
              <Plus aria-hidden="true" />
              Nova venda
            </Link>
          )
        }
      />

      {(limDe.ajustado || limAte.ajustado) && <AvisoDoHistorico ehDono={membro.papel === "DONO"} />}

      <div className="flex flex-wrap items-end gap-3">
        <Segmentos rotulo="Período" itens={PERIODOS.map((p) => ({ href: `/vendas?periodo=${p.chave}`, rotulo: p.rotulo, ativo: chave === p.chave }))} />
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="de" className="mb-1 block text-xs text-muted-foreground">
              De
            </label>
            <input id="de" name="de" type="date" defaultValue={de} min={inicio ?? undefined} max={hoje} className={cn(classeDoCampo(), "h-11 py-0")} />
          </div>
          <div>
            <label htmlFor="ate" className="mb-1 block text-xs text-muted-foreground">
              Até
            </label>
            <input id="ate" name="ate" type="date" defaultValue={ate} min={inicio ?? undefined} max={hoje} className={cn(classeDoCampo(), "h-11 py-0")} />
          </div>
          <button type="submit" className={classeDoBotao("secundario")}>
            Ver período
          </button>
        </form>
      </div>

      <Superficie aria-label="Resumo do período">
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <Numero rotulo={`${concluidas.length} ${concluidas.length === 1 ? "venda" : "vendas"} no período`} valor={brl(totalConcluidas)} tamanho="lg" />
          {concluidas.length > 0 && <Numero rotulo="Média por venda" valor={brl(totalConcluidas / concluidas.length)} tamanho="md" />}
          {lista.length > concluidas.length && <Numero rotulo="Canceladas" valor={String(lista.length - concluidas.length)} tamanho="md" />}
        </div>
        {pontos && concluidas.length > 0 && (
          <div className="mt-6">
            <GraficoDeBarras pontos={pontos} descricao={`Vendas por dia de ${diaCurto(de)} a ${diaCurto(ate)}; total ${brl(totalConcluidas)}`} />
          </div>
        )}
      </Superficie>

      {lista.length === 0 ? (
        <Superficie>
          <EstadoVazio
            Icone={Receipt}
            titulo="Nenhuma venda neste período"
            acao={
              pode(membro.permissoes, "vendas", "criar") && (
                <Link href="/vendas/nova" className={classeDoBotao("principal")}>
                  Registrar uma venda
                </Link>
              )
            }
          >
            Escolha outro período acima ou registre uma venda.
          </EstadoVazio>
        </Superficie>
      ) : (
        <Superficie espaco="nenhum" aria-label="Vendas do período">
          {/* Computador: tabela; celular: lista. As mesmas informações nos dois (SPEC-016, 5.4). */}
          <table className="hidden w-full text-left text-sm md:table">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="px-6 py-3 font-medium">Venda</th>
                <th scope="col" className="px-3 py-3 font-medium">Quando</th>
                <th scope="col" className="px-3 py-3 font-medium">Pagamento</th>
                <th scope="col" className="px-3 py-3 font-medium">Registrada por</th>
                <th scope="col" className="px-6 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((v) => (
                <tr key={v.id} className="border-b last:border-b-0 hover:bg-muted/50">
                  <td className="px-6 py-3">
                    <Link href={`/vendas/${v.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">
                      Venda nº {v.numero}
                    </Link>
                    {v.status === "CANCELADA" && (
                      <Selo tom="neutro" className="ml-2">
                        Cancelada
                      </Selo>
                    )}
                    <span className="block text-xs text-muted-foreground">
                      {v.itens} {v.itens === 1 ? "item" : "itens"}
                      {v.cliente && `, ${v.cliente}`}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums">{quando.format(v.data)}</td>
                  <td className="px-3 py-3">{v.formas.map((f) => ROTULO_FORMA[f]).join(" + ")}</td>
                  <td className="px-3 py-3 text-muted-foreground">{v.registradaPor}</td>
                  <td className={cn("px-6 py-3 text-right font-bold tabular-nums", v.status === "CANCELADA" && "text-muted-foreground line-through")}>{brl(v.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y md:hidden">
            {lista.map((v) => (
              <li key={v.id}>
                <Link href={`/vendas/${v.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">
                      Venda nº {v.numero}
                      {v.status === "CANCELADA" && (
                        <Selo tom="neutro" className="ml-2">
                          Cancelada
                        </Selo>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {quando.format(v.data)}, {v.formas.map((f) => ROTULO_FORMA[f]).join(" + ")}
                    </p>
                  </div>
                  <p className={cn("font-bold tabular-nums", v.status === "CANCELADA" && "text-muted-foreground line-through")}>{brl(v.valorTotal)}</p>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Superficie>
      )}
    </div>
  );
}
