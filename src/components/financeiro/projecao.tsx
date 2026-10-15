import Link from "next/link";
import { Legenda, TabelaDeValores } from "@/components/graficos/comuns";
import { GraficoDeProjecao } from "@/components/graficos/projecao";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { MENSAGENS_DASHBOARD } from "@/lib/dashboard/servicos";
import type { Projecao } from "@/lib/dominio/dashboard";
import { reaisDeCentavos as reais } from "@/lib/dominio/venda";

// "Caixa nos próximos meses" (SPEC-012, RF68; SPEC-016, 5.5): o mesmo cartão no Painel e no
// Financeiro, a partir da mesma projeção.

const NOMES_DOS_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const mesPorExtenso = (comp: string) => NOMES_DOS_MESES[Number(comp.slice(5, 7)) - 1];

export function ProjecaoDoCaixa({ dados, className }: { dados: Projecao; className?: string }) {
  return (
    <Superficie aria-labelledby="titulo-projecao" className={className}>
      <TituloDaSuperficie id="titulo-projecao" titulo="Caixa nos próximos meses" descricao={MENSAGENS_DASHBOARD.rodapeProjecao} />
      <GraficoDeProjecao
        meses={dados.meses.map((m) => ({
          chave: m.competencia,
          nome: mesPorExtenso(m.competencia).replace(/^./, (c) => c.toUpperCase()),
          curto: mesPorExtenso(m.competencia).slice(0, 3),
          entradasCentavos: m.entradasCentavos,
          saidasCentavos: m.saidasCentavos,
          saldoCentavos: m.saldoProjetadoCentavos,
        }))}
        descricao="Entradas previstas acima e saídas abaixo da linha do zero, com o saldo previsto em linha"
      />
      <Legenda
        className="mt-2"
        itens={[
          { rotulo: "Entradas previstas", marca: "barra", cor: "var(--chart-1)" },
          { rotulo: "Saídas previstas", marca: "barra", cor: "var(--chart-2)" },
          { rotulo: "Saldo previsto", marca: "linha" },
        ]}
      />
      {dados.atrasadas.quantidade > 0 && (
        <AvisoDaPagina tom="atencao" className="mt-3">
          {dados.atrasadas.quantidade} {dados.atrasadas.quantidade === 1 ? "conta atrasada entra" : "contas atrasadas entram"} no mês atual
          {dados.atrasadas.entradasCentavos > 0 && `, ${reais(dados.atrasadas.entradasCentavos)} a receber`}
          {dados.atrasadas.saidasCentavos > 0 && `, ${reais(dados.atrasadas.saidasCentavos)} a pagar`}.{" "}
          <Link href={`/financeiro/contas?tipo=${dados.atrasadas.saidasCentavos > 0 ? "PAGAR" : "RECEBER"}&situacao=atrasadas`}>Ver as contas</Link>
        </AvisoDaPagina>
      )}
      <TabelaDeValores
        className="mt-3"
        legenda="Caixa previsto por mês"
        colunas={["Mês", "Entradas", "Saídas", "Saldo previsto"]}
        linhas={dados.meses.map((m) => [mesPorExtenso(m.competencia), reais(m.entradasCentavos), reais(m.saidasCentavos), reais(m.saldoProjetadoCentavos)])}
      />
    </Superficie>
  );
}
