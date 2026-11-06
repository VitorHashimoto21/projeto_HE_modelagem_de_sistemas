import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { EventoSuporte, PlanoNegocio } from "@/generated/prisma/enums";
import {
  expiracaoDoPedido,
  lerPedidoDePlano,
  resumoDoPedidoDePlano,
  situacaoEfetiva,
  type PedidoDePlano,
  type SituacaoDoPedido,
  type TipoDoPedido,
} from "@/lib/dominio/plataforma";
import { comNegocio, type ClienteDoNegocio } from "./cliente-do-negocio";
import { aplicarTroca } from "./planos";

/**
 * Pedidos da plataforma (SPEC-019, 5.6 e 5.8 — INV-006): um Administrador pede, OUTRA conta de
 * Administrador aprova ou recusa, em até 12 h. Nesta etapa, a troca de plano.
 *
 * Concorrência: toda escrita trava primeiro a linha do negócio e depois a do pedido, sempre nessa
 * ordem (sem impasse), e confere de novo dentro da transação. O pedido vencido é marcado como
 * expirado na primeira escrita depois do prazo; as leituras já o mostram expirado (`situacaoEfetiva`).
 */

export type ResultadoDoPedido =
  | { ok: true; id: string; expiraEm: Date }
  | { ok: false; erro: "NegocioInexistente" | "NegocioEncerrado" | "PedidoPendente" }
  | { ok: false; erro: "MesmoPlano"; plano: PlanoNegocio };

export type ErroDaDecisao = "PedidoInexistente" | "PedidoJaDecidido" | "PedidoExpirado" | "MesmoAdministrador" | "NaoEAdministrador";

export type ResultadoDaDecisao =
  | { ok: true; situacao: "APROVADO"; negocioId: string; pedido: PedidoDePlano; suspensos: number; reativados: number; convitesCancelados: number }
  | { ok: true; situacao: "RECUSADO"; negocioId: string; pedido: PedidoDePlano }
  | { ok: false; erro: ErroDaDecisao | "SolicitanteSemPapel" | "NegocioEncerrado" }
  | { ok: false; erro: "MesmoPlano"; plano: PlanoNegocio };

export type ResultadoDoCancelamento = { ok: true } | { ok: false; erro: "PedidoInexistente" | "PedidoJaDecidido" | "PedidoExpirado" | "SoQuemPediu" };

/** Pedido na lista do painel e na ficha do negócio. */
export type PedidoDaPlataforma = {
  id: string;
  tipo: TipoDoPedido;
  negocioId: string;
  negocio: string;
  solicitadoPorId: string;
  solicitadoPor: string;
  criadoEm: Date;
  expiraEm: Date;
  situacao: SituacaoDoPedido;
  decididoPor: string | null;
  decididoEm: Date | null;
  motivoDaRecusa: string | null;
  /** Na troca de plano: o plano de destino, o motivo e a descrição. */
  plano: PedidoDePlano | null;
};

/** Conta de Administrador na lista do painel (5.9, item 4). */
export type AdministradorDaPlataforma = {
  id: string;
  nome: string;
  email: string;
  desde: Date;
  /** Autenticadores ativos no Supabase Auth; null se não foi possível contar. */
  autenticadores: number | null;
};

const DECIDIDOS_NA_LISTA = 20;
const PEDIDOS_DO_NEGOCIO = 20;

const SELECAO = {
  id: true,
  tipo: true,
  negocioId: true,
  solicitadoPorId: true,
  criadoEm: true,
  expiraEm: true,
  situacao: true,
  decididoEm: true,
  motivoDaRecusa: true,
  dados: true,
  negocio: { select: { nome: true } },
  solicitadoPor: { select: { nome: true } },
  decididoPor: { select: { nome: true } },
} as const;

