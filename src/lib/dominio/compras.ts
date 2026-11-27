import type { ErrosDeCampo, Validacao } from "@/lib/auth/validacao";
import { casasDecimais, lerNumero } from "@/lib/dominio/catalogo";
import { diasEntre, QUANTIDADE_MAXIMA, somarDias } from "@/lib/dominio/estoque";
import { pode, type Matriz } from "@/lib/dominio/permissoes";
import { dividirEmParcelas, MAX_PARCELAS, paraCentavos, subtotalEmCentavos } from "@/lib/dominio/venda";

/**
 * Compras de fornecedores (SPEC-027): validação, total, rateio, contas a pagar e o custo do
 * produto depois da compra. Camada de domínio pura, sem framework nem banco (ADR-005). Roda no
 * navegador (resumo) e no servidor, que valida tudo de novo antes de gravar. Valores em centavos.
 */

export const DIAS_RETROATIVOS_COMPRA = 90; // 5.1: hoje ou até 90 dias atrás
export const MAX_LINHAS_COMPRA = 100; // OPEN-003
export const MAX_PARCELAS_COMPRA = MAX_PARCELAS; // OPEN-004: de 1 a 12
export const DIAS_ENTRE_PARCELAS = 30; // OPEN-004: vencimentos sugeridos a cada 30 dias
export const MAX_DOCUMENTO = 40; // OPEN-002: como nas contas
export const MAX_OBSERVACAO = 200;
/** Maior valor de uma coluna Decimal(10, 2): R$ 99.999.999,99. */
export const VALOR_MAXIMO_CENTAVOS = 9_999_999_999;

export const CONDICOES_DE_COMPRA = { A_VISTA: "À vista", A_PRAZO: "A prazo" } as const;
export type CondicaoDeCompra = keyof typeof CONDICOES_DE_COMPRA;

/** OPEN-001: o custo do produto depois da compra; o médio vem marcado. */
export const ESCOLHAS_DE_CUSTO = { MEDIO: "Custo médio", COMPRA: "Custo desta compra", ATUAL: "Manter o atual" } as const;
export type EscolhaDeCusto = keyof typeof ESCOLHAS_DE_CUSTO;
export const ESCOLHA_PADRAO: EscolhaDeCusto = "MEDIO";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Seção 5.11, mais as mensagens de formato do formulário. */
export const MENSAGENS_COMPRA = {
  compraInvalida: "Não foi possível ler a compra. Recarregue a página e tente de novo.",
  semFornecedor: "Escolha o fornecedor.",
  semDocumento: 'Informe o nº do documento ou marque "Compra sem nota fiscal".',
  documentoLongo: `Use no máximo ${MAX_DOCUMENTO} caracteres.`,
  observacaoLonga: `Use no máximo ${MAX_OBSERVACAO} caracteres.`,
  semProdutos: "Adicione pelo menos um produto.",
  muitasLinhas: `Use no máximo ${MAX_LINHAS_COMPRA} produtos por compra.`,
  quantidadeInvalida: "Informe uma quantidade maior que zero.",
  quantidadeCasas: "Use uma quantidade com até 3 casas decimais.",
  custoNegativo: "O custo não pode ser negativo.",
  custoInvalido: "Use um custo com até 2 casas decimais.",
  valorInvalido: "Use um valor de 0 ou mais, com até 2 casas decimais.",
  dataInvalida: `Use uma data entre hoje e ${DIAS_RETROATIVOS_COMPRA} dias atrás.`,
  parcelasInvalidas: `Use de 1 a ${MAX_PARCELAS_COMPRA} parcelas.`,
  semVencimento: "Informe o vencimento de cada parcela.",
  vencimentoAntes: "O vencimento não pode ser antes da data da compra.",
  totalZero: "O total da compra precisa ser maior que zero.",
  valorAlto: "O valor passa do limite de R$ 99.999.999,99.",
  descontoAlto: "O desconto não pode passar do valor dos produtos.",
  entradaInvalida: "A entrada precisa ser maior que zero e menor que o total da compra.",
  produtoIndisponivel: (produto: string) => `${produto} não está mais disponível. Remova-o da compra.`,
  documentoRepetido: (numero: number, documento: string) =>
    `Este fornecedor já tem a compra nº ${numero} com o documento ${documento}. Confira o número ou cancele a compra anterior.`,
} as const;

