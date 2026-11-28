import { nomeDeExibicao } from "@/lib/dominio/cliente";
import { diaLocal, intervaloDoDia } from "@/lib/dominio/datas";
import { estaAtrasada, restanteDaConta } from "@/lib/dominio/financeiro";
import type { FormaDoPagamento } from "@/lib/dominio/contas";
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
import { numeroDaBusca, pagamentoDaCompra, type FiltrosDasCompras, type PagamentoDaCompra, type SituacaoDaCompra } from "@/lib/dominio/lista-de-compras";
import { mascararNome } from "@/lib/dominio/suporte";
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
/** Detalhar compra (seção 9): id inválido, de outro negócio ou inexistente. */
export class CompraNaoEncontrada extends Error {
  constructor() {
    super("Compra não encontrada.");
    this.name = "CompraNaoEncontrada";
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

/** Produto na tela da compra (OPEN-003): físico e ativo, com o saldo e o custo atual. */
export type ProdutoDaCompra = { id: string; nome: string; codigo: string | null; unidadeMedida: string; custoCentavos: number; saldo: number };

export type CompraRegistrada = { id: string; numero: number; jaExistia: boolean; custosNovos: { itemId: string; nome: string }[] };

/** O resumo antes de confirmar (5.1, item 4). */
export type ResumoDaCompra = Omit<ValoresDaCompra, "linhas"> & {
  linhas: LinhaDoResumo[];
  freteCentavos: number;
  outrasDespesasCentavos: number;
  descontoCentavos: number;
};

export const COMPRAS_POR_PAGINA = 100;

/** Uma compra na lista (5.6). */
export type CompraDaLista = {
  id: string;
  numero: number;
  /** Data da compra (AAAA-MM-DD). */
  data: string;
  fornecedor: string;
  numeroDocumento: string | null;
  semNotaFiscal: boolean;
  totalCentavos: number;
  condicao: "A_VISTA" | "A_PRAZO";
  /** A situação das contas; nula na compra cancelada. */
  pagamento: PagamentoDaCompra | null;
  situacao: SituacaoDaCompra;
};

export type ListaDeCompras = {
  compras: CompraDaLista[];
  pagina: number;
  paginas: number;
  /** Totais de todas as páginas, sem as canceladas (5.6). */
  quantidade: number;
  totalCentavos: number;
  canceladas: number;
  /** Compras anteriores ao histórico do plano gratuito, fora da lista (SPEC-013). */
  ocultasPeloPlano: number;
};

const diaDe = (d: Date) => d.toISOString().slice(0, 10);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const centavos = (d: unknown) => paraCentavos(num(d) ?? 0);

/** O detalhe da compra (5.6). */
export type DetalheDaCompra = {
  id: string;
  numero: number;
  data: string;
  /** No modo suporte, o nome sai mascarado; `id` nulo quando não há o que abrir (anonimizado ou suporte). */
  fornecedor: { id: string | null; nome: string };
  numeroDocumento: string | null;
  semNotaFiscal: boolean;
  observacao: string | null;
  valorProdutosCentavos: number;
  freteCentavos: number;
  outrasDespesasCentavos: number;
  descontoCentavos: number;
  totalCentavos: number;
  condicao: "A_VISTA" | "A_PRAZO";
  entradaCentavos: number | null;
  situacao: SituacaoDaCompra;
  pagamento: PagamentoDaCompra | null;
  registradaPor: string;
  registradaEm: Date;
  cancelamento: { por: string | null; em: Date; motivo: string } | null;
  produtos: {
    itemId: string;
    nome: string;
    codigo: string | null;
    unidadeMedida: string;
    quantidade: number;
    custoUnitarioCentavos: number;
    totalLinhaCentavos: number;
    custoComRateioCentavos: number;
    escolhaCusto: EscolhaDeCusto;
    custoAnteriorCentavos: number;
    custoNovoCentavos: number;
  }[];
  contas: {
    id: string;
    descricao: string | null;
    totalCentavos: number;
    pagoCentavos: number;
    restanteCentavos: number;
    vencimento: string;
    status: "ABERTA" | "PARCIAL" | "QUITADA" | "CANCELADA";
    atrasada: boolean;
    pagamentos: { data: Date; valorCentavos: number; forma: FormaDoPagamento | null; estornado: boolean }[];
  }[];
  /** Pago e em aberto, somando as contas não canceladas. */
  pagoCentavos: number;
  emAbertoCentavos: number;
  entradas: { itemId: string; nome: string; tipo: string; quantidade: number; saldoAnterior: number; saldoPosterior: number }[];
};
const dataDoDia = (dia: string) => new Date(`${dia}T00:00:00Z`);

export function criarConsultasDeCompras(cliente: ClienteDoNegocio, negocioId: string, opcoes: { mascararNomes?: boolean } = {}) {
  /** 5.9: no modo suporte, o nome do fornecedor sai mascarado (SPEC-026, OPEN-011). */
  const nomeVisto = (f: Parameters<typeof nomeDeExibicao>[0]) => (opcoes.mascararNomes ? mascararNome(nomeDeExibicao(f)) : nomeDeExibicao(f));

  /** Busca (5.6): nome do fornecedor, nº do documento ou nº da compra. No suporte, o nome não é buscado. */
  function condicaoDaBusca(busca: string) {
    const numero = numeroDaBusca(busca);
    return {
      OR: [
        { numeroDocumento: { contains: busca, mode: "insensitive" as const } },
        ...(numero !== null ? [{ numero }] : []),
        ...(opcoes.mascararNomes
          ? []
          : [{ fornecedor: { is: { OR: [{ nome: { contains: busca, mode: "insensitive" as const } }, { nomeFantasia: { contains: busca, mode: "insensitive" as const } }] } } }]),
      ],
    };
  }

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

  /** 5.1, item 6: os produtos cujo custo mudou pela compra, para revisar o preço na Calculadora. */
  async function custosNovosDa(compraId: string): Promise<{ itemId: string; nome: string }[]> {
    const linhas = await cliente.itemCompra.findMany({ where: { compraId }, select: { itemId: true, custoAnterior: true, custoNovo: true, item: { select: { nome: true } } } });
    return linhas
      .filter((l) => num(l.custoNovo) !== num(l.custoAnterior))
      .map((l) => ({ itemId: l.itemId, nome: l.item.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
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
    /**
     * Listar compras (5.6): busca, período da data da compra, fornecedor e situação, das mais recentes
     * para as mais antigas. O total soma todas as páginas, sem as canceladas. No plano gratuito, só a
     * partir de `desde` (os últimos 12 meses).
     */
    async listar(f: { filtros: FiltrosDasCompras; pagina?: number; desde?: string | null }): Promise<ListaDeCompras> {
      const { filtros } = f;
      // O início é o mais recente entre o filtro e o limite do plano.
      const inicio = [f.desde, filtros.de].filter((d): d is string => Boolean(d)).sort().at(-1);
      const data = { ...(inicio ? { gte: dataDoDia(inicio) } : {}), ...(filtros.ate ? { lte: dataDoDia(filtros.ate) } : {}) };
      const where = {
        AND: [
          Object.keys(data).length ? { data } : {},
          filtros.fornecedorId ? { fornecedorId: filtros.fornecedorId } : {},
          filtros.situacao ? { situacao: filtros.situacao } : {},
          filtros.busca ? condicaoDaBusca(filtros.busca) : {},
        ],
      };
      const registradas = { AND: [where, { situacao: "REGISTRADA" as const }] };
      const [total, soma, canceladas, ocultasPeloPlano] = await Promise.all([
        cliente.compra.count({ where }),
        cliente.compra.aggregate({ where: registradas, _sum: { total: true }, _count: true }),
        cliente.compra.count({ where: { AND: [where, { situacao: "CANCELADA" as const }] } }),
        f.desde ? cliente.compra.count({ where: { data: { lt: dataDoDia(f.desde) } } }) : Promise.resolve(0),
      ]);
      const paginas = Math.max(1, Math.ceil(total / COMPRAS_POR_PAGINA));
      const pagina = Math.min(Math.max(1, Math.floor(f.pagina ?? 1) || 1), paginas);
      const linhas = await cliente.compra.findMany({
        where,
        orderBy: [{ data: "desc" }, { numero: "desc" }],
        skip: (pagina - 1) * COMPRAS_POR_PAGINA,
        take: COMPRAS_POR_PAGINA,
        select: {
          id: true,
          numero: true,
          data: true,
          numeroDocumento: true,
          semNotaFiscal: true,
          total: true,
          condicao: true,
          situacao: true,
          fornecedor: { select: { tipo: true, nome: true, nomeFantasia: true } },
          contas: { select: { status: true } },
        },
      });
      return {
        compras: linhas.map((c) => ({
          id: c.id,
          numero: c.numero,
          data: diaDe(c.data),
          fornecedor: nomeVisto(c.fornecedor),
          numeroDocumento: c.numeroDocumento,
          semNotaFiscal: c.semNotaFiscal,
          totalCentavos: paraCentavos(num(c.total)!),
          condicao: c.condicao,
          pagamento: c.situacao === "CANCELADA" ? null : pagamentoDaCompra(c.contas.map((k) => k.status)),
          situacao: c.situacao,
        })),
        pagina,
        paginas,
        quantidade: soma._count,
        totalCentavos: paraCentavos(num(soma._sum.total ?? 0)!),
        canceladas,
        ocultasPeloPlano,
      };
    },

    /**
     * Detalhar compra (5.6, seção 9): os dados, os produtos com os custos, as contas com os pagamentos, as
     * entradas no estoque, quem registrou e, se cancelada, quem cancelou, quando e o motivo.
     */
    async detalhar(id: string, hoje: string): Promise<DetalheDaCompra> {
      if (!UUID.test(id)) throw new CompraNaoEncontrada();
      const c = await cliente.compra.findFirst({
        where: { id },
        select: {
          id: true,
          numero: true,
          data: true,
          numeroDocumento: true,
          semNotaFiscal: true,
          observacao: true,
          valorProdutos: true,
          frete: true,
          outrasDespesas: true,
          desconto: true,
          total: true,
          condicao: true,
          valorEntrada: true,
          situacao: true,
          registradaEm: true,
          canceladaEm: true,
          motivoCancelamento: true,
          fornecedor: { select: { id: true, tipo: true, nome: true, nomeFantasia: true, anonimizadoEm: true } },
          registradaPor: { select: { nome: true } },
          canceladaPor: { select: { nome: true } },
          itens: {
            select: {
              itemId: true,
              quantidade: true,
              custoUnitario: true,
              totalLinha: true,
              custoComRateio: true,
              escolhaCusto: true,
              custoAnterior: true,
              custoNovo: true,
              item: { select: { nome: true, codigo: true, unidadeMedida: true } },
            },
          },
          contas: {
            orderBy: [{ vencimento: "asc" }, { descricao: "asc" }],
            select: {
              id: true,
              descricao: true,
              valorTotal: true,
              valorPago: true,
              valorDesconto: true,
              valorAcrescimo: true,
              vencimento: true,
              status: true,
              lancamentos: {
                where: { origem: "CONTA" },
                orderBy: { data: "asc" },
                select: { data: true, valor: true, formaPagamento: true, estornadoPor: { select: { id: true } } },
              },
            },
          },
          movimentacoes: { orderBy: { registradoEm: "asc" }, select: { itemId: true, tipo: true, quantidade: true, saldoAnterior: true, saldoPosterior: true, item: { select: { nome: true } } } },
        },
      });
      if (!c) throw new CompraNaoEncontrada();
      const contas = c.contas.map((k) => {
        const valores = { totalCentavos: centavos(k.valorTotal), pagoCentavos: centavos(k.valorPago), descontoCentavos: centavos(k.valorDesconto), acrescimoCentavos: centavos(k.valorAcrescimo) };
        const vencimento = diaLocal(k.vencimento);
        return {
          id: k.id,
          descricao: k.descricao,
          totalCentavos: valores.totalCentavos,
          restanteCentavos: k.status === "CANCELADA" ? 0 : restanteDaConta(valores),
          vencimento,
          status: k.status,
          atrasada: estaAtrasada({ ...valores, vencimento, status: k.status }, hoje),
          pagoCentavos: valores.pagoCentavos,
          pagamentos: k.lancamentos.map((l) => ({ data: l.data, valorCentavos: centavos(l.valor), forma: l.formaPagamento, estornado: l.estornadoPor !== null })),
        };
      });
      const validas = contas.filter((k) => k.status !== "CANCELADA");
      return {
        id: c.id,
        numero: c.numero,
        data: diaDe(c.data),
        fornecedor: { id: c.fornecedor.anonimizadoEm || opcoes.mascararNomes ? null : c.fornecedor.id, nome: nomeVisto(c.fornecedor) },
        numeroDocumento: c.numeroDocumento,
        semNotaFiscal: c.semNotaFiscal,
        observacao: c.observacao,
        valorProdutosCentavos: centavos(c.valorProdutos),
        freteCentavos: centavos(c.frete),
        outrasDespesasCentavos: centavos(c.outrasDespesas),
        descontoCentavos: centavos(c.desconto),
        totalCentavos: centavos(c.total),
        condicao: c.condicao,
        entradaCentavos: c.valorEntrada === null ? null : centavos(c.valorEntrada),
        situacao: c.situacao,
        pagamento: c.situacao === "CANCELADA" ? null : pagamentoDaCompra(c.contas.map((k) => k.status)),
        registradaPor: c.registradaPor.nome,
        registradaEm: c.registradaEm,
        cancelamento: c.situacao === "CANCELADA" ? { por: c.canceladaPor?.nome ?? null, em: c.canceladaEm!, motivo: c.motivoCancelamento! } : null,
        produtos: c.itens
          .map((i) => ({
            itemId: i.itemId,
            nome: i.item.nome,
            codigo: i.item.codigo,
            unidadeMedida: i.item.unidadeMedida,
            quantidade: num(i.quantidade)!,
            custoUnitarioCentavos: centavos(i.custoUnitario),
            totalLinhaCentavos: centavos(i.totalLinha),
            custoComRateioCentavos: centavos(i.custoComRateio),
            escolhaCusto: i.escolhaCusto,
            custoAnteriorCentavos: centavos(i.custoAnterior),
            custoNovoCentavos: centavos(i.custoNovo),
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
        contas,
        pagoCentavos: validas.reduce((s, k) => s + k.pagoCentavos, 0),
        emAbertoCentavos: validas.reduce((s, k) => s + k.restanteCentavos, 0),
        entradas: c.movimentacoes.map((m) => ({
          itemId: m.itemId,
          nome: m.item.nome,
          tipo: m.tipo,
          quantidade: num(m.quantidade)!,
          saldoAnterior: num(m.saldoAnterior)!,
          saldoPosterior: num(m.saldoPosterior)!,
        })),
      };
    },

    /** Os produtos que podem entrar na compra (OPEN-003, 5.2): só os físicos ativos. */
    async produtosDisponiveis(): Promise<ProdutoDaCompra[]> {
      const itens = await cliente.item.findMany({
        where: { tipo: "PRODUTO_FISICO", arquivadoEm: null },
        select: { id: true, nome: true, codigo: true, unidadeMedida: true, custoBase: true, quantidadeEstoque: true },
        orderBy: { nome: "asc" },
        take: 2000,
      });
      return itens.map((i) => ({ id: i.id, nome: i.nome, codigo: i.codigo, unidadeMedida: i.unidadeMedida, custoCentavos: paraCentavos(num(i.custoBase)!), saldo: num(i.quantidadeEstoque)! }));
    },

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
    async registrar(d: DadosDaCompra, usuarioId: string, agora = new Date()): Promise<CompraRegistrada> {
      const existente = await cliente.compra.findFirst({ where: { id: d.id }, select: { id: true, numero: true } });
      if (existente) return { ...existente, jaExistia: true, custosNovos: await custosNovosDa(existente.id) };
      const valores = valoresDa(d);
      await conferirFornecedor(d.fornecedorId);
      await conferirDocumento(d);
      await produtos(d);
      let gravada: { id: string; numero: number; jaExistia: boolean };
      try {
        gravada = await cliente.$transaction(async (tx) => ({ ...(await gravar(tx as unknown as Tx, d, valores, usuarioId, agora)), jaExistia: false }), {
          timeout: 30_000,
        });
      } catch (e) {
        if (!ehUnicidade(e)) throw e;
        // Envio simultâneo da mesma compra, ou outra compra com o mesmo documento gravada antes (INV-011).
        const outra = await cliente.compra.findFirst({ where: { id: d.id }, select: { id: true, numero: true } });
        if (!outra) {
          await conferirDocumento(d);
          throw e;
        }
        gravada = { ...outra, jaExistia: true };
      }
      return { ...gravada, custosNovos: await custosNovosDa(gravada.id) };
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
