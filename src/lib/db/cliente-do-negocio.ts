import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { ContextoDeNegocioAusente, NegocioDivergente, OperacaoForaDoContexto } from "./erros";
import { definicaoDoModelo, ehOperacional } from "./modelos";

/**
 * "Cliente do negócio" (SPEC-001, OPEN-28): extensão do Prisma Client que restringe
 * todo acesso a modelos operacionais ao negocioId do contexto.
 *
 * - leituras, alterações e exclusões recebem `negocioId = contexto` no filtro;
 * - criações (inclusive aninhadas) recebem o negocioId do contexto; um valor diferente é recusado;
 * - o negocioId nunca é alterado;
 * - registros de outro negócio se comportam como inexistentes;
 * - o gatilho do banco (migração de isolamento) recusa ligações entre negócios diferentes (INV-005).
 */

export type ContextoDeNegocio = {
  negocioId: string;
  usuarioId?: string;
};

type Dados = Record<string, unknown>;

const LEITURAS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);
const ALTERACOES_FILTRADAS = new Set(["update", "updateMany", "updateManyAndReturn"]);
const EXCLUSOES = new Set(["delete", "deleteMany"]);
const CRIACOES_EM_LOTE = new Set(["createMany", "createManyAndReturn"]);

function ehObjeto(valor: unknown): valor is Dados {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function paraCada(valor: unknown, fn: (item: unknown) => unknown): unknown {
  return Array.isArray(valor) ? valor.map(fn) : fn(valor);
}

function erroDoBanco(erro: unknown): never {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  if (mensagem.includes("he_negocio_divergente")) {
    throw new NegocioDivergente("a ligação aponta para um registro de outro negócio.");
  }
  if (mensagem.includes("he_negocio_imutavel")) {
    throw new NegocioDivergente("o negocioId de um registro não pode ser alterado.");
  }
  throw erro;
}

export function criarExtensaoDoNegocio(contexto: ContextoDeNegocio | null | undefined) {
  const negocioId = contexto?.negocioId;
  if (!negocioId) throw new ContextoDeNegocioAusente();

  /**
   * Soma a condição do contexto à condição recebida (AND), sem sobrescrever nada:
   * um filtro por outro negócio continua valendo e simplesmente não encontra registros.
   */
  function restringir(where: unknown, condicao: Dados): Dados {
    const original = ehObjeto(where) ? where : {};
    const and = original.AND === undefined ? [] : Array.isArray(original.AND) ? original.AND : [original.AND];
    return { ...original, AND: [...and, condicao] };
  }

  function comFiltro(where: unknown): Dados {
    return restringir(where, { negocioId });
  }

  function verificarAtualizacao(modelo: string, dados: unknown): unknown {
    if (!ehObjeto(dados)) return dados;
    if ("negocioId" in dados || "negocio" in dados) {
      throw new NegocioDivergente(`o negocioId de ${modelo} não pode ser alterado.`);
    }
    return injetarAninhados(modelo, { ...dados });
  }

  function prepararCriacaoPlana(modelo: string, dados: unknown): unknown {
    if (!ehObjeto(dados)) return dados;
    if (dados.negocioId !== undefined && dados.negocioId !== negocioId) {
      throw new NegocioDivergente(`criação de ${modelo} informando outro negócio.`);
    }
    return { ...dados, negocioId };
  }

  function prepararCriacao(modelo: string, dados: unknown): unknown {
    if (!ehObjeto(dados)) return dados;
    const resultado: Dados = { ...dados };

    if (resultado.negocioId !== undefined && resultado.negocioId !== negocioId) {
      throw new NegocioDivergente(`criação de ${modelo} informando outro negócio.`);
    }
    if (resultado.negocio !== undefined) {
      const conectado = ehObjeto(resultado.negocio) && ehObjeto(resultado.negocio.connect)
        ? resultado.negocio.connect.id
        : undefined;
      if (conectado !== negocioId) {
        throw new NegocioDivergente(`criação de ${modelo} ligada a outro negócio.`);
      }
    }

    // Entrada "checada" (relações como objetos) exige `negocio: { connect }`;
    // entrada "não checada" (chaves estrangeiras escalares) exige `negocioId`.
    const relacoes = definicaoDoModelo(modelo)?.relacoes ?? {};
    const checada = Object.entries(relacoes).some(
      ([campo, rel]) => rel.fk !== undefined && ehObjeto(resultado[campo]),
    );
    if (checada) {
      delete resultado.negocioId;
      resultado.negocio = { connect: { id: negocioId } };
    } else {
      delete resultado.negocio;
      resultado.negocioId = negocioId;
    }
    return injetarAninhados(modelo, resultado);
  }

  /** Injeta o negocioId nas escritas aninhadas que criam registros operacionais. */
  function injetarAninhados(modelo: string, dados: Dados): Dados {
    const relacoes = definicaoDoModelo(modelo)?.relacoes ?? {};
    for (const [campo, rel] of Object.entries(relacoes)) {
      const escrita = dados[campo];
      if (campo === "negocio" || !ehObjeto(escrita) || !ehOperacional(rel.modelo)) continue;
      const destino = rel.modelo;
      const nova: Dados = { ...escrita };

      if (nova.create !== undefined) {
        nova.create = paraCada(nova.create, (d) => prepararCriacao(destino, d));
      }
      if (ehObjeto(nova.createMany)) {
        nova.createMany = {
          ...nova.createMany,
          data: paraCada(nova.createMany.data, (d) => prepararCriacaoPlana(destino, d)),
        };
      }
      if (nova.connectOrCreate !== undefined) {
        nova.connectOrCreate = paraCada(nova.connectOrCreate, (c) =>
          ehObjeto(c) ? { ...c, create: prepararCriacao(destino, c.create) } : c,
        );
      }
      if (nova.upsert !== undefined) {
        nova.upsert = paraCada(nova.upsert, (u) =>
          ehObjeto(u)
            ? { ...u, create: prepararCriacao(destino, u.create), update: verificarAtualizacao(destino, u.update) }
            : u,
        );
      }
      if (nova.update !== undefined) {
        nova.update = paraCada(nova.update, (u) =>
          ehObjeto(u) && "data" in u
            ? { ...u, data: verificarAtualizacao(destino, u.data) }
            : verificarAtualizacao(destino, u),
        );
      }
      if (nova.updateMany !== undefined) {
        nova.updateMany = paraCada(nova.updateMany, (u) =>
          ehObjeto(u) ? { ...u, data: verificarAtualizacao(destino, u.data) } : u,
        );
      }
      dados[campo] = nova;
    }
    return dados;
  }

  function prepararOperacional(modelo: string, operacao: string, args: Dados): Dados {
    if (LEITURAS.has(operacao) || EXCLUSOES.has(operacao)) {
      return { ...args, where: comFiltro(args.where) };
    }
    if (ALTERACOES_FILTRADAS.has(operacao)) {
      return { ...args, where: comFiltro(args.where), data: verificarAtualizacao(modelo, args.data) };
    }
    if (operacao === "create") {
      return { ...args, data: prepararCriacao(modelo, args.data) };
    }
    if (CRIACOES_EM_LOTE.has(operacao)) {
      return { ...args, data: paraCada(args.data, (d) => prepararCriacaoPlana(modelo, d)) };
    }
    if (operacao === "upsert") {
      return {
        ...args,
        where: comFiltro(args.where),
        create: prepararCriacao(modelo, args.create),
        update: verificarAtualizacao(modelo, args.update),
      };
    }
    throw new OperacaoForaDoContexto(modelo, operacao);
  }

  function prepararAncora(modelo: string, operacao: string, args: Dados): Dados {
    const where = restringir(args.where, { id: negocioId });
    if (LEITURAS.has(operacao)) return { ...args, where };
    if (ALTERACOES_FILTRADAS.has(operacao)) {
      const dados = ehObjeto(args.data) ? args.data : {};
      if ("id" in dados) throw new NegocioDivergente("o id do negócio não pode ser alterado.");
      return { ...args, where };
    }
    // Criar ou excluir negócios não é feito pelo cliente do negócio (SPEC-004 / SPEC-014).
    throw new OperacaoForaDoContexto(modelo, operacao);
  }

  return Prisma.defineExtension({
    name: "cliente-do-negocio",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const classe = definicaoDoModelo(model)?.classe;
          if (classe === undefined) throw new OperacaoForaDoContexto(model, operation);
          if (classe === "global") return query(args);

          const preparado =
            classe === "operacional"
              ? prepararOperacional(model, operation, (args ?? {}) as Dados)
              : prepararAncora(model, operation, (args ?? {}) as Dados);
          try {
            return await query(preparado as typeof args);
          } catch (erro) {
            erroDoBanco(erro);
          }
        },
      },
    },
  });
}

/** Aplica o cliente do negócio a um PrismaClient. */
export function comNegocio(cliente: PrismaClient, contexto: ContextoDeNegocio | null | undefined) {
  return cliente.$extends(criarExtensaoDoNegocio(contexto));
}

export type ClienteDoNegocio = ReturnType<typeof comNegocio>;
