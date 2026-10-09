import type { PrismaClient } from "@/generated/prisma/client";
import type { PapelUsuario, RegimeTributario } from "@/generated/prisma/enums";
import type { DadosDoNegocio } from "@/lib/negocio/validacao";

/**
 * Negócios do usuário (SPEC-004). O Negocio é a âncora do tenant (ADR-002): é criado
 * aqui, antes de existir um negócio no contexto; depois disso, os dados operacionais
 * passam pelo cliente do negócio.
 */

export class CnpjJaCadastrado extends Error {
  constructor() {
    super("CNPJ já cadastrado.");
    this.name = "CnpjJaCadastrado";
  }
}

export type ResumoDoNegocio = { id: string; nome: string; regime: RegimeTributario; papel: PapelUsuario };

const paraBanco = (d: DadosDoNegocio) => ({
  nome: d.nome,
  regimeTributario: d.regime,
  cnpj: d.cnpj,
  razaoSocial: d.razaoSocial,
  cnaePrincipal: d.cnaePrincipal,
  anexoSimples: d.anexoSimples,
  sujeitoFatorR: d.sujeitoFatorR,
  atividadeMei: d.atividadeMei,
  impostoPercentualManual: d.impostoPercentualManual,
});

const ehViolacaoDeUnicidade = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

export function criarConsultasDeNegocios(cliente: PrismaClient) {
  return {
    /** Cria o negócio e o membro Dono na mesma transação (INV-001). */
    async criarComDono(usuarioId: string, dados: DadosDoNegocio): Promise<string> {
      try {
        return await cliente.$transaction(async (tx) => {
          const negocio = await tx.negocio.create({ data: paraBanco(dados), select: { id: true } });
          await tx.membroNegocio.create({ data: { usuarioId, negocioId: negocio.id, papel: "DONO" } });
          return negocio.id;
        });
      } catch (e) {
        if (ehViolacaoDeUnicidade(e)) throw new CnpjJaCadastrado();
        throw e;
      }
    },

    async cnpjCadastrado(cnpj: string): Promise<boolean> {
      return (await cliente.negocio.count({ where: { cnpj } })) > 0;
    },

    /** Negócios em que o usuário é membro, sem os encerrados, em ordem alfabética. */
    async listarDoUsuario(usuarioId: string): Promise<ResumoDoNegocio[]> {
      const membros = await cliente.membroNegocio.findMany({
        where: { usuarioId, negocio: { encerradoEm: null } },
        select: { papel: true, negocio: { select: { id: true, nome: true, regimeTributario: true } } },
        orderBy: { negocio: { nome: "asc" } },
      });
      return membros.map((m) => ({ id: m.negocio.id, nome: m.negocio.nome, regime: m.negocio.regimeTributario, papel: m.papel }));
    },

    /** Papel do usuário no negócio, ou null se não for membro ou o negócio estiver encerrado. */
    async papel(usuarioId: string, negocioId: string): Promise<PapelUsuario | null> {
      const membro = await cliente.membroNegocio.findFirst({
        where: { usuarioId, negocioId, negocio: { encerradoEm: null } },
        select: { papel: true },
      });
      return membro?.papel ?? null;
    },

    /** Dados fiscais do negócio (para o painel e a edição). */
    async dadosFiscais(negocioId: string): Promise<(DadosDoNegocio & { id: string }) | null> {
      const n = await cliente.negocio.findUnique({ where: { id: negocioId } });
      if (!n || n.encerradoEm) return null;
      return {
        id: n.id,
        nome: n.nome,
        regime: n.regimeTributario,
        cnpj: n.cnpj,
        razaoSocial: n.razaoSocial,
        cnaePrincipal: n.cnaePrincipal,
        anexoSimples: n.anexoSimples,
        sujeitoFatorR: n.sujeitoFatorR,
        atividadeMei: n.atividadeMei,
        impostoPercentualManual: n.impostoPercentualManual === null ? null : Number(n.impostoPercentualManual.toString()),
      };
    },

    /** Grava os dados fiscais (os campos que não valem para o regime ficam nulos — 5.5). */
    async atualizarDadosFiscais(negocioId: string, dados: DadosDoNegocio): Promise<void> {
      try {
        await cliente.negocio.update({ where: { id: negocioId }, data: paraBanco(dados) });
      } catch (e) {
        if (ehViolacaoDeUnicidade(e)) throw new CnpjJaCadastrado();
        throw e;
      }
    },

    /** Dias de cobertura do estoque (SPEC-007, OPEN-010): lidos por todos, alterados só pelo Dono. */
    async diasCobertura(negocioId: string): Promise<number> {
      const n = await cliente.negocio.findUnique({ where: { id: negocioId }, select: { diasCoberturaEstoque: true } });
      return n?.diasCoberturaEstoque ?? 7;
    },

    async definirDiasCobertura(negocioId: string, dias: number): Promise<void> {
      await cliente.negocio.update({ where: { id: negocioId }, data: { diasCoberturaEstoque: dias } });
    },
  };
}

export type ConsultasDeNegocios = ReturnType<typeof criarConsultasDeNegocios>;
