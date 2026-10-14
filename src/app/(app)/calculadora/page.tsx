import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, SlidersHorizontal } from "lucide-react";
import { FormularioConfirmacao } from "@/components/calculadora/formularios";
import { ROTULO_REGIME } from "@/components/negocio/rotulos";
import { BarraEmpilhada } from "@/components/graficos/barras-de-parte";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao, classeDoLink } from "@/components/ui/estilos";
import { Numero } from "@/components/ui/numero";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { dependenciasDaCalculadora } from "@/lib/calculadora/servidor";
import { analisarNegocio, calcular, type BaseDoNegocio, type Fonte, type MotivoDoBloqueio } from "@/lib/calculadora/servicos";
import { validarOpcoes } from "@/lib/calculadora/validacao";
import { duasCasas } from "@/lib/dominio/precificacao";
import { pode } from "@/lib/dominio/permissoes";
import { reaisDeCentavos as reais } from "@/lib/dominio/venda";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calculadora" };

const pct = (n: number) => `${duasCasas(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const dataBr = (dia: string) => dia.split("-").reverse().join("/");
const fonte = (f: Fonte | null) => (f ? `${f.fonteLegal}, vigente desde ${dataBr(f.vigenteDesde)}` : null);

const ORIGEM_FATURAMENTO = {
  real: "vendas dos últimos 12 meses",
  proporcional: "média dos meses com histórico × 12",
  estimado: "faturamento estimado × 12 (ainda sem vendas nos meses anteriores)",
  "sem-dados": "",
} as const;

/** Para onde levar cada bloqueio. */
const CORRECAO: Partial<Record<MotivoDoBloqueio, { href: string; texto: string }>> = {
  "sem-faturamento": { href: "/calculadora/parametros", texto: "Abrir os parâmetros de precificação" },
  "imposto-nao-informado": { href: "/negocio/dados", texto: "Abrir os dados do negócio" },
  "anexo-nao-informado": { href: "/negocio/dados", texto: "Abrir os dados do negócio" },
  "atividade-mei-nao-informada": { href: "/negocio/dados", texto: "Abrir os dados do negócio" },
  "acima-do-simples": { href: "/negocio/dados", texto: "Abrir os dados do negócio" },
  inviavel: { href: "/financeiro/despesas-fixas", texto: "Revisar as despesas fixas" },
};

function Linha({ rotulo, valor, detalhe, forte }: { rotulo: string; valor: React.ReactNode; detalhe?: React.ReactNode; forte?: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 border-b py-3 last:border-b-0">
      <dt className={`text-sm ${forte ? "font-semibold text-foreground" : "text-foreground"}`}>{rotulo}</dt>
      <dd className={`text-right text-sm tabular-nums ${forte ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>{valor}</dd>
      {detalhe && <p className="col-span-2 text-xs break-words text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

function Bloqueio({ motivo, mensagem }: { motivo: MotivoDoBloqueio; mensagem: string }) {
  const c = CORRECAO[motivo];
  return (
    <AvisoDaPagina tom="erro">
      <p className="font-semibold">{mensagem}</p>
      {c && (
        <p className="mt-1">
          <Link href={c.href}>{c.texto}</Link>
        </p>
      )}
    </AvisoDaPagina>
  );
}

/** Linhas do negócio, comuns ao preço e ao ponto de equilíbrio. */
function LinhasDoNegocio({ base }: { base: BaseDoNegocio }) {
  return (
    <>
      <Linha rotulo="Faturamento médio mensal" valor={reais(base.faturamentoMedioCentavos)} detalhe={`RBT12 ${reais(base.rbt12.rbt12Centavos)}: ${ORIGEM_FATURAMENTO[base.rbt12.origem]}${base.rbt12.origem === "proporcional" ? ` (${base.rbt12.mesesConsiderados} ${base.rbt12.mesesConsiderados === 1 ? "mês" : "meses"})` : ""}.`} />
      <Linha
        rotulo="Despesas fixas por mês"
        valor={reais(base.despesasFixas.totalCentavos)}
        detalhe={
          base.despesasFixas.dasCentavos !== null
            ? `Cadastradas ${reais(base.despesasFixas.manuaisCentavos)} + DAS do MEI ${reais(base.despesasFixas.dasCentavos)} (${fonte(base.despesasFixas.dasFonte)}).`
            : "Despesas fixas ativas cadastradas no Financeiro."
        }
      />
    </>
  );
}

// Calculadora de precificação (SPEC-010, 5.1–5.4): Calculadora — ver; confirmar o preço com
// "criar"; parâmetros com "editar". O cálculo acontece aqui, no servidor, a cada consulta.
export default async function Calculadora({ searchParams }: PageProps<"/calculadora">) {
  const membro = await exigirPermissao("calculadora", "ver");
  const busca = await searchParams;
  const deps = dependenciasDaCalculadora(membro);
  const campos = { margem: typeof busca.margem === "string" ? busca.margem : "", comissao: typeof busca.comissao === "string" ? busca.comissao : "" };
  const opcoes = validarOpcoes(campos);
  const itemId = typeof busca.item === "string" ? busca.item : "";

  const [itens, analise, resultado] = await Promise.all([
    deps.precificacao.itens(),
    analisarNegocio(deps),
    itemId && opcoes.ok ? calcular(itemId, opcoes.dados, deps) : Promise.resolve(null),
  ]);
  const podeConfirmar = pode(membro.permissoes, "calculadora", "criar");
  const base = analise.status === "ok" ? analise.base : null;

  // Composição do preço sugerido (SPEC-016, 5.5): as mesmas parcelas do cálculo, em reais.
  const composicao =
    resultado?.status === "ok"
      ? (() => {
          const parte = (percentual: number) => Math.round((resultado.precoCentavos * percentual) / 100);
          const fixas = parte(resultado.despesasFixasPercentual);
          const variaveis = parte(resultado.despesasVariaveis);
          const imposto = parte(resultado.base.imposto.percentual);
          const margem = parte(resultado.margem.percentual);
          return [
            { nome: "Custo do item", valorCentavos: Math.max(0, resultado.precoCentavos - fixas - variaveis - imposto - margem) },
            { nome: "Despesas fixas", valorCentavos: fixas },
            { nome: "Maquininha e comissão", valorCentavos: variaveis },
            { nome: "Imposto", valorCentavos: imposto },
            { nome: "Margem (fica para você)", valorCentavos: margem },
          ];
        })()
      : null;

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        titulo="Preço de venda"
        descricao={base ? `Regime: ${ROTULO_REGIME[base.regime]}${base.imposto.anexoEfetivo ? `, Anexo ${base.imposto.anexoEfetivo}` : ""}.` : "Calcule o preço de um item a partir dos custos, das despesas e dos impostos."}
        acoes={
          <Link href="/calculadora/parametros" className={classeDoBotao("secundario", "sm")}>
            <SlidersHorizontal aria-hidden="true" />
            Parâmetros de precificação
          </Link>
        }
      />

      {base?.avisoAnexo && <AvisoDaPagina tom="atencao">{base.avisoAnexo}</AvisoDaPagina>}
      {base?.limiteMei?.acima && (
        <AvisoDaPagina tom="atencao">
          O faturamento dos últimos 12 meses ({reais(base.rbt12.rbt12Centavos)}) passou do limite do MEI ({reais(base.limiteMei.limiteCentavos)} por ano). Procure o seu contador sobre o
          desenquadramento.
        </AvisoDaPagina>
      )}

      <Superficie aria-labelledby="titulo-item">
        <TituloDaSuperficie
          id="titulo-item"
          titulo="Calcular o preço de um item"
          descricao="Deixe a margem vazia para usar a sugerida para a categoria. A margem é o que sobra para você em cada venda, depois de custos, despesas e impostos; não é o lucro total do negócio."
        />
        <form action="/calculadora" className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <div className="min-w-0">
            <label htmlFor="item" className="mb-1.5 block text-sm font-medium text-foreground">
              Item
            </label>
            <select id="item" name="item" defaultValue={itemId} className={classeDoCampo()}>
              <option value="">Selecione…</option>
              {itens.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                  {i.precoAtualCentavos !== null ? `, hoje ${reais(i.precoAtualCentavos)}` : ", sem preço"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="margem" className="mb-1.5 block text-sm font-medium text-foreground">
              Margem (%)
            </label>
            <input id="margem" name="margem" inputMode="decimal" defaultValue={campos.margem} placeholder="Sugerida" className={classeDoCampo(opcoes.ok ? undefined : opcoes.erros.margem)} />
          </div>
          <div>
            <label htmlFor="comissao" className="mb-1.5 block text-sm font-medium text-foreground">
              Comissão (%)
            </label>
            <input id="comissao" name="comissao" inputMode="decimal" defaultValue={campos.comissao} placeholder="A do item" className={classeDoCampo(opcoes.ok ? undefined : opcoes.erros.comissao)} />
          </div>
          <button type="submit" className={classeDoBotao("principal", "md", "h-[46px]")}>
            <Calculator aria-hidden="true" />
            Calcular
          </button>
        </form>
        {!opcoes.ok && <p className="mt-2 text-xs text-status-danger">{Object.values(opcoes.erros).join(" ")}</p>}
      </Superficie>

      {resultado?.status === "bloqueado" && <Bloqueio motivo={resultado.motivo} mensagem={resultado.mensagem} />}

      {resultado?.status === "ok" && (
        <section aria-labelledby="titulo-resultado" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
          <div className="flex flex-col gap-4">
            <Superficie tom="estrutura" as="div">
              <h2 id="titulo-resultado" className="text-sm break-words text-estrutura-suave">
                Preço sugerido para <span className="font-bold text-estrutura-foreground">{resultado.item.nome}</span>
              </h2>
              <p className="mt-2 text-[44px] leading-none font-extrabold tracking-tight tabular-nums">{reais(resultado.precoCentavos)}</p>
              <p className="mt-3 text-sm text-estrutura-suave">
                {resultado.item.precoAtualCentavos === null
                  ? "O item ainda não tem preço oficial."
                  : `Preço atual: ${reais(resultado.item.precoAtualCentavos)} (${resultado.precoCentavos >= resultado.item.precoAtualCentavos ? "+" : "−"}${reais(Math.abs(resultado.precoCentavos - resultado.item.precoAtualCentavos))}).`}
              </p>
            </Superficie>
            {resultado.comissao.simulada ? (
              <AvisoDaPagina tom="atencao">
                Simulação com comissão de {pct(resultado.comissao.percentual)}; a do item é {pct(resultado.comissao.doItem)}. Para confirmar com outra comissão, altere-a no Catálogo.
              </AvisoDaPagina>
            ) : podeConfirmar ? (
              <Superficie aria-label="Confirmar o preço">
                <FormularioConfirmacao itemId={resultado.item.id} margem={campos.margem} precoCentavos={resultado.precoCentavos} arredondadoCentavos={resultado.arredondadoCentavos} />
              </Superficie>
            ) : (
              <p className="px-1 text-xs text-muted-foreground">Você pode simular, mas confirmar o preço exige a permissão de criar na Calculadora.</p>
            )}
            {composicao && (
              <Superficie aria-labelledby="titulo-composicao">
                <TituloDaSuperficie id="titulo-composicao" titulo="Para onde vai cada venda" descricao={`Como os ${reais(resultado.precoCentavos)} se dividem.`} />
                <BarraEmpilhada
                  itens={composicao}
                  descricao={`Composição do preço de ${reais(resultado.precoCentavos)}: ${composicao.map((c) => `${c.nome} ${reais(c.valorCentavos)}`).join(", ")}`}
                />
              </Superficie>
            )}
          </div>

          <Superficie aria-labelledby="titulo-calculo">
            <TituloDaSuperficie id="titulo-calculo" titulo="Como o preço foi calculado" />
            <dl>
              <Linha
                rotulo="Custo total"
                valor={reais(resultado.item.custoTotalCentavos)}
                detalhe={
                  resultado.item.materiais.length
                    ? `Custo do item ${reais(resultado.item.custoBaseCentavos)} + materiais: ${resultado.item.materiais.map((m) => `${m.nome} ${m.quantidade.toLocaleString("pt-BR")} × ${reais(m.custoCentavos)}`).join("; ")}.`
                    : undefined
                }
              />
              <LinhasDoNegocio base={resultado.base} />
              <Linha rotulo="Despesas fixas" valor={pct(resultado.despesasFixasPercentual)} detalhe="Despesas fixas por mês ÷ faturamento médio mensal." />
              <Linha rotulo="Despesas variáveis" valor={pct(resultado.despesasVariaveis)} detalhe={`Taxa da maquininha ${pct(resultado.base.taxaCartao)} + comissão ${pct(resultado.comissao.percentual)}.`} />
              <Linha
                rotulo="Imposto"
                valor={pct(resultado.base.imposto.percentual)}
                detalhe={
                  resultado.base.regime === "MEI"
                    ? "MEI: o DAS já está nas despesas fixas."
                    : resultado.base.regime === "AUTONOMO"
                      ? "Percentual informado nos dados do negócio."
                      : `Alíquota efetiva do Anexo ${resultado.base.imposto.anexoEfetivo}, ${resultado.base.imposto.faixa}ª faixa${resultado.base.imposto.fatorR !== null ? `; Fator R ${pct(resultado.base.imposto.fatorR)}` : ""}. ${fonte(resultado.base.imposto.fonte)}.`
                }
              />
              <Linha rotulo="Margem" valor={pct(resultado.margem.percentual)} detalhe={`Sugerida para a categoria: ${pct(resultado.margem.sugerida)} (${fonte(resultado.margem.fonte)}).`} />
              <Linha rotulo="Soma dos percentuais" valor={pct(resultado.soma)} detalhe="Precisa ficar abaixo de 100%." />
              <Linha forte rotulo="Preço = custo ÷ (1 − soma)" valor={reais(resultado.precoCentavos)} detalhe="Arredondado para cima ao centavo." />
            </dl>
          </Superficie>
        </section>
      )}

      <Superficie aria-labelledby="titulo-negocio">
        <TituloDaSuperficie id="titulo-negocio" titulo="Seu negócio no mês" />
        {analise.status === "bloqueado" ? (
          <Bloqueio motivo={analise.motivo} mensagem={analise.mensagem} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={cn("rounded-lg p-4", analise.abaixoDoEquilibrio ? "bg-status-danger-bg" : "bg-muted")}>
                <Numero
                  tamanho="md"
                  rotulo="Ponto de equilíbrio"
                  valor={analise.pontoDeEquilibrioCentavos === null ? "—" : reais(analise.pontoDeEquilibrioCentavos)}
                  detalhe="Faturamento mínimo para pagar todas as despesas."
                />
              </div>
              <div className="rounded-lg bg-muted p-4">
                <Numero
                  tamanho="md"
                  rotulo="Faturamento meta"
                  valor={analise.metaCentavos === null ? "—" : reais(analise.metaCentavos)}
                  detalhe={analise.base.margemMeta === null ? "Informe a margem desejada nos parâmetros." : `Para ter ${pct(analise.base.margemMeta)} de lucro no mês.`}
                />
              </div>
            </div>
            {analise.abaixoDoEquilibrio && (
              <AvisoDaPagina tom="erro" className="mt-4">
                O faturamento médio ({reais(analise.base.faturamentoMedioCentavos)}) está abaixo do ponto de equilíbrio: as vendas não cobrem as despesas.
              </AvisoDaPagina>
            )}
            {analise.base.cmv.percentual === null && (
              <p className="mt-4 text-sm text-muted-foreground">
                Para o ponto de equilíbrio sem histórico de vendas, informe o custo dos produtos e insumos (CMV%) nos{" "}
                <Link href="/calculadora/parametros" className={classeDoLink()}>
                  parâmetros
                </Link>
                .
              </p>
            )}
            <dl className="mt-4">
              <LinhasDoNegocio base={analise.base} />
              <Linha
                rotulo="Custo dos produtos e insumos (CMV)"
                valor={analise.base.cmv.percentual === null ? "—" : pct(analise.base.cmv.percentual)}
                detalhe={analise.base.cmv.origem === "apurado" ? "Custo gravado nas vendas ÷ vendas, nos últimos 12 meses." : analise.base.cmv.origem === "estimado" ? "Estimado nos parâmetros." : undefined}
              />
              <Linha rotulo="Imposto" valor={pct(analise.base.imposto.percentual)} />
              <Linha rotulo="Taxa da maquininha" valor={pct(analise.base.taxaCartao)} />
            </dl>
          </>
        )}
      </Superficie>
    </div>
  );
}
