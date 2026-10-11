import type { ErrosDeCampo } from "@/lib/auth/validacao";
import type { RegimeTributario } from "@/generated/prisma/enums";
import { ItemNaoEncontrado, type ConsultasDoCatalogo } from "@/lib/db/catalogo";
import { AcimaDoLimiteDoSimples, ParametroAusente, type ConsultasFiscais } from "@/lib/db/parametros-fiscais";
import type { ConsultasDePrecificacao, ItemCalculavel } from "@/lib/db/precificacao";
import { competenciaDoDia } from "@/lib/dominio/financeiro";
import { aliquotaEfetiva } from "@/lib/dominio/fiscal";
import {
  anexoEfetivo,
  calcularPreco,
  calcularRbt12,
  despesasFixasPercentual,
  duasCasas,
  maiorParcela,
  pontoDeEquilibrio,
  type Anexo,
  type Rbt12,
} from "@/lib/dominio/precificacao";
import { reaisDeCentavos } from "@/lib/dominio/venda";
import { validarConfirmacao, validarParametros, type OpcoesDoCalculo } from "./validacao";

/**
 * Fluxos da Calculadora (SPEC-010, seção 5), independentes do Next.js. O cálculo é sempre
 * feito no servidor com os dados do momento; do navegador vêm só a margem, a comissão para
 * simular e a escolha do arredondamento (INV-003).
 */

export type DependenciasDaCalculadora = {
  precificacao: ConsultasDePrecificacao;
  catalogo: ConsultasDoCatalogo;
  fiscais: ConsultasFiscais;
  usuarioId: string;
  /** Dia local de hoje (São Paulo) — injetável nos testes. */
  hoje: string;
};

export type Fonte = { fonteLegal: string; vigenteDesde: string };

export type MotivoDoBloqueio =
  | "item-nao-encontrado"
  | "sem-faturamento"
  | "sem-custo"
  | "inviavel"
  | "acima-do-simples"
  | "imposto-nao-informado"
  | "anexo-nao-informado"
  | "atividade-mei-nao-informada"
  | "parametro-ausente";

/** Base do negócio: o que vale para qualquer item e para o ponto de equilíbrio. */
export type BaseDoNegocio = {
  dia: string;
  regime: RegimeTributario;
  rbt12: Rbt12;
  faturamentoMedioCentavos: number;
  despesasFixas: { manuaisCentavos: number; dasCentavos: number | null; totalCentavos: number; dasFonte: Fonte | null };
  imposto: { percentual: number; anexoEfetivo: Anexo | null; fatorR: number | null; faixa: number | null; fonte: Fonte | null };
  cmv: { percentual: number | null; origem: "apurado" | "estimado" | null };
  taxaCartao: number;
  margemMeta: number | null;
  limiteMei: { limiteCentavos: number; acima: boolean; fonte: Fonte } | null;
  avisoAnexo: string | null;
};

export type MemoriaDoCalculo = {
  versao: 1;
  dia: string;
  item: { custoBaseCentavos: number; materiais: ItemCalculavel["materiais"]; custoTotalCentavos: number };
  rbt12: Rbt12;
  faturamentoMedioCentavos: number;
  despesasFixas: BaseDoNegocio["despesasFixas"];
  despesasFixasPercentual: number;
  taxaCartao: number;
  comissao: number;
  regime: RegimeTributario;
  anexoEfetivo: Anexo | null;
  imposto: BaseDoNegocio["imposto"];
  margem: { percentual: number; sugerida: number; fonte: Fonte };
  soma: number;
  precoExatoCentavos: number;
  precoSugeridoCentavos: number;
};

export type ResultadoDoCalculo =
  | {
      status: "ok";
      item: ItemCalculavel;
      base: BaseDoNegocio;
      margem: { percentual: number; sugerida: number; fonte: Fonte };
      comissao: { percentual: number; doItem: number; simulada: boolean };
      despesasFixasPercentual: number;
      despesasVariaveis: number;
      soma: number;
      precoCentavos: number;
      arredondadoCentavos: number;
      memoria: MemoriaDoCalculo;
    }
  | { status: "bloqueado"; motivo: MotivoDoBloqueio; mensagem: string; item?: ItemCalculavel; base?: BaseDoNegocio };

