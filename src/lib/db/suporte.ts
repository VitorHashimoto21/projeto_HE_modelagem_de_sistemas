import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { EventoSuporte, PlanoNegocio, RegimeTributario } from "@/generated/prisma/enums";
import type { LiberacaoDoContexto } from "@/lib/auth/contexto";
import type { Modulo } from "@/lib/dominio/permissoes";
import { dataHoraCompleta, expiraEm as calcularExpiracao, listaDeModulos, modulosValidos, type DadosDaLiberacao, type TelaDoSuporte } from "@/lib/dominio/suporte";
import { comNegocio } from "./cliente-do-negocio";

/**
 * Acesso de suporte (SPEC-018). Três públicos, cada um com o seu recorte:
 * - o Dono, sobre o próprio negócio (liberar, revogar, consultar o registro) — pelo cliente do negócio;
 * - o Administrador, no painel: somente os metadados dos negócios (INV-009) e a liberação ativa;
 * - o contexto da requisição: a liberação lida do banco a cada requisição (INV-001).
 * O registro de auditoria (RegistroSuporte) só recebe inserções (gatilho he_somente_insercao).
 */

const TAMANHO_DA_PAGINA = 25;

export type NegocioNoPainel = {
  id: string;
  nome: string;
  regime: RegimeTributario;
  plano: PlanoNegocio;
  criadoEm: Date;
  membros: number;
  encerrado: boolean;
  dono: { nome: string; email: string } | null;
  liberacao: { id: string; motivo: string; modulos: Modulo[]; expiraEm: Date } | null;
};

export type EventoDoRegistro = { id: string; evento: EventoSuporte; modulo: string | null; descricao: string; criadoEm: Date; autor: string };

export type LiberacaoDoNegocio = {
  id: string;
  motivo: string;
  modulos: Modulo[];
  criadoEm: Date;
  expiraEm: Date;
  revogadoEm: Date | null;
  liberadoPor: string;
  revogadoPor: string | null;
  eventos: EventoDoRegistro[];
};

export type ResultadoDaConcessao =
  | { ok: true; jaEra: boolean; desde: Date }
  | { ok: false; erro: "ContaInexistente" | "ContaExcluida" | "ContaComVinculo" | "ConvitePendente"; negocios?: string[] };

export type ResultadoDaRetirada = { ok: true; naoEra: boolean } | { ok: false; erro: "ContaInexistente" };

export type ResultadoDaEntrada = { ok: true; primeira: boolean; negocioId: string } | { ok: false; erro: "SemLiberacao" | "Expirada" };

/** Liberação ativa: não revogada, não vencida e de negócio não encerrado. */
const ativa = (agora: Date) => ({ revogadoEm: null, expiraEm: { gt: agora }, negocio: { encerradoEm: null } });