type LinhaDoPedido = {
  id: string;
  tipo: TipoDoPedido;
  negocioId: string;
  solicitadoPorId: string;
  criadoEm: Date;
  expiraEm: Date;
  situacao: SituacaoDoPedido;
  decididoEm: Date | null;
  motivoDaRecusa: string | null;
  dados: Prisma.JsonValue;
  negocio: { nome: string };
  solicitadoPor: { nome: string };
  decididoPor: { nome: string } | null;
};

const paraPedido = (p: LinhaDoPedido, agora: Date): PedidoDaPlataforma => {
  const situacao = situacaoEfetiva(p, agora);
  return {
    id: p.id,
    tipo: p.tipo,
    negocioId: p.negocioId,
    negocio: p.negocio.nome,
    solicitadoPorId: p.solicitadoPorId,
    solicitadoPor: p.solicitadoPor.nome,
    criadoEm: p.criadoEm,
    expiraEm: p.expiraEm,
    situacao,
    decididoPor: p.decididoPor?.nome ?? null,
    // O expirado que o banco ainda não marcou expirou na hora do prazo.
    decididoEm: p.decididoEm ?? (situacao === "EXPIRADO" ? p.expiraEm : null),
    motivoDaRecusa: p.motivoDaRecusa,
    plano: p.tipo === "PLANO" ? lerPedidoDePlano(p.dados) : null,
  };
};

type Transacao = Pick<ClienteDoNegocio, "$queryRaw" | "$executeRaw" | "pedidoPlataforma" | "registroSuporte" | "usuario">;

/** Trava a linha do negócio (primeiro) e diz o plano e se está encerrado; null se não existe. */
const travarNegocio = async (tx: Pick<ClienteDoNegocio, "$queryRaw">, negocioId: string) =>
  (await tx.$queryRaw<{ plano: PlanoNegocio; encerrado: boolean }[]>`
    SELECT "plano", "encerradoEm" IS NOT NULL AS "encerrado" FROM "Negocio" WHERE "id" = ${negocioId}::uuid FOR UPDATE`)[0] ?? null;

/** Trava a linha do pedido (depois do negócio). */
const travarPedido = async (tx: Pick<ClienteDoNegocio, "$queryRaw">, pedidoId: string) =>
  (await tx.$queryRaw<{ situacao: SituacaoDoPedido; tipo: TipoDoPedido; solicitadoPorId: string; expiraEm: Date; dados: unknown }[]>`
    SELECT "situacao"::text AS "situacao", "tipo"::text AS "tipo", "solicitadoPorId"::text AS "solicitadoPorId", "expiraEm", "dados"
    FROM "PedidoPlataforma" WHERE "id" = ${pedidoId}::uuid FOR UPDATE`)[0] ?? null;

/** Marca como expirados os pedidos pendentes vencidos do negócio: a hora da decisão é a do prazo. */
const expirarVencidos = (tx: Pick<ClienteDoNegocio, "$executeRaw">, negocioId: string, agora: Date) =>
  tx.$executeRaw`
    UPDATE "PedidoPlataforma" SET "situacao" = 'EXPIRADO', "decididoEm" = "expiraEm"
    WHERE "negocioId" = ${negocioId}::uuid AND "situacao" = 'PENDENTE' AND "expiraEm" <= ${agora}`;

const ehAdministrador = async (tx: Pick<ClienteDoNegocio, "usuario">, usuarioId: string) => {
  const u = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { administradorEm: true, excluidoEm: true } });
  return Boolean(u?.administradorEm && !u.excluidoEm);
};

/** Registro de auditoria (RN32): só inserção, com o pedido. */
const registrar = (tx: Pick<ClienteDoNegocio, "registroSuporte">, r: { negocioId: string; pedidoId: string; usuarioId: string; evento: EventoSuporte; descricao: string; criadoEm: Date }) =>
  tx.registroSuporte.create({ data: { negocioId: r.negocioId, acessoId: null, pedidoId: r.pedidoId, usuarioId: r.usuarioId, evento: r.evento, descricao: r.descricao.slice(0, 200), criadoEm: r.criadoEm } });

