import type { PrismaClient } from "@/generated/prisma/client";
import type { PapelUsuario, PlanoNegocio } from "@/generated/prisma/enums";
import { LIMITE_DO_PLANO_GRATUITO, planejarVoltaAoGratuito } from "@/lib/dominio/planos";
import { comNegocio } from "./cliente-do-negocio";

/**
 * Plano do negócio (SPEC-013). `alterarPlano` é o ÚNICO lugar que escreve `Negocio.plano`
 * (INV-003): numa transação que trava a linha do negócio, grava o plano, quem trocou e
 * quando, o HistoricoPlano e as suspensões/reativações. A SPEC-015 troca só o chamador
 * (o webhook do gateway), não este contrato.
 */

export type ResultadoDaTroca =
  | { ok: true; plano: PlanoNegocio; suspensos: number; reativados: number; convitesCancelados: number }
  | { ok: false; erro: "MesmoPlano" | "NaoEhDono" | "NegocioIndisponivel" | "EscolhaInvalida" };

export type ResultadoDoAcesso = { ok: true } | { ok: false; erro: "LimiteDoPlano" | "MembroNaoEncontrado" | "PlanoPago" | "NegocioIndisponivel" };

export type ColaboradorDoPlano = { id: string; nome: string; email: string; papel: PapelUsuario; suspensoEm: Date | null };

export type SituacaoDoPlano = {
  plano: PlanoNegocio;
  alteradoEm: Date | null;
  alteradoPor: string | null;
  colaboradores: ColaboradorDoPlano[];
  convitesPendentes: number;
};

