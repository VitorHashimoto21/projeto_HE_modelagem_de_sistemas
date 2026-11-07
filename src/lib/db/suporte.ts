import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { EventoSuporte, MotivoEmergencia, MotivoSuspensao, PlanoNegocio, RegimeTributario, TipoAcessoSuporte } from "@/generated/prisma/enums";
import type { LiberacaoDoContexto } from "@/lib/auth/contexto";
import { MOTIVO_CURTO_DA_EMERGENCIA } from "@/lib/dominio/emergencia";
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
  liberacao: { id: string; motivo: string; modulos: Modulo[]; modulosComCorrecao: Modulo[]; expiraEm: Date } | null;
  /** SPEC-019 (5.6): o acesso de emergência em andamento, se houver. */
  emergencia: EmergenciaAtiva | null;
  /** SPEC-019 (5.7, 5.9): a suspensão em vigor, com quem suspendeu, o motivo e a descrição. */
  suspensao: { desde: Date; motivo: MotivoSuspensao; descricao: string; por: string } | null;
};

/** Acesso de emergência em andamento (SPEC-019, 5.6): para as faixas, o painel e a ficha. */
export type EmergenciaAtiva = {
  id: string;
  motivo: MotivoEmergencia;
  referencia: string;
  modulos: Modulo[];
  expiraEm: Date;
  solicitadoPorId: string;
  solicitadoPor: string;
};

export type EventoDoRegistro = { id: string; evento: EventoSuporte; modulo: string | null; descricao: string; criadoEm: Date; autor: string };

export type LiberacaoDoNegocio = {
  id: string;
  /** SPEC-019 (5.6): liberação do Dono ou acesso de emergência. */
  tipo: TipoAcessoSuporte;
  motivo: string;
  modulos: Modulo[];
  /** SPEC-019 (5.10): o nível de cada módulo — estes em "ver e corrigir". */
  modulosComCorrecao: Modulo[];
  criadoEm: Date;
  expiraEm: Date;
  revogadoEm: Date | null;
  /** Quem liberou (na emergência, null). */
  liberadoPor: string | null;
  revogadoPor: string | null;
  eventos: EventoDoRegistro[];
  /** SPEC-019 (5.6, 5.10): na emergência, o motivo da lista, a referência, quem pediu, quem aprovou e o resultado. */
  emergencia: {
    motivo: MotivoEmergencia;
    referencia: string;
    justificativa: string;
    solicitadoPor: string;
    aprovadoPor: string | null;
    resultado: string | null;
    resultadoEm: Date | null;
  } | null;
};

/** Um acesso de emergência no histórico do painel (5.9, item 3). */
export type EmergenciaNoPainel = {
  id: string;
  negocioId: string;
  negocio: string;
  motivo: MotivoEmergencia;
  referencia: string;
  justificativa: string;
  modulos: Modulo[];
  solicitadoPorId: string;
  solicitadoPor: string;
  aprovadoPor: string | null;
  pedidoEm: Date;
  aprovadoEm: Date;
  expiraEm: Date;
  encerradoEm: Date | null;
  encerradoPor: string | null;
  resultado: string | null;
  resultadoEm: Date | null;
};

export type ResultadoDaEntradaNaEmergencia =
  | { ok: true; acessoId: string; expiraEm: Date; modulos: Modulo[]; primeira: boolean }
  | { ok: false; erro: "SemEmergencia" | "SoQuemPediu" };

export type ResultadoDoResultado = { ok: true; negocioId: string } | { ok: false; erro: "AcessoInexistente" | "SoQuemPediu" | "AindaAtiva" | "JaRegistrado" };

export type ResultadoDaConcessao =
  | { ok: true; jaEra: boolean; desde: Date }
  | { ok: false; erro: "ContaInexistente" | "ContaExcluida" | "ContaComVinculo" | "ConvitePendente"; negocios?: string[] };

export type ResultadoDaRetirada = { ok: true; naoEra: boolean } | { ok: false; erro: "ContaInexistente" };

