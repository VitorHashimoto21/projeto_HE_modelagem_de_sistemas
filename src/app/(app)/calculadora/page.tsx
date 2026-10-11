import type { Metadata } from "next";
import Link from "next/link";
import { FormularioConfirmacao } from "@/components/calculadora/formularios";
import { ROTULO_REGIME } from "@/components/negocio/rotulos";
import { classeDoCampo } from "@/components/ui/classes";
import { exigirPermissao } from "@/lib/auth/servidor";
import { dependenciasDaCalculadora } from "@/lib/calculadora/servidor";
import { analisarNegocio, calcular, type BaseDoNegocio, type Fonte, type MotivoDoBloqueio } from "@/lib/calculadora/servicos";
import { validarOpcoes } from "@/lib/calculadora/validacao";
import { duasCasas } from "@/lib/dominio/precificacao";
import { pode } from "@/lib/dominio/permissoes";
import { reaisDeCentavos as reais } from "@/lib/dominio/venda";

export const metadata: Metadata = { title: "Calculadora" };

const pct = (n: number) => `${duasCasas(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const dataBr = (dia: string) => dia.split("-").reverse().join("/");
const fonte = (f: Fonte | null) => (f ? `${f.fonteLegal} — vigente desde ${dataBr(f.vigenteDesde)}` : null);

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
    <div role="alert" className="rounded-2xl border border-status-danger/30 bg-status-danger-bg p-5 text-sm text-status-danger">
      <p className="font-medium">{mensagem}</p>
      {c && (
        <Link href={c.href} className="mt-2 inline-block font-semibold underline underline-offset-2">
          {c.texto}
        </Link>
      )}
    </div>
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Calculadora</p>
          <h1 className="font-display text-3xl font-semibold text-foreground">Preço de venda</h1>
          {base && (
            <p className="mt-1 text-sm text-muted-foreground">
              Regime: <strong className="font-medium text-foreground">{ROTULO_REGIME[base.regime]}</strong>
              {base.imposto.anexoEfetivo && ` · Anexo ${base.imposto.anexoEfetivo}`}
            </p>
          )}
        </div>
        <Link href="/calculadora/parametros" className="rounded-xl border border-input px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted">
          Parâmetros de precificação
        </Link>
      </div>

      {base?.avisoAnexo && (
        <p role="status" className="rounded-xl border border-status-warn/40 bg-status-warn-bg px-4 py-3 text-sm text-status-warn">
          <span aria-hidden="true">▲ </span>
          {base.avisoAnexo}
        </p>
      )}
      {base?.limiteMei?.acima && (
        <p role="status" className="rounded-xl border border-status-warn/40 bg-status-warn-bg px-4 py-3 text-sm text-status-warn">
          <span aria-hidden="true">▲ </span>O faturamento dos últimos 12 meses ({reais(base.rbt12.rbt12Centavos)}) passou do limite do MEI ({reais(base.limiteMei.limiteCentavos)} por ano). Procure o seu contador
          sobre o desenquadramento.
        </p>
      )}

      <section aria-labelledby="titulo-item" className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 id="titulo-item" className="mb-4 font-display text-xl font-semibold text-card-foreground">
          Calcular o preço de um item
        </h2>
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
                  {i.precoAtualCentavos !== null ? ` — ${reais(i.precoAtualCentavos)}` : " — sem preço"}
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
          <button type="submit" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
            Calcular
          </button>
        </form>
        {!opcoes.ok && <p className="mt-2 text-xs text-destructive">{Object.values(opcoes.erros).join(" · ")}</p>}
        <p className="mt-3 text-xs text-muted-foreground">
          Deixe a margem vazia para usar a sugerida para a categoria do item. A margem é o que sobra para você em cada venda, depois de custos, despesas e impostos — não é o lucro total
          do negócio.
        </p>
      </section>

      {resultado?.status === "bloqueado" && <Bloqueio motivo={resultado.motivo} mensagem={resultado.mensagem} />}

      {resultado?.status === "ok" && (
        <section aria-labelledby="titulo-resultado" className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm ring-1 ring-primary/20">
            <h2 id="titulo-resultado" className="font-display text-xl font-semibold break-words text-card-foreground">
              {resultado.item.nome}
            </h2>
            <div>
              <p className="text-sm text-muted-foreground">Preço sugerido</p>
              <p className="text-4xl font-semibold text-foreground tabular-nums">{reais(resultado.precoCentavos)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {resultado.item.precoAtualCentavos === null
                  ? "O item ainda não tem preço oficial."
                  : `Preço atual: ${reais(resultado.item.precoAtualCentavos)} (${resultado.precoCentavos >= resultado.item.precoAtualCentavos ? "+" : "−"}${reais(Math.abs(resultado.precoCentavos - resultado.item.precoAtualCentavos))}).`}
              </p>
            </div>
            {resultado.comissao.simulada ? (
              <p role="status" className="rounded-xl border border-status-warn/40 bg-status-warn-bg px-4 py-3 text-sm text-status-warn">
                Simulação com comissão de {pct(resultado.comissao.percentual)}; a do item é {pct(resultado.comissao.doItem)}. Para confirmar com outra comissão, altere-a no Catálogo.
              </p>
            ) : podeConfirmar ? (
              <FormularioConfirmacao itemId={resultado.item.id} margem={campos.margem} precoCentavos={resultado.precoCentavos} arredondadoCentavos={resultado.arredondadoCentavos} />
            ) : (
              <p className="text-xs text-muted-foreground">Você pode simular, mas confirmar o preço exige a permissão de criar na Calculadora.</p>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-2 font-display text-xl font-semibold text-card-foreground">Como o preço foi calculado</h2>
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
          </div>
        </section>
      )}

      <section aria-labelledby="titulo-negocio" className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 id="titulo-negocio" className="mb-1 font-display text-xl font-semibold text-card-foreground">
          Seu negócio no mês
        </h2>
        {analise.status === "bloqueado" ? (
          <div className="mt-3">
            <Bloqueio motivo={analise.motivo} mensagem={analise.mensagem} />
          </div>
        ) : (
          <>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className={`rounded-xl border p-4 ${analise.abaixoDoEquilibrio ? "border-status-danger/30 bg-status-danger-bg" : "bg-muted/40"}`}>
                <p className="text-sm text-muted-foreground">Ponto de equilíbrio</p>
                <p className="text-2xl font-semibold text-foreground tabular-nums">{analise.pontoDeEquilibrioCentavos === null ? "—" : reais(analise.pontoDeEquilibrioCentavos)}</p>
                <p className="text-xs text-muted-foreground">Faturamento mínimo para pagar todas as despesas.</p>
              </div>
              <div className="rounded-xl border bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Faturamento meta</p>
                <p className="text-2xl font-semibold text-foreground tabular-nums">{analise.metaCentavos === null ? "—" : reais(analise.metaCentavos)}</p>
                <p className="text-xs text-muted-foreground">
                  {analise.base.margemMeta === null ? "Informe a margem desejada nos parâmetros." : `Para ter ${pct(analise.base.margemMeta)} de lucro no mês.`}
                </p>
              </div>
            </div>
            {analise.abaixoDoEquilibrio && (
              <p role="status" className="mt-4 text-sm font-medium text-status-danger">
                <span aria-hidden="true">▲ </span>O faturamento médio ({reais(analise.base.faturamentoMedioCentavos)}) está abaixo do ponto de equilíbrio: as vendas não cobrem as despesas.
              </p>
            )}
            {analise.base.cmv.percentual === null && (
              <p className="mt-4 text-sm text-muted-foreground">
                Para o ponto de equilíbrio sem histórico de vendas, informe o custo dos produtos e insumos (CMV%) nos{" "}
                <Link href="/calculadora/parametros" className="font-medium text-primary underline-offset-2 hover:underline">
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
      </section>
    </div>
  );
}