const ROTULO_PARCELA = { despesasFixas: "as despesas fixas", taxaCartao: "a taxa de cartão", comissao: "a comissão", imposto: "o imposto", margem: "a margem" } as const;
const pct = (n: number) => `${duasCasas(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export const MENSAGENS_FLUXO_CALCULADORA = {
  semFaturamento: "Ainda não há vendas nos meses anteriores. Informe a capacidade mensal e o ticket médio (ou o faturamento estimado) nos parâmetros de precificação.",
  semCusto: "Informe o custo do item no Catálogo para calcular o preço.",
  inviavel: (soma: number, maior: string) =>
    `Com esses parâmetros o preço é inviável: os percentuais somam ${pct(soma)}. O que mais pesa é ${maior}; revise as despesas fixas, o faturamento estimado ou a margem.`,
  acimaDoSimples: "Faturamento acima do limite do Simples Nacional (R$ 4,8 milhões): revise o regime nos dados do negócio.",
  impostoNaoInformado: "Informe o percentual de imposto do autônomo nos dados do negócio.",
  anexoNaoInformado: "Informe o Anexo do Simples Nacional nos dados do negócio.",
  atividadeMeiNaoInformada: "Informe a atividade do MEI nos dados do negócio.",
  parametroAusente: "Faltam os parâmetros fiscais oficiais. Avise o suporte (carga dos parâmetros fiscais).",
  itemNaoEncontrado: "Item não encontrado.",
  precoMudou: (centavos: number) => `Os dados mudaram desde o cálculo: o preço sugerido agora é ${reaisDeCentavos(centavos)}. Confira e confirme de novo.`,
  confirmado: (centavos: number) => `Preço oficial atualizado para ${reaisDeCentavos(centavos)}.`,
  parametrosSalvos: "Parâmetros de precificação salvos.",
  falhaInterna: "Não foi possível concluir agora. Tente novamente.",
} as const;
const M = MENSAGENS_FLUXO_CALCULADORA;

function bloqueio(motivo: MotivoDoBloqueio, mensagem: string, extra: { item?: ItemCalculavel; base?: BaseDoNegocio } = {}): ResultadoDoCalculo & { status: "bloqueado" } {
  return { status: "bloqueado", motivo, mensagem, ...extra };
}

/** Base do negócio (5.1): RBT12, faturamento médio, despesas fixas, imposto, CMV%, Fator R. */
export async function baseDoNegocio(deps: DependenciasDaCalculadora): Promise<BaseDoNegocio | (ResultadoDoCalculo & { status: "bloqueado" })> {
  const { precificacao: p, fiscais, hoje } = deps;
  const [par, hist, manuais] = await Promise.all([p.parametros(), p.historico(competenciaDoDia(hoje)), p.despesasFixasManuaisCentavos()]);
  const rbt12 = calcularRbt12({
    compAtual: competenciaDoDia(hoje),
    porCompetencia: hist.porCompetencia,
    primeiraCompetencia: hist.primeiraCompetencia,
    faturamentoEstimadoCentavos: par.faturamentoEstimadoCentavos,
  });
  if (rbt12.origem === "sem-dados") return bloqueio("sem-faturamento", M.semFaturamento);
  const faturamentoMedioCentavos = Math.round(rbt12.rbt12Centavos / 12);

  try {
    let das: { centavos: number; fonte: Fonte; limiteCentavos: number } | null = null;
    let imposto: BaseDoNegocio["imposto"] = { percentual: 0, anexoEfetivo: null, fatorR: null, faixa: null, fonte: null };
    let avisoAnexo: string | null = null;

    if (par.regime === "MEI") {
      if (!par.atividadeMei) return bloqueio("atividade-mei-nao-informada", M.atividadeMeiNaoInformada);
      const mei = await fiscais.parametroMei(par.atividadeMei, hoje);
      das = { centavos: Math.round(mei.valorDasMensal * 100), fonte: { fonteLegal: mei.fonteLegal, vigenteDesde: mei.vigenteDesde }, limiteCentavos: Math.round(mei.limiteFaturamentoAnual * 100) };
    } else if (par.regime === "AUTONOMO") {
      if (par.impostoManual === null) return bloqueio("imposto-nao-informado", M.impostoNaoInformado);
      imposto = { ...imposto, percentual: par.impostoManual };
    } else {
      if (!par.anexoSimples) return bloqueio("anexo-nao-informado", M.anexoNaoInformado);
      const regra = par.sujeitoFatorR ? await fiscais.regraFatorR(hoje) : null;
      const ef = anexoEfetivo({ sujeitoFatorR: par.sujeitoFatorR, anexoCadastro: par.anexoSimples, folhaCentavos: hist.folhaCentavos, receitaRealCentavos: rbt12.realCentavos, regra });
      const faixa = await fiscais.faixaDoSimples(ef.anexo, rbt12.rbt12Centavos / 100, hoje);
      imposto = {
        percentual: aliquotaEfetiva(faixa, rbt12.rbt12Centavos / 100),
        anexoEfetivo: ef.anexo,
        fatorR: ef.fatorR,
        faixa: faixa.faixaOrdem,
        fonte: { fonteLegal: faixa.fonteLegal, vigenteDesde: faixa.vigenteDesde },
      };
      const anterior = await p.ultimoAnexoConfirmado();
      if (anterior && anterior !== ef.anexo) {
        avisoAnexo = `O Anexo efetivo mudou de ${anterior} para ${ef.anexo}${ef.fatorR !== null ? ` (Fator R = ${pct(ef.fatorR)})` : ""}. Os preços confirmados antes usaram o Anexo ${anterior}; vale recalculá-los.`;
      }
    }

    const cmv: BaseDoNegocio["cmv"] =
      rbt12.realCentavos > 0
        ? { percentual: (hist.custoVendidoCentavos / rbt12.realCentavos) * 100, origem: "apurado" }
        : par.cmvEstimado !== null
          ? { percentual: par.cmvEstimado, origem: "estimado" }
          : { percentual: null, origem: null };

    return {
      dia: hoje,
      regime: par.regime,
      rbt12,
      faturamentoMedioCentavos,
      despesasFixas: { manuaisCentavos: manuais, dasCentavos: das?.centavos ?? null, totalCentavos: manuais + (das?.centavos ?? 0), dasFonte: das?.fonte ?? null },
      imposto,
      cmv,
      taxaCartao: par.taxaCartao,
      margemMeta: par.margemMeta,
      limiteMei: das ? { limiteCentavos: das.limiteCentavos, acima: rbt12.rbt12Centavos > das.limiteCentavos, fonte: das.fonte } : null,
      avisoAnexo,
    };
  } catch (e) {
    if (e instanceof AcimaDoLimiteDoSimples) return bloqueio("acima-do-simples", M.acimaDoSimples);
    if (e instanceof ParametroAusente) return bloqueio("parametro-ausente", M.parametroAusente);
    throw e;
  }
}

/** Calcular o preço de um item (UC10, 5.2). Nada é gravado. */
export async function calcular(itemId: string, opcoes: OpcoesDoCalculo, deps: DependenciasDaCalculadora): Promise<ResultadoDoCalculo> {
  let item: ItemCalculavel;
  try {
    item = await deps.precificacao.item(itemId);
  } catch (e) {
    if (e instanceof ItemNaoEncontrado) return bloqueio("item-nao-encontrado", M.itemNaoEncontrado);
    throw e;
  }
  const base = await baseDoNegocio(deps);
  if ("status" in base) return { ...base, item };
  if (!(item.custoTotalCentavos > 0)) return bloqueio("sem-custo", M.semCusto, { item, base });

  let sugerida: { margemPadrao: number; fonteLegal: string; vigenteDesde: string };
  try {
    sugerida = await deps.fiscais.margemPadrao(item.categoria, deps.hoje);
  } catch (e) {
    if (e instanceof ParametroAusente) return bloqueio("parametro-ausente", M.parametroAusente, { item, base });
    throw e;
  }
  const margem = { percentual: opcoes.margem ?? sugerida.margemPadrao, sugerida: sugerida.margemPadrao, fonte: { fonteLegal: sugerida.fonteLegal, vigenteDesde: sugerida.vigenteDesde } };
  const doItem = item.comissao ?? 0;
  const comissao = { percentual: opcoes.comissao ?? doItem, doItem, simulada: opcoes.comissao !== null && opcoes.comissao !== doItem };
  const df = despesasFixasPercentual(base.despesasFixas.totalCentavos, base.faturamentoMedioCentavos);
  const componentes = { despesasFixas: df, taxaCartao: base.taxaCartao, comissao: comissao.percentual, imposto: base.imposto.percentual, margem: margem.percentual };
  const r = calcularPreco({ custoCentavos: item.custoTotalCentavos, ...componentes });
  if (!r.ok) return bloqueio("inviavel", M.inviavel(r.soma, ROTULO_PARCELA[maiorParcela(componentes)]), { item, base });

  const memoria: MemoriaDoCalculo = {
    versao: 1,
    dia: deps.hoje,
    item: { custoBaseCentavos: item.custoBaseCentavos, materiais: item.materiais, custoTotalCentavos: item.custoTotalCentavos },
    rbt12: base.rbt12,
    faturamentoMedioCentavos: base.faturamentoMedioCentavos,
    despesasFixas: base.despesasFixas,
    despesasFixasPercentual: df,
    taxaCartao: base.taxaCartao,
    comissao: comissao.percentual,
    regime: base.regime,
    anexoEfetivo: base.imposto.anexoEfetivo,
    imposto: base.imposto,
    margem,
    soma: r.soma,
    precoExatoCentavos: r.precoExato,
    precoSugeridoCentavos: r.precoCentavos,
  };
  return {
    status: "ok",
    item,
    base,
    margem,
    comissao,
    despesasFixasPercentual: df,
    despesasVariaveis: r.despesasVariaveis,
    soma: r.soma,
    precoCentavos: r.precoCentavos,
    arredondadoCentavos: r.arredondadoCentavos,
    memoria,
  };
}

export type EstadoDaConfirmacao =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: ErrosDeCampo }
  | { status: "mudou"; mensagem: string; precoCentavos: number }
  | { status: "confirmado"; mensagem: string };

export const CONFIRMACAO_INICIAL: EstadoDaConfirmacao = { status: "ocioso" };

/** Confirmar o preço (UC10a, 5.3): recalcula no servidor e grava pela função de preço da SPEC-006. */
export async function confirmar(itemId: string, campos: Record<string, string>, deps: DependenciasDaCalculadora): Promise<EstadoDaConfirmacao> {
  const v = validarConfirmacao(campos);
  if (!v.ok) return { status: "erro", erros: v.erros, mensagem: v.erros.preco };
  try {
    // A comissão da confirmação é sempre a do item: a simulada serve só para comparar.
    const r = await calcular(itemId, { margem: v.dados.margem, comissao: null }, deps);
    if (r.status !== "ok") return { status: "erro", mensagem: r.mensagem };
    const preco = v.dados.arredondar ? r.arredondadoCentavos : r.precoCentavos;
    if (preco !== v.dados.precoVistoCentavos) return { status: "mudou", mensagem: M.precoMudou(preco), precoCentavos: preco };
    await deps.catalogo.definirPreco(itemId, preco / 100, deps.usuarioId, "CALCULADORA", {
      margemAplicada: duasCasas(r.margem.percentual),
      custoConsiderado: (r.item.custoTotalCentavos / 100).toFixed(2),
      despesasFixasPercentual: duasCasas(r.despesasFixasPercentual),
      despesasVariaveisPercentual: duasCasas(r.despesasVariaveis),
      regimeTributario: r.base.regime,
      impostoAplicado: duasCasas(r.base.imposto.percentual),
      precoSugerido: (r.precoCentavos / 100).toFixed(2),
      memoriaCalculo: r.memoria,
    });
    return { status: "confirmado", mensagem: M.confirmado(preco) };
  } catch (e) {
    if (e instanceof ItemNaoEncontrado) return { status: "erro", mensagem: M.itemNaoEncontrado };
    console.error("[calculadora] falha:", e instanceof Error ? e.name : "erro");
    return { status: "erro", mensagem: M.falhaInterna };
  }
}

export type AnaliseDoNegocio =
  | {
      status: "ok";
      base: BaseDoNegocio;
      pontoDeEquilibrioCentavos: number | null;
      metaCentavos: number | null;
      abaixoDoEquilibrio: boolean;
    }
  | (ResultadoDoCalculo & { status: "bloqueado" });

/** Ponto de equilíbrio e faturamento meta (RF54–RF56, 5.4). */
export async function analisarNegocio(deps: DependenciasDaCalculadora): Promise<AnaliseDoNegocio> {
  const base = await baseDoNegocio(deps);
  if ("status" in base) return base;
  const entrada = { despesasFixasCentavos: base.despesasFixas.totalCentavos, cmv: base.cmv.percentual ?? 0, imposto: base.imposto.percentual, taxaCartao: base.taxaCartao };
  const pe = base.cmv.percentual === null ? null : pontoDeEquilibrio(entrada);
  const meta = base.cmv.percentual === null || base.margemMeta === null ? null : pontoDeEquilibrio({ ...entrada, margemMeta: base.margemMeta });
  return { status: "ok", base, pontoDeEquilibrioCentavos: pe, metaCentavos: meta, abaixoDoEquilibrio: pe !== null && base.faturamentoMedioCentavos < pe };
}

export type EstadoDosParametros = { status: "ocioso" } | { status: "erro"; erros: ErrosDeCampo } | { status: "salvo"; mensagem: string };

/** Parâmetros de precificação (UC16, 5.5). */
export async function salvarParametros(campos: Record<string, string>, deps: DependenciasDaCalculadora): Promise<EstadoDosParametros> {
  const v = validarParametros(campos);
  if (!v.ok) return { status: "erro", erros: v.erros };
  await deps.precificacao.salvarParametros(v.dados);
  return { status: "salvo", mensagem: M.parametrosSalvos };
}