export type LinhaDaCompra = {
  itemId: string;
  quantidade: number;
  custoUnitarioCentavos: number;
  escolhaCusto: EscolhaDeCusto;
};

export type DadosDaCompra = {
  /** Identificador gerado no formulário = id da compra (proteção contra envio duplicado). */
  id: string;
  fornecedorId: string;
  /** Nulo só na compra sem nota fiscal (OPEN-002). */
  numeroDocumento: string | null;
  semNotaFiscal: boolean;
  /** Dia local da compra. */
  dia: string;
  observacao: string | null;
  linhas: LinhaDaCompra[];
  freteCentavos: number;
  outrasDespesasCentavos: number;
  descontoCentavos: number;
  condicao: CondicaoDeCompra;
  /** Só a prazo, opcional (OPEN-004). */
  entradaCentavos: number | null;
  /** Vencimento de cada parcela (só a prazo). */
  vencimentos: string[];
};

/** OPEN-007: registrar exige Estoque — criar e Financeiro — criar; o suporte nunca registra (RN37). */
export const podeRegistrarCompra = (m: { permissoes: Matriz; modoSuporte?: boolean }) =>
  !m.modoSuporte && pode(m.permissoes, "estoque", "criar") && pode(m.permissoes, "financeiro", "criar");

/** OPEN-007: ver a lista e o detalhe exige Estoque — ver e Financeiro — ver (o suporte, com os dois liberados, também). */
export const podeVerCompras = (m: { permissoes: Matriz }) => pode(m.permissoes, "estoque", "ver") && pode(m.permissoes, "financeiro", "ver");

/** INV-011: o nº do documento comparado sem diferença de espaços e de maiúsculas. */
export const chaveDoDocumento = (numero: string) => numero.trim().replace(/\s+/g, " ").toUpperCase();

/** OPEN-004: vencimentos sugeridos, a cada 30 dias depois da data da compra. */
export function vencimentosSugeridos(dia: string, n: number): string[] {
  return Array.from({ length: n }, (_, k) => somarDias(dia, DIAS_ENTRE_PARCELAS * (k + 1)));
}

const lerValor = (v: unknown) => (typeof v === "number" ? v : lerNumero(typeof v === "string" ? v : undefined));
const vazio = (v: unknown) => v === undefined || v === null || v === "";
const diaValido = (d: unknown): d is string => typeof d === "string" && DIA.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

/** Valor em reais de 0 ou mais, com até 2 casas, em centavos; null se inválido. */
function lerCentavos(v: unknown): number | null {
  if (vazio(v)) return 0;
  const n = lerValor(v);
  if (n === null || !Number.isFinite(n) || n < 0 || casasDecimais(n) > 2) return null;
  const c = paraCentavos(n);
  return c > VALOR_MAXIMO_CENTAVOS ? null : c;
}

/**
 * Valida a forma da compra (sem consultar o banco), com os valores e as contas (INV-002). O
 * fornecedor, os produtos, o saldo e o custo atual são conferidos no servidor.
 */
