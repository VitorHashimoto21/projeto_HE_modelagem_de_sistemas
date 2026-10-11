import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { criarConsultasDeAcesso } from "@/lib/db/acesso";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDeEquipe } from "@/lib/db/equipe";
import { criarConsultasDoEstoque } from "@/lib/db/estoque";
import { criarConsultasFinanceiras } from "@/lib/db/financeiro";
import { criarConsultasDeNegocios } from "@/lib/db/negocios";
import { criarConsultasDePlanos } from "@/lib/db/planos";
import { criarConsultasDeRelatorios } from "@/lib/db/relatorios";
import { hoje as hojeLocal, intervaloDoDia } from "@/lib/dominio/datas";
import { somarDias } from "@/lib/dominio/estoque";
import { MATRIZ_COMPLETA } from "@/lib/dominio/permissoes";
import { inicioDoHistorico } from "@/lib/dominio/planos";
import { carregarRentabilidade, exportar, type DependenciasDosRelatorios } from "@/lib/relatorios/servicos";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

// SPEC-013 — testes de integração (seção 12): banco real, troca de plano em transação,
// suspensões, relatórios e exportações.

const base: PrismaClient = criarPrismaClient(urlDoBancoDeTeste());
const HOJE = hojeLocal();
const planos = criarConsultasDePlanos(base);
const acesso = criarConsultasDeAcesso(base);
const equipe = criarConsultasDeEquipe(base);

let dono: string;
let negocioA: string;
let negocioB: string;
let numero = 1;

async function usuario(nome: string) {
  return (await base.usuario.create({ data: { id: randomUUID(), nome, email: `${nome.toLowerCase()}-${randomUUID()}@exemplo.com` } })).id;
}
async function membro(nome: string, papel: "GERENTE" | "COLABORADOR" = "COLABORADOR", negocioId = negocioA) {
  const u = await usuario(nome);
  const m = await base.membroNegocio.create({ data: { usuarioId: u, negocioId, papel } });
  return { usuarioId: u, membroId: m.id };
}
async function convite(email: string, negocioId = negocioA) {
  return base.convite.create({ data: { negocioId, email, tokenHash: randomUUID(), expiraEm: new Date(Date.now() + 86_400_000), convidadoPorId: dono } });
}
const meioDia = (dia: string) => new Date(intervaloDoDia(dia).inicio.getTime() + 12 * 3_600_000);
async function item(nome: string, negocioId = negocioA) {
  return (await base.item.create({ data: { negocioId, tipo: "SERVICO", nome, nomeChave: `${nome}-${randomUUID()}`, categoria: "BELEZA", unidadeMedida: "un", custoBase: 1 } })).id;
}
async function vender(itemId: string, preco: number, custo: number, extra: { quantidade?: number; status?: "CONCLUIDA" | "CANCELADA"; data?: Date; negocioId?: string } = {}) {
  const negocioId = extra.negocioId ?? negocioA;
  const quantidade = extra.quantidade ?? 1;
  const data = extra.data ?? new Date();
  const v = await base.venda.create({
    data: {
      negocioId,
      data,
      valorTotal: preco * quantidade,
      numero: numero++,
      registradaPorId: dono,
      status: extra.status ?? "CONCLUIDA",
      ...(extra.status === "CANCELADA" ? { canceladaEm: data, canceladaPorId: dono, motivoCancelamento: "Erro no registro" } : {}),
    },
  });
  await base.itemVenda.create({ data: { negocioId, vendaId: v.id, itemId, quantidade, precoUnitario: preco, custoUnitario: custo } });
  await base.pagamento.create({ data: { negocioId, vendaId: v.id, forma: "PIX", valor: preco * quantidade } });
  return v.id;
}
const depsRel = (negocioId = negocioA): DependenciasDosRelatorios => ({
  relatorios: criarConsultasDeRelatorios(comNegocio(base, { negocioId, usuarioId: dono }), negocioId),
  negocio: "Studio A",
  hoje: HOJE,
  agora: new Date(),
});

beforeEach(async () => {
  const tabelas = await base.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await base.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  dono = await usuario("Gisele");
  negocioA = (await base.negocio.create({ data: { nome: "Studio A" } })).id;
  negocioB = (await base.negocio.create({ data: { nome: "Studio B" } })).id;
  await base.membroNegocio.create({ data: { usuarioId: dono, negocioId: negocioA, papel: "DONO" } });
  await base.membroNegocio.create({ data: { usuarioId: dono, negocioId: negocioB, papel: "DONO" } });
  numero = 1;
});

