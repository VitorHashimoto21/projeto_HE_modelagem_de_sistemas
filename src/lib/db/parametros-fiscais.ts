import type { PrismaClient } from "@/generated/prisma/client";
import type { AnexoSimples, AtividadeMei, CategoriaItem } from "@/generated/prisma/enums";
import { hoje } from "@/lib/dominio/datas";
import { faixaContem, normalizarCnae, RbtInvalido, type FaixaDoSimples } from "@/lib/dominio/fiscal";

/**
 * Consultas aos parâmetros fiscais (SPEC-003, 5.3) — somente leitura (INV-006).
 * A versão vigente numa data é a de maior `vigenteDesde` até aquela data (OPEN-001).
 * Toda resposta traz a fonte legal e a vigência do valor usado (RN17).
 */

export class ParametroAusente extends Error {
  constructor(qual: string, dia: string) {
    super(`Nenhum parâmetro fiscal vigente para ${qual} em ${dia}. Rode a carga dos parâmetros (npm run fiscal:carregar).`);
    this.name = "ParametroAusente";
  }
}

export class AcimaDoLimiteDoSimples extends Error {
  constructor(public readonly limite: number) {
    super(`RBT12 acima do limite do Simples Nacional (R$ ${limite.toLocaleString("pt-BR")}).`);
    this.name = "AcimaDoLimiteDoSimples";
  }
}

export type Origem = { fonteLegal: string; vigenteDesde: string };

const num = (d: { toString(): string }) => Number(d.toString());
const dia = (d: Date) => d.toISOString().slice(0, 10);
const ate = (diaRef: string) => ({ lte: new Date(`${diaRef}T00:00:00Z`) });
const maisNova = { vigenteDesde: "desc" } as const;

export function criarConsultasFiscais(cliente: PrismaClient) {
  /** Vigência mais nova (até a data) do Anexo: todas as faixas dela. */
  async function faixasVigentes(anexo: AnexoSimples, diaRef: string) {
    const atual = await cliente.faixaTributaria.findFirst({
      where: { anexo, vigenteDesde: ate(diaRef) },
      orderBy: maisNova,
      select: { vigenteDesde: true },
    });
    if (!atual) throw new ParametroAusente(`as faixas do Anexo ${anexo}`, diaRef);
    return cliente.faixaTributaria.findMany({
      where: { anexo, vigenteDesde: atual.vigenteDesde },
      orderBy: { faixaOrdem: "asc" },
    });
  }

  return {
    /** Faixa do Simples em que rbt12De < RBT12 ≤ rbt12Ate (CA-07). */
    async faixaDoSimples(
      anexo: AnexoSimples,
      rbt12: number,
      diaRef: string = hoje(),
    ): Promise<FaixaDoSimples & Origem & { anexo: AnexoSimples; faixaOrdem: number }> {
      if (!(rbt12 > 0) || !Number.isFinite(rbt12)) throw new RbtInvalido();
      const faixas = (await faixasVigentes(anexo, diaRef)).map((f) => ({
        anexo: f.anexo,
        faixaOrdem: f.faixaOrdem,
        rbt12De: num(f.rbt12De),
        rbt12Ate: num(f.rbt12Ate),
        aliquota: num(f.aliquota),
        parcelaDeduzir: num(f.parcelaDeduzir),
        fonteLegal: f.fonteLegal,
        vigenteDesde: dia(f.vigenteDesde),
      }));
      const faixa = faixas.find((f) => faixaContem(f, rbt12));
      if (!faixa) throw new AcimaDoLimiteDoSimples(faixas[faixas.length - 1].rbt12Ate);
      return faixa;
    },

    /** Anexo de um CNAE em qualquer formato (CA-09); null se não estiver na tabela (RF59: manual). */
    async anexoDoCnae(codigo: string | number, diaRef: string = hoje()) {
      const cnae = normalizarCnae(codigo);
      if (!cnae) return null;
      const r = await cliente.cnaeAnexo.findFirst({ where: { cnae, vigenteDesde: ate(diaRef) }, orderBy: maisNova });
      return r
        ? { cnae: r.cnae, descricao: r.descricao, anexo: r.anexo, sujeitoFatorR: r.sujeitoFatorR, fonteLegal: r.fonteLegal, vigenteDesde: dia(r.vigenteDesde) }
        : null;
    },

    /** DAS mensal e limite anual do MEI por atividade (RF60). */
    async parametroMei(atividade: AtividadeMei, diaRef: string = hoje()) {
      const r = await cliente.parametroMei.findFirst({ where: { atividade, vigenteDesde: ate(diaRef) }, orderBy: maisNova });
      if (!r) throw new ParametroAusente(`o MEI (${atividade})`, diaRef);
      return {
        atividade: r.atividade,
        valorDasMensal: num(r.valorDasMensal),
        limiteFaturamentoAnual: num(r.limiteFaturamentoAnual),
        fonteLegal: r.fonteLegal,
        vigenteDesde: dia(r.vigenteDesde),
      };
    },

    /** Regra do Fator R (RF69). */
    async regraFatorR(diaRef: string = hoje()) {
      const r = await cliente.parametroFatorR.findFirst({ where: { vigenteDesde: ate(diaRef) }, orderBy: maisNova });
      if (!r) throw new ParametroAusente("o Fator R", diaRef);
      return {
        limiteMinimo: num(r.limiteMinimo),
        anexoSeAtingir: r.anexoSeAtingir,
        anexoSeNaoAtingir: r.anexoSeNaoAtingir,
        fonteLegal: r.fonteLegal,
        vigenteDesde: dia(r.vigenteDesde),
      };
    },

    /** Margem padrão da categoria (RF36). */
    async margemPadrao(categoria: CategoriaItem, diaRef: string = hoje()) {
      const r = await cliente.margemPadraoCategoria.findFirst({ where: { categoria, vigenteDesde: ate(diaRef) }, orderBy: maisNova });
      if (!r) throw new ParametroAusente(`a margem padrão de ${categoria}`, diaRef);
      return { categoria: r.categoria, margemPadrao: num(r.margemPadrao), fonteLegal: r.fonteLegal, vigenteDesde: dia(r.vigenteDesde) };
    },
  };
}

export type ConsultasFiscais = ReturnType<typeof criarConsultasFiscais>;
