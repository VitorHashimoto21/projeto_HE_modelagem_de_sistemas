import { intervaloDoDia } from "@/lib/dominio/datas";
import {
  calcularCompra,
  chaveDoDocumento,
  custoEscolhido,
  custosDaLinha,
  descricaoDaConta,
  type ContaDaCompra,
  type CustosDaLinha,
  type DadosDaCompra,
  type EscolhaDeCusto,
  type ValoresDaCompra,
} from "@/lib/dominio/compras";
import { paraCentavos } from "@/lib/dominio/venda";
import { ItemNaoEncontrado } from "./catalogo";
import type { ClienteDoNegocio } from "./cliente-do-negocio";
import { instanteDaOcorrencia, ItemArquivado, ItemSemEstoque, movimentar } from "./estoque";
import { FornecedorNaoEncontrado } from "./fornecedores";

/**
 * Compras de fornecedores do negócio ativo (SPEC-027, etapa 1). A compra inteira é uma transação
 * (INV-001): número, compra, produtos, entradas no estoque pela primitiva da SPEC-007, custo com o
 * histórico (OPEN-001) e as contas a pagar (OPEN-004). Nenhuma compra muda o caixa no registro
 * (INV-007): o caixa só muda quando cada conta é paga no Financeiro. Quem chama já passou pela
 * guarda de permissão (Estoque: criar e Financeiro: criar, OPEN-007).
 */

/** OPEN-002 (INV-011): o fornecedor já tem uma compra não cancelada com este nº. */
export class DocumentoDaCompraRepetido extends Error {
  constructor(public readonly numero: number, public readonly documento: string) {
    super("Este fornecedor já tem uma compra com este documento.");
    this.name = "DocumentoDaCompraRepetido";
  }
}
/** 5.11: produto arquivado, excluído ou que não é produto físico (CA-07). */
export class ProdutoIndisponivel extends Error {
  constructor(public readonly nome: string) {
    super("Produto indisponível para a compra.");
    this.name = "ProdutoIndisponivel";
  }
}
/** Os valores não fecham (o formulário já valida; só por segurança no servidor). */
export class ValoresDaCompraInvalidos extends Error {
  constructor() {
    super("Os valores da compra são inválidos.");
    this.name = "ValoresDaCompraInvalidos";
  }
}

const num = (d: unknown) => (d === null || d === undefined ? null : Number(String(d)));
const reais = (centavos: number) => (centavos / 100).toFixed(2);
const meioDia = (dia: string) => new Date(intervaloDoDia(dia).inicio.getTime() + 12 * 3_600_000);
const ehUnicidade = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
const NOME_GENERICO = "Um dos produtos";

/** Transação (ou cliente) do negócio. */
type Tx = Parameters<typeof movimentar>[0] &
  Pick<ClienteDoNegocio, "negocio" | "compra" | "itemCompra" | "historicoCusto" | "contaPagarReceber">;

export type LinhaDoResumo = {
  itemId: string;
  nome: string;
  unidadeMedida: string;
  quantidade: number;
  custoUnitarioCentavos: number;
  totalLinhaCentavos: number;
  rateioCentavos: number;
  saldoAtual: number;
  saldoNovo: number;
  /** Os três custos (OPEN-001); a escolha marcada vem do formulário (o médio, por padrão). */
  custos: CustosDaLinha;
  escolhaCusto: EscolhaDeCusto;
};

/** O resumo antes de confirmar (5.1, item 4). */
export type ResumoDaCompra = Omit<ValoresDaCompra, "linhas"> & {
  linhas: LinhaDoResumo[];
  freteCentavos: number;
  outrasDespesasCentavos: number;
  descontoCentavos: number;
};

