import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Receipt } from "lucide-react";
import { CabecalhoDoFinanceiro, reais, ROTULO_CATEGORIA, SeloDaConta } from "@/components/financeiro/exibicao";
import { AvisoDoHistorico } from "@/components/planos/avisos";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao } from "@/components/ui/estilos";
import { Segmentos } from "@/components/ui/segmentos";
import { Superficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { financeiro } from "@/lib/db";
import type { SituacaoFiltrada } from "@/lib/db/financeiro";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";
import { inicioDoHistorico } from "@/lib/dominio/planos";
import { planoDoMembro } from "@/lib/planos/servidor";
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
  // Plano gratuito: quitadas e canceladas só dos últimos 12 meses (SPEC-013, OPEN-005).
  const desde = inicioDoHistorico(await planoDoMembro(membro), dia);
  const r = await financeiro(membro).listarContas({ tipo, situacao, pagina, desde }, dia);
  const link = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams({ tipo, situacao, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) });
    return `/financeiro/contas?${p}`;
  };

  return (
    <div className="space-y-6">
      <CabecalhoDoFinanceiro
        atual="contas"
        titulo="Contas"
        acoes={
          pode(membro.permissoes, "financeiro", "criar") && (
            <Link href={`/financeiro/contas/nova?tipo=${tipo}`} scroll={false} className={classeDoBotao("principal")}>
              <Plus aria-hidden="true" />
              Nova conta
            </Link>
          )
        }
      />

      {r.ocultasPeloPlano > 0 && <AvisoDoHistorico ehDono={membro.papel === "DONO"} />}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmentos
          rotulo="Tipo de conta"
          itens={(["PAGAR", "RECEBER"] as const).map((t) => ({ href: `/financeiro/contas?tipo=${t}&situacao=${situacao}`, rotulo: t === "PAGAR" ? "A pagar" : "A receber", ativo: t === tipo }))}
        />
        <Segmentos
          rotulo="Situação"
          itens={SITUACOES.map(([s, rotulo]) => ({
            href: `/financeiro/contas?tipo=${tipo}&situacao=${s}`,
            rotulo: s === "atrasadas" && r.atrasadas > 0 ? `${rotulo} (${r.atrasadas})` : rotulo,
            ativo: s === situacao,
          }))}
        />
      </div>

      {r.atrasadas > 0 && situacao !== "atrasadas" && (
        <AvisoDaPagina tom="erro">
          {r.atrasadas} {r.atrasadas === 1 ? "conta atrasada" : "contas atrasadas"} {tipo === "PAGAR" ? "a pagar" : "a receber"}. <Link href={`/financeiro/contas?tipo=${tipo}&situacao=atrasadas`}>Ver quais</Link>
        </AvisoDaPagina>
      )}

      {r.contas.length === 0 ? (
        <Superficie>
          <EstadoVazio Icone={Receipt} titulo="Nenhuma conta nesta situação">
            {situacao === "abertas" ? `Nada ${tipo === "PAGAR" ? "a pagar" : "a receber"} em aberto.` : "Escolha outra situação acima."}
          </EstadoVazio>
        </Superficie>
      ) : (
        <Superficie espaco="nenhum" aria-label="Lista de contas" className="overflow-hidden">
          <ul className="divide-y">
            {r.contas.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/financeiro/contas/${c.id}`}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3.5 transition-colors duration-(--duracao-estado) hover:bg-accent focus-visible:bg-accent focus-visible:outline-none sm:gap-4 sm:px-5",
                    c.atrasada && "shadow-[inset_3px_0_0_var(--status-danger)]",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold break-words text-foreground">{c.descricao ?? "Conta"}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence em {dataBr(c.vencimento)}, {ROTULO_CATEGORIA[c.categoria].toLowerCase()}, {ORIGEM[c.origem].toLowerCase()}
                    </p>
                    <div className="mt-1.5">
                      <SeloDaConta tipo={c.tipo} status={c.status} atrasada={c.atrasada} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-extrabold text-foreground tabular-nums">{reais(c.totalCentavos)}</p>
                    {c.status === "PARCIAL" && <p className="text-xs text-muted-foreground tabular-nums">Restam {reais(c.restanteCentavos)}</p>}
                  </div>
                  <ChevronRight aria-hidden="true" className="mt-1 hidden size-4 shrink-0 text-muted-foreground sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        </Superficie>
      )}

      {r.paginas > 1 && (
        <nav aria-label="Páginas das contas" className="flex items-center justify-between gap-2 text-sm">
          {r.pagina > 1 ? (
            <Link href={link({ pagina: r.pagina - 1 })} className={classeDoBotao("fantasma", "sm")}>
              <ChevronLeft aria-hidden="true" />
              Anteriores
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Página {r.pagina} de {r.paginas}
          </span>
          {r.pagina < r.paginas ? (
            <Link href={link({ pagina: r.pagina + 1 })} className={classeDoBotao("fantasma", "sm")}>
              Próximas
              <ChevronRight aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
