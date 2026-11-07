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
      // SPEC-019 (5.7): o Administrador que suspendeu.
      suspensoPor: { modelo: "Usuario", fk: "suspensoPorId" },
      membros: { modelo: "MembroNegocio" },
      convites: { modelo: "Convite" },
      historicoPlanos: { modelo: "HistoricoPlano" },
      acessosSuporte: { modelo: "AcessoSuporte" },
      registrosSuporte: { modelo: "RegistroSuporte" },
      pedidosPlataforma: { modelo: "PedidoPlataforma" },
      itens: { modelo: "Item" },
      subcategorias: { modelo: "Subcategoria" },
      materiaisServico: { modelo: "MaterialServico" },
      movimentacoes: { modelo: "MovimentacaoEstoque" },
      historicoPrecos: { modelo: "HistoricoPreco" },
      historicoCustos: { modelo: "HistoricoCusto" },
      vendas: { modelo: "Venda" },
      itensVenda: { modelo: "ItemVenda" },
      pagamentos: { modelo: "Pagamento" },
      parcelas: { modelo: "Parcela" },
      lancamentos: { modelo: "LancamentoFinanceiro" },
      contas: { modelo: "ContaPagarReceber" },
      clientes: { modelo: "Cliente" },
      fornecedores: { modelo: "Fornecedor" },
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
  HistoricoPlano: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      usuario: { modelo: "Usuario", fk: "usuarioId" },
      // SPEC-019 (5.8): a troca pela plataforma aponta o pedido aprovado.
      pedido: { modelo: "PedidoPlataforma", fk: "pedidoId" },
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
      contas: { modelo: "ContaPagarReceber" },
    },
  },
  // SPEC-026: fornecedores do negócio.
  Fornecedor: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      contas: { modelo: "ContaPagarReceber" },
      despesasFixas: { modelo: "DespesaFixa" },
    },
  },
  Item: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      subcategoria: { modelo: "Subcategoria", fk: "subcategoriaId" },
      movimentacoes: { modelo: "MovimentacaoEstoque" },
      historicoPrecos: { modelo: "HistoricoPreco" },
      historicoCustos: { modelo: "HistoricoCusto" },
      materiais: { modelo: "MaterialServico" },
      usadoEm: { modelo: "MaterialServico" },
      itensVenda: { modelo: "ItemVenda" },
    },
  },
  // SPEC-020 (RF79): subcategoria livre do negócio dentro de uma categoria fixa.
  Subcategoria: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      itens: { modelo: "Item" },
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
  // SPEC-025 (RN41): custo do item ao longo do tempo, para o inventário numa data.
  HistoricoCusto: {
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
      fornecedor: { modelo: "Fornecedor", fk: "fornecedorId" },
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
      usuario: { modelo: "Usuario", fk: "usuarioId" },
      estornoDe: { modelo: "LancamentoFinanceiro", fk: "estornoDeId" },
      estornadoPor: { modelo: "LancamentoFinanceiro" },
    },
  },
  ContaPagarReceber: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      parcela: { modelo: "Parcela", fk: "parcelaId" },
      despesaFixa: { modelo: "DespesaFixa", fk: "despesaFixaId" },
      fornecedor: { modelo: "Fornecedor", fk: "fornecedorId" },
      cliente: { modelo: "Cliente", fk: "clienteId" },
      lancamentos: { modelo: "LancamentoFinanceiro" },
    },
  },

  // Globais (sem tenant)
  // SPEC-018: liberação do acesso de suporte e registro de auditoria (negocioId nulo só nos
  // eventos de papel, que nunca passam pelo cliente do negócio).
  AcessoSuporte: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      liberadoPor: { modelo: "Usuario", fk: "liberadoPorId" },
      revogadoPor: { modelo: "Usuario", fk: "revogadoPorId" },
      // SPEC-019 (5.6): a emergência aponta o pedido aprovado.
      pedido: { modelo: "PedidoPlataforma", fk: "pedidoId" },
      registros: { modelo: "RegistroSuporte" },
    },
  },
  RegistroSuporte: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      acesso: { modelo: "AcessoSuporte", fk: "acessoId" },
      usuario: { modelo: "Usuario", fk: "usuarioId" },
      // SPEC-019 (5.5): o desfazer aponta a correção desfeita.
      correcao: { modelo: "RegistroSuporte", fk: "correcaoId" },
      desfeitas: { modelo: "RegistroSuporte" },
      // SPEC-019 (5.8): os eventos de pedido apontam o pedido.
      pedido: { modelo: "PedidoPlataforma", fk: "pedidoId" },
    },
  },
  // SPEC-019 (5.6, 5.8): pedidos que precisam de uma segunda conta de Administrador.
  PedidoPlataforma: {
    classe: "operacional",
    relacoes: {
      negocio: { modelo: "Negocio", fk: "negocioId" },
      solicitadoPor: { modelo: "Usuario", fk: "solicitadoPorId" },
      decididoPor: { modelo: "Usuario", fk: "decididoPorId" },
      registros: { modelo: "RegistroSuporte" },
      trocasDePlano: { modelo: "HistoricoPlano" },
      acessoEmergencia: { modelo: "AcessoSuporte" },
    },
  },

  Usuario: {
    classe: "global",
    relacoes: {
      membroEm: { modelo: "MembroNegocio" },
      movimentacoes: { modelo: "MovimentacaoEstoque" },
      historicoPrecos: { modelo: "HistoricoPreco" },
      historicoCustos: { modelo: "HistoricoCusto" },
      vendasCanceladas: { modelo: "Venda" },
      vendasRegistradas: { modelo: "Venda" },
      lancamentos: { modelo: "LancamentoFinanceiro" },
      convitesEnviados: { modelo: "Convite" },
      planosAlterados: { modelo: "Negocio" },
      negociosSuspensos: { modelo: "Negocio" },
      trocasDePlano: { modelo: "HistoricoPlano" },
      acessosLiberados: { modelo: "AcessoSuporte" },
      acessosRevogados: { modelo: "AcessoSuporte" },
      registrosSuporte: { modelo: "RegistroSuporte" },
      pedidosFeitos: { modelo: "PedidoPlataforma" },
      pedidosDecididos: { modelo: "PedidoPlataforma" },
    },
  },
  FaixaTributaria: { classe: "global", relacoes: {} },
  CnaeAnexo: { classe: "global", relacoes: {} },
  ParametroMei: { classe: "global", relacoes: {} },
  ParametroFatorR: { classe: "global", relacoes: {} },
  MargemPadraoCategoria: { classe: "global", relacoes: {} },
  Ncm: { classe: "global", relacoes: {} }, // SPEC-021: tabela NCM oficial
  TabelaNcm: { classe: "global", relacoes: {} }, // SPEC-021: versão da tabela carregada
} as const satisfies Record<string, DefinicaoModelo>;

export type NomeModelo = keyof typeof MODELOS;

/**
 * SPEC-019 (5.7, INV-008): os modelos operacionais que continuam gravando com o negócio suspenso, e
 * por quê. Nos demais, o gatilho he_negocio_suspenso do banco recusa toda inclusão, alteração e
 * exclusão. O teste test/unit/modelos.test.ts confere as migrações contra esta lista.
 */
export const GRAVAM_NA_SUSPENSAO = {
  MembroNegocio: "a troca de plano pela plataforma e a exclusão de conta (as ações da Equipe são recusadas)",
  HistoricoPlano: "a troca de plano pela plataforma",
  Convite: "a expiração, o cancelamento e a anonimização da LGPD (o aceite é recusado no serviço)",
  AcessoSuporte: "a liberação, a revogação e a emergência",
  RegistroSuporte: "o registro do suporte, com a própria suspensão",
  PedidoPlataforma: "os pedidos de emergência e de plano",
} as const satisfies Partial<Record<NomeModelo, string>>;

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