export function criarConsultasDeCompras(cliente: ClienteDoNegocio, negocioId: string) {
  function valoresDa(d: DadosDaCompra): ValoresDaCompra {
    const v = calcularCompra(d);
    if (!v.ok) throw new ValoresDaCompraInvalidos();
    return v.dados;
  }

  /** Fornecedor do negócio, não anonimizado (OPEN-002). */
  async function conferirFornecedor(fornecedorId: string) {
    const f = await cliente.fornecedor.findFirst({ where: { id: fornecedorId, anonimizadoEm: null }, select: { id: true } });
    if (!f) throw new FornecedorNaoEncontrado();
  }

  /** INV-011: outra compra não cancelada do mesmo fornecedor com o mesmo nº. */
  async function conferirDocumento(d: DadosDaCompra) {
    if (!d.numeroDocumento) return;
    const outra = await cliente.compra.findFirst({
      where: { fornecedorId: d.fornecedorId, documentoChave: chaveDoDocumento(d.numeroDocumento), id: { not: d.id } },
      select: { numero: true, numeroDocumento: true },
    });
    if (outra) throw new DocumentoDaCompraRepetido(outra.numero, outra.numeroDocumento ?? d.numeroDocumento);
  }

  /** Produtos físicos ativos do negócio (OPEN-003, CA-07). */
  async function produtos(d: DadosDaCompra) {
    const itens = await cliente.item.findMany({
      where: { id: { in: d.linhas.map((l) => l.itemId) } },
      select: { id: true, nome: true, unidadeMedida: true, tipo: true, arquivadoEm: true, custoBase: true, quantidadeEstoque: true },
    });
    const porId = new Map(itens.map((i) => [i.id, i]));
    for (const l of d.linhas) {
      const i = porId.get(l.itemId);
      if (!i || i.tipo !== "PRODUTO_FISICO" || i.arquivadoEm) throw new ProdutoIndisponivel(i?.nome ?? NOME_GENERICO);
    }
    return porId;
  }

  return {
    /** Revisar compra (seção 9): o resumo com o saldo novo, as contas e os três custos de cada produto. */
    async revisar(d: DadosDaCompra): Promise<ResumoDaCompra> {
      const valores = valoresDa(d);
      await conferirFornecedor(d.fornecedorId);
      await conferirDocumento(d);
      const porId = await produtos(d);
      const linhas = valores.linhas.map((l) => {
        const i = porId.get(l.itemId)!;
        const saldoAtual = num(i.quantidadeEstoque)!;
        return {
          itemId: l.itemId,
          nome: i.nome,
          unidadeMedida: i.unidadeMedida,
          quantidade: l.quantidade,
          custoUnitarioCentavos: l.custoUnitarioCentavos,
          totalLinhaCentavos: l.totalLinhaCentavos,
          rateioCentavos: l.rateioCentavos,
          saldoAtual,
          saldoNovo: Math.round((saldoAtual + l.quantidade) * 1000) / 1000,
          custos: custosDaLinha({ saldoAntes: saldoAtual, custoAtualCentavos: paraCentavos(num(i.custoBase)!), ...l }),
          escolhaCusto: l.escolhaCusto,
        };
      });
      return {
        ...valores,
        linhas,
        freteCentavos: d.freteCentavos,
        outrasDespesasCentavos: d.outrasDespesasCentavos,
        descontoCentavos: d.descontoCentavos,
      };
    },

    /**
     * Registrar compra (5.4). O servidor valida tudo de novo e grava numa transação. Se a compra já foi
     * gravada (clique duplo, rede lenta), devolve a existente em vez de criar outra.
     */
    async registrar(d: DadosDaCompra, usuarioId: string, agora = new Date()): Promise<{ id: string; numero: number; jaExistia: boolean }> {
      const existente = await cliente.compra.findFirst({ where: { id: d.id }, select: { id: true, numero: true } });
      if (existente) return { ...existente, jaExistia: true };
      const valores = valoresDa(d);
      await conferirFornecedor(d.fornecedorId);
      await conferirDocumento(d);
      await produtos(d);
      try {
        return await cliente.$transaction(async (tx) => ({ ...(await gravar(tx as unknown as Tx, d, valores, usuarioId, agora)), jaExistia: false }), {
          timeout: 30_000,
        });
      } catch (e) {
        if (!ehUnicidade(e)) throw e;
        // Envio simultâneo da mesma compra, ou outra compra com o mesmo documento gravada antes (INV-011).
        const gravada = await cliente.compra.findFirst({ where: { id: d.id }, select: { id: true, numero: true } });
        if (gravada) return { ...gravada, jaExistia: true };
        await conferirDocumento(d);
        throw e;
      }
    },
  };

  async function gravar(tx: Tx, d: DadosDaCompra, valores: ValoresDaCompra, usuarioId: string, agora: Date): Promise<{ id: string; numero: number }> {
    // Número sequencial (INV-005): a trava da linha do negócio serializa as compras do mesmo negócio;
    // se a transação falhar, o incremento também é desfeito.
    const { proximoNumeroCompra } = await tx.negocio.update({
      where: { id: negocioId },
      data: { proximoNumeroCompra: { increment: 1 } },
      select: { proximoNumeroCompra: true },
    });
    const numero = proximoNumeroCompra - 1;
    const compra = await tx.compra.create({
      data: {
        id: d.id,
        negocioId,
        numero,
        fornecedorId: d.fornecedorId,
        numeroDocumento: d.numeroDocumento,
        documentoChave: d.numeroDocumento ? chaveDoDocumento(d.numeroDocumento) : null,
        semNotaFiscal: d.semNotaFiscal,
        data: new Date(`${d.dia}T00:00:00Z`),
        observacao: d.observacao,
        valorProdutos: reais(valores.valorProdutosCentavos),
        frete: reais(d.freteCentavos),
        outrasDespesas: reais(d.outrasDespesasCentavos),
        desconto: reais(d.descontoCentavos),
        total: reais(valores.totalCentavos),
        condicao: d.condicao,
        valorEntrada: d.entradaCentavos === null ? null : reais(d.entradaCentavos),
        registradaPorId: usuarioId,
        registradaEm: agora,
      },
      select: { id: true, numero: true },
    });

    // Entradas no estoque (INV-003) e o custo (OPEN-001). A ordem pelo id do produto evita que duas
    // compras com os mesmos produtos travem as linhas em ordem trocada.
    const data = instanteDaOcorrencia(d.dia, agora);
    const linhas = [...valores.linhas].sort((a, b) => a.itemId.localeCompare(b.itemId));
    for (const l of linhas) {
      let saldoAnterior: number;
      try {
        ({ saldoAnterior } = await movimentar(tx, negocioId, { itemId: l.itemId, tipo: "ENTRADA", quantidade: l.quantidade, usuarioId, data, compraId: compra.id }));
      } catch (e) {
        if (e instanceof ItemArquivado || e instanceof ItemSemEstoque || e instanceof ItemNaoEncontrado) {
          const i = await tx.item.findFirst({ where: { id: l.itemId }, select: { nome: true } });
          throw new ProdutoIndisponivel(i?.nome ?? NOME_GENERICO);
        }
        throw e;
      }
      // O custo atual é lido depois da trava da linha do item (pela movimentação), como o saldo.
      const item = await tx.item.findFirst({ where: { id: l.itemId }, select: { custoBase: true } });
      const custoAnterior = paraCentavos(num(item!.custoBase)!);
      const custoNovo = custoEscolhido(l.escolhaCusto, custosDaLinha({ saldoAntes: saldoAnterior, custoAtualCentavos: custoAnterior, ...l }));
      if (custoNovo !== custoAnterior) {
        // Vale a partir do registro (5.5), como uma edição no Catálogo; o histórico aponta a compra (INV-006).
        await tx.item.update({ where: { id: l.itemId }, data: { custoBase: reais(custoNovo) } });
        await tx.historicoCusto.create({ data: { negocioId, itemId: l.itemId, custo: reais(custoNovo), vigenteDesde: agora, usuarioId, compraId: compra.id } });
      }
      await tx.itemCompra.create({
        data: {
          negocioId,
          compraId: compra.id,
          itemId: l.itemId,
          quantidade: l.quantidade.toFixed(3),
          custoUnitario: reais(l.custoUnitarioCentavos),
          totalLinha: reais(l.totalLinhaCentavos),
          custoComRateio: reais(l.custoComRateioCentavos),
          escolhaCusto: l.escolhaCusto,
          custoAnterior: reais(custoAnterior),
          custoNovo: reais(custoNovo),
        },
      });
    }

    // Contas a pagar (OPEN-004): toda compra, inclusive a à vista e a entrada. Nenhum lançamento no caixa.
    for (const c of valores.contas) await criarConta(tx, d, compra, c, usuarioId);
    return compra;
  }

  async function criarConta(tx: Tx, d: DadosDaCompra, compra: { id: string; numero: number }, c: ContaDaCompra, usuarioId: string) {
    await tx.contaPagarReceber.create({
      data: {
        negocioId,
        compraId: compra.id,
        tipo: "PAGAR",
        categoria: "FORNECEDORES",
        descricao: descricaoDaConta(compra.numero, c),
        valorTotal: reais(c.valorCentavos),
        vencimento: meioDia(c.vencimento),
        status: "ABERTA",
        criadaPorId: usuarioId,
        fornecedorId: d.fornecedorId,
        numeroDocumento: d.numeroDocumento,
      },
    });
  }
}

export type ConsultasDeCompras = ReturnType<typeof criarConsultasDeCompras>;