/** SPEC-019 (OPEN-002): conta cujo 2º fator a equipe vai redefinir pelo workflow. */
export type ContaParaRedefinir = { ok: true; usuarioId: string } | { ok: false; erro: "ContaInexistente" | "NaoEAdministrador" };

export type ResultadoDaEntrada = { ok: true; primeira: boolean; negocioId: string } | { ok: false; erro: "SemLiberacao" | "Expirada" | "Reconfirmar" };

/** Liberação ativa: não revogada, não vencida e de negócio não encerrado. */
const ativa = (agora: Date) => ({ revogadoEm: null, expiraEm: { gt: agora }, negocio: { encerradoEm: null } });

/** Os dados do acesso de emergência em andamento que as telas mostram. */
const SELECAO_DA_EMERGENCIA = {
  id: true,
  motivoEmergencia: true,
  referencia: true,
  modulos: true,
  expiraEm: true,
  pedido: { select: { solicitadoPorId: true, solicitadoPor: { select: { nome: true } } } },
} as const;

type LinhaDaEmergencia = {
  id: string;
  motivoEmergencia: MotivoEmergencia | null;
  referencia: string | null;
  modulos: string[];
  expiraEm: Date;
  pedido: { solicitadoPorId: string; solicitadoPor: { nome: string } } | null;
};

