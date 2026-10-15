import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { CabecalhoDoFinanceiro, reais, ROTULO_CATEGORIA } from "@/components/financeiro/exibicao";
import { FormularioDespesa } from "@/components/financeiro/formularios";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Numero } from "@/components/ui/numero";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { financeiro } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";
import { conferirFinanceiro } from "@/lib/financeiro/conferencia";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Despesas fixas" };

// Despesas fixas (SPEC-009, 5.5 e 5.6): Financeiro — ver; nova com "criar"; editar e
// ativar/desativar com "editar". O DAS do MEI aparece sozinho para negócio MEI.
export default async function DespesasFixas() {
  const membro = await exigirPermissao("financeiro", "ver");
  const dia = hoje();
  await conferirFinanceiro(membro);
  const f = financeiro(membro);
  const [despesas, das] = await Promise.all([f.listarDespesas(), f.dasVigente(dia)]);
  const ativas = despesas.filter((d) => d.ativo);
  const totalMensal = ativas.reduce((s, d) => s + (d.valorCentavos ?? (d.origem === "DAS_MEI" ? (das ?? 0) : 0)), 0);
  const podeEditar = pode(membro.permissoes, "financeiro", "editar");

  const valorDe = (d: (typeof despesas)[number]) => d.valorCentavos ?? (d.origem === "DAS_MEI" ? (das ?? 0) : 0);

  return (
    <div className="space-y-6">
      <CabecalhoDoFinanceiro atual="despesas" titulo="Despesas fixas" />

      <Superficie tom="estrutura" aria-label="Total mensal">
        <Numero rotulo="Total por mês das despesas ativas" tamanho="xl" valor={reais(totalMensal)} />
        <p className="mt-3 max-w-2xl text-sm text-estrutura-suave">
          Cada despesa ativa gera uma conta a pagar por mês, com o vencimento no dia escolhido. Mudar o valor vale para os próximos meses.
        </p>
      </Superficie>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <Superficie espaco="nenhum" aria-labelledby="titulo-lista" className="min-w-0 flex-1 overflow-hidden">
          <h2 id="titulo-lista" className="px-5 pt-5 pb-3 text-[17px] font-bold text-card-foreground sm:px-6 sm:pt-6">
            Cadastradas
          </h2>
          {despesas.length === 0 ? (
            <EstadoVazio Icone={CalendarClock} titulo="Nenhuma despesa fixa ainda">
              Cadastre o aluguel, a internet e os salários: eles entram no preço de venda e na projeção do caixa.
            </EstadoVazio>
          ) : (
            <ul className="divide-y border-t">
              {despesas.map((d) => {
                const parte = d.ativo && totalMensal > 0 ? Math.round((valorDe(d) / totalMensal) * 100) : 0;
                const conteudo = (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[15px] font-bold break-words", d.ativo ? "text-foreground" : "text-muted-foreground")}>{d.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        Todo dia {d.diaVencimento}, {ROTULO_CATEGORIA[d.categoria].toLowerCase()}
                        {d.origem === "DAS_MEI" && ", automático (MEI)"}
                        {!d.ativo && ", desativada"}
                      </p>
                      {d.ativo && (
                        <div className="mt-2 flex items-center gap-2" aria-hidden="true">
                          <div className="h-1.5 max-w-48 flex-1 rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${parte}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">{parte}%</span>
                        </div>
                      )}
                    </div>
                    <p className="text-right text-[15px] font-extrabold text-foreground tabular-nums">
                      {d.valorCentavos !== null ? reais(d.valorCentavos) : das !== null ? reais(das) : "—"}
                      {d.origem === "DAS_MEI" && <span className="block text-xs font-normal text-muted-foreground">valor oficial vigente</span>}
                    </p>
                  </>
                );
                return (
                  <li key={d.id}>
                    {podeEditar ? (
                      <Link
                        href={`/financeiro/despesas-fixas/${d.id}`}
                        className="flex items-start gap-4 px-5 py-3.5 transition-colors duration-(--duracao-estado) hover:bg-accent focus-visible:bg-accent focus-visible:outline-none sm:px-6"
                      >
                        {conteudo}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-4 px-5 py-3.5 sm:px-6">{conteudo}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Superficie>

        {pode(membro.permissoes, "financeiro", "criar") && (
          <aside className="w-full lg:sticky lg:top-6 lg:w-96">
            <Superficie aria-labelledby="titulo-nova">
              <TituloDaSuperficie id="titulo-nova" titulo="Nova despesa fixa" />
              <FormularioDespesa />
            </Superficie>
          </aside>
        )}
      </div>
    </div>
  );
}
