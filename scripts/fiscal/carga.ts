import type { PrismaClient } from "@/generated/prisma/client";
import type { ParametrosFiscais, TabelaFiscal } from "@/lib/fiscal/arquivo";
import {
  CAMPOS_DA_CHAVE,
  planejarCarga,
  resumirPlano,
  TABELAS_FISCAIS,
  type PlanoDeCarga,
  type Registro,
  type Resumo,
} from "@/lib/fiscal/plano";

/**
 * Gravação dos parâmetros fiscais (SPEC-003, 5.1). É o único código que escreve nas
 * tabelas fiscais (INV-006): a aplicação só lê, por src/lib/db/parametros-fiscais.ts.
 */

export class ConflitoDeVigencia extends Error {
  constructor(public readonly conflitos: string[]) {
    super(`Carga recusada — nada foi gravado:\n- ${conflitos.join("\n- ")}`);
    this.name = "ConflitoDeVigencia";
  }
}

type Delegado = {
  findMany(args?: object): Promise<Record<string, unknown>[]>;
  create(args: { data: object }): Promise<unknown>;
  updateMany(args: { where: object; data: object }): Promise<{ count: number }>;
};
type ClienteFiscal = Pick<PrismaClient, TabelaFiscal>;
const delegado = (cliente: ClienteFiscal, tabela: TabelaFiscal) => cliente[tabela] as unknown as Delegado;

const paraData = (dia: string) => new Date(`${dia}T00:00:00Z`);

/** Linha do banco → registro comparável com o arquivo (Decimal → número, Date → "AAAA-MM-DD"). */
function paraRegistro(linha: Record<string, unknown>): Registro {
  const registro: Record<string, string | number | boolean> = {};
  for (const [campo, valor] of Object.entries(linha)) {
    if (campo === "id") continue;
    if (valor instanceof Date) registro[campo] = valor.toISOString().slice(0, 10);
    else if (typeof valor === "object" && valor !== null) registro[campo] = Number(String(valor));
    else registro[campo] = valor as string | number | boolean;
  }
  return registro as Registro;
}

export async function lerParametrosDoBanco(cliente: ClienteFiscal): Promise<Record<TabelaFiscal, Registro[]>> {
  const entradas = await Promise.all(
    TABELAS_FISCAIS.map(async (t) => [t, (await delegado(cliente, t).findMany()).map(paraRegistro)] as const),
  );
  return Object.fromEntries(entradas) as Record<TabelaFiscal, Registro[]>;
}

const comData = (r: Registro) => ({ ...r, vigenteDesde: paraData(r.vigenteDesde) });

async function aplicar(cliente: ClienteFiscal, plano: PlanoDeCarga) {
  for (const op of plano.operacoes) {
    const d = delegado(cliente, op.tabela);
    if (op.tipo === "criar") {
      await d.create({ data: comData(op.registro) });
    } else if (op.tipo === "corrigir") {
      const where = Object.fromEntries(
        [...CAMPOS_DA_CHAVE[op.tabela], "vigenteDesde"].map((c) => [c, c === "vigenteDesde" ? paraData(op.registro.vigenteDesde) : op.registro[c]]),
      );
      const { count } = await d.updateMany({ where, data: comData(op.registro) });
      if (count !== 1) throw new Error(`Correção de ${op.tabela} afetou ${count} registros (esperado 1).`);
    }
  }
}

export type ResultadoDaCarga = { plano: PlanoDeCarga; resumo: Resumo; gravado: boolean };

/**
 * Carga idempotente e atômica (INV-005): planeja contra o estado atual e grava tudo
 * numa única transação. Com conflito de vigência, nada é gravado (CA-05).
 */
export async function carregarParametros(
  cliente: PrismaClient,
  parametros: ParametrosFiscais,
  opcoes: { simular?: boolean; corrigir?: boolean } = {},
): Promise<ResultadoDaCarga> {
  const executar = async (tx: ClienteFiscal) => {
    const plano = planejarCarga(parametros, await lerParametrosDoBanco(tx), { corrigir: opcoes.corrigir });
    if (plano.conflitos.length) throw new ConflitoDeVigencia(plano.conflitos);
    const resumo = resumirPlano(plano);
    const haMudancas = plano.operacoes.some((op) => op.tipo !== "inalterado");
    if (!opcoes.simular && haMudancas) await aplicar(tx, plano);
    return { plano, resumo, gravado: !opcoes.simular && haMudancas };
  };

  if (opcoes.simular) return executar(cliente);
  return cliente.$transaction((tx) => executar(tx), { timeout: 60_000 });
}
