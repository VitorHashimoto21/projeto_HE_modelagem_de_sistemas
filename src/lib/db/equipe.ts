import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { PapelUsuario, PlanoNegocio } from "@/generated/prisma/enums";
import type { Matriz } from "@/lib/dominio/permissoes";
import { comNegocio } from "./cliente-do-negocio";

/**
 * Equipe e convites (SPEC-005). As operações do Dono passam pelo cliente do negócio
 * (o Convite e o MembroNegocio têm negocioId — AD-C02). A leitura e a aceitação do
 * convite acontecem antes de o convidado ser membro, então leem o convite pelo hash do
 * token ou pelo e-mail confirmado, fora do cliente do negócio (seção 8).
 */

export type PapelDeMembro = Exclude<PapelUsuario, "DONO">;

export type MembroDaEquipe = {
  id: string;
  usuarioId: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  permissoesCustom: unknown;
};

export type ConvitePendente = { id: string; email: string; papel: PapelUsuario; permissoesCustom: unknown; expiraEm: Date };

export type NovoConvite = {
  email: string;
  papel: PapelDeMembro;
  permissoesCustom: Matriz | null;
  tokenHash: string;
  expiraEm: Date;
  convidadoPorId: string;
};

export type ResultadoDoConvite =
  | { ok: true; id: string }
  | { ok: false; erro: "LimiteDoPlano" | "JaEhMembro" | "ConvitePendenteExistente" | "NegocioIndisponivel" };

/** Colaboradores permitidos no plano gratuito, além do Dono (RF47). */
export const LIMITE_DO_PLANO_GRATUITO = 1;

const json = (m: Matriz | null) => (m === null ? Prisma.DbNull : (m as unknown as Prisma.InputJsonValue));

/** Dados do convite para a página de aceitação (5.3). */
export type ConviteDoLink = {
  id: string;
  negocioId: string;
  negocio: string;
  convidadoPor: string;
  email: string;
  papel: PapelUsuario;
  permissoesCustom: unknown;
  valido: boolean;
};

