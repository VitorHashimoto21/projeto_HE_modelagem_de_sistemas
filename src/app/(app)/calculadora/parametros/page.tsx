import type { Metadata } from "next";
import Link from "next/link";
import { FormularioParametros } from "@/components/calculadora/formularios";
import { exigirPermissao } from "@/lib/auth/servidor";
import { precificacao } from "@/lib/db";
import { pode } from "@/lib/dominio/permissoes";
import { reaisDeCentavos } from "@/lib/dominio/venda";

export const metadata: Metadata = { title: "Parâmetros de precificação" };

const decimal = (n: number | null) => (n === null ? "" : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
const dinheiro = (c: number | null) => (c === null ? "" : (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-3 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="font-medium text-foreground">{valor || "—"}</dd>
    </div>
  );
}

// Parâmetros de precificação (SPEC-010, 5.5; UC16; OPEN-002): Calculadora — ver para consultar;
// "editar" para alterar.
export default async function Parametros() {
  const membro = await exigirPermissao("calculadora", "ver");
  const p = await precificacao(membro).parametros();
  const atuais = {
    taxaCartao: decimal(p.taxaCartao),
    capacidadeMensal: decimal(p.capacidadeMensal),
    unidadeCapacidade: p.unidadeCapacidade ?? "",
    ticketMedio: dinheiro(p.ticketMedioCentavos),
    faturamentoEstimado: dinheiro(p.faturamentoEstimadoCentavos),
    cmvEstimado: decimal(p.cmvEstimado),
    margemMeta: decimal(p.margemMeta),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href="/calculadora" className="font-medium text-primary underline-offset-2 hover:underline">
            ← Calculadora
          </Link>
        </p>
        <h1 className="font-display text-3xl font-semibold text-foreground">Parâmetros de precificação</h1>
        <p className="text-sm text-muted-foreground">
          Valem para todos os preços do negócio. As despesas fixas vêm do{" "}
          <Link href="/financeiro/despesas-fixas" className="font-medium text-primary underline-offset-2 hover:underline">
            Financeiro
          </Link>
          , e o regime e o imposto, dos dados do negócio.
        </p>
      </div>
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        {pode(membro.permissoes, "calculadora", "editar") ? (
          <FormularioParametros atuais={atuais} />
        ) : (
          <dl>
            <Linha rotulo="Taxa média da maquininha" valor={atuais.taxaCartao && `${atuais.taxaCartao}%`} />
            <Linha rotulo="Capacidade por mês" valor={[atuais.capacidadeMensal, atuais.unidadeCapacidade].filter(Boolean).join(" ")} />
            <Linha rotulo="Ticket médio" valor={p.ticketMedioCentavos === null ? "" : reaisDeCentavos(p.ticketMedioCentavos)} />
            <Linha rotulo="Faturamento mensal estimado" valor={p.faturamentoEstimadoCentavos === null ? "" : reaisDeCentavos(p.faturamentoEstimadoCentavos)} />
            <Linha rotulo="CMV% estimado" valor={atuais.cmvEstimado && `${atuais.cmvEstimado}%`} />
            <Linha rotulo="Margem de lucro desejada" valor={atuais.margemMeta && `${atuais.margemMeta}%`} />
          </dl>
        )}
      </section>
    </div>
  );
}
