import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  expiracaoDoPedido,
  lerPedidoDePlano,
  MENSAGENS_DA_PLATAFORMA,
  resumoDoPedidoDePlano,
  situacaoEfetiva,
  validarPedidoDePlano,
  validarRecusa,
} from "@/lib/dominio/plataforma";
import * as servicos from "@/lib/plataforma/servicos";

// SPEC-019, etapa 3a — testes unitários: o domínio dos pedidos da plataforma (5.8) e os fluxos com
// dependências falsas. A regra das duas pessoas no banco está em test/integracao/plataforma.test.ts.

const M = MENSAGENS_DA_PLATAFORMA;
const NEGOCIO = "c0000000-0000-4000-8000-000000000001";
const PEDIDO = "e0000000-0000-4000-8000-000000000001";

describe("pedido de troca de plano (5.8, item 1)", () => {
  it("aceita plano, motivo da lista e descrição, com os espaços normalizados", () => {
    expect(validarPedidoDePlano({ para: "PAGO", motivo: "CORTESIA", descricao: "  Cortesia   de 3 meses " })).toEqual({
      ok: true,
      dados: { para: "PAGO", motivo: "CORTESIA", descricao: "Cortesia de 3 meses" },
    });
  });

  it("recusa plano e motivo fora da lista e descrição vazia ou longa", () => {
    expect(validarPedidoDePlano({ para: "OURO", motivo: "AMIZADE", descricao: " " })).toEqual({
      ok: false,
      erros: { para: M.planoObrigatorio, motivo: M.motivoObrigatorio, descricao: M.descricaoObrigatoria },
    });
    expect(validarPedidoDePlano({ para: "GRATUITO", motivo: "TESTE", descricao: "x".repeat(301) })).toEqual({ ok: false, erros: { descricao: M.descricaoLonga } });
    expect(validarPedidoDePlano({ para: "GRATUITO", motivo: "TESTE", descricao: "x".repeat(300) }).ok).toBe(true);
  });

  it("lê os dados gravados só quando estão completos", () => {
    expect(lerPedidoDePlano({ para: "PAGO", motivo: "CORRECAO", descricao: "x" })).toEqual({ para: "PAGO", motivo: "CORRECAO", descricao: "x" });
    expect(lerPedidoDePlano({ para: "PAGO", motivo: "CORRECAO" })).toBeNull();
    expect(lerPedidoDePlano("texto")).toBeNull();
    expect(lerPedidoDePlano(null)).toBeNull();
    expect(resumoDoPedidoDePlano({ para: "PAGO", motivo: "CORRECAO" })).toBe("plano Pago (correção)");
  });

  it("o pedido vale 12 h, e o pendente vencido conta como expirado (CA-10, CA-16)", () => {
    const agora = new Date("2026-11-05T12:00:00Z");
    const expira = expiracaoDoPedido(agora);
    expect(expira).toEqual(new Date("2026-11-06T00:00:00Z"));
    expect(situacaoEfetiva({ situacao: "PENDENTE", expiraEm: expira }, new Date("2026-11-05T23:59:59Z"))).toBe("PENDENTE");
    expect(situacaoEfetiva({ situacao: "PENDENTE", expiraEm: expira }, expira)).toBe("EXPIRADO");
    expect(situacaoEfetiva({ situacao: "APROVADO", expiraEm: expira }, new Date("2026-11-07T00:00:00Z"))).toBe("APROVADO");
  });

  it("a recusa exige o motivo, até 300 caracteres", () => {
    expect(validarRecusa({ motivoDaRecusa: "  Sem   combinação " })).toEqual({ ok: true, motivo: "Sem combinação" });
    expect(validarRecusa({ motivoDaRecusa: "" })).toEqual({ ok: false, erro: M.motivoDaRecusaObrigatorio });
    expect(validarRecusa({})).toEqual({ ok: false, erro: M.motivoDaRecusaObrigatorio });
    expect(validarRecusa({ motivoDaRecusa: "x".repeat(301) })).toEqual({ ok: false, erro: M.motivoDaRecusaLongo });
  });
});

function deps(extra: Partial<servicos.DependenciasDaPlataforma> = {}): servicos.DependenciasDaPlataforma {
  return {
    administradorId: "a0000000-0000-4000-8000-0000000000a1",
    agora: () => new Date("2026-11-05T12:00:00Z"),
    pedirTrocaDePlano: vi.fn(async () => ({ ok: true as const, id: PEDIDO, expiraEm: new Date("2026-11-06T00:00:00Z") })),
    decidirTrocaDePlano: vi.fn(async () => ({ ok: false as const, erro: "PedidoInexistente" as const })),
    cancelar: vi.fn(async () => ({ ok: true as const })),
    dono: vi.fn(async () => ({ nome: "Rafael", email: "dono@exemplo.com", negocio: "HE Testing" })),
    avisar: vi.fn(),
    origem: "https://he.exemplo.com",
    ...extra,
  };
}