export function criarConsultasDeSuporte(cliente: PrismaClient) {
  /** Registro de auditoria (RN32): só inserção. */
  const registrar = (
    db: { registroSuporte: { create: (args: { data: Prisma.RegistroSuporteUncheckedCreateInput }) => PromiseLike<unknown> } },
    r: { negocioId: string | null; acessoId: string | null; usuarioId: string; evento: EventoSuporte; modulo?: string | null; descricao: string; criadoEm?: Date },
  ) =>
    db.registroSuporte.create({
      data: { negocioId: r.negocioId, acessoId: r.acessoId, usuarioId: r.usuarioId, evento: r.evento, modulo: r.modulo ?? null, descricao: r.descricao.slice(0, 200), criadoEm: r.criadoEm },
    });

  return {
    // ---------------------------------------------------------------- contexto (INV-001)

    async liberacaoDoContexto(acessoId: string): Promise<LiberacaoDoContexto | null> {
      const l = await cliente.acessoSuporte.findUnique({
        where: { id: acessoId },
        select: { id: true, negocioId: true, modulos: true, expiraEm: true, revogadoEm: true, negocio: { select: { nome: true, encerradoEm: true } } },
      });
      if (!l) return null;
      return { id: l.id, negocioId: l.negocioId, negocio: l.negocio.nome, negocioEncerrado: l.negocio.encerradoEm !== null, modulos: l.modulos, expiraEm: l.expiraEm, revogadoEm: l.revogadoEm };
    },

    /** Liberação ativa do negócio, para a faixa dos membros (5.6). */
    async liberacaoAtiva(negocioId: string, agora: Date): Promise<{ id: string; modulos: Modulo[]; expiraEm: Date } | null> {
      const l = await comNegocio(cliente, { negocioId }).acessoSuporte.findFirst({
        where: { revogadoEm: null, expiraEm: { gt: agora } },
        orderBy: { criadoEm: "desc" },
        select: { id: true, modulos: true, expiraEm: true },
      });
      return l && { id: l.id, modulos: modulosValidos(l.modulos), expiraEm: l.expiraEm };
    },

    // ---------------------------------------------------------------- Dono (5.4, 5.6)

    /**
     * Libera o acesso (RN31): trava a linha do negócio, encerra a liberação ativa anterior
     * (substituição, com registro) e cria a nova, tudo numa transação. null se o negócio está encerrado.
     */
    async liberar(negocioId: string, donoId: string, dados: DadosDaLiberacao, agora: Date): Promise<{ id: string; expiraEm: Date } | null> {
      return comNegocio(cliente, { negocioId }).$transaction(async (db) => {
        const vivo = await db.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Negocio" WHERE "id" = ${negocioId}::uuid AND "encerradoEm" IS NULL FOR UPDATE`;
        if (vivo.length === 0) return null;
        const anteriores = await db.acessoSuporte.findMany({ where: { revogadoEm: null, expiraEm: { gt: agora } }, select: { id: true } });
        for (const a of anteriores) {
          await db.acessoSuporte.update({ where: { id: a.id }, data: { revogadoEm: agora, revogadoPorId: donoId } });
          await registrar(db, { negocioId, acessoId: a.id, usuarioId: donoId, evento: "REVOGACAO", descricao: "Substituída por uma nova liberação", criadoEm: agora });
        }
        const expira = calcularExpiracao(agora, dados.prazo);
        const nova = await db.acessoSuporte.create({
          data: { negocioId, liberadoPorId: donoId, motivo: dados.motivo, modulos: dados.modulos, criadoEm: agora, expiraEm: expira },
          select: { id: true, expiraEm: true },
        });
        await registrar(db, { negocioId, acessoId: nova.id, usuarioId: donoId, evento: "LIBERACAO", descricao: `Liberou ${listaDeModulos(dados.modulos)} até ${dataHoraCompleta(expira)}`, criadoEm: agora });
        return nova;
      });
    },

    /** Revoga a liberação ativa do negócio (5.4); false se não havia liberação ativa com esse id. */
    async revogar(negocioId: string, acessoId: string, donoId: string, agora: Date): Promise<boolean> {
      return comNegocio(cliente, { negocioId }).$transaction(async (db) => {
        const r = await db.acessoSuporte.updateMany({ where: { id: acessoId, revogadoEm: null, expiraEm: { gt: agora } }, data: { revogadoEm: agora, revogadoPorId: donoId } });
        if (r.count === 0) return false;
        await registrar(db, { negocioId, acessoId, usuarioId: donoId, evento: "REVOGACAO", descricao: "Revogou o acesso", criadoEm: agora });
        return true;
      });
    },

    /** Liberações do negócio com o registro de cada uma (tela "Acessos do suporte"). */
    async liberacoesDoNegocio(negocioId: string): Promise<LiberacaoDoNegocio[]> {
      const db = comNegocio(cliente, { negocioId });
      const lista = await db.acessoSuporte.findMany({
        orderBy: { criadoEm: "desc" },
        take: 50,
        select: {
          id: true,
          motivo: true,
          modulos: true,
          criadoEm: true,
          expiraEm: true,
          revogadoEm: true,
          liberadoPor: { select: { nome: true } },
          revogadoPor: { select: { nome: true } },
          registros: { orderBy: { criadoEm: "asc" }, select: { id: true, evento: true, modulo: true, descricao: true, criadoEm: true, usuario: { select: { nome: true } } } },
        },
      });
      return lista.map((l) => ({
        id: l.id,
        motivo: l.motivo,
        modulos: modulosValidos(l.modulos),
        criadoEm: l.criadoEm,
        expiraEm: l.expiraEm,
        revogadoEm: l.revogadoEm,
        liberadoPor: l.liberadoPor.nome,
        revogadoPor: l.revogadoPor?.nome ?? null,
        eventos: l.registros.map((r) => ({ id: r.id, evento: r.evento, modulo: r.modulo, descricao: r.descricao, criadoEm: r.criadoEm, autor: r.usuario.nome })),
      }));
    },

    // ---------------------------------------------------------------- Administrador (5.3, 5.5)

    /** Painel (INV-009): só os metadados da seção 5.3, com busca por nome do negócio ou e-mail do Dono. */
    async listarNegocios(busca: string, pagina: number, agora: Date): Promise<{ negocios: NegocioNoPainel[]; total: number; paginas: number }> {
      const termo = busca.trim().slice(0, 120);
      const where = termo
        ? {
            OR: [
              { nome: { contains: termo, mode: "insensitive" as const } },
              { membros: { some: { papel: "DONO" as const, usuario: { email: { contains: termo.toLowerCase() } } } } },
            ],
          }
        : {};
      const [total, linhas] = await Promise.all([
        cliente.negocio.count({ where }),
        cliente.negocio.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (Math.max(1, pagina) - 1) * TAMANHO_DA_PAGINA,
          take: TAMANHO_DA_PAGINA,
          select: SELECAO_DO_PAINEL(agora),
        }),
      ]);
      return { negocios: linhas.map(paraPainel), total, paginas: Math.max(1, Math.ceil(total / TAMANHO_DA_PAGINA)) };
    },

    async negocioNoPainel(negocioId: string, agora: Date): Promise<NegocioNoPainel | null> {
      const n = await cliente.negocio.findUnique({ where: { id: negocioId }, select: SELECAO_DO_PAINEL(agora) });
      return n && paraPainel(n);
    },

    /** Entrada em modo suporte (5.5): confere a liberação, marca a primeira entrada e registra. */
    async entrar(acessoId: string, administradorId: string, agora: Date): Promise<ResultadoDaEntrada> {
      const alvo = await cliente.acessoSuporte.findUnique({ where: { id: acessoId }, select: { negocioId: true } });
      if (!alvo) return { ok: false, erro: "SemLiberacao" };
      const negocioId = alvo.negocioId;
      return comNegocio(cliente, { negocioId }).$transaction(async (db) => {
        // Marca a primeira entrada só uma vez, mesmo com duas entradas simultâneas (OPEN-009).
        const ainda = await db.acessoSuporte.findFirst({ where: { id: acessoId, ...ativa(agora) }, select: { id: true } });
        if (!ainda) return { ok: false, erro: "Expirada" } as const;
        const primeira = (await db.acessoSuporte.updateMany({ where: { id: acessoId, primeiraEntradaEm: null }, data: { primeiraEntradaEm: agora } })).count === 1;
        await registrar(db, { negocioId, acessoId, usuarioId: administradorId, evento: "ENTRADA", descricao: "Entrou em modo suporte (somente leitura)", criadoEm: agora });
        return { ok: true, primeira, negocioId } as const;
      });
    },

    /** Cada tela aberta em modo suporte (INV-005): sem o registro, a página não é mostrada. */
    async registrarTela(negocioId: string, acessoId: string, administradorId: string, tela: TelaDoSuporte): Promise<void> {
      const db = comNegocio(cliente, { negocioId });
      let descricao = tela.descricao;
      if (tela.detalhe?.tipo === "venda") {
        const v = await db.venda.findFirst({ where: { id: tela.detalhe.id }, select: { numero: true } });
        if (v) descricao = `Vendas — venda nº ${v.numero}`;
      } else if (tela.detalhe?.tipo === "item") {
        const i = await db.item.findFirst({ where: { id: tela.detalhe.id }, select: { nome: true } });
        if (i) descricao = `${descricao.replace(/ — item$/, "")} — ${i.nome}`;
      } else if (tela.detalhe?.tipo === "conta") {
        const c = await db.contaPagarReceber.findFirst({ where: { id: tela.detalhe.id }, select: { descricao: true } });
        if (c) descricao = `Financeiro — conta "${c.descricao}"`;
      }
      await registrar(db, { negocioId, acessoId, usuarioId: administradorId, evento: "TELA", modulo: tela.modulo, descricao });
    },

    async sair(negocioId: string, acessoId: string, administradorId: string): Promise<void> {
      await registrar(comNegocio(cliente, { negocioId }), { negocioId, acessoId, usuarioId: administradorId, evento: "SAIDA", descricao: "Saiu do modo suporte" });
    },

    // ---------------------------------------------------------------- script da equipe (5.1)

    /**
     * Concede o papel (INV-004): a conta precisa existir, não estar excluída e não ter vínculo
     * com negócio nem convite pendente. Registra PAPEL_CONCEDIDO com o responsável.
     */
    async concederPapel(email: string, responsavel: string, agora: Date): Promise<ResultadoDaConcessao> {
      return cliente.$transaction(async (tx) => {
        const u = await tx.usuario.findUnique({
          where: { email: email.trim().toLowerCase() },
          select: { id: true, excluidoEm: true, administradorEm: true, membroEm: { select: { negocio: { select: { nome: true } } } } },
        });
        if (!u) return { ok: false, erro: "ContaInexistente" } as const;
        if (u.excluidoEm) return { ok: false, erro: "ContaExcluida" } as const;
        if (u.membroEm.length > 0) return { ok: false, erro: "ContaComVinculo", negocios: u.membroEm.map((m) => m.negocio.nome) } as const;
        const convites = await tx.convite.count({ where: { email: email.trim().toLowerCase(), status: "PENDENTE", expiraEm: { gt: agora } } });
        if (convites > 0) return { ok: false, erro: "ConvitePendente" } as const;
        if (u.administradorEm) return { ok: true, jaEra: true, desde: u.administradorEm } as const;
        await tx.usuario.update({ where: { id: u.id }, data: { administradorEm: agora } });
        await registrar(tx, { negocioId: null, acessoId: null, usuarioId: u.id, evento: "PAPEL_CONCEDIDO", descricao: `Papel de Administrador concedido por ${responsavel} (script)`, criadoEm: agora });
        return { ok: true, jaEra: false, desde: agora } as const;
      });
    },

    async retirarPapel(email: string, responsavel: string, agora: Date): Promise<ResultadoDaRetirada> {
      return cliente.$transaction(async (tx) => {
        const u = await tx.usuario.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, administradorEm: true } });
        if (!u) return { ok: false, erro: "ContaInexistente" } as const;
        if (!u.administradorEm) return { ok: true, naoEra: true } as const;
        await tx.usuario.update({ where: { id: u.id }, data: { administradorEm: null } });
        await registrar(tx, { negocioId: null, acessoId: null, usuarioId: u.id, evento: "PAPEL_RETIRADO", descricao: `Papel de Administrador retirado por ${responsavel} (script)`, criadoEm: agora });
        return { ok: true, naoEra: false } as const;
      });
    },

    /** Conta de Administrador? (INV-004: criar negócio e aceitar convite são recusados para ela.) */
    async ehAdministrador(usuarioId: string): Promise<boolean> {
      const u = await cliente.usuario.findUnique({ where: { id: usuarioId }, select: { administradorEm: true } });
      return Boolean(u?.administradorEm);
    },

    /** E-mail e nome do Dono do negócio, para os avisos (OPEN-009). */
    async donoDoNegocio(negocioId: string): Promise<{ nome: string; email: string; negocio: string } | null> {
      const m = await comNegocio(cliente, { negocioId }).membroNegocio.findFirst({
        where: { papel: "DONO" },
        select: { usuario: { select: { nome: true, email: true, excluidoEm: true } }, negocio: { select: { nome: true } } },
      });
      if (!m || m.usuario.excluidoEm) return null;
      return { nome: m.usuario.nome, email: m.usuario.email, negocio: m.negocio.nome };
    },
  };
}