export function criarConsultasDeEquipe(cliente: PrismaClient) {
  /** Convites vencidos ainda marcados como pendentes viram EXPIRADO quando lidos (5.6). */
  const expirarVencidos = (db: Pick<PrismaClient, "convite">, agora: Date, where: Prisma.ConviteWhereInput = {}) =>
    db.convite.updateMany({ where: { ...where, status: "PENDENTE", expiraEm: { lte: agora } }, data: { status: "EXPIRADO" } });

  return {
    /** Operações do Dono no negócio ativo, sempre restritas a ele (cliente do negócio). */
    doNegocio(negocioId: string) {
      const db = comNegocio(cliente, { negocioId });

      return {
        async resumo(): Promise<{ nome: string; plano: PlanoNegocio } | null> {
          return db.negocio.findFirst({ where: { encerradoEm: null }, select: { nome: true, plano: true } });
        },

        async listar(agora: Date): Promise<{ membros: MembroDaEquipe[]; convites: ConvitePendente[] }> {
          await expirarVencidos(db as unknown as PrismaClient, agora);
          const [membros, convites] = await Promise.all([
            db.membroNegocio.findMany({
              select: { id: true, usuarioId: true, papel: true, permissoesCustom: true, usuario: { select: { nome: true, email: true } } },
            }),
            db.convite.findMany({
              where: { status: "PENDENTE" },
              select: { id: true, email: true, papel: true, permissoesCustom: true, expiraEm: true },
              orderBy: { createdAt: "asc" },
            }),
          ]);
          const ordem: Record<PapelUsuario, number> = { DONO: 0, GERENTE: 1, COLABORADOR: 2 };
          return {
            membros: membros
              .map((m) => ({ id: m.id, usuarioId: m.usuarioId, papel: m.papel, permissoesCustom: m.permissoesCustom, nome: m.usuario.nome, email: m.usuario.email }))
              .sort((a, b) => ordem[a.papel] - ordem[b.papel] || a.nome.localeCompare(b.nome, "pt-BR")),
            convites,
          };
        },

        /**
         * Cria o convite numa transação que trava o negócio (INV-003): dois convites
         * simultâneos não passam do limite do plano nem duplicam o pendente do mesmo e-mail.
         */
        async criarConvite(novo: NovoConvite, agora: Date): Promise<ResultadoDoConvite> {
          return db.$transaction(async (tx) => {
            const travado = await tx.$queryRaw<{ plano: PlanoNegocio }[]>`
              SELECT "plano" FROM "Negocio" WHERE "id" = ${negocioId}::uuid AND "encerradoEm" IS NULL FOR UPDATE`;
            if (travado.length === 0) return { ok: false, erro: "NegocioIndisponivel" };

            await expirarVencidos(tx as unknown as PrismaClient, agora);
            if ((await tx.membroNegocio.count({ where: { usuario: { email: novo.email } } })) > 0) {
              return { ok: false, erro: "JaEhMembro" };
            }
            if ((await tx.convite.count({ where: { status: "PENDENTE", email: novo.email } })) > 0) {
              return { ok: false, erro: "ConvitePendenteExistente" };
            }
            if (travado[0].plano === "GRATUITO") {
              const [membros, pendentes] = await Promise.all([
                tx.membroNegocio.count({ where: { papel: { not: "DONO" } } }),
                tx.convite.count({ where: { status: "PENDENTE" } }),
              ]);
              if (membros + pendentes >= LIMITE_DO_PLANO_GRATUITO) return { ok: false, erro: "LimiteDoPlano" };
            }
            const criado = await tx.convite.create({
              data: {
                negocioId,
                email: novo.email,
                papel: novo.papel,
                permissoesCustom: json(novo.permissoesCustom),
                tokenHash: novo.tokenHash,
                expiraEm: novo.expiraEm,
                convidadoPorId: novo.convidadoPorId,
              },
              select: { id: true },
            });
            return { ok: true, id: criado.id };
          });
        },

        /** Cancela um convite pendente (o link para de valer e a vaga é liberada). */
        async cancelarConvite(id: string, agora: Date): Promise<boolean> {
          const r = await db.convite.updateMany({ where: { id, status: "PENDENTE" }, data: { status: "CANCELADO", respondidoEm: agora } });
          return r.count > 0;
        },

        /** Reenviar: token e validade novos no mesmo registro; o link anterior para de valer (INV-007). */
        async renovarConvite(id: string, tokenHash: string, expiraEm: Date, agora: Date): Promise<ConvitePendente | null> {
          await expirarVencidos(db as unknown as PrismaClient, agora, { id });
          const r = await db.convite.updateMany({ where: { id, status: "PENDENTE" }, data: { tokenHash, expiraEm } });
          if (r.count === 0) return null;
          return db.convite.findFirst({ where: { id }, select: { id: true, email: true, papel: true, permissoesCustom: true, expiraEm: true } });
        },

        async membro(id: string): Promise<MembroDaEquipe | null> {
          const m = await db.membroNegocio.findFirst({
            where: { id },
            select: { id: true, usuarioId: true, papel: true, permissoesCustom: true, usuario: { select: { nome: true, email: true } } },
          });
          return m && { id: m.id, usuarioId: m.usuarioId, papel: m.papel, permissoesCustom: m.permissoesCustom, nome: m.usuario.nome, email: m.usuario.email };
        },

        /** Troca o papel e limpa a matriz customizada (5.4). Nunca altera o Dono (INV-002). */
        async alterarPapel(id: string, papel: PapelDeMembro): Promise<boolean> {
          const r = await db.membroNegocio.updateMany({
            where: { id, papel: { not: "DONO" } },
            data: { papel, permissoesCustom: Prisma.DbNull },
          });
          return r.count > 0;
        },

        /** Grava a matriz inteira (ou null = predefinição do papel). Nunca no Dono (INV-002). */
        async alterarPermissoes(id: string, matriz: Matriz | null): Promise<boolean> {
          const r = await db.membroNegocio.updateMany({ where: { id, papel: { not: "DONO" } }, data: { permissoesCustom: json(matriz) } });
          return r.count > 0;
        },

        /** Remove o membro; os registros que ele criou continuam (ligados ao Usuario). Nunca o Dono. */
        async remover(id: string): Promise<boolean> {
          const r = await db.membroNegocio.deleteMany({ where: { id, papel: { not: "DONO" } } });
          return r.count > 0;
        },
      };
    },

    /** Convite pelo hash do token do link (5.3), com o negócio e quem convidou. */
    async conviteDoToken(tokenHash: string, agora: Date): Promise<ConviteDoLink | null> {
      await expirarVencidos(cliente, agora, { tokenHash });
      const c = await cliente.convite.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          negocioId: true,
          email: true,
          papel: true,
          permissoesCustom: true,
          status: true,
          negocio: { select: { nome: true, encerradoEm: true } },
          convidadoPor: { select: { nome: true } },
        },
      });
      if (!c) return null;
      return {
        id: c.id,
        negocioId: c.negocioId,
        negocio: c.negocio.nome,
        convidadoPor: c.convidadoPor.nome,
        email: c.email,
        papel: c.papel,
        permissoesCustom: c.permissoesCustom,
        valido: c.status === "PENDENTE" && c.negocio.encerradoEm === null,
      };
    },

    /** "Convites para você" (OPEN-006): pendentes e válidos para o e-mail confirmado da conta. */
    async convitesDoEmail(email: string, agora: Date) {
      await expirarVencidos(cliente, agora, { email });
      const lista = await cliente.convite.findMany({
        where: { email, status: "PENDENTE", negocio: { encerradoEm: null } },
        select: { id: true, papel: true, expiraEm: true, negocio: { select: { id: true, nome: true } }, convidadoPor: { select: { nome: true } } },
        orderBy: { createdAt: "asc" },
      });
      return lista.map((c) => ({ id: c.id, papel: c.papel, expiraEm: c.expiraEm, negocioId: c.negocio.id, negocio: c.negocio.nome, convidadoPor: c.convidadoPor.nome }));
    },

    /**
     * Aceita o convite (5.3) numa transação. A marcação ACEITO é condicional (pendente,
     * válido, do e-mail da conta, negócio não encerrado): é ela que garante o uso único
     * (INV-006) e que só a conta convidada aceita (INV-010).
     */
    async aceitar(
      conviteId: string,
      usuarioId: string,
      email: string,
      agora: Date,
    ): Promise<{ ok: true; negocioId: string } | { ok: false; erro: "ConviteInvalido" | "JaEhMembro" }> {
      return cliente.$transaction(async (tx) => {
        const marcado = await tx.convite.updateMany({
          where: { id: conviteId, email, status: "PENDENTE", expiraEm: { gt: agora }, negocio: { encerradoEm: null } },
          data: { status: "ACEITO", respondidoEm: agora },
        });
        if (marcado.count === 0) return { ok: false, erro: "ConviteInvalido" };

        const c = await tx.convite.findUniqueOrThrow({ where: { id: conviteId }, select: { negocioId: true, papel: true, permissoesCustom: true } });
        const jaMembro = await tx.membroNegocio.findUnique({ where: { usuarioId_negocioId: { usuarioId, negocioId: c.negocioId } }, select: { id: true } });
        if (jaMembro) return { ok: false, erro: "JaEhMembro" };

        await tx.membroNegocio.create({
          data: {
            usuarioId,
            negocioId: c.negocioId,
            papel: c.papel,
            permissoesCustom: c.permissoesCustom === null ? Prisma.DbNull : (c.permissoesCustom as Prisma.InputJsonValue),
          },
        });
        return { ok: true, negocioId: c.negocioId };
      });
    },

    /** Sair do negócio (OPEN-007): só quem não é Dono (INV-002). */
    async sair(usuarioId: string, negocioId: string): Promise<boolean> {
      const r = await cliente.membroNegocio.deleteMany({ where: { usuarioId, negocioId, papel: { not: "DONO" } } });
      return r.count > 0;
    },

    /** E-mail e nome da conta (o e-mail é o confirmado no Supabase Auth — SPEC-002). */
    async usuario(usuarioId: string): Promise<{ nome: string; email: string } | null> {
      return cliente.usuario.findUnique({ where: { id: usuarioId }, select: { nome: true, email: true } });
    },
  };
}

export type ConsultasDeEquipe = ReturnType<typeof criarConsultasDeEquipe>;
export type EquipeDoNegocio = ReturnType<ConsultasDeEquipe["doNegocio"]>;