describe("fluxos dos pedidos (servicos.ts)", () => {
  it("pedir: valida antes de gravar e mostra o prazo", async () => {
    const d = deps();
    expect(await servicos.pedirTrocaDePlano({ negocioId: "x", para: "PAGO", motivo: "TESTE", descricao: "a" }, d)).toEqual({ status: "erro", mensagem: M.negocioInexistente });
    expect(await servicos.pedirTrocaDePlano({ negocioId: NEGOCIO, para: "PAGO" }, d)).toMatchObject({ status: "erro", erros: { motivo: M.motivoObrigatorio } });
    expect(d.pedirTrocaDePlano).not.toHaveBeenCalled();
    expect(await servicos.pedirTrocaDePlano({ negocioId: NEGOCIO, para: "PAGO", motivo: "TESTE", descricao: "a" }, d)).toEqual({
      status: "ok",
      mensagem: expect.stringContaining("Outra conta de Administrador precisa aprovar até"),
    });
  });

  it("pedir: cada recusa do banco vira a sua mensagem; o mesmo plano aparece no campo", async () => {
    const com = (r: Awaited<ReturnType<servicos.DependenciasDaPlataforma["pedirTrocaDePlano"]>>) =>
      servicos.pedirTrocaDePlano({ negocioId: NEGOCIO, para: "PAGO", motivo: "TESTE", descricao: "a" }, deps({ pedirTrocaDePlano: async () => r }));
    expect(await com({ ok: false, erro: "MesmoPlano", plano: "PAGO" })).toEqual({ status: "erro", erros: { para: M.mesmoPlano("PAGO") } });
    expect(await com({ ok: false, erro: "PedidoPendente" })).toEqual({ status: "erro", mensagem: M.pedidoPendente });
    expect(await com({ ok: false, erro: "NegocioEncerrado" })).toEqual({ status: "erro", mensagem: M.negocioEncerrado });
    expect(await com({ ok: false, erro: "NegocioInexistente" })).toEqual({ status: "erro", mensagem: M.negocioInexistente });
  });

  it("aprovar: avisa o Dono por e-mail só quando o plano muda", async () => {
    const recusada = deps({ decidirTrocaDePlano: async () => ({ ok: false, erro: "MesmoAdministrador" }) });
    expect(await servicos.aprovar({ pedidoId: PEDIDO }, recusada)).toEqual({ status: "erro", mensagem: M.mesmoAdministrador });
    expect(recusada.avisar).not.toHaveBeenCalled();

    const aprovada = deps({
      decidirTrocaDePlano: async () => ({
        ok: true,
        situacao: "APROVADO",
        negocioId: NEGOCIO,
        pedido: { para: "GRATUITO", motivo: "CORRECAO", descricao: "Pago por engano" },
        suspensos: 2,
        reativados: 0,
        convitesCancelados: 1,
      }),
    });
    expect(await servicos.aprovar({ pedidoId: PEDIDO }, aprovada)).toEqual({ status: "ok", mensagem: M.aprovado("GRATUITO") });
    expect(aprovada.avisar).toHaveBeenCalledTimes(1);
    const email = vi.mocked(aprovada.avisar).mock.calls[0][0];
    expect(email.assunto).toBe("O plano do HE Testing mudou para Gratuito pela plataforma do HE");
    expect(email.texto).toContain("Motivo: Correção — Pago por engano");
    expect(email.texto).toContain("2 colaboradores ficaram sem acesso");
    expect(email.texto).toContain("https://he.exemplo.com/negocio/equipe");
    expect(email.texto).toContain("1 convite pendente foi cancelado");
  });

  it("aprovar e recusar: cada recusa vira a sua explicação", async () => {
    const com = (r: Awaited<ReturnType<servicos.DependenciasDaPlataforma["decidirTrocaDePlano"]>>) => servicos.aprovar({ pedidoId: PEDIDO }, deps({ decidirTrocaDePlano: async () => r }));
    expect(await com({ ok: false, erro: "PedidoExpirado" })).toEqual({ status: "erro", mensagem: M.pedidoExpirado });
    expect(await com({ ok: false, erro: "PedidoJaDecidido" })).toEqual({ status: "erro", mensagem: M.pedidoJaDecidido });
    expect(await com({ ok: false, erro: "SolicitanteSemPapel" })).toEqual({ status: "erro", mensagem: M.solicitanteSemPapel });
    expect(await com({ ok: false, erro: "NegocioEncerrado" })).toEqual({ status: "erro", mensagem: M.negocioEncerrado });
    expect(await com({ ok: false, erro: "MesmoPlano", plano: "PAGO" })).toEqual({ status: "erro", mensagem: `${M.mesmoPlano("PAGO")} Recuse o pedido.` });
    expect(await servicos.aprovar({ pedidoId: "nada" }, deps())).toEqual({ status: "erro", mensagem: M.pedidoInexistente });

    const d = deps();
    expect(await servicos.recusar({ pedidoId: PEDIDO }, d)).toEqual({ status: "erro", mensagem: M.motivoDaRecusaObrigatorio });
    expect(d.decidirTrocaDePlano).not.toHaveBeenCalled();
  });

  it("cancelar: só quem pediu", async () => {
    expect(await servicos.cancelar({ pedidoId: PEDIDO }, deps())).toEqual({ status: "ok", mensagem: M.cancelado });
    expect(await servicos.cancelar({ pedidoId: PEDIDO }, deps({ cancelar: async () => ({ ok: false, erro: "SoQuemPediu" }) }))).toEqual({ status: "erro", mensagem: M.soQuemPediuCancela });
  });
});

// INV-002 e OPEN-003: pedir, aprovar e recusar são ações críticas (código dos últimos 10 min).
describe("ações dos pedidos (acoes.ts)", () => {
  const codigo = readFileSync("src/lib/plataforma/acoes.ts", "utf8");
  it.each(["acaoPedirTrocaDePlano", "acaoAprovarPedido", "acaoRecusarPedido"])("%s usa acaoCritica", (nome) => {
    expect(codigo).toMatch(new RegExp(`export const ${nome} = acaoCritica\\(`));
  });
  it("cancelar o próprio pedido basta a conta de Administrador", () => {
    expect(codigo).toMatch(/export const acaoCancelarPedido = acaoDoAdministrador\(/);
  });
});