export function validarCompra(entrada: unknown, hoje: string): Validacao<DadosDaCompra> {
  const c = entrada as Record<string, unknown> | null;
  if (!c || typeof c !== "object" || typeof c.id !== "string" || !UUID.test(c.id)) {
    return { ok: false, erros: { compra: MENSAGENS_COMPRA.compraInvalida } };
  }
  const erros: ErrosDeCampo = {};

  const fornecedorId = typeof c.fornecedorId === "string" && UUID.test(c.fornecedorId) ? c.fornecedorId : null;
  if (!fornecedorId) erros.fornecedor = MENSAGENS_COMPRA.semFornecedor;

  const semNotaFiscal = c.semNotaFiscal === true;
  let numeroDocumento: string | null = null;
  if (!semNotaFiscal) {
    numeroDocumento = typeof c.numeroDocumento === "string" ? c.numeroDocumento.trim().replace(/\s+/g, " ") : "";
    if (!numeroDocumento) erros.documento = MENSAGENS_COMPRA.semDocumento;
    else if (numeroDocumento.length > MAX_DOCUMENTO) erros.documento = MENSAGENS_COMPRA.documentoLongo;
  }

  const dia = vazio(c.dia) ? hoje : c.dia;
  const diaOk = diaValido(dia) && diasEntre(dia, hoje) >= 0 && diasEntre(dia, hoje) <= DIAS_RETROATIVOS_COMPRA;
  if (!diaOk) erros.dia = MENSAGENS_COMPRA.dataInvalida;

  const observacao = typeof c.observacao === "string" ? c.observacao.trim() || null : null;
  if (observacao && observacao.length > MAX_OBSERVACAO) erros.observacao = MENSAGENS_COMPRA.observacaoLonga;

  const linhas: LinhaDaCompra[] = [];
  const brutas = Array.isArray(c.linhas) ? (c.linhas as Record<string, unknown>[]) : [];
  if (brutas.length === 0) erros.itens = MENSAGENS_COMPRA.semProdutos;
  else if (brutas.length > MAX_LINHAS_COMPRA) erros.itens = MENSAGENS_COMPRA.muitasLinhas;
  const vistos = new Set<string>();
  for (const l of brutas) {
    if (typeof l?.itemId !== "string" || !UUID.test(l.itemId) || vistos.has(l.itemId)) {
      erros.itens = MENSAGENS_COMPRA.compraInvalida; // a tela leva à linha que já existe (5.2)
      continue;
    }
    vistos.add(l.itemId);
    const quantidade = lerValor(l.quantidade);
    if (quantidade === null || !(quantidade > 0)) {
      erros[`quantidade_${l.itemId}`] = MENSAGENS_COMPRA.quantidadeInvalida;
      continue;
    }
    if (quantidade > QUANTIDADE_MAXIMA || casasDecimais(quantidade) > 3) {
      erros[`quantidade_${l.itemId}`] = MENSAGENS_COMPRA.quantidadeCasas;
      continue;
    }
    const custo = vazio(l.custoUnitario) ? null : lerValor(l.custoUnitario);
    if (custo !== null && custo < 0) {
      erros[`custo_${l.itemId}`] = MENSAGENS_COMPRA.custoNegativo;
      continue;
    }
    if (custo === null || !Number.isFinite(custo) || casasDecimais(custo) > 2 || paraCentavos(custo) > VALOR_MAXIMO_CENTAVOS) {
      erros[`custo_${l.itemId}`] = MENSAGENS_COMPRA.custoInvalido;
      continue;
    }
    const escolha = vazio(l.escolhaCusto) ? ESCOLHA_PADRAO : l.escolhaCusto;
    if (typeof escolha !== "string" || !Object.hasOwn(ESCOLHAS_DE_CUSTO, escolha)) {
      erros.itens = MENSAGENS_COMPRA.compraInvalida;
      continue;
    }
    linhas.push({ itemId: l.itemId, quantidade, custoUnitarioCentavos: paraCentavos(custo), escolhaCusto: escolha as EscolhaDeCusto });
  }

  const frete = lerCentavos(c.frete);
  if (frete === null) erros.frete = MENSAGENS_COMPRA.valorInvalido;
  const outras = lerCentavos(c.outrasDespesas);
  if (outras === null) erros.outrasDespesas = MENSAGENS_COMPRA.valorInvalido;
  const desconto = lerCentavos(c.desconto);
  if (desconto === null) erros.desconto = MENSAGENS_COMPRA.valorInvalido;

  const condicao = c.condicao;
  if (condicao !== "A_VISTA" && condicao !== "A_PRAZO") return { ok: false, erros: { ...erros, condicao: MENSAGENS_COMPRA.compraInvalida } };

  let entradaCentavos: number | null = null;
  const vencimentos: string[] = [];
  if (condicao === "A_PRAZO") {
    if (!vazio(c.entrada)) {
      const e = lerValor(c.entrada);
      if (e === null || !Number.isFinite(e) || !(e > 0) || casasDecimais(e) > 2) erros.entrada = MENSAGENS_COMPRA.entradaInvalida;
      else entradaCentavos = paraCentavos(e);
    }
    const parcelas = Array.isArray(c.parcelas) ? (c.parcelas as Record<string, unknown>[]) : [];
    if (parcelas.length < 1 || parcelas.length > MAX_PARCELAS_COMPRA) erros.parcelas = MENSAGENS_COMPRA.parcelasInvalidas;
    else
      parcelas.forEach((p, i) => {
        const v = p?.vencimento;
        if (!diaValido(v)) erros[`vencimento_${i}`] = MENSAGENS_COMPRA.semVencimento;
        else if (diaOk && diasEntre(dia as string, v) < 0) erros[`vencimento_${i}`] = MENSAGENS_COMPRA.vencimentoAntes;
        else vencimentos.push(v);
      });
  } else if (!vazio(c.entrada) || (Array.isArray(c.parcelas) && c.parcelas.length > 0)) {
    erros.condicao = MENSAGENS_COMPRA.compraInvalida; // à vista não tem entrada nem parcelas
  }

  if (Object.keys(erros).length) return { ok: false, erros };
  const dados: DadosDaCompra = {
    id: c.id,
    fornecedorId: fornecedorId!,
    numeroDocumento,
    semNotaFiscal,
    dia: dia as string,
    observacao,
    linhas,
    freteCentavos: frete!,
    outrasDespesasCentavos: outras!,
    descontoCentavos: desconto!,
    condicao,
    entradaCentavos,
    vencimentos,
  };
  const valores = calcularCompra(dados);
  return valores.ok ? { ok: true, dados } : valores;
}

