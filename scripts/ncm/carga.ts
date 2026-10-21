import type { PrismaClient } from "@/generated/prisma/client";
import type { CodigoNcm, TabelaNcmLida } from "@/lib/ncm/arquivo";

/**
 * Gravação da tabela NCM (SPEC-021, 5.1). É o único código que escreve em Ncm e TabelaNcm:
 * a aplicação só lê. A carga é idempotente e nunca apaga um código (INV-006): o código que
 * não está mais no arquivo recebe como fim o dia anterior à atualização da tabela. Nenhum
 * item muda (INV-003).
 */

export type ResumoDaCargaNcm = { inseridos: number; alterados: number; encerrados: number; versao: boolean };

type ClienteNcm = Pick<PrismaClient, "ncm" | "tabelaNcm" | "$transaction">;

const paraData = (dia: string) => new Date(`${dia}T00:00:00Z`);
const paraDia = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const diaAnterior = (dia: string) => paraDia(new Date(paraData(dia).getTime() - 86_400_000))!;
const LOTE = 2000;

function igual(banco: { descricao: string; caminho: string[]; textoBusca: string; ato: string; vigenteAte: Date | null }, c: CodigoNcm) {
  return (
    banco.descricao === c.descricao &&
    banco.textoBusca === c.textoBusca &&
    banco.ato === c.ato &&
    paraDia(banco.vigenteAte) === c.vigenteAte &&
    banco.caminho.length === c.caminho.length &&
    banco.caminho.every((d, i) => d === c.caminho[i])
  );
}

export async function carregarTabelaNcm(cliente: ClienteNcm, tabela: TabelaNcmLida): Promise<ResumoDaCargaNcm> {
  const existentes = await cliente.ncm.findMany({
    select: { id: true, codigo: true, descricao: true, caminho: true, textoBusca: true, vigenteDesde: true, vigenteAte: true, ato: true },
  });
  const porChave = new Map(existentes.map((e) => [`${e.codigo}|${paraDia(e.vigenteDesde)}`, e]));
  const noArquivo = new Set(tabela.codigos.map((c) => `${c.codigo}|${c.vigenteDesde}`));

  const novos: CodigoNcm[] = [];
  const alterados: { id: string; c: CodigoNcm }[] = [];
  for (const c of tabela.codigos) {
    const e = porChave.get(`${c.codigo}|${c.vigenteDesde}`);
    if (!e) novos.push(c);
    else if (!igual(e, c)) alterados.push({ id: e.id, c });
  }
  const fim = diaAnterior(tabela.atualizadaEm);
  const encerrados = existentes
    .filter((e) => e.vigenteAte === null && !noArquivo.has(`${e.codigo}|${paraDia(e.vigenteDesde)}`))
    .map((e) => {
      const desde = paraDia(e.vigenteDesde)!;
      return { id: e.id, ate: fim < desde ? desde : fim };
    });

  const versao = await cliente.tabelaNcm.findUnique({ where: { id: 1 } });
  const versaoMudou = !versao || paraDia(versao.atualizadaEm) !== tabela.atualizadaEm || versao.ato !== tabela.ato;
  const resumo = { inseridos: novos.length, alterados: alterados.length, encerrados: encerrados.length, versao: versaoMudou };
  if (!novos.length && !alterados.length && !encerrados.length && !versaoMudou) return resumo;

  await cliente.$transaction(
    async (tx) => {
      for (let i = 0; i < novos.length; i += LOTE) {
        await tx.ncm.createMany({
          data: novos.slice(i, i + LOTE).map((c) => ({
            codigo: c.codigo,
            descricao: c.descricao,
            caminho: c.caminho,
            textoBusca: c.textoBusca,
            vigenteDesde: paraData(c.vigenteDesde),
            vigenteAte: c.vigenteAte ? paraData(c.vigenteAte) : null,
            ato: c.ato,
          })),
        });
      }
      for (const { id, c } of alterados) {
        await tx.ncm.update({
          where: { id },
          data: { descricao: c.descricao, caminho: c.caminho, textoBusca: c.textoBusca, ato: c.ato, vigenteAte: c.vigenteAte ? paraData(c.vigenteAte) : null },
        });
      }
      for (const { id, ate } of encerrados) {
        await tx.ncm.update({ where: { id }, data: { vigenteAte: paraData(ate) } });
      }
      await tx.tabelaNcm.upsert({
        where: { id: 1 },
        create: { id: 1, atualizadaEm: paraData(tabela.atualizadaEm), ato: tabela.ato },
        update: { atualizadaEm: paraData(tabela.atualizadaEm), ato: tabela.ato, carregadaEm: new Date() },
      });
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
  return resumo;
}
