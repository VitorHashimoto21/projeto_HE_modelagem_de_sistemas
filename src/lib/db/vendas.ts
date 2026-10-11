import type { FormaPagamento, StatusConta, StatusVenda, TipoItem, TipoMovimentacao } from "@/generated/prisma/enums";
import { custoTotal } from "@/lib/dominio/catalogo";
import { intervaloDoDia } from "@/lib/dominio/datas";
import { dividirEmParcelas, ehImediato, paraCentavos, subtotalEmCentavos, vencimentoDaParcela } from "@/lib/dominio/venda";
import type { DadosDoCarrinho } from "@/lib/vendas/validacao";
import type { ClienteDoNegocio } from "./cliente-do-negocio";
import { EstoqueInsuficiente, instanteDaOcorrencia, movimentar } from "./estoque";

/**
 * Vendas do negócio ativo (SPEC-008). A venda inteira é uma transação (INV-001): número,
 * venda, itens, baixas de estoque (primitiva da SPEC-007), pagamentos, lançamentos e
 * parcelas com contas a receber. Preço e custo vêm sempre do banco (INV-002, INV-007).
 */

export class ItemNaoVendavel extends Error {
  constructor(public readonly nome: string, public readonly motivo: "sem-preco" | "arquivado" | "inexistente") {
    super("Item não pode ser vendido.");
    this.name = "ItemNaoVendavel";
  }
}
export class PrecoMudou extends Error {
  constructor(public readonly itens: { nome: string; precoCentavos: number }[]) {
    super("O preço mudou.");
    this.name = "PrecoMudou";
  }
}
export class SomaDivergente extends Error {
  constructor(public readonly totalCentavos: number) {
    super("A soma dos pagamentos não bate com o total.");
    this.name = "SomaDivergente";
  }
}
export class EstoqueInsuficienteNaVenda extends Error {
  constructor(public readonly nome: string, public readonly saldo: number, public readonly unidade: string) {
    super("Estoque insuficiente.");
    this.name = "EstoqueInsuficienteNaVenda";
  }
}
export class ClienteInvalido extends Error {
  constructor() {
    super("Cliente inválido.");
    this.name = "ClienteInvalido";
  }
}
export class VendaNaoEncontrada extends Error {
  constructor() {
    super("Venda não encontrada.");
    this.name = "VendaNaoEncontrada";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (d: unknown) => (d === null || d === undefined ? null : Number(String(d)));
const reais = (centavos: number) => (centavos / 100).toFixed(2);
const meioDia = (dia: string) => new Date(intervaloDoDia(dia).inicio.getTime() + 12 * 3_600_000);
const ehUnicidade = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

export type ItemVendavel = {
  id: string;
  nome: string;
  tipo: TipoItem;
  unidadeMedida: string;
  preco: number;
  /** Saldo do produto físico (null para serviço). */
  saldo: number | null;
  materiais: { materialId: string; nome: string; quantidade: number; saldo: number; unidadeMedida: string }[];
};

export type VendaResumida = {
  id: string;
  numero: number;
  data: Date;
  valorTotal: number;
  status: StatusVenda;
  cliente: string | null;
  registradaPor: string;
  itens: number;
  formas: FormaPagamento[];
};

export type DetalheDaVenda = VendaResumida & {
  itensVenda: { itemId: string; nome: string; unidadeMedida: string; quantidade: number; precoUnitario: number; subtotal: number }[];
  pagamentos: {
    forma: FormaPagamento;
    valor: number;
    parcelas: { numero: number; valor: number; vencimento: Date; status: StatusConta | null; valorPago: number }[];
  }[];
  movimentacoes: { itemId: string; nome: string; tipo: TipoMovimentacao; quantidade: number; saldoAnterior: number; saldoPosterior: number }[];
};

export function criarConsultasDeVendas(cliente: ClienteDoNegocio, negocioId: string) {
  return {
    /** Itens que podem entrar na venda: não arquivados e com preço oficial (RN23). */
    async itensVendaveis(): Promise<ItemVendavel[]> {
      const itens = await cliente.item.findMany({
        where: { arquivadoEm: null, precoAtual: { not: null } },
        select: {
          id: true,
          nome: true,
          tipo: true,
          unidadeMedida: true,
          precoAtual: true,
          quantidadeEstoque: true,
          materiais: { select: { materialId: true, quantidade: true, material: { select: { nome: true, quantidadeEstoque: true, unidadeMedida: true } } } },
        },
        orderBy: { nome: "asc" },
        take: 2000,
      });
      return itens.map((i) => ({
        id: i.id,
        nome: i.nome,
        tipo: i.tipo,
        unidadeMedida: i.unidadeMedida,
        preco: num(i.precoAtual)!,
        saldo: i.tipo === "PRODUTO_FISICO" ? num(i.quantidadeEstoque) : null,
        materiais: i.materiais.map((m) => ({
          materialId: m.materialId,
          nome: m.material.nome,
          quantidade: num(m.quantidade)!,
          saldo: num(m.material.quantidadeEstoque)!,
          unidadeMedida: m.material.unidadeMedida,
        })),
      }));
    },

    async clientes(): Promise<{ id: string; nome: string; contato: string | null }[]> {
      return cliente.cliente.findMany({
        where: { anonimizadoEm: null },
        select: { id: true, nome: true, contato: true },
        orderBy: { nome: "asc" },
        take: 1000,
      });
    },

    async criarCliente(nome: string, contato: string | null) {
      return cliente.cliente.create({ data: { negocioId, nome, contato }, select: { id: true, nome: true, contato: true } });
    },

    /**
     * Registra a venda (5.2). Se o carrinho já virou venda (clique duplo, rede lenta),
     * devolve a venda existente em vez de criar outra (INV-009).
     */
    async registrar(c: DadosDoCarrinho, usuarioId: string, agora = new Date()): Promise<{ id: string; numero: number; jaExistia: boolean }> {
      const existente = await cliente.venda.findFirst({ where: { id: c.id }, select: { id: true, numero: true } });
      if (existente) return { ...existente, jaExistia: true };

      // Linhas com preço e custo do banco (INV-002, INV-007).
      const itens = await cliente.item.findMany({
        where: { id: { in: c.linhas.map((l) => l.itemId) } },
        select: {
          id: true,
          nome: true,
          tipo: true,
          precoAtual: true,
          custoBase: true,
          arquivadoEm: true,
          materiais: { select: { materialId: true, quantidade: true, material: { select: { custoBase: true } } } },
        },
      });
      const porId = new Map(itens.map((i) => [i.id, i]));
      const linhas = c.linhas.map((l) => {
        const i = porId.get(l.itemId);
        if (!i) throw new ItemNaoVendavel("Item", "inexistente");
        if (i.arquivadoEm) throw new ItemNaoVendavel(i.nome, "arquivado");
        if (i.precoAtual === null) throw new ItemNaoVendavel(i.nome, "sem-preco");
        const precoCentavos = paraCentavos(num(i.precoAtual)!);
        const materiais = i.materiais.map((m) => ({ materialId: m.materialId, quantidade: num(m.quantidade)!, custo: num(m.material.custoBase)! }));
        return {
          ...l,
          nome: i.nome,
          tipo: i.tipo,
          precoCentavos,
          custo: custoTotal(num(i.custoBase)!, materiais),
          materiais,
          subtotal: subtotalEmCentavos(precoCentavos, l.quantidade),
        };
      });
      const total = linhas.reduce((s, l) => s + l.subtotal, 0);
      const pago = c.pagamentos.reduce((s, p) => s + p.valorCentavos, 0);
      if (pago !== total) {
        const mudaram = linhas.filter((l) => l.precoVistoCentavos !== null && l.precoVistoCentavos !== l.precoCentavos);
        if (mudaram.length) throw new PrecoMudou(mudaram.map((l) => ({ nome: l.nome, precoCentavos: l.precoCentavos })));
        throw new SomaDivergente(total);
      }
      if (c.clienteId && !(await cliente.cliente.findFirst({ where: { id: c.clienteId, anonimizadoEm: null }, select: { id: true } }))) {
        throw new ClienteInvalido();
      }

      const data = instanteDaOcorrencia(c.dia, agora);
      try {
        return await cliente.$transaction(
          async (tx) => {
            // Número sequencial (OPEN-007): a trava da linha do negócio serializa as vendas
            // do mesmo negócio; se a transação falhar, o incremento também é desfeito.
            const [{ numero }] = await tx.$queryRaw<{ numero: number }[]>`
              UPDATE "Negocio" SET "proximoNumeroVenda" = "proximoNumeroVenda" + 1
              WHERE id = ${negocioId}::uuid RETURNING "proximoNumeroVenda" - 1 AS numero`;
            const venda = await tx.venda.create({
              data: { id: c.id, negocioId, clienteId: c.clienteId, data, valorTotal: reais(total), numero, registradaPorId: usuarioId },
              select: { id: true, numero: true },
            });
            await tx.itemVenda.createMany({
              data: linhas.map((l) => ({
                negocioId,
                vendaId: venda.id,
                itemId: l.itemId,
                quantidade: l.quantidade.toFixed(3),
                precoUnitario: reais(l.precoCentavos),
                custoUnitario: l.custo.toFixed(2),
              })),
            });

            // Baixa de estoque (RN05, RN06): produto físico pela quantidade; serviço, pelos materiais.
            const baixar = async (itemId: string, quantidade: number, nome: string, exigirAtivo: boolean) => {
              try {
                await movimentar(tx as unknown as Parameters<typeof movimentar>[0], negocioId, { itemId, tipo: "SAIDA_VENDA", quantidade, vendaId: venda.id, data, usuarioId, exigirAtivo });
              } catch (e) {
                if (e instanceof EstoqueInsuficiente) {
                  const m = await tx.item.findFirst({ where: { id: itemId }, select: { nome: true, unidadeMedida: true } });
                  throw new EstoqueInsuficienteNaVenda(m?.nome ?? nome, e.saldo, m?.unidadeMedida ?? "");
                }
                throw e;
              }
            };
            for (const l of linhas) {
              if (l.tipo === "PRODUTO_FISICO") await baixar(l.itemId, l.quantidade, l.nome, true);
              else {
                for (const m of l.materiais) {
                  const q = Math.round(l.quantidade * m.quantidade * 1000) / 1000;
                  // Material arquivado continua sendo consumido pelo serviço (SPEC-006, OPEN-006).
                  if (q > 0) await baixar(m.materialId, q, l.nome, false);
                }
              }
            }

            // Pagamentos (RN09, RN10, RN11).
            for (const p of c.pagamentos) {
              const pagamento = await tx.pagamento.create({
                data: { negocioId, vendaId: venda.id, forma: p.forma, valor: reais(p.valorCentavos), parcelas: p.parcelas },
                select: { id: true },
              });
              if (ehImediato(p.forma)) {
                await tx.lancamentoFinanceiro.create({
                  data: { negocioId, vendaId: venda.id, origem: "VENDA", tipo: "ENTRADA", categoria: "VENDAS", valor: reais(p.valorCentavos), data, usuarioId },
                });
                continue;
              }
              const valores = dividirEmParcelas(p.valorCentavos, p.parcelas);
              for (let k = 1; k <= valores.length; k++) {
                const vencimento = meioDia(vencimentoDaParcela(c.dia, k));
                const parcela = await tx.parcela.create({
                  data: { negocioId, pagamentoId: pagamento.id, numero: k, valor: reais(valores[k - 1]), vencimento },
                  select: { id: true },
                });
                await tx.contaPagarReceber.create({
                  data: {
                    negocioId,
                    parcelaId: parcela.id,
                    tipo: "RECEBER",
                    categoria: "VENDAS",
                    descricao: `Venda nº ${venda.numero} — parcela ${k}/${valores.length}`,
                    valorTotal: reais(valores[k - 1]),
                    vencimento,
                    status: "ABERTA",
                  },
                });
              }
            }
            return { ...venda, jaExistia: false };
          },
          { timeout: 30_000 },
        );
      } catch (e) {
        // Envio simultâneo do mesmo carrinho: a outra transação gravou a venda primeiro.
        if (ehUnicidade(e)) {
          const gravada = await cliente.venda.findFirst({ where: { id: c.id }, select: { id: true, numero: true } });
          if (gravada) return { ...gravada, jaExistia: true };
        }
        throw e;
      }
    },

    /** Histórico (5.4): vendas no intervalo [inicio, fim), da mais nova para a mais antiga. */
    async listar(inicio: Date, fim: Date): Promise<{ vendas: VendaResumida[]; totalConcluidas: number }> {
      const vendas = await cliente.venda.findMany({
        where: { data: { gte: inicio, lt: fim } },
        orderBy: [{ data: "desc" }, { numero: "desc" }],
        take: 2000,
        select: {
          id: true,
          numero: true,
          data: true,
          valorTotal: true,
          status: true,
          cliente: { select: { nome: true } },
          registradaPor: { select: { nome: true } },
          pagamentos: { select: { forma: true } },
          _count: { select: { itens: true } },
        },
      });
      const lista = vendas.map((v) => ({
        id: v.id,
        numero: v.numero,
        data: v.data,
        valorTotal: num(v.valorTotal)!,
        status: v.status,
        cliente: v.cliente?.nome ?? null,
        registradaPor: v.registradaPor.nome,
        itens: v._count.itens,
        formas: [...new Set(v.pagamentos.map((p) => p.forma))],
      }));
      const totalConcluidas = lista.filter((v) => v.status === "CONCLUIDA").reduce((s, v) => s + paraCentavos(v.valorTotal), 0) / 100;
      return { vendas: lista, totalConcluidas };
    },

    async detalhar(id: string): Promise<DetalheDaVenda> {
      if (!UUID.test(id)) throw new VendaNaoEncontrada();
      const v = await cliente.venda.findFirst({
        where: { id },
        include: {
          cliente: { select: { nome: true } },
          registradaPor: { select: { nome: true } },
          itens: { include: { item: { select: { nome: true, unidadeMedida: true } } } },
          pagamentos: { include: { detalheParcelas: { include: { conta: { select: { status: true, valorPago: true } } }, orderBy: { numero: "asc" } } } },
          movimentacoes: { include: { item: { select: { nome: true } } }, orderBy: { registradoEm: "asc" } },
        },
      });
      if (!v) throw new VendaNaoEncontrada();
      return {
        id: v.id,
        numero: v.numero,
        data: v.data,
        valorTotal: num(v.valorTotal)!,
        status: v.status,
        cliente: v.cliente?.nome ?? null,
        registradaPor: v.registradaPor.nome,
        itens: v.itens.length,
        formas: [...new Set(v.pagamentos.map((p) => p.forma))],
        itensVenda: v.itens.map((i) => ({
          itemId: i.itemId,
          nome: i.item.nome,
          unidadeMedida: i.item.unidadeMedida,
          quantidade: num(i.quantidade)!,
          precoUnitario: num(i.precoUnitario)!,
          subtotal: subtotalEmCentavos(paraCentavos(num(i.precoUnitario)!), num(i.quantidade)!) / 100,
        })),
        pagamentos: v.pagamentos.map((p) => ({
          forma: p.forma,
          valor: num(p.valor)!,
          parcelas: p.detalheParcelas.map((pa) => ({
            numero: pa.numero,
            valor: num(pa.valor)!,
            vencimento: pa.vencimento,
            status: pa.conta?.status ?? null,
            valorPago: num(pa.conta?.valorPago ?? 0)!,
          })),
        })),
        movimentacoes: v.movimentacoes.map((m) => ({
          itemId: m.itemId,
          nome: m.item.nome,
          tipo: m.tipo,
          quantidade: num(m.quantidade)!,
          saldoAnterior: num(m.saldoAnterior)!,
          saldoPosterior: num(m.saldoPosterior)!,
        })),
      };
    },
  };
}

export type ConsultasDeVendas = ReturnType<typeof criarConsultasDeVendas>;