const paraEmergencia = (e: LinhaDaEmergencia): EmergenciaAtiva | null =>
  e.motivoEmergencia && e.pedido
    ? { id: e.id, motivo: e.motivoEmergencia, referencia: e.referencia ?? "", modulos: modulosValidos(e.modulos), expiraEm: e.expiraEm, solicitadoPorId: e.pedido.solicitadoPorId, solicitadoPor: e.pedido.solicitadoPor.nome }
    : null;

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

    /**
     * A liberação do cookie, conferida no banco. Com `administradorId` e módulos em correção, diz também
     * quando esse Administrador entrou com o código reconfirmado (SPEC-019, 5.3): a última entrada dele
     * nessa liberação, se não houve saída depois.
     */
    async liberacaoDoContexto(acessoId: string, administradorId?: string): Promise<LiberacaoDoContexto | null> {
      const l = await cliente.acessoSuporte.findUnique({
        where: { id: acessoId },
        select: {
          id: true,
          tipo: true,
          negocioId: true,
          modulos: true,
          modulosComCorrecao: true,
          expiraEm: true,
          revogadoEm: true,
          motivoEmergencia: true,
          negocio: { select: { nome: true, encerradoEm: true, suspensoEm: true, motivoSuspensao: true } },
          pedido: { select: { solicitadoPorId: true } },
        },
      });
      if (!l) return null;
      const ultima =
        administradorId && (l.modulosComCorrecao ?? []).length > 0
          ? await cliente.registroSuporte.findFirst({
              where: { acessoId, usuarioId: administradorId, evento: { in: ["ENTRADA", "SAIDA"] } },
              orderBy: { criadoEm: "desc" },
              select: { evento: true, dados: true, criadoEm: true },
            })
          : null;
      const reconfirmada = ultima?.evento === "ENTRADA" && (ultima.dados as { reconfirmada?: unknown } | null)?.reconfirmada === true;
      return {
        entradaComCorrecaoEm: reconfirmada ? ultima.criadoEm : null,
        id: l.id,
        negocioId: l.negocioId,
        negocio: l.negocio.nome,
        negocioEncerrado: l.negocio.encerradoEm !== null,
        modulos: l.modulos,
        modulosComCorrecao: l.modulosComCorrecao ?? [],
        expiraEm: l.expiraEm,
        revogadoEm: l.revogadoEm,
        // SPEC-019 (INV-010): na emergência, o contexto confere que é a conta que pediu.
        emergencia:
          l.tipo === "EMERGENCIA" && l.motivoEmergencia && l.pedido
            ? { motivo: MOTIVO_CURTO_DA_EMERGENCIA[l.motivoEmergencia], solicitadoPorId: l.pedido.solicitadoPorId }
            : null,
        // SPEC-019 (5.7): a suspensão do negócio; a liberação e a emergência continuam valendo para ver.
        negocioSuspenso: l.negocio.suspensoEm && l.negocio.motivoSuspensao ? { desde: l.negocio.suspensoEm, motivo: l.negocio.motivoSuspensao } : null,
      };
    },

    /** Liberação ativa do Dono no negócio, para a faixa dos membros (5.6). A emergência não conta aqui. */
    async liberacaoAtiva(negocioId: string, agora: Date): Promise<{ id: string; modulos: Modulo[]; modulosComCorrecao: Modulo[]; expiraEm: Date } | null> {
      const l = await comNegocio(cliente, { negocioId }).acessoSuporte.findFirst({
        where: { tipo: "LIBERACAO", revogadoEm: null, expiraEm: { gt: agora } },
        orderBy: { criadoEm: "desc" },
        select: { id: true, modulos: true, modulosComCorrecao: true, expiraEm: true },
      });
      return l && { id: l.id, modulos: modulosValidos(l.modulos), modulosComCorrecao: modulosValidos(l.modulosComCorrecao ?? []), expiraEm: l.expiraEm };
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
        // Substitui só a liberação anterior: um acesso de emergência em andamento continua (o Dono o encerra à parte).
        const anteriores = await db.acessoSuporte.findMany({ where: { tipo: "LIBERACAO", revogadoEm: null, expiraEm: { gt: agora } }, select: { id: true } });
        for (const a of anteriores) {
          await db.acessoSuporte.update({ where: { id: a.id }, data: { revogadoEm: agora, revogadoPorId: donoId } });
          await registrar(db, { negocioId, acessoId: a.id, usuarioId: donoId, evento: "REVOGACAO", descricao: "Substituída por uma nova liberação", criadoEm: agora });
        }
        const expira = calcularExpiracao(agora, dados.prazo);
        const nova = await db.acessoSuporte.create({
          data: { negocioId, liberadoPorId: donoId, motivo: dados.motivo, modulos: dados.modulos, modulosComCorrecao: dados.modulosComCorrecao, criadoEm: agora, expiraEm: expira },
          select: { id: true, expiraEm: true },
        });
        const correcao = dados.modulosComCorrecao.length ? ` (corrigir ${listaDeModulos(dados.modulosComCorrecao)})` : "";
        await registrar(db, { negocioId, acessoId: nova.id, usuarioId: donoId, evento: "LIBERACAO", descricao: `Liberou ${listaDeModulos(dados.modulos)}${correcao} até ${dataHoraCompleta(expira)}`, criadoEm: agora });
        return nova;
      });
    },

    /** Revoga a liberação ativa do negócio (5.4); false se não havia liberação ativa com esse id. */
    async revogar(negocioId: string, acessoId: string, donoId: string, agora: Date): Promise<boolean> {
      return comNegocio(cliente, { negocioId }).$transaction(async (db) => {
        const r = await db.acessoSuporte.updateMany({ where: { id: acessoId, tipo: "LIBERACAO", revogadoEm: null, expiraEm: { gt: agora } }, data: { revogadoEm: agora, revogadoPorId: donoId } });
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
          tipo: true,
          motivo: true,
          modulos: true,
          modulosComCorrecao: true,
          criadoEm: true,
          expiraEm: true,
          revogadoEm: true,
          motivoEmergencia: true,
          referencia: true,
          justificativa: true,
          resultado: true,
          resultadoEm: true,
          pedido: { select: { solicitadoPor: { select: { nome: true } }, decididoPor: { select: { nome: true } } } },
          liberadoPor: { select: { nome: true } },
          revogadoPor: { select: { nome: true } },
          registros: { orderBy: { criadoEm: "asc" }, select: { id: true, evento: true, modulo: true, descricao: true, criadoEm: true, usuario: { select: { nome: true } } } },
        },
      });
      return lista.map((l) => ({
        id: l.id,
        tipo: l.tipo,
        motivo: l.motivo,
        modulos: modulosValidos(l.modulos),
        modulosComCorrecao: modulosValidos(l.modulosComCorrecao ?? []),
        criadoEm: l.criadoEm,
        expiraEm: l.expiraEm,
        revogadoEm: l.revogadoEm,
        liberadoPor: l.liberadoPor?.nome ?? null,
        revogadoPor: l.revogadoPor?.nome ?? null,
        eventos: l.registros.map((r) => ({ id: r.id, evento: r.evento, modulo: r.modulo, descricao: r.descricao, criadoEm: r.criadoEm, autor: r.usuario.nome })),
        emergencia:
          l.tipo === "EMERGENCIA" && l.motivoEmergencia && l.pedido
            ? {
                motivo: l.motivoEmergencia,
                referencia: l.referencia ?? "",
                justificativa: l.justificativa ?? "",
                solicitadoPor: l.pedido.solicitadoPor.nome,
                aprovadoPor: l.pedido.decididoPor?.nome ?? null,
                resultado: l.resultado,
                resultadoEm: l.resultadoEm,
              }
            : null,
      }));
    },

    // ---------------------------------------------------------------- emergência (SPEC-019, 5.6)

    /** Acesso de emergência em andamento no negócio (faixas dos membros, painel e ficha). */
    async emergenciaAtiva(negocioId: string, agora: Date): Promise<EmergenciaAtiva | null> {
      const e = await comNegocio(cliente, { negocioId }).acessoSuporte.findFirst({
        where: { tipo: "EMERGENCIA", revogadoEm: null, expiraEm: { gt: agora }, negocio: { encerradoEm: null } },
        orderBy: { criadoEm: "desc" },
        select: SELECAO_DA_EMERGENCIA,
      });
      return e && paraEmergencia(e);
    },

    /**
     * Entrar no acesso de emergência (5.6): só a conta que pediu, e só enquanto ele vale (INV-010). Registra a
     * entrada, somente leitura, como no modo suporte.
     */
    async entrarNaEmergencia(negocioId: string, administradorId: string, agora: Date): Promise<ResultadoDaEntradaNaEmergencia> {
      return comNegocio(cliente, { negocioId }).$transaction(async (db): Promise<ResultadoDaEntradaNaEmergencia> => {
        const e = await db.acessoSuporte.findFirst({
          where: { tipo: "EMERGENCIA", ...ativa(agora) },
          orderBy: { criadoEm: "desc" },
          select: { id: true, expiraEm: true, modulos: true, pedido: { select: { solicitadoPorId: true } } },
        });
        if (!e) return { ok: false, erro: "SemEmergencia" };
        if (e.pedido?.solicitadoPorId !== administradorId) return { ok: false, erro: "SoQuemPediu" };
        const primeira = (await db.acessoSuporte.updateMany({ where: { id: e.id, primeiraEntradaEm: null }, data: { primeiraEntradaEm: agora } })).count === 1;
        await registrar(db, { negocioId, acessoId: e.id, usuarioId: administradorId, evento: "ENTRADA", descricao: "Entrou no acesso de emergência (somente leitura)", criadoEm: agora });
        return { ok: true, acessoId: e.id, expiraEm: e.expiraEm, modulos: modulosValidos(e.modulos), primeira };
      });
    },

    /**
     * Encerrar o acesso de emergência (5.6): o Dono, a qualquer momento; ou quem pediu, ao sair. A próxima
     * requisição do Administrador já não tem o contexto (INV-010). false se já tinha terminado.
     */
    async encerrarEmergencia(negocioId: string, acessoId: string, usuarioId: string, agora: Date, quem: "DONO" | "ADMINISTRADOR"): Promise<boolean> {
      return comNegocio(cliente, { negocioId }).$transaction(async (db) => {
        const r = await db.acessoSuporte.updateMany({ where: { id: acessoId, tipo: "EMERGENCIA", revogadoEm: null, expiraEm: { gt: agora } }, data: { revogadoEm: agora, revogadoPorId: usuarioId } });
        if (r.count === 0) return false;
        const descricao = quem === "DONO" ? "Encerrou o acesso de emergência" : "Saiu e encerrou o acesso de emergência";
        await registrar(db, { negocioId, acessoId, usuarioId, evento: "EMERGENCIA_ENCERRADA", descricao, criadoEm: agora });
        return true;
      });
    },

    /**
     * Resultado do acesso de emergência (5.6, "Depois"): quem pediu, depois do fim (saída, expiração ou
     * encerramento), uma vez, até 1000 caracteres. Visível ao Dono e às contas de Administrador.
     */
    async registrarResultado(acessoId: string, administradorId: string, resultado: string, agora: Date): Promise<ResultadoDoResultado> {
      const alvo = await cliente.acessoSuporte.findUnique({ where: { id: acessoId }, select: { negocioId: true, tipo: true } });
      if (!alvo || alvo.tipo !== "EMERGENCIA") return { ok: false, erro: "AcessoInexistente" };
      const negocioId = alvo.negocioId;
      return comNegocio(cliente, { negocioId }).$transaction(async (db): Promise<ResultadoDoResultado> => {
        const e = (
          await db.$queryRaw<{ revogadoEm: Date | null; expiraEm: Date; resultado: string | null; solicitadoPorId: string }[]>`
            SELECT a."revogadoEm", a."expiraEm", a."resultado", p."solicitadoPorId"::text AS "solicitadoPorId"
            FROM "AcessoSuporte" a JOIN "PedidoPlataforma" p ON p."id" = a."pedidoId"
            WHERE a."id" = ${acessoId}::uuid FOR UPDATE OF a`
        )[0];
        if (!e) return { ok: false, erro: "AcessoInexistente" };
        if (e.solicitadoPorId !== administradorId) return { ok: false, erro: "SoQuemPediu" };
        if (e.revogadoEm === null && e.expiraEm.getTime() > agora.getTime()) return { ok: false, erro: "AindaAtiva" };
        if (e.resultado !== null) return { ok: false, erro: "JaRegistrado" };
        await db.acessoSuporte.update({ where: { id: acessoId }, data: { resultado, resultadoEm: agora } });
        await registrar(db, { negocioId, acessoId, usuarioId: administradorId, evento: "EMERGENCIA_RESULTADO", descricao: `Registrou o resultado: ${resultado}`, criadoEm: agora });
        return { ok: true, negocioId };
      });
    },

    /**
     * Histórico das emergências de todas as contas (5.9, item 3), da mais nova para a mais antiga. Com
     * `semResultadoDe`, só as dessa conta ainda sem o resultado (o que ela precisa registrar).
     */
    async emergencias(filtro: { limite?: number; semResultadoDe?: string } = {}): Promise<EmergenciaNoPainel[]> {
      const lista = await cliente.acessoSuporte.findMany({
        where: { tipo: "EMERGENCIA", ...(filtro.semResultadoDe ? { resultado: null, pedido: { solicitadoPorId: filtro.semResultadoDe } } : {}) },
        orderBy: { criadoEm: "desc" },
        take: filtro.limite ?? 50,
        select: {
          id: true,
          negocioId: true,
          motivoEmergencia: true,
          referencia: true,
          justificativa: true,
          modulos: true,
          criadoEm: true,
          expiraEm: true,
          revogadoEm: true,
          resultado: true,
          resultadoEm: true,
          negocio: { select: { nome: true } },
          revogadoPor: { select: { nome: true } },
          pedido: { select: { criadoEm: true, solicitadoPorId: true, solicitadoPor: { select: { nome: true } }, decididoPor: { select: { nome: true } } } },
        },
      });
      return lista.flatMap((e) =>
        e.motivoEmergencia && e.pedido
          ? [
              {
                id: e.id,
                negocioId: e.negocioId,
                negocio: e.negocio.nome,
                motivo: e.motivoEmergencia,
                referencia: e.referencia ?? "",
                justificativa: e.justificativa ?? "",
                modulos: modulosValidos(e.modulos),
                solicitadoPorId: e.pedido.solicitadoPorId,
                solicitadoPor: e.pedido.solicitadoPor.nome,
                aprovadoPor: e.pedido.decididoPor?.nome ?? null,
                pedidoEm: e.pedido.criadoEm,
                aprovadoEm: e.criadoEm,
                expiraEm: e.expiraEm,
                encerradoEm: e.revogadoEm,
                encerradoPor: e.revogadoPor?.nome ?? null,
                resultado: e.resultado,
                resultadoEm: e.resultadoEm,
              },
            ]
          : [],
      );
    },

    // ---------------------------------------------------------------- Administrador (5.3, 5.5)

    /** Painel (INV-009): só os metadados da seção 5.3, com busca por nome do negócio ou e-mail do Dono. */
    async listarNegocios(
      busca: string,
      pagina: number,
      agora: Date,
      situacao: "todos" | "suspensos" = "todos",
    ): Promise<{ negocios: NegocioNoPainel[]; total: number; paginas: number }> {
      const termo = busca.trim().slice(0, 120);
      const where = {
        ...(termo
          ? {
              OR: [
                { nome: { contains: termo, mode: "insensitive" as const } },
                { membros: { some: { papel: "DONO" as const, usuario: { email: { contains: termo.toLowerCase() } } } } },
              ],
            }
          : {}),
        // SPEC-019 (5.9): o filtro da situação "Suspenso".
        ...(situacao === "suspensos" ? { suspensoEm: { not: null } } : {}),
      };
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

    /**
     * Entrada em modo suporte (5.5): confere a liberação, marca a primeira entrada e registra. Na
     * liberação com correção (SPEC-019, 5.3), só com o código reconfirmado, que fica no registro da entrada.
     */
    async entrar(acessoId: string, administradorId: string, agora: Date, reconfirmada = false): Promise<ResultadoDaEntrada> {
      const alvo = await cliente.acessoSuporte.findUnique({ where: { id: acessoId }, select: { negocioId: true } });
      if (!alvo) return { ok: false, erro: "SemLiberacao" };
      const negocioId = alvo.negocioId;
      return comNegocio(cliente, { negocioId }).$transaction(async (db) => {
        // Marca a primeira entrada só uma vez, mesmo com duas entradas simultâneas (OPEN-009).
        const ainda = await db.acessoSuporte.findFirst({ where: { id: acessoId, ...ativa(agora) }, select: { id: true, modulosComCorrecao: true } });
        if (!ainda) return { ok: false, erro: "Expirada" } as const;
        const correcao = modulosValidos(ainda.modulosComCorrecao ?? []);
        if (correcao.length > 0 && !reconfirmada) return { ok: false, erro: "Reconfirmar" } as const;
        const primeira = (await db.acessoSuporte.updateMany({ where: { id: acessoId, primeiraEntradaEm: null }, data: { primeiraEntradaEm: agora } })).count === 1;
        const descricao = correcao.length > 0 ? `Entrou em modo suporte com o código reconfirmado (pode corrigir ${listaDeModulos(correcao)})` : "Entrou em modo suporte (somente leitura)";
        await db.registroSuporte.create({
          data: { negocioId, acessoId, usuarioId: administradorId, evento: "ENTRADA", descricao: descricao.slice(0, 200), criadoEm: agora, dados: correcao.length > 0 ? { reconfirmada: true } : undefined },
        });
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

    /** SPEC-019 (5.3, item 5): correções deste Administrador desde a última entrada nesta liberação. */
    async correcoesDaVisita(acessoId: string, administradorId: string): Promise<number> {
      const entrada = await cliente.registroSuporte.findFirst({ where: { acessoId, usuarioId: administradorId, evento: "ENTRADA" }, orderBy: { criadoEm: "desc" }, select: { criadoEm: true } });
      if (!entrada) return 0;
      return cliente.registroSuporte.count({ where: { acessoId, usuarioId: administradorId, evento: "CORRECAO", criadoEm: { gte: entrada.criadoEm } } });
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

    // ---------------------------------------------------------------- 2º fator (SPEC-019, 5.1)

    /** Eventos do 2º fator no registro, sem negócio associado, como os de papel (RN32: só inclusão). */
    async registrarSegundoFator(usuarioId: string, evento: "SEGUNDO_FATOR_CADASTRADO" | "SEGUNDO_FATOR_REMOVIDO", descricao: string, agora: Date): Promise<void> {
      await registrar(cliente, { negocioId: null, acessoId: null, usuarioId, evento, descricao, criadoEm: agora });
    },

    /** Conta para a redefinição pelo workflow (OPEN-002): só conta de Administrador existente. */
    async contaParaRedefinir(email: string): Promise<ContaParaRedefinir> {
      const u = await cliente.usuario.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, excluidoEm: true, administradorEm: true } });
      if (!u || u.excluidoEm) return { ok: false, erro: "ContaInexistente" };
      if (!u.administradorEm) return { ok: false, erro: "NaoEAdministrador" };
      return { ok: true, usuarioId: u.id };
    },

    /**
     * Depois de apagar os fatores no Supabase Auth: as sessões abertas antes de `agora` deixam de
     * valer (INV-001) e o registro mostra quem redefiniu, na mesma transação.
     */
    async registrarRedefinicao(usuarioId: string, responsavel: string, removidos: number, agora: Date): Promise<void> {
      await cliente.$transaction(async (tx) => {
        await tx.usuario.update({ where: { id: usuarioId }, data: { segundoFatorRedefinidoEm: agora } });
        await registrar(tx, {
          negocioId: null,
          acessoId: null,
          usuarioId,
          evento: "SEGUNDO_FATOR_REDEFINIDO",
          descricao: `2º fator redefinido por ${responsavel} (workflow): ${removidos} autenticador(es) removido(s)`,
          criadoEm: agora,
        });
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
    suspensoEm: true,
    motivoSuspensao: true,
    descricaoSuspensao: true,
    suspensoPor: { select: { nome: true } },
    _count: { select: { membros: true } },
    membros: { where: { papel: "DONO" }, take: 1, select: { usuario: { select: { nome: true, email: true, excluidoEm: true } } } },
    // A liberação ativa e, à parte, a emergência em andamento (no máximo uma de cada).
    acessosSuporte: {
      where: { revogadoEm: null, expiraEm: { gt: agora } },
      orderBy: { criadoEm: "desc" },
      take: 4,
      select: { tipo: true, motivo: true, modulosComCorrecao: true, ...SELECAO_DA_EMERGENCIA },
    },
  }) as const;

type LinhaDoPainel = {
  id: string;
  nome: string;
  regimeTributario: RegimeTributario;
  plano: PlanoNegocio;
  createdAt: Date;
  encerradoEm: Date | null;
  suspensoEm: Date | null;
  motivoSuspensao: MotivoSuspensao | null;
  descricaoSuspensao: string | null;
  suspensoPor: { nome: string } | null;
  _count: { membros: number };
  membros: { usuario: { nome: string; email: string; excluidoEm: Date | null } }[];
  acessosSuporte: (LinhaDaEmergencia & { tipo: TipoAcessoSuporte; motivo: string; modulosComCorrecao: string[] })[];
};

function paraPainel(n: LinhaDoPainel): NegocioNoPainel {
  const dono = n.membros[0]?.usuario;
  const l = n.encerradoEm ? undefined : n.acessosSuporte.find((a) => a.tipo === "LIBERACAO");
  const e = n.encerradoEm ? undefined : n.acessosSuporte.find((a) => a.tipo === "EMERGENCIA");
  return {
    id: n.id,
    nome: n.nome,
    regime: n.regimeTributario,
    plano: n.plano,
    criadoEm: n.createdAt,
    membros: n._count.membros,
    encerrado: n.encerradoEm !== null,
    dono: dono && !dono.excluidoEm ? { nome: dono.nome, email: dono.email } : null,
    liberacao: l ? { id: l.id, motivo: l.motivo, modulos: modulosValidos(l.modulos), modulosComCorrecao: modulosValidos(l.modulosComCorrecao ?? []), expiraEm: l.expiraEm } : null,
    emergencia: e ? paraEmergencia(e) : null,
    suspensao:
      n.suspensoEm && n.motivoSuspensao
        ? { desde: n.suspensoEm, motivo: n.motivoSuspensao, descricao: n.descricaoSuspensao ?? "", por: n.suspensoPor?.nome ?? "—" }
        : null,
  };
}

export type ConsultasDeSuporte = ReturnType<typeof criarConsultasDeSuporte>;
