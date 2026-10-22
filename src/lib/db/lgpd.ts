import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { diaLocal } from "@/lib/dominio/datas";
import {
  CLIENTE_ANONIMO,
  dataDeEliminacao,
  DIAS_ATE_LIMPAR_CONVITE,
  DOMINIO_ANONIMO,
  emailAnonimo,
  NOME_ANONIMO,
  type DadosDoTitular,
  type Linha,
  type Tabelas,
  type Valor,
} from "@/lib/dominio/lgpd";

/**
 * LGPD (SPEC-014). Fora do cliente do negócio, como as consultas de acesso: a exportação e
 * a exclusão atravessam todos os negócios do titular. Toda consulta filtra pelo usuário da
 * sessão e pelos negócios dele (INV-004).
 */

export type ResumoDaExclusao = {
  email: string;
  encerrar: { id: string; nome: string; membrosAfetados: number }[];
  deixar: { id: string; nome: string; papel: "GERENTE" | "COLABORADOR" }[];
};

export type ResultadoDaExclusao = { ok: true; negociosEncerrados: number } | { ok: false; erro: "JaExcluida" | "UsuarioNaoEncontrado" };

/** Valor serializável: datas em ISO 8601, Decimal e BigInt como texto, JSON como texto. */
function valor(v: unknown): Valor {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (Prisma.Decimal.isDecimal(v)) return (v as Prisma.Decimal).toString();
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "object") return JSON.stringify(v);
  return v as Valor;
}
const linha = (o: Record<string, unknown>): Linha => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, valor(v)]));
const linhas = (lista: Record<string, unknown>[]) => lista.map(linha);

