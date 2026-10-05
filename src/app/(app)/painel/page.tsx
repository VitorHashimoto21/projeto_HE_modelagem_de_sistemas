import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ROTULO_ANEXO, ROTULO_ATIVIDADE_MEI, ROTULO_REGIME } from "@/components/negocio/rotulos";
import { exigirNegocio } from "@/lib/auth/servidor";
import { negocios } from "@/lib/db";
import { formatarCnpj } from "@/lib/dominio/cnpj";
import { MENSAGENS_ENQUADRAMENTO } from "@/lib/negocio/enquadramento";

export const metadata: Metadata = { title: "Painel" };

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b py-3 last:border-b-0 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm font-medium break-words text-foreground sm:text-right">{valor}</dd>
    </div>
  );
}

// Página inicial do negócio ativo (SPEC-004, escopo 7) — provisória: o Dashboard da
// SPEC-012 a substitui. Sem negócio ativo válido, exigirNegocio leva a "Meus negócios".
export default async function Painel({ searchParams }: PageProps<"/painel">) {
  const { negocioId, usuarioId } = await exigirNegocio();
  const [n, papel, { salvo }] = await Promise.all([
    negocios().dadosFiscais(negocioId),
    negocios().papel(usuarioId!, negocioId),
    searchParams,
  ]);
  if (!n) notFound();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Painel</p>
        <h1 className="font-display text-3xl font-semibold break-words text-foreground">{n.nome}</h1>
      </div>

      {salvo && (
        <p role="status" className="rounded-xl border border-status-ok/30 bg-status-ok-bg px-4 py-3 text-sm text-status-ok">
          Dados do negócio salvos.
        </p>
      )}

      <section className="rounded-2xl border bg-card p-6 shadow-sm" aria-labelledby="titulo-enquadramento">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-enquadramento" className="font-display text-xl font-semibold text-card-foreground">
            Enquadramento fiscal
          </h2>
          {papel === "DONO" && (
            <Link href="/negocio/dados" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
              Editar dados do negócio
            </Link>
          )}
        </div>
        <dl>
          <Linha rotulo="Regime" valor={ROTULO_REGIME[n.regime]} />
          {n.cnpj && <Linha rotulo="CNPJ" valor={formatarCnpj(n.cnpj)} />}
          {n.razaoSocial && <Linha rotulo="Razão social" valor={n.razaoSocial} />}
          {n.cnaePrincipal && <Linha rotulo="CNAE principal" valor={n.cnaePrincipal} />}
          {n.atividadeMei && <Linha rotulo="Atividade do MEI" valor={ROTULO_ATIVIDADE_MEI[n.atividadeMei]} />}
          {n.anexoSimples && <Linha rotulo="Anexo" valor={ROTULO_ANEXO[n.anexoSimples]} />}
          {n.regime === "SIMPLES_NACIONAL" && <Linha rotulo="Sujeito ao Fator R" valor={n.sujeitoFatorR ? "Sim" : "Não"} />}
          {n.impostoPercentualManual !== null && (
            <Linha rotulo="Imposto informado" valor={`${n.impostoPercentualManual.toLocaleString("pt-BR")}%`} />
          )}
        </dl>
        {n.regime === "SIMPLES_NACIONAL" && <p className="mt-4 text-xs text-muted-foreground">{MENSAGENS_ENQUADRAMENTO.anexoUnico}</p>}
      </section>

      <p className="text-sm text-muted-foreground">
        Estoque, vendas, financeiro e a calculadora de preços chegam nas próximas etapas do sistema.
      </p>
    </div>
  );
}