const UNICO_PENDENTE = "PedidoPlataforma_um_pendente";
const violouUnicoPendente = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002" && JSON.stringify(e).includes(UNICO_PENDENTE);

export function criarConsultasDaPlataforma(cliente: PrismaClient) {
  return {
    // ---------------------------------------------------------------- escrita

    /**
     * Pedir a troca de plano (5.8, item 1): negócio existente e não encerrado (suspenso vale), outro plano
     * e nenhum pedido de plano pendente. Registra PLANO_SOLICITADO na mesma transação.
     */
    async pedirTrocaDePlano(negocioId: string, administradorId: string, dados: PedidoDePlano, agora: Date): Promise<ResultadoDoPedido> {
      return comNegocio(cliente, { negocioId })
        .$transaction(async (tx): Promise<ResultadoDoPedido> => {
          const negocio = await travarNegocio(tx, negocioId);
          if (!negocio) return { ok: false, erro: "NegocioInexistente" };
          if (negocio.encerrado) return { ok: false, erro: "NegocioEncerrado" };
          if (negocio.plano === dados.para) return { ok: false, erro: "MesmoPlano", plano: negocio.plano };
          await expirarVencidos(tx, negocioId, agora);
          const pendente = await tx.pedidoPlataforma.count({ where: { tipo: "PLANO", situacao: "PENDENTE" } });
          if (pendente > 0) return { ok: false, erro: "PedidoPendente" };
          const expiraEm = expiracaoDoPedido(agora);
          const pedido = await tx.pedidoPlataforma.create({
            data: { tipo: "PLANO", negocioId, solicitadoPorId: administradorId, dados: { ...dados }, criadoEm: agora, expiraEm },
            select: { id: true },
          });
          await registrar(tx, {
            negocioId,
            pedidoId: pedido.id,
            usuarioId: administradorId,
            evento: "PLANO_SOLICITADO",
            descricao: `Pediu a troca para o ${resumoDoPedidoDePlano(dados)}: ${dados.descricao}`,
            criadoEm: agora,
          });
          return { ok: true, id: pedido.id, expiraEm };
        })
        .catch((e) => {
          // Rede de segurança: o índice único parcial recusa um segundo pendente.
          if (violouUnicoPendente(e)) return { ok: false as const, erro: "PedidoPendente" as const };
          throw e;
        });
    },

    /**
     * Aprovar ou recusar a troca de plano (5.8, item 3 — INV-006): só outra conta de Administrador, com o
     * pedido pendente e no prazo. Na aprovação, o plano muda pelo núcleo da troca do Dono (`aplicarTroca`),
     * com o pedido e a descrição no histórico; ao voltar ao gratuito, fica o colaborador com acesso se
     * houver um só, e com mais de um, o Dono escolhe depois quem volta (Equipe). Tudo numa transação.
     */
    async decidirTrocaDePlano(
      pedidoId: string,
      administradorId: string,
      decisao: { aprovar: true } | { aprovar: false; motivo: string },
      agora: Date,
    ): Promise<ResultadoDaDecisao> {
      const alvo = await cliente.pedidoPlataforma.findUnique({ where: { id: pedidoId }, select: { negocioId: true, tipo: true } });
      if (!alvo || alvo.tipo !== "PLANO") return { ok: false, erro: "PedidoInexistente" };
      const negocioId = alvo.negocioId;
      return comNegocio(cliente, { negocioId }).$transaction(async (tx): Promise<ResultadoDaDecisao> => {
        const negocio = await travarNegocio(tx, negocioId);
        const p = await travarPedido(tx, pedidoId);
        if (!negocio || !p) return { ok: false, erro: "PedidoInexistente" };
        const conferido = await conferirDecisao(tx, p, pedidoId, administradorId, agora);
        if (conferido) return { ok: false, erro: conferido };
        const pedido = lerPedidoDePlano(p.dados);
        if (!pedido) return { ok: false, erro: "PedidoInexistente" };

        if (!decisao.aprovar) {
          await tx.pedidoPlataforma.update({ where: { id: pedidoId }, data: { situacao: "RECUSADO", decididoPorId: administradorId, decididoEm: agora, motivoDaRecusa: decisao.motivo } });
          await registrar(tx, {
            negocioId,
            pedidoId,
            usuarioId: administradorId,
            evento: "PLANO_RECUSADO",
            descricao: `Recusou a troca para o ${resumoDoPedidoDePlano(pedido)}: ${decisao.motivo}`,
            criadoEm: agora,
          });
          return { ok: true, situacao: "RECUSADO", negocioId, pedido };
        }

        if (!(await ehAdministrador(tx, p.solicitadoPorId))) return { ok: false, erro: "SolicitanteSemPapel" };
        if (negocio.encerrado) return { ok: false, erro: "NegocioEncerrado" };
        if (negocio.plano === pedido.para) return { ok: false, erro: "MesmoPlano", plano: negocio.plano };

        // O pedido aprovado primeiro: o histórico do plano aponta para ele.
        await tx.pedidoPlataforma.update({ where: { id: pedidoId }, data: { situacao: "APROVADO", decididoPorId: administradorId, decididoEm: agora } });
        let manterId: string | null = null;
        if (pedido.para === "GRATUITO") {
          const ativos = await tx.membroNegocio.findMany({ where: { papel: { not: "DONO" }, suspensoEm: null }, select: { id: true } });
          manterId = ativos.length === 1 ? ativos[0].id : null;
        }
        const troca = await aplicarTroca(tx, { negocioId, de: negocio.plano, para: pedido.para, usuarioId: administradorId, manterId, agora, plataforma: { pedidoId, descricao: pedido.descricao } });
        // `manterId` vem da própria transação: a escolha é sempre válida.
        if (!troca.ok) throw new Error(`Troca de plano pela plataforma recusada: ${troca.erro}`);
        await registrar(tx, {
          negocioId,
          pedidoId,
          usuarioId: administradorId,
          evento: "PLANO_APROVADO",
          descricao: `Aprovou a troca para o ${resumoDoPedidoDePlano(pedido)}: o plano mudou pela plataforma`,
          criadoEm: agora,
        });
        return { ok: true, situacao: "APROVADO", negocioId, pedido, suspensos: troca.suspensos, reativados: troca.reativados, convitesCancelados: troca.convitesCancelados };
      });
    },

    /** Quem pediu cancela o próprio pedido pendente (5.9, item 2). O pedido guarda a hora. */
    async cancelar(pedidoId: string, administradorId: string, agora: Date): Promise<ResultadoDoCancelamento> {
      const alvo = await cliente.pedidoPlataforma.findUnique({ where: { id: pedidoId }, select: { negocioId: true } });
      if (!alvo) return { ok: false, erro: "PedidoInexistente" };
      return comNegocio(cliente, { negocioId: alvo.negocioId }).$transaction(async (tx): Promise<ResultadoDoCancelamento> => {
        await travarNegocio(tx, alvo.negocioId);
        const p = await travarPedido(tx, pedidoId);
        if (!p) return { ok: false, erro: "PedidoInexistente" };
        if (p.situacao !== "PENDENTE") return { ok: false, erro: "PedidoJaDecidido" };
        if (p.expiraEm.getTime() <= agora.getTime()) {
          await tx.pedidoPlataforma.update({ where: { id: pedidoId }, data: { situacao: "EXPIRADO", decididoEm: p.expiraEm } });
          return { ok: false, erro: "PedidoExpirado" };
        }
        if (p.solicitadoPorId !== administradorId) return { ok: false, erro: "SoQuemPediu" };
        await tx.pedidoPlataforma.update({ where: { id: pedidoId }, data: { situacao: "CANCELADO", decididoEm: agora } });
        return { ok: true };
      });
    },

    // ---------------------------------------------------------------- leitura (painel e Dono)

    /** Pedidos pendentes e no prazo de todos os negócios (5.9, item 2), do mais antigo ao mais novo. */
    async pedidosPendentes(agora: Date): Promise<PedidoDaPlataforma[]> {
      const linhas = await cliente.pedidoPlataforma.findMany({ where: { situacao: "PENDENTE", expiraEm: { gt: agora } }, orderBy: { criadoEm: "asc" }, select: SELECAO });
      return linhas.map((l) => paraPedido(l, agora));
    },

    /** Os últimos pedidos decididos, cancelados ou expirados (quem pediu vê o motivo da recusa). */
    async pedidosDecididos(agora: Date): Promise<PedidoDaPlataforma[]> {
      const linhas = await cliente.pedidoPlataforma.findMany({
        where: { OR: [{ situacao: { not: "PENDENTE" } }, { expiraEm: { lte: agora } }] },
        orderBy: { criadoEm: "desc" },
        take: DECIDIDOS_NA_LISTA,
        select: SELECAO,
      });
      return linhas.map((l) => paraPedido(l, agora));
    },

    /** Pedidos de um negócio, do mais novo ao mais antigo: na ficha do painel e para o Dono (5.10). */
    async pedidosDoNegocio(negocioId: string, agora: Date): Promise<PedidoDaPlataforma[]> {
      const linhas = await comNegocio(cliente, { negocioId }).pedidoPlataforma.findMany({ orderBy: { criadoEm: "desc" }, take: PEDIDOS_DO_NEGOCIO, select: SELECAO });
      return linhas.map((l) => paraPedido(l, agora));
    },

    /**
     * Contas de Administrador (5.9, item 4), da mais antiga à mais nova, com os autenticadores ativos
     * contados em auth.mfa_factors (Supabase Auth). Se a contagem falhar, a lista sai sem ela.
     */
    async administradores(): Promise<AdministradorDaPlataforma[]> {
      const contas = await cliente.usuario.findMany({
        where: { administradorEm: { not: null }, excluidoEm: null },
        orderBy: { administradorEm: "asc" },
        select: { id: true, nome: true, email: true, administradorEm: true },
      });
      if (contas.length === 0) return [];
      let fatores: Map<string, number> | null = null;
      try {
        const linhas = await cliente.$queryRaw<{ usuario: string; total: number }[]>`
          SELECT "user_id"::text AS "usuario", count(*)::int AS "total" FROM auth.mfa_factors
          WHERE "status"::text = 'verified' AND "factor_type"::text = 'totp' AND "user_id" = ANY(${contas.map((c) => c.id)}::uuid[])
          GROUP BY "user_id"`;
        fatores = new Map(linhas.map((l) => [l.usuario, Number(l.total)]));
      } catch {
        fatores = null;
      }
      return contas.map((c) => ({ id: c.id, nome: c.nome, email: c.email, desde: c.administradorEm!, autenticadores: fatores ? (fatores.get(c.id) ?? 0) : null }));
    },
  };
}

/** Confere a decisão com as linhas travadas; devolve o erro, ou null se pode decidir. */
async function conferirDecisao(
  tx: Transacao,
  p: { situacao: SituacaoDoPedido; solicitadoPorId: string; expiraEm: Date },
  pedidoId: string,
  administradorId: string,
  agora: Date,
): Promise<ErroDaDecisao | null> {
  if (p.situacao !== "PENDENTE") return "PedidoJaDecidido";
  if (p.expiraEm.getTime() <= agora.getTime()) {
    await tx.pedidoPlataforma.update({ where: { id: pedidoId }, data: { situacao: "EXPIRADO", decididoEm: p.expiraEm } });
    return "PedidoExpirado";
  }
  // INV-006: ninguém decide o próprio pedido (o banco recusa também, pelo CHECK).
  if (p.solicitadoPorId === administradorId) return "MesmoAdministrador";
  if (!(await ehAdministrador(tx, administradorId))) return "NaoEAdministrador";
  return null;
}

export type ConsultasDaPlataforma = ReturnType<typeof criarConsultasDaPlataforma>;