export function criarConsultasDaLgpd(cliente: PrismaClient) {
  /** Negócios ativos do titular, separados em "é o Dono" e "é membro". */
  async function vinculosAtivos(usuarioId: string) {
    const vinculos = await cliente.membroNegocio.findMany({
      where: { usuarioId, negocio: { encerradoEm: null } },
      select: { papel: true, negocioId: true, negocio: { select: { nome: true } } },
    });
    return { dono: vinculos.filter((v) => v.papel === "DONO"), membro: vinculos.filter((v) => v.papel !== "DONO") };
  }

  return {
    /** Dados mostrados em "Minha conta" (5.1). */
    async perfil(usuarioId: string) {
      return cliente.usuario.findFirst({
        where: { id: usuarioId, excluidoEm: null },
        select: { nome: true, email: true, consentimentoLgpdEm: true, versaoTermosAceita: true, termosAceitosEm: true, createdAt: true },
      });
    },

    /** O que a exclusão vai afetar (5.3): negócios a encerrar (com membros) e a deixar. */
    async resumoDaExclusao(usuarioId: string): Promise<ResumoDaExclusao | null> {
      const u = await cliente.usuario.findUnique({ where: { id: usuarioId }, select: { email: true, excluidoEm: true } });
      if (!u || u.excluidoEm) return null;
      const { dono, membro } = await vinculosAtivos(usuarioId);
      const contagens = await Promise.all(dono.map((v) => cliente.membroNegocio.count({ where: { negocioId: v.negocioId, usuarioId: { not: usuarioId } } })));
      return {
        email: u.email,
        encerrar: dono.map((v, i) => ({ id: v.negocioId, nome: v.negocio.nome, membrosAfetados: contagens[i] })),
        deixar: membro.map((v) => ({ id: v.negocioId, nome: v.negocio.nome, papel: v.papel as "GERENTE" | "COLABORADOR" })),
      };
    },

    /** Dados do titular para a exportação (RNF04), no escopo do OPEN-004. */
    async dadosDoTitular(usuarioId: string, agora: Date): Promise<DadosDoTitular | null> {
      const u = await cliente.usuario.findUnique({
        where: { id: usuarioId },
        select: { id: true, nome: true, email: true, consentimentoLgpdEm: true, versaoTermosAceita: true, termosAceitosEm: true, createdAt: true, excluidoEm: true },
      });
      if (!u || u.excluidoEm) return null;
      const [vinculos, convitesRecebidos] = await Promise.all([
        cliente.membroNegocio.findMany({
          where: { usuarioId, negocio: { encerradoEm: null } },
          select: { negocioId: true, papel: true, permissoesCustom: true, suspensoEm: true, negocio: { select: { nome: true } } },
        }),
        cliente.convite.findMany({
          where: { email: u.email },
          select: { id: true, negocioId: true, papel: true, status: true, createdAt: true, expiraEm: true, respondidoEm: true, negocio: { select: { nome: true } } },
        }),
      ]);

      const donos = vinculos.filter((v) => v.papel === "DONO").map((v) => v.negocioId);
      const outros = vinculos.filter((v) => v.papel !== "DONO").map((v) => v.negocioId);

      const negociosComoDono = await Promise.all(
        donos.map(async (negocioId) => {
          const f = { where: { negocioId } };
          const [negocio, membros, convites, itens, subcategorias, materiais, movimentacoes, historicoPrecos, vendas, itensVenda, pagamentos, parcelas, clientes, lancamentos, contas, despesasFixas, historicoPlano, acessosSuporte, registrosSuporte] =
            await Promise.all([
              cliente.negocio.findUniqueOrThrow({ where: { id: negocioId } }),
              cliente.membroNegocio.findMany({ ...f, select: { id: true, papel: true, permissoesCustom: true, suspensoEm: true, usuarioId: true, usuario: { select: { nome: true, email: true } } } }),
              cliente.convite.findMany({ ...f, select: { id: true, email: true, papel: true, status: true, createdAt: true, expiraEm: true, respondidoEm: true } }),
              cliente.item.findMany(f),
              // SPEC-020 (RNF04): subcategorias do negócio; os itens trazem a referência (subcategoriaId).
              cliente.subcategoria.findMany(f),
              cliente.materialServico.findMany(f),
              cliente.movimentacaoEstoque.findMany(f),
              cliente.historicoPreco.findMany(f),
              cliente.venda.findMany(f),
              cliente.itemVenda.findMany(f),
              cliente.pagamento.findMany(f),
              cliente.parcela.findMany(f),
              cliente.cliente.findMany(f),
              cliente.lancamentoFinanceiro.findMany(f),
              cliente.contaPagarReceber.findMany(f),
              cliente.despesaFixa.findMany(f),
              cliente.historicoPlano.findMany(f),
              // SPEC-018 (RNF04): acessos do suporte liberados e o registro de auditoria de cada um.
              cliente.acessoSuporte.findMany(f),
              cliente.registroSuporte.findMany({ ...f, select: { id: true, acessoId: true, evento: true, modulo: true, descricao: true, criadoEm: true, usuario: { select: { nome: true } } } }),
            ]);
          const tabelas: Tabelas = {
            membros: membros.map(({ usuario, ...m }) => linha({ ...m, nome: usuario.nome, email: usuario.email })),
            convites: linhas(convites),
            itens: linhas(itens),
            subcategorias: linhas(subcategorias),
            materiaisServico: linhas(materiais),
            movimentacoesEstoque: linhas(movimentacoes),
            historicoPrecos: linhas(historicoPrecos),
            vendas: linhas(vendas),
            itensVenda: linhas(itensVenda),
            pagamentos: linhas(pagamentos),
            parcelas: linhas(parcelas),
            clientes: linhas(clientes),
            lancamentosFinanceiros: linhas(lancamentos),
            contasPagarReceber: linhas(contas),
            despesasFixas: linhas(despesasFixas),
            historicoPlano: linhas(historicoPlano),
            acessosSuporte: linhas(acessosSuporte),
            registrosSuporte: registrosSuporte.map(({ usuario, ...r }) => linha({ ...r, autor: usuario.nome })),
          };
          return { negocio: linha(negocio), tabelas };
        }),
      );

      const registrosEmOutrosNegocios = await Promise.all(
        outros.map(async (negocioId) => {
          const [negocio, vendas, movimentacoes, lancamentos] = await Promise.all([
            cliente.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { id: true, nome: true } }),
            cliente.venda.findMany({ where: { negocioId, registradaPorId: usuarioId } }),
            cliente.movimentacaoEstoque.findMany({ where: { negocioId, usuarioId } }),
            cliente.lancamentoFinanceiro.findMany({ where: { negocioId, usuarioId } }),
          ]);
          return { negocio: linha(negocio), tabelas: { vendasRegistradas: linhas(vendas), movimentacoesEstoque: linhas(movimentacoes), lancamentosFinanceiros: linhas(lancamentos) } };
        }),
      );

      return {
        geradoEm: agora.toISOString(),
        titular: linha(u),
        vinculos: vinculos.map(({ negocio, ...v }) => linha({ ...v, negocio: negocio.nome })),
        convitesRecebidos: convitesRecebidos.map(({ negocio, ...c }) => linha({ ...c, negocio: negocio.nome })),
        negociosComoDono,
        registrosEmOutrosNegocios,
      };
    },

    /**
     * Exclusão (RN27, 5.3) numa transação. A marcação condicional (`excluidoEm IS NULL`)
     * trava o usuário: um segundo pedido simultâneo espera e não faz nada (INV-003).
     */
    async excluirConta(usuarioId: string, agora: Date): Promise<ResultadoDaExclusao> {
      return cliente.$transaction(async (tx) => {
        const atual = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { email: true, administradorEm: true } });
        if (!atual) return { ok: false, erro: "UsuarioNaoEncontrado" };
        const marcado = await tx.usuario.updateMany({
          where: { id: usuarioId, excluidoEm: null },
          // SPEC-018: conta excluída nunca é administradora (CHECK Usuario_administrador_nao_excluido).
          data: { excluidoEm: agora, anonimizadoEm: agora, nome: NOME_ANONIMO, email: emailAnonimo(usuarioId), administradorEm: null },
        });
        if (marcado.count === 0) return { ok: false, erro: "JaExcluida" };
        if (atual.administradorEm) {
          await tx.registroSuporte.create({ data: { negocioId: null, acessoId: null, usuarioId, evento: "PAPEL_RETIRADO", descricao: "Papel de Administrador retirado pela exclusão da conta", criadoEm: agora } });
        }

        const donos = (
          await tx.membroNegocio.findMany({ where: { usuarioId, papel: "DONO", negocio: { encerradoEm: null } }, select: { negocioId: true } })
        ).map((v) => v.negocioId);

        if (donos.length) {
          await tx.negocio.updateMany({
            where: { id: { in: donos } },
            data: { encerradoEm: agora, eliminarApos: new Date(`${dataDeEliminacao(diaLocal(agora))}T00:00:00Z`) },
          });
          await tx.cliente.updateMany({ where: { negocioId: { in: donos } }, data: { nome: CLIENTE_ANONIMO, contato: null, anonimizadoEm: agora } });
          // SPEC-018 (5.4.6): negócio encerrado não fica com acesso de suporte liberado; o registro fica (RN32).
          const liberacoes = await tx.acessoSuporte.findMany({ where: { negocioId: { in: donos }, revogadoEm: null, expiraEm: { gt: agora } }, select: { id: true, negocioId: true } });
          if (liberacoes.length) {
            await tx.acessoSuporte.updateMany({ where: { id: { in: liberacoes.map((l) => l.id) } }, data: { revogadoEm: agora, revogadoPorId: usuarioId } });
            await tx.registroSuporte.createMany({
              data: liberacoes.map((l) => ({ negocioId: l.negocioId, acessoId: l.id, usuarioId, evento: "REVOGACAO" as const, descricao: "Revogada pela exclusão da conta do Dono (negócio encerrado)", criadoEm: agora })),
            });
          }
          await tx.convite.updateMany({ where: { negocioId: { in: donos }, status: "PENDENTE" }, data: { status: "CANCELADO", respondidoEm: agora } });
          // Os convidados destes negócios também deixam de ser identificáveis (5.3).
          await tx.$executeRaw`
            UPDATE "Convite" SET email = 'convite-' || id || ${`@${DOMINIO_ANONIMO}`}
            WHERE "negocioId" = ANY(${donos}::uuid[]) AND email NOT LIKE ${`%@${DOMINIO_ANONIMO}`}`;
        }

        // Vínculos em negócios de outros Donos: removidos; os registros dele continuam (5.3).
        await tx.membroNegocio.deleteMany({ where: { usuarioId, papel: { not: "DONO" } } });

        // Convites para o e-mail dele, em qualquer negócio: cancelados e anonimizados.
        await tx.convite.updateMany({ where: { email: atual.email, status: "PENDENTE" }, data: { status: "CANCELADO", respondidoEm: agora } });
        await tx.$executeRaw`
          UPDATE "Convite" SET email = 'convite-' || id || ${`@${DOMINIO_ANONIMO}`} WHERE email = ${atual.email}`;

        return { ok: true, negociosEncerrados: donos.length };
      });
    },

    /** Contas excluídas com a credencial ainda no Supabase Auth (OPEN-001). */
    async credenciaisPendentes(limite = 50): Promise<string[]> {
      const lista = await cliente.usuario.findMany({ where: { excluidoEm: { not: null }, credencialRemovidaEm: null }, select: { id: true }, take: limite, orderBy: { excluidoEm: "asc" } });
      return lista.map((u) => u.id);
    },

    async marcarCredencialRemovida(usuarioId: string, agora: Date): Promise<void> {
      await cliente.usuario.updateMany({ where: { id: usuarioId, excluidoEm: { not: null }, credencialRemovidaEm: null }, data: { credencialRemovidaEm: agora } });
    },

    /**
     * Convites antigos (SPEC-005 OPEN-009; OPEN-006): e-mail anonimizado nos expirados ou
     * cancelados há mais de 90 dias (pendentes vencidos há 90 dias contam como expirados).
     */
    async anonimizarConvitesAntigos(agora: Date): Promise<number> {
      const limite = new Date(agora.getTime() - DIAS_ATE_LIMPAR_CONVITE * 86_400_000);
      return cliente.$executeRaw`
        UPDATE "Convite"
        SET email = 'convite-' || id || ${`@${DOMINIO_ANONIMO}`},
            status = CASE WHEN status = 'PENDENTE' THEN 'EXPIRADO'::"StatusConvite" ELSE status END
        WHERE email NOT LIKE ${`%@${DOMINIO_ANONIMO}`}
          AND ((status IN ('EXPIRADO', 'CANCELADO') AND COALESCE("respondidoEm", "expiraEm") < ${limite})
            OR (status = 'PENDENTE' AND "expiraEm" < ${limite}))`;
    },
  };
}

export type ConsultasDaLgpd = ReturnType<typeof criarConsultasDaLgpd>;