/**
 * OPEN-005: reparte um valor (positivo ou negativo) em proporção aos pesos, ao centavo, pelo
 * maior resto; a soma das partes é exatamente o valor. Sem peso (todas as linhas a custo zero),
 * reparte pela quantidade.
 */
export function ratear(valorCentavos: number, pesos: readonly number[], reserva?: readonly number[]): number[] {
  const total = pesos.reduce((s, p) => s + p, 0);
  if (valorCentavos === 0 || pesos.length === 0) return pesos.map(() => 0);
  if (total === 0) return reserva && reserva.some((r) => r > 0) ? ratear(valorCentavos, reserva) : pesos.map(() => 0);
  const sinal = valorCentavos < 0 ? -1 : 1;
  const a = BigInt(Math.abs(valorCentavos));
  const t = BigInt(total);
  const partes = pesos.map((p) => (a * BigInt(p)) / t);
  const restos = pesos.map((p, i) => ({ i, resto: (a * BigInt(p)) % t }));
  let sobra = Number(a - partes.reduce((s, p) => s + p, BigInt(0)));
  restos.sort((x, y) => (y.resto > x.resto ? 1 : y.resto < x.resto ? -1 : x.i - y.i));
  for (const { i } of restos) {
    if (sobra <= 0) break;
    partes[i] += BigInt(1);
    sobra--;
  }
  return partes.map((p) => sinal * Number(p));
}

/** Divisão de inteiros com arredondamento ao mais próximo (meio para cima), para valores não negativos. */
const dividirArredondando = (a: bigint, b: bigint) => (a * BigInt(2) + b) / (b * BigInt(2));
const milesimos = (q: number) => BigInt(Math.round(q * 1000));

export type ContaDaCompra = {
  tipo: "A_VISTA" | "ENTRADA" | "PARCELA";
  /** Número da parcela (1..n) e o total de parcelas; zero na à vista e na entrada. */
  parcela: number;
  deParcelas: number;
  valorCentavos: number;
  vencimento: string;
};

export type ValoresDaLinha = LinhaDaCompra & {
  totalLinhaCentavos: number;
  rateioCentavos: number;
  /** Total da linha com o rateio (OPEN-005), base do custo desta compra e do médio. */
  totalComRateioCentavos: number;
  /** Custo unitário com o rateio, ao centavo (o "custo desta compra"). */
  custoComRateioCentavos: number;
};

export type ValoresDaCompra = {
  linhas: ValoresDaLinha[];
  valorProdutosCentavos: number;
  totalCentavos: number;
  contas: ContaDaCompra[];
};