const SELECAO_DO_PAINEL = (agora: Date) =>
  ({
    id: true,
    nome: true,
    regimeTributario: true,
    plano: true,
    createdAt: true,
    encerradoEm: true,
    _count: { select: { membros: true } },
    membros: { where: { papel: "DONO" }, take: 1, select: { usuario: { select: { nome: true, email: true, excluidoEm: true } } } },
    acessosSuporte: {
      where: { revogadoEm: null, expiraEm: { gt: agora } },
      orderBy: { criadoEm: "desc" },
      take: 1,
      select: { id: true, motivo: true, modulos: true, expiraEm: true },
    },
  }) as const;

type LinhaDoPainel = {
  id: string;
  nome: string;
  regimeTributario: RegimeTributario;
  plano: PlanoNegocio;
  createdAt: Date;
  encerradoEm: Date | null;
  _count: { membros: number };
  membros: { usuario: { nome: string; email: string; excluidoEm: Date | null } }[];
  acessosSuporte: { id: string; motivo: string; modulos: string[]; expiraEm: Date }[];
};

function paraPainel(n: LinhaDoPainel): NegocioNoPainel {
  const dono = n.membros[0]?.usuario;
  const l = n.encerradoEm ? undefined : n.acessosSuporte[0];
  return {
    id: n.id,
    nome: n.nome,
    regime: n.regimeTributario,
    plano: n.plano,
    criadoEm: n.createdAt,
    membros: n._count.membros,
    encerrado: n.encerradoEm !== null,
    dono: dono && !dono.excluidoEm ? { nome: dono.nome, email: dono.email } : null,
    liberacao: l ? { id: l.id, motivo: l.motivo, modulos: modulosValidos(l.modulos), expiraEm: l.expiraEm } : null,
  };
}

export type ConsultasDeSuporte = ReturnType<typeof criarConsultasDeSuporte>;
