/**
 * Classificação dos modelos para o isolamento multi-tenant (SPEC-001, seção 7).
 *
 * Este mapa é a referência da extensão "cliente do negócio". O teste
 * test/unit/modelos.test.ts o compara com prisma/schema.prisma: um modelo novo
 * sem classificação, um modelo operacional sem `negocioId` ou uma relação fora
 * do mapa fazem o teste falhar (INV-006).
 */

export type ClasseModelo = "operacional" | "ancora" | "global";

export type Relacao = {
  /** Modelo de destino da relação. */
  modelo: string;
  /** Campo de chave estrangeira neste modelo, quando a relação é "para um" com FK aqui. */
  fk?: string;
};

export type DefinicaoModelo = {
  classe: ClasseModelo;
  relacoes: Record<string, Relacao>;
};

export const MODELOS = {
  // Âncora do tenant
  Negocio: {
    classe: "ancora",
    relacoes: {
      planoAlteradoPor: { modelo: "Usuario", fk: "planoAlteradoPorId" },
      membros: { modelo: "MembroNegocio" },
      convites: { modelo: "Convite" },
      itens: { modelo: "Item" },
      materiaisServico: { modelo: "MaterialServico" },
      movimentacoes: { modelo: "MovimentacaoEstoque" },
      historicoPrecos: { modelo: "HistoricoPreco" },
      vendas: { modelo: "Venda" },
      itensVenda: { modelo: "ItemVenda" },
      pagamentos: { modelo: "Pagamento" },
      parcelas: { modelo: "Parcela" },
      lancamentos: { modelo: "LancamentoFinanceiro" },
      contas: { modelo: "ContaPagarReceber" },
      clientes: { modelo: "Cliente" },
      despesasFixas: { modelo: "DespesaFixa" },
    },
  },

  // Operacionais (todos com negocioId)
  MembroNegocio: {
    classe: "operacional",
    relacoes: {
      usuario: { modelo: "Usuario", fk: "usuarioId" },
      negocio: { modelo: "Negocio", fk: "negocioId" },
    },
  },
  Convite: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      convidadoPor: { modelo: "Usuario", fk: "convidadoPorId" },
    },
  },
  Cliente: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      vendas: { modelo: "Venda" },
    },
  },
  Item: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      movimentacoes: { modelo: "MovimentacaoEstoque" },
      historicoPrecos: { modelo: "HistoricoPreco" },
      materiais: { modelo: "MaterialServico" },
      usadoEm: { modelo: "MaterialServico" },
      itensVenda: { modelo: "ItemVenda" },
    },
  },
  MaterialServico: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      servico: { modelo: "Item", fk: "servicoId" },
      material: { modelo: "Item", fk: "materialId" },
    },
  },
  MovimentacaoEstoque: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      item: { modelo: "Item", fk: "itemId" },
      venda: { modelo: "Venda", fk: "vendaId" },
      usuario: { modelo: "Usuario", fk: "usuarioId" },
    },
  },
  HistoricoPreco: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      item: { modelo: "Item", fk: "itemId" },
      usuario: { modelo: "Usuario", fk: "usuarioId" },
    },
  },
  DespesaFixa: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      contas: { modelo: "ContaPagarReceber" },
    },
  },
  Venda: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      cliente: { modelo: "Cliente", fk: "clienteId" },
      canceladaPor: { modelo: "Usuario", fk: "canceladaPorId" },
      registradaPor: { modelo: "Usuario", fk: "registradaPorId" },
      vendaOrigem: { modelo: "Venda", fk: "vendaOrigemId" },
      vendaTroca: { modelo: "Venda" },
      itens: { modelo: "ItemVenda" },
      movimentacoes: { modelo: "MovimentacaoEstoque" },
      pagamentos: { modelo: "Pagamento" },
      lancamentos: { modelo: "LancamentoFinanceiro" },
    },
  },
  ItemVenda: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      venda: { modelo: "Venda", fk: "vendaId" },
      item: { modelo: "Item", fk: "itemId" },
    },
  },
  Pagamento: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      venda: { modelo: "Venda", fk: "vendaId" },
      detalheParcelas: { modelo: "Parcela" },
    },
  },
  Parcela: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      pagamento: { modelo: "Pagamento", fk: "pagamentoId" },
      conta: { modelo: "ContaPagarReceber" },
    },
  },
  LancamentoFinanceiro: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      venda: { modelo: "Venda", fk: "vendaId" },
      conta: { modelo: "ContaPagarReceber", fk: "contaId" },
    },
  },
  ContaPagarReceber: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      parcela: { modelo: "Parcela", fk: "parcelaId" },
      despesaFixa: { modelo: "DespesaFixa", fk: "despesaFixaId" },
      lancamentos: { modelo: "LancamentoFinanceiro" },
    },
  },

  // Globais (sem tenant)
  Usuario: {
    classe: "global",
    relacoes: {
      membroEm: { modelo: "MembroNegocio" },
      movimentacoes: { modelo: "MovimentacaoEstoque" },
      historicoPrecos: { modelo: "HistoricoPreco" },
      vendasCanceladas: { modelo: "Venda" },
      vendasRegistradas: { modelo: "Venda" },
      convitesEnviados: { modelo: "Convite" },
      planosAlterados: { modelo: "Negocio" },
    },
  },
  FaixaTributaria: { classe: "global", relacoes: {} },
  CnaeAnexo: { classe: "global", relacoes: {} },
  ParametroMei: { classe: "global", relacoes: {} },
  ParametroFatorR: { classe: "global", relacoes: {} },
  MargemPadraoCategoria: { classe: "global", relacoes: {} },
} as const satisfies Record<string, DefinicaoModelo>;

export type NomeModelo = keyof typeof MODELOS;

export function definicaoDoModelo(modelo: string): DefinicaoModelo | undefined {
  return (MODELOS as Record<string, DefinicaoModelo>)[modelo];
}

export function ehOperacional(modelo: string): boolean {
  return definicaoDoModelo(modelo)?.classe === "operacional";
}

/**
 * Relações "para um" entre dois modelos operacionais, com a FK no modelo de origem.
 * Cada uma é protegida no banco por um gatilho que exige o mesmo negocioId nos dois lados (INV-005).
 */
export function relacoesEntreOperacionais(): { modelo: string; fk: string; destino: string }[] {
  const lista: { modelo: string; fk: string; destino: string }[] = [];
  for (const [modelo, def] of Object.entries(MODELOS as Record<string, DefinicaoModelo>)) {
    if (def.classe !== "operacional") continue;
    for (const rel of Object.values(def.relacoes)) {
      if (rel.fk && rel.fk !== "negocioId" && ehOperacional(rel.modelo)) {
        lista.push({ modelo, fk: rel.fk, destino: rel.modelo });
      }
    }
  }
  return lista;
}