export function criarConsultasDePlanos(cliente: PrismaClient) {
  return {
    /** Plano do negócio não encerrado (guarda de plano — 5.5); null se indisponível. */
    async planoDoNegocio(negocioId: string): Promise<PlanoNegocio | null> {
      const n = await cliente.negocio.findFirst({ where: { id: negocioId, encerradoEm: null }, select: { plano: true } });
      return n?.plano ?? null;
    },

    doNegocio(negocioId: string) {
      const db = comNegocio(cliente, { negocioId });

      /** Trava a linha do negócio; null se encerrado (5.1: trocas simultâneas). */
      const travar = async (tx: Pick<PrismaClient, "$queryRaw">) =>
        (await tx.$queryRaw<{ plano: PlanoNegocio }[]>`
          SELECT "plano" FROM "Negocio" WHERE "id" = ${negocioId}::uuid AND "encerradoEm" IS NULL FOR UPDATE`)[0]?.plano ?? null;

      return {
        async situacao(agora: Date): Promise<SituacaoDoPlano | null> {
          const [n, membros, convitesPendentes] = await Promise.all([
            db.negocio.findFirst({ where: { encerradoEm: null }, select: { plano: true, planoAlteradoEm: true, planoAlteradoPor: { select: { nome: true } } } }),
            db.membroNegocio.findMany({
              where: { papel: { not: "DONO" } },
              select: { id: true, papel: true, suspensoEm: true, usuario: { select: { nome: true, email: true } } },
            }),
            db.convite.count({ where: { status: "PENDENTE", expiraEm: { gt: agora } } }),
          ]);
          if (!n) return null;
          return {
            plano: n.plano,
            alteradoEm: n.planoAlteradoEm,
            alteradoPor: n.planoAlteradoPor?.nome ?? null,
            colaboradores: membros
              .map((m) => ({ id: m.id, nome: m.usuario.nome, email: m.usuario.email, papel: m.papel, suspensoEm: m.suspensoEm }))
              .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
            convitesPendentes,
          };
        },

        /**
         * Troca de plano (RF73). Para o pago: reativa os suspensos. Para o gratuito
         * (OPEN-001): fica o colaborador escolhido, os outros são suspensos e os convites
         * pendentes cancelados. Nada é apagado (INV-005).
         */
        async alterarPlano(para: PlanoNegocio, usuarioId: string, manterId: string | null, agora: Date): Promise<ResultadoDaTroca> {
          return db.$transaction(async (tx) => {
            const atual = await travar(tx);
            if (atual === null) return { ok: false, erro: "NegocioIndisponivel" };
            const dono = await tx.membroNegocio.count({ where: { usuarioId, papel: "DONO" } });
            if (dono === 0) return { ok: false, erro: "NaoEhDono" };
            if (atual === para) return { ok: false, erro: "MesmoPlano" };

            let suspensos = 0;
            let reativados = 0;
            let convitesCancelados = 0;
            if (para === "PAGO") {
              reativados = (await tx.membroNegocio.updateMany({ where: { suspensoEm: { not: null } }, data: { suspensoEm: null } })).count;
            } else {
              const ativos = await tx.membroNegocio.findMany({ where: { papel: { not: "DONO" }, suspensoEm: null }, select: { id: true, papel: true } });
              const plano = planejarVoltaAoGratuito(ativos as { id: string; papel: "GERENTE" | "COLABORADOR" }[], manterId);
              if (!plano.ok) return { ok: false, erro: plano.erro };
              if (plano.suspender.length) {
                suspensos = (await tx.membroNegocio.updateMany({ where: { id: { in: plano.suspender }, papel: { not: "DONO" } }, data: { suspensoEm: agora } })).count;
              }
              convitesCancelados = (await tx.convite.updateMany({ where: { status: "PENDENTE" }, data: { status: "CANCELADO", respondidoEm: agora } })).count;
            }

            await tx.negocio.updateMany({ data: { plano: para, planoAlteradoEm: agora, planoAlteradoPorId: usuarioId } });
            await tx.historicoPlano.create({ data: { negocioId, de: atual, para, usuarioId, createdAt: agora } });
            return { ok: true, plano: para, suspensos, reativados, convitesCancelados };
          });
        },

        /**
         * Trocar quem tem acesso no gratuito (OPEN-001): reativa um suspenso, suspendendo
         * outro se for preciso para caber no limite (INV-004).
         */
        async trocarAcesso(reativarId: string, suspenderId: string | null, agora: Date): Promise<ResultadoDoAcesso> {
          return db.$transaction(async (tx): Promise<ResultadoDoAcesso> => {
            const plano = await travar(tx);
            if (plano === null) return { ok: false, erro: "NegocioIndisponivel" };
            if (plano === "PAGO") return { ok: false, erro: "PlanoPago" };
            const alvo = await tx.membroNegocio.findFirst({ where: { id: reativarId, papel: { not: "DONO" }, suspensoEm: { not: null } }, select: { id: true } });
            if (!alvo) return { ok: false, erro: "MembroNaoEncontrado" };
            if (suspenderId !== null) {
              const r = await tx.membroNegocio.updateMany({ where: { id: suspenderId, papel: { not: "DONO" }, suspensoEm: null }, data: { suspensoEm: agora } });
              if (r.count === 0) return { ok: false, erro: "MembroNaoEncontrado" };
            }
            const [ativos, pendentes] = await Promise.all([
              tx.membroNegocio.count({ where: { papel: { not: "DONO" }, suspensoEm: null } }),
              tx.convite.count({ where: { status: "PENDENTE", expiraEm: { gt: agora } } }),
            ]);
            if (ativos + pendentes + 1 > LIMITE_DO_PLANO_GRATUITO) throw new LimiteNaTroca();
            await tx.membroNegocio.updateMany({ where: { id: reativarId }, data: { suspensoEm: null } });
            return { ok: true };
          }).catch((e) => {
            if (e instanceof LimiteNaTroca) return { ok: false as const, erro: "LimiteDoPlano" as const };
            throw e;
          });
        },
      };
    },
  };
}

/** Desfaz a suspensão feita na mesma transação quando a troca não cabe no limite. */
class LimiteNaTroca extends Error {}

export type ConsultasDePlanos = ReturnType<typeof criarConsultasDePlanos>;