afterAll(async () => {
  await base.$disconnect();
});

describe("troca de plano", () => {
  it("T05 — CA-02/CA-03: upgrade com registro; mesmo plano e não-Dono recusados; trocas simultâneas → uma", async () => {
    const gerente = await membro("Rafa", "GERENTE");
    const a = planos.doNegocio(negocioA);
    expect(await a.alterarPlano("PAGO", gerente.usuarioId, null, new Date())).toEqual({ ok: false, erro: "NaoEhDono" });
    const rs = await Promise.all([a.alterarPlano("PAGO", dono, null, new Date()), a.alterarPlano("PAGO", dono, null, new Date())]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(rs.find((r) => !r.ok)).toEqual({ ok: false, erro: "MesmoPlano" });
    const n = await base.negocio.findUniqueOrThrow({ where: { id: negocioA } });
    expect(n.plano).toBe("PAGO");
    expect(n.planoAlteradoPorId).toBe(dono);
    expect(await base.historicoPlano.findMany({ where: { negocioId: negocioA }, select: { de: true, para: true, usuarioId: true } })).toEqual([{ de: "GRATUITO", para: "PAGO", usuarioId: dono }]);
    expect((await a.situacao(new Date()))).toMatchObject({ plano: "PAGO", alteradoPor: "Gisele" });
    expect(await planos.planoDoNegocio(negocioB)).toBe("GRATUITO"); // isolamento
    // Histórico somente inserção
    await expect(base.$executeRawUnsafe(`UPDATE "HistoricoPlano" SET "para" = 'GRATUITO'`)).rejects.toThrow(/he_somente_insercao/);
    await expect(base.$executeRawUnsafe(`DELETE FROM "HistoricoPlano"`)).rejects.toThrow(/he_somente_insercao/);
  });

  it("T06 — CA-04/CA-06: volta ao gratuito com 3 colaboradores e 1 convite; nada apagado; upgrade devolve tudo (INV-005)", async () => {
    const a = planos.doNegocio(negocioA);
    await a.alterarPlano("PAGO", dono, null, new Date());
    const ana = await membro("Ana", "GERENTE");
    const bia = await membro("Bia");
    const caio = await membro("Caio");
    await base.membroNegocio.update({ where: { id: caio.membroId }, data: { permissoesCustom: MATRIZ_COMPLETA as never } });
    const pendente = await convite("novo@exemplo.com");
    const servico = await item("Manicure");
    await vender(servico, 50, 12);
    const antes = await base.venda.count();

    expect(await a.alterarPlano("GRATUITO", dono, randomUUID(), new Date())).toEqual({ ok: false, erro: "EscolhaInvalida" });
    expect(await a.alterarPlano("GRATUITO", dono, bia.membroId, new Date())).toEqual({ ok: true, plano: "GRATUITO", suspensos: 2, reativados: 0, convitesCancelados: 1 });
    const situacao = await a.situacao(new Date());
    expect(situacao!.colaboradores.map((c) => [c.nome, c.suspensoEm !== null])).toEqual([
      ["Ana", true],
      ["Bia", false],
      ["Caio", true],
    ]);
    expect((await base.convite.findUniqueOrThrow({ where: { id: pendente.id } })).status).toBe("CANCELADO");
    expect(await base.venda.count()).toBe(antes);
    expect(await base.membroNegocio.count({ where: { negocioId: negocioA } })).toBe(4);

    expect(await a.alterarPlano("PAGO", dono, null, new Date())).toMatchObject({ ok: true, reativados: 2 });
    const caioDepois = await base.membroNegocio.findUniqueOrThrow({ where: { id: caio.membroId } });
    expect(caioDepois).toMatchObject({ suspensoEm: null, papel: "COLABORADOR" });
    expect(caioDepois.permissoesCustom).toEqual(MATRIZ_COMPLETA);
    expect((await base.membroNegocio.findUniqueOrThrow({ where: { id: ana.membroId } })).papel).toBe("GERENTE");
    expect(await base.historicoPlano.count({ where: { negocioId: negocioA } })).toBe(3);
    // O Dono nunca é suspenso (CHECK do banco)
    await expect(base.membroNegocio.updateMany({ where: { negocioId: negocioA, papel: "DONO" }, data: { suspensoEm: new Date() } })).rejects.toThrow(/dono_nunca_suspenso/);
  });

  it("T07 — CA-05: suspenso não passa na filiação nem troca para o negócio; aparece marcado em Meus negócios (INV-006)", async () => {
    const a = planos.doNegocio(negocioA);
    await a.alterarPlano("PAGO", dono, null, new Date());
    const bia = await membro("Bia");
    const caio = await membro("Caio");
    await a.alterarPlano("GRATUITO", dono, bia.membroId, new Date());
    expect(await acesso.filiacao(caio.usuarioId, negocioA)).toBeNull();
    expect(await acesso.ehMembro(caio.usuarioId, negocioA)).toBe(false);
    expect(await acesso.filiacao(bia.usuarioId, negocioA)).toMatchObject({ papel: "COLABORADOR" });
    const negocios = criarConsultasDeNegocios(base);
    expect(await negocios.papel(caio.usuarioId, negocioA)).toBeNull();
    expect(await negocios.listarDoUsuario(caio.usuarioId)).toEqual([expect.objectContaining({ id: negocioA, suspenso: true })]);
    // Suspenso não ocupa vaga: com a vaga da Bia ocupada, um convite novo é recusado; sem a Bia, é aceito.
    const doNegocio = equipe.doNegocio(negocioA);
    const novo = { email: "x@exemplo.com", papel: "COLABORADOR" as const, permissoesCustom: null, tokenHash: randomUUID(), expiraEm: new Date(Date.now() + 86_400_000), convidadoPorId: dono };
    expect(await doNegocio.criarConvite(novo, new Date())).toEqual({ ok: false, erro: "LimiteDoPlano" });
    await doNegocio.remover(bia.membroId);
    expect(await doNegocio.criarConvite({ ...novo, tokenHash: randomUUID() }, new Date())).toMatchObject({ ok: true });
  });

  it("T08 — CA-07: trocar quem tem acesso respeita o limite (INV-004)", async () => {
    const a = planos.doNegocio(negocioA);
    await a.alterarPlano("PAGO", dono, null, new Date());
    const ana = await membro("Ana");
    const bia = await membro("Bia");
    await a.alterarPlano("GRATUITO", dono, bia.membroId, new Date());
    expect(await a.trocarAcesso(ana.membroId, null, new Date())).toEqual({ ok: false, erro: "LimiteDoPlano" });
    expect((await base.membroNegocio.findUniqueOrThrow({ where: { id: bia.membroId } })).suspensoEm).toBeNull(); // nada mudou
    expect((await base.membroNegocio.findUniqueOrThrow({ where: { id: ana.membroId } })).suspensoEm).not.toBeNull();
    expect(await a.trocarAcesso(ana.membroId, bia.membroId, new Date())).toEqual({ ok: true });
    expect((await base.membroNegocio.findUniqueOrThrow({ where: { id: ana.membroId } })).suspensoEm).toBeNull();
    expect((await base.membroNegocio.findUniqueOrThrow({ where: { id: bia.membroId } })).suspensoEm).not.toBeNull();
    expect(await a.trocarAcesso(randomUUID(), null, new Date())).toEqual({ ok: false, erro: "MembroNaoEncontrado" });
  });

  it("T08 — CA-13: volta ao gratuito e aceite de convite ao mesmo tempo → no máximo 1 colaborador com acesso + pendentes", async () => {
    for (let rodada = 0; rodada < 5; rodada++) {
      await base.negocio.update({ where: { id: negocioA }, data: { plano: "PAGO" } });
      await base.membroNegocio.deleteMany({ where: { negocioId: negocioA, papel: { not: "DONO" } } });
      const bia = await membro(`Bia${rodada}`);
      const convidado = await usuario(`Novo${rodada}`);
      const email = (await base.usuario.findUniqueOrThrow({ where: { id: convidado } })).email;
      const c = await convite(email);
      await Promise.all([
        planos.doNegocio(negocioA).alterarPlano("GRATUITO", dono, bia.membroId, new Date()),
        equipe.aceitar(c.id, convidado, email, new Date()),
      ]);
      const ativos = await base.membroNegocio.count({ where: { negocioId: negocioA, papel: { not: "DONO" }, suspensoEm: null } });
      const pendentes = await base.convite.count({ where: { negocioId: negocioA, status: "PENDENTE" } });
      expect(ativos + pendentes, `rodada ${rodada}`).toBeLessThanOrEqual(1);
    }
  });
});

describe("relatórios", () => {
  it("T09 — CA-08: rentabilidade com cancelada fora; total = faturamento do período; isolamento (INV-007, INV-008)", async () => {
    const mani = await item("Manicure");
    const esmalte = await item("Esmalte");
    for (let i = 0; i < 3; i++) await vender(mani, 50, 12);
    await vender(esmalte, 18, 8, { quantidade: 2 });
    await vender(mani, 50, 12, { status: "CANCELADA" });
    await vender(await item("Outro", negocioB), 999, 1, { negocioId: negocioB });
    const r = await carregarRentabilidade(somarDias(HOJE, -1), HOJE, "margem", depsRel());
    expect(r.itens.map((i) => [i.nome, i.quantidade, i.faturamentoCentavos, i.custoCentavos, i.margemCentavos, i.margemPercentual])).toEqual([
      ["Manicure", 3, 15000, 3600, 11400, 76],
      ["Esmalte", 2, 3600, 1600, 2000, 55.56],
    ]);
    const fat = await base.venda.aggregate({ where: { negocioId: negocioA, status: "CONCLUIDA" }, _sum: { valorTotal: true } });
    expect(r.totais.faturamentoCentavos).toBe(Math.round(Number(fat._sum.valorTotal) * 100));
  });

  it("T09/T10 — CA-09/CA-10/CA-12: exportações batem com as fontes; gratuito e sem permissão recusados no servidor (INV-002)", async () => {
    const mani = await item("Manicure");
    await vender(mani, 50, 12);
    await vender(mani, 50, 12, { status: "CANCELADA" });
    const fin = criarConsultasFinanceiras(comNegocio(base, { negocioId: negocioA, usuarioId: dono }), negocioA);
    await fin.lancar({ tipo: "SAIDA", valorCentavos: 8000, categoria: "FORNECEDORES", descricao: "Compra; de esmaltes", data: new Date(), usuarioId: dono });
    await fin.criarConta({ tipo: "PAGAR", descricao: "Aluguel", categoria: "OUTROS", valorCentavos: 50000, vencimento: HOJE }, dono);

    const busca = (relatorio: string, formato: string) => ({ relatorio, formato, periodo: "mes" });
    expect(await exportar(busca("vendas", "csv"), { plano: "GRATUITO", permissoes: MATRIZ_COMPLETA }, depsRel())).toMatchObject({ ok: false, recusa: { motivo: "plano" } });
    expect(await exportar(busca("fluxo", "csv"), { plano: "PAGO", permissoes: { ...MATRIZ_COMPLETA, financeiro: { ver: false, criar: true, editar: false, excluir: false } } }, depsRel())).toMatchObject({
      ok: false,
      recusa: { motivo: "permissao" },
    });
    expect(await exportar(busca("planilha", "csv"), { plano: "PAGO", permissoes: MATRIZ_COMPLETA }, depsRel())).toMatchObject({ ok: false });

    const vendas = await exportar(busca("vendas", "csv"), { plano: "PAGO", permissoes: MATRIZ_COMPLETA }, depsRel());
    if (!vendas.ok) throw new Error(vendas.recusa.mensagem);
    const linhas = String(vendas.arquivo.corpo).trim().split("\r\n");
    expect(linhas).toHaveLength(4); // cabeçalho, 2 vendas, totais
    expect(linhas[2]).toContain(";Cancelada;");
    expect(linhas[3]).toContain("1 concluídas;1 canceladas;50,00");

    const fluxo = await exportar(busca("fluxo", "csv"), { plano: "PAGO", permissoes: MATRIZ_COMPLETA }, depsRel());
    if (!fluxo.ok) throw new Error(fluxo.recusa.mensagem);
    const lf = String(fluxo.arquivo.corpo).trim().split("\r\n");
    expect(lf).toHaveLength(2 + (await base.lancamentoFinanceiro.count({ where: { negocioId: negocioA } })));
    expect(lf.some((l) => l.includes('"Compra; de esmaltes";-80,00'))).toBe(true);

    const contas = await exportar(busca("contas", "pdf"), { plano: "PAGO", permissoes: MATRIZ_COMPLETA }, depsRel());
    if (!contas.ok) throw new Error(contas.recusa.mensagem);
    expect(contas.arquivo.tipo).toBe("application/pdf");
    expect(contas.arquivo.nome).toMatch(/^he-contas-\d{4}-\d{2}-01-a-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(Buffer.from(contas.arquivo.corpo as Uint8Array).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("T11 — CA-11: listas do gratuito limitadas a 12 meses; registros guardados e visíveis no pago", async () => {
    const desde = inicioDoHistorico("GRATUITO", HOJE)!;
    const antigo = somarDias(desde, -45);
    const fin = criarConsultasFinanceiras(comNegocio(base, { negocioId: negocioA, usuarioId: dono }), negocioA);
    await fin.criarConta({ tipo: "PAGAR", descricao: "Velha quitada", categoria: "OUTROS", valorCentavos: 1000, vencimento: antigo }, dono);
    await fin.criarConta({ tipo: "PAGAR", descricao: "Velha aberta", categoria: "OUTROS", valorCentavos: 2000, vencimento: antigo }, dono);
    await base.contaPagarReceber.updateMany({ where: { descricao: "Velha quitada" }, data: { status: "QUITADA", valorPago: 10 } });
    const gratis = await fin.listarContas({ tipo: "PAGAR", situacao: "todas", desde }, HOJE);
    expect(gratis.contas.map((c) => c.descricao)).toEqual(["Velha aberta"]);
    expect(gratis.ocultasPeloPlano).toBe(1);
    const pago = await fin.listarContas({ tipo: "PAGAR", situacao: "todas", desde: null }, HOJE);
    expect(pago.contas).toHaveLength(2);

    const produto = (await base.item.create({ data: { negocioId: negocioA, tipo: "PRODUTO_FISICO", nome: "Esmalte", nomeChave: "esmalte", categoria: "BELEZA", unidadeMedida: "un", custoBase: 5 } })).id;
    const est = criarConsultasDoEstoque(comNegocio(base, { negocioId: negocioA, usuarioId: dono }), negocioA);
    await base.movimentacaoEstoque.create({ data: { negocioId: negocioA, itemId: produto, tipo: "ENTRADA", quantidade: 5, saldoAnterior: 0, saldoPosterior: 5, usuarioId: dono, data: meioDia(antigo) } });
    await base.movimentacaoEstoque.create({ data: { negocioId: negocioA, itemId: produto, tipo: "ENTRADA", quantidade: 1, saldoAnterior: 5, saldoPosterior: 6, usuarioId: dono, data: new Date() } });
    const d = await est.detalhar(produto, HOJE, 1, desde);
    expect(d.movimentacoes).toHaveLength(1);
    expect(d.ocultasPeloPlano).toBe(1);
    expect((await est.detalhar(produto, HOJE, 1, null)).movimentacoes).toHaveLength(2);
  });

  it("T12 — RNF06: rentabilidade de 12 meses com 10 mil vendas e exportação de 10 mil linhas em menos de 3 s", async () => {
    const itens = await Promise.all(Array.from({ length: 20 }, (_, i) => item(`Item ${i}`)));
    const inicio = intervaloDoDia(inicioDoHistorico("GRATUITO", HOJE)!).inicio.getTime();
    const passo = Math.floor((Date.now() - inicio) / 10_000);
    const ids = Array.from({ length: 10_000 }, () => randomUUID());
    await base.venda.createMany({ data: ids.map((id, i) => ({ id, negocioId: negocioA, data: new Date(inicio + i * passo), valorTotal: 50, numero: i + 1, registradaPorId: dono })) });
    await base.itemVenda.createMany({ data: ids.map((vendaId, i) => ({ negocioId: negocioA, vendaId, itemId: itens[i % 20], quantidade: 1, precoUnitario: 50, custoUnitario: 20 })) });
    await base.pagamento.createMany({ data: ids.map((vendaId) => ({ negocioId: negocioA, vendaId, forma: "PIX" as const, valor: 50 })) });

    let t0 = performance.now();
    const r = await carregarRentabilidade(inicioDoHistorico("GRATUITO", HOJE)!, HOJE, "margem", depsRel());
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(r.totais.quantidade).toBe(10_000);

    t0 = performance.now();
    const csv = await exportar({ relatorio: "vendas", formato: "csv", periodo: "12meses" }, { plano: "PAGO", permissoes: MATRIZ_COMPLETA }, depsRel());
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(csv.ok && String(csv.arquivo.corpo).trim().split("\r\n").length).toBe(10_002);
  });
});