/** INV-002: total, rateio e contas a pagar. Recusa desconto maior que os produtos, total zero, entrada fora do total. */
export function calcularCompra(d: DadosDaCompra): Validacao<ValoresDaCompra> {
  const erros: ErrosDeCampo = {};
  const totais = d.linhas.map((l) => subtotalEmCentavos(l.custoUnitarioCentavos, l.quantidade));
  totais.forEach((t, i) => {
    if (t > VALOR_MAXIMO_CENTAVOS) erros[`custo_${d.linhas[i].itemId}`] = MENSAGENS_COMPRA.valorAlto;
  });
  const valorProdutos = totais.reduce((s, t) => s + t, 0);
  const total = valorProdutos + d.freteCentavos + d.outrasDespesasCentavos - d.descontoCentavos;
  if (d.descontoCentavos > valorProdutos) erros.desconto = MENSAGENS_COMPRA.descontoAlto;
  else if (total <= 0) erros.total = MENSAGENS_COMPRA.totalZero;
  else if (total > VALOR_MAXIMO_CENTAVOS || valorProdutos > VALOR_MAXIMO_CENTAVOS) erros.total = MENSAGENS_COMPRA.valorAlto;
  if (d.entradaCentavos !== null && !erros.total && !erros.desconto && d.entradaCentavos >= total) {
    erros.entrada = MENSAGENS_COMPRA.entradaInvalida;
  }
  if (Object.keys(erros).length) return { ok: false, erros };

  const rateio = ratear(
    d.freteCentavos + d.outrasDespesasCentavos - d.descontoCentavos,
    totais,
    d.linhas.map((l) => Number(milesimos(l.quantidade))),
  );
  const linhas = d.linhas.map((l, i) => {
    const totalComRateio = totais[i] + rateio[i];
    return {
      ...l,
      totalLinhaCentavos: totais[i],
      rateioCentavos: rateio[i],
      totalComRateioCentavos: totalComRateio,
      custoComRateioCentavos: Number(dividirArredondando(BigInt(totalComRateio) * BigInt(1000), milesimos(l.quantidade))),
    };
  });

  const contas: ContaDaCompra[] = [];
  if (d.condicao === "A_VISTA") {
    contas.push({ tipo: "A_VISTA", parcela: 0, deParcelas: 0, valorCentavos: total, vencimento: d.dia });
  } else {
    const entrada = d.entradaCentavos ?? 0;
    if (entrada > 0) contas.push({ tipo: "ENTRADA", parcela: 0, deParcelas: 0, valorCentavos: entrada, vencimento: d.dia });
    const n = d.vencimentos.length;
    dividirEmParcelas(total - entrada, n).forEach((valor, k) =>
      contas.push({ tipo: "PARCELA", parcela: k + 1, deParcelas: n, valorCentavos: valor, vencimento: d.vencimentos[k] }),
    );
  }
  return { ok: true, dados: { linhas, valorProdutosCentavos: valorProdutos, totalCentavos: total, contas } };
}

/** Descrição da conta a pagar da compra (5.4). */
export function descricaoDaConta(numero: number, c: Pick<ContaDaCompra, "tipo" | "parcela" | "deParcelas">): string {
  if (c.tipo === "A_VISTA") return `Compra nº ${numero} — à vista`;
  if (c.tipo === "ENTRADA") return `Compra nº ${numero} — entrada`;
  return `Compra nº ${numero} — parcela ${c.parcela}/${c.deParcelas}`;
}

export type CustosDaLinha = { atualCentavos: number; compraCentavos: number; medioCentavos: number };

/**
 * OPEN-001: os três custos de um produto da compra. O médio é
 * (saldo antes × custo atual + total da linha com o rateio) ÷ (saldo antes + quantidade), ao
 * centavo; com saldo antes igual a zero ou negativo, vale o custo desta compra.
 */
export function custosDaLinha(p: { saldoAntes: number; custoAtualCentavos: number; quantidade: number; totalComRateioCentavos: number; custoComRateioCentavos: number }): CustosDaLinha {
  const saldo = milesimos(p.saldoAntes);
  const medio =
    saldo <= BigInt(0)
      ? p.custoComRateioCentavos
      : Number(
          dividirArredondando(
            saldo * BigInt(p.custoAtualCentavos) + BigInt(p.totalComRateioCentavos) * BigInt(1000),
            saldo + milesimos(p.quantidade),
          ),
        );
  return { atualCentavos: p.custoAtualCentavos, compraCentavos: p.custoComRateioCentavos, medioCentavos: medio };
}

/** O custo do produto depois da compra, pela escolha (OPEN-001). */
export function custoEscolhido(escolha: EscolhaDeCusto, c: CustosDaLinha): number {
  return escolha === "MEDIO" ? c.medioCentavos : escolha === "COMPRA" ? c.compraCentavos : c.atualCentavos;
}
