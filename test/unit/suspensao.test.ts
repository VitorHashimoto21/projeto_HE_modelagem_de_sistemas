import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { autorizar, type NivelDeAcesso } from "@/lib/auth/autorizacao";
import { resolverContextoDaRequisicao, type ContextoComPapel, type LiberacaoDoContexto } from "@/lib/auth/contexto";
import { permissoesEfetivas } from "@/lib/dominio/permissoes";
import {
  explicacaoDaSuspensao,
  lerDadosDaSuspensao,
  MENSAGENS_DA_SUSPENSAO,
  textoDaFaixaDaSuspensao,
  validarReativacao,
  validarSuspensao,
  type SuspensaoDoNegocio,
} from "@/lib/dominio/suspensao";
import * as servicos from "@/lib/plataforma/servicos";

// SPEC-019, etapa 4a — testes unitários da suspensão (5.7, RN39, INV-008): o domínio, a autorização de cada
// fábrica com o negócio suspenso, o contexto do suporte e os fluxos com dependências falsas. O banco (os
// gatilhos, a rotina, os convites e o desfazer) está em test/integracao/suspensao.test.ts.

const S = MENSAGENS_DA_SUSPENSAO;
const ADMIN = "a0000000-0000-4000-8000-000000000001";
const DONO = "d0000000-0000-4000-8000-000000000001";
const NEGOCIO = "c0000000-0000-4000-8000-000000000001";
const ACESSO = "b0000000-0000-4000-8000-000000000001";
const AGORA = new Date("2026-11-07T15:00:00Z");
const VERSAO = "2026-11-01";
const SUSPENSAO: SuspensaoDoNegocio = { desde: new Date("2026-11-07T13:00:00Z"), motivo: "INCIDENTE_SEGURANCA" };

describe("suspensão: motivo e descrição (5.7)", () => {
  it("aceita o motivo da lista e a descrição até 500 caracteres, sem espaços sobrando", () => {
    expect(validarSuspensao({ motivo: "ORDEM_JUDICIAL", descricao: "  Ofício   123 " })).toEqual({ ok: true, dados: { motivo: "ORDEM_JUDICIAL", descricao: "Ofício 123" } });
    for (const motivo of ["PEDIDO_DO_DONO", "USO_INDEVIDO", "INCIDENTE_SEGURANCA", "ORDEM_JUDICIAL"]) expect(validarSuspensao({ motivo, descricao: "x" }).ok).toBe(true);
  });

  it("recusa motivo fora da lista, descrição vazia ou longa; a reativação também pede a descrição", () => {
    expect(validarSuspensao({ motivo: "CURIOSIDADE", descricao: " " })).toEqual({ ok: false, erros: { motivo: S.motivoObrigatorio, descricao: S.descricaoObrigatoria } });
    expect(validarSuspensao({ motivo: "USO_INDEVIDO", descricao: "x".repeat(501) })).toEqual({ ok: false, erros: { descricao: S.longo(500) } });
    expect(validarReativacao({ descricao: "  Resolvido " })).toEqual({ ok: true, descricao: "Resolvido" });
    expect(validarReativacao({})).toEqual({ ok: false, erro: S.descricaoDaReativacao });
    expect(validarReativacao({ descricao: "y".repeat(501) })).toEqual({ ok: false, erro: S.longo(500) });
  });

  it("a faixa dos membros diz desde quando e o motivo; o registro é lido com cuidado", () => {
    expect(textoDaFaixaDaSuspensao(SUSPENSAO)).toBe("Negócio suspenso pelo HE desde 07/11/2026: incidente de segurança. Fale com o suporte.");
    expect(explicacaoDaSuspensao(SUSPENSAO)).toMatch(/^Desde 07\/11\/2026, por incidente de segurança, você e a equipe podem ver e exportar os dados, mas nada é gravado/);
    expect(lerDadosDaSuspensao({ motivo: "USO_INDEVIDO", descricao: "Spam" })).toEqual({ motivo: "USO_INDEVIDO", descricao: "Spam" });
    expect(lerDadosDaSuspensao({ motivo: "X", descricao: "Resolvido" })).toEqual({ motivo: null, descricao: "Resolvido" });
    expect(lerDadosDaSuspensao({ motivo: "USO_INDEVIDO" })).toBeNull();
    expect(lerDadosDaSuspensao(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------
// Autorização (RN39, INV-008): toda fábrica com o negócio suspenso.

function membro(papel: "DONO" | "GERENTE" | "COLABORADOR", negocioSuspenso: SuspensaoDoNegocio | null = SUSPENSAO): ContextoComPapel {
  return {
    usuarioId: DONO,
    negocioId: NEGOCIO,
    negocioRecusado: false,
    papel,
    permissoes: permissoesEfetivas(papel, null),
    administrador: false,
    suporte: null,
    suporteEncerrado: null,
    termosPendentes: false,
    sessaoExpirada: false,
    negocioSuspenso,
  };
}

describe("autorização no negócio suspenso (INV-008)", () => {
  const recusa = { ok: false, motivo: "NegocioSuspenso" };
  const acoesDeModulo: NivelDeAcesso[] = [
    { tipo: "permissao", modulo: "catalogo", acao: "criar", origem: "acao" },
    { tipo: "permissao", modulo: "estoque", acao: "editar", origem: "acao" },
    { tipo: "permissao", modulo: "vendas", acao: "excluir", origem: "acao" },
    { tipo: "permissao", modulo: "financeiro", acao: "criar", origem: "acao" },
    { tipo: "permissao", modulo: "calculadora", acao: "editar", origem: "acao" },
    // "ver" também: há ação de módulo com "ver" que grava (criar subcategoria no formulário do item).
    { tipo: "permissao", modulo: "catalogo", acao: "ver", origem: "acao" },
  ];

  it("toda ação de módulo é recusada, salvo as consultas dos formulários; sem suspensão, passa", () => {
    for (const nivel of acoesDeModulo) {
      expect(autorizar(membro("DONO"), nivel), JSON.stringify(nivel)).toEqual(recusa);
      expect(autorizar(membro("DONO", null), nivel).ok, JSON.stringify(nivel)).toBe(true);
    }
    expect(autorizar(membro("DONO"), { tipo: "permissao", modulo: "catalogo", acao: "ver", origem: "acao", correcao: "consulta" }).ok).toBe(true);
  });

  it("as telas de ver abrem; as de incluir, editar e excluir levam à explicação", () => {
    expect(autorizar(membro("GERENTE"), { tipo: "permissao", modulo: "vendas", acao: "ver" }).ok).toBe(true);
    expect(autorizar(membro("GERENTE"), { tipo: "permissao", modulo: "vendas", acao: "criar" })).toEqual(recusa);
    expect(autorizar(membro("GERENTE"), { tipo: "permissao", modulo: "catalogo", acao: "editar" })).toEqual(recusa);
    // Sem a permissão, continua "SemPermissao": a suspensão não amplia nada.
    expect(autorizar(membro("COLABORADOR"), { tipo: "permissao", modulo: "financeiro", acao: "criar" })).toEqual({ ok: false, motivo: "SemPermissao" });
  });

  it("Configurações: o Dono vê; grava só o acesso do suporte e o desfazer (naSuspensao)", () => {
    expect(autorizar(membro("DONO"), { tipo: "dono" }).ok).toBe(true);
    expect(autorizar(membro("DONO"), { tipo: "dono", origem: "acao" })).toEqual(recusa);
    expect(autorizar(membro("DONO"), { tipo: "dono", origem: "acao", naSuspensao: true }).ok).toBe(true);
    expect(autorizar(membro("GERENTE"), { tipo: "dono", origem: "acao", naSuspensao: true })).toEqual({ ok: false, motivo: "SomenteDono" });
  });

  it("a sessão (sair do negócio, trocar de negócio) e a conta (exportar, excluir) continuam", () => {
    expect(autorizar(membro("COLABORADOR"), { tipo: "sessao", origem: "acao" }).ok).toBe(true);
    expect(autorizar(membro("COLABORADOR"), { tipo: "conta" }).ok).toBe(true);
    const r = autorizar(membro("COLABORADOR"), { tipo: "sessao" });
    expect(r.ok && r.membro?.negocioSuspenso).toEqual(SUSPENSAO);
  });
});

// Só estas ações do Dono continuam na suspensão (5.7): liberar e revogar o suporte, encerrar a emergência e o
// desfazer, que chega ao banco e recusa com a explicação (OPEN-018).
describe("ações do Dono que continuam na suspensão", () => {
  function arquivos(pasta: string): string[] {
    return readdirSync(pasta).flatMap((n) => {
      const p = join(pasta, n);
      return statSync(p).isDirectory() ? arquivos(p) : p.endsWith(".ts") ? [p] : [];
    });
  }
  it("são exatamente as quatro do acesso do suporte e do desfazer", () => {
    const marcadas: string[] = [];
    for (const p of arquivos("src/lib")) {
      const texto = readFileSync(p, "utf8");
      for (const parte of texto.split(/(?=export const )/)) {
        const nome = parte.match(/^export const (\w+) = acaoDoDono\(/)?.[1];
        if (nome && parte.includes("{ naSuspensao: true }")) marcadas.push(nome);
      }
    }
    expect(marcadas.sort()).toEqual(["acaoDesfazerCorrecao", "acaoEncerrarEmergencia", "acaoLiberarSuporte", "acaoRevogarSuporte"]);
  });

  it("suspender e reativar são ações críticas (OPEN-003)", () => {
    const plataforma = readFileSync("src/lib/plataforma/acoes.ts", "utf8");
    expect(plataforma).toMatch(/export const acaoSuspenderNegocio = acaoCritica\(/);
    expect(plataforma).toMatch(/export const acaoReativarNegocio = acaoCritica\(/);
  });
});

// ---------------------------------------------------------------------------------------
// Contexto: a suspensão vem da filiação (membros) e da liberação (suporte).

function liberacao(extra: Partial<LiberacaoDoContexto> = {}): LiberacaoDoContexto {
  return {
    id: ACESSO,
    negocioId: NEGOCIO,
    negocio: "Negócio X",
    negocioEncerrado: false,
    modulos: ["catalogo", "estoque"],
    modulosComCorrecao: ["catalogo"],
    entradaComCorrecaoEm: new Date(AGORA.getTime() - 60_000),
    expiraEm: new Date(AGORA.getTime() + 3_600_000),
    revogadoEm: null,
    emergencia: null,
    negocioSuspenso: SUSPENSAO,
    ...extra,
  };
}

const entrada = (usuarioId: string, cookie: { negocio?: string; suporte?: string }) => ({
  usuarioId,
  negocioDoCookie: cookie.negocio,
  suporteDoCookie: cookie.suporte,
  autenticadoEm: new Date(AGORA.getTime() - 3_600_000),
  nivelDaSessao: "aal2" as const,
  codigoEm: new Date(AGORA.getTime() - 60_000),
  agora: AGORA,
  versaoDosTermos: VERSAO,
});

describe("contexto do negócio suspenso", () => {
  it("o membro recebe a suspensão na mesma consulta da filiação", async () => {
    const c = await resolverContextoDaRequisicao(entrada(DONO, { negocio: NEGOCIO }), {
      filiacao: async () => ({ papel: "DONO", permissoesCustom: null, suspensao: SUSPENSAO }),
      conta: async () => ({ administradorEm: null, versaoTermosAceita: VERSAO }),
      liberacao: async () => null,
    });
    expect(c).toMatchObject({ negocioId: NEGOCIO, papel: "DONO", negocioSuspenso: SUSPENSAO });
  });

  it("no suporte, a liberação vale para ver e as correções saem do contexto; a chamada direta é recusada", async () => {
    const deps = { filiacao: async () => null, conta: async () => ({ administradorEm: AGORA, versaoTermosAceita: VERSAO }), liberacao: async () => liberacao() };
    const c = await resolverContextoDaRequisicao(entrada(ADMIN, { suporte: ACESSO }), deps);
    expect(c?.suporte).toMatchObject({ modulos: ["catalogo", "estoque"], modulosComCorrecao: [], correcaoPendente: false });
    expect(c?.negocioSuspenso).toEqual(SUSPENSAO);
    expect(autorizar(c, { tipo: "permissao", modulo: "catalogo", acao: "editar", origem: "acao", correcao: "catalogo.editarItem" })).toEqual({ ok: false, motivo: "NegocioSuspenso" });
    expect(autorizar(c, { tipo: "permissao", modulo: "catalogo", acao: "ver" }).ok).toBe(true);
    // Reativado, a correção volta (a entrada com o código continua valendo).
    const reativado = await resolverContextoDaRequisicao(entrada(ADMIN, { suporte: ACESSO }), { ...deps, liberacao: async () => liberacao({ negocioSuspenso: null }) });
    expect(reativado?.suporte?.modulosComCorrecao).toEqual(["catalogo"]);
  });
});

// ---------------------------------------------------------------------------------------
// Fluxos (servicos.ts) com dependências falsas.

function deps(extra: Partial<servicos.DependenciasDaPlataforma> = {}): servicos.DependenciasDaPlataforma {
  return {
    administradorId: ADMIN,
    agora: () => AGORA,
    pedirTrocaDePlano: vi.fn(),
    pedirEmergencia: vi.fn(),
    decidir: vi.fn(),
    cancelar: vi.fn(),
    entrarNaEmergencia: vi.fn(),
    registrarResultado: vi.fn(),
    suspender: vi.fn(async () => ({ ok: true as const, negocio: "HE Testing" })),
    reativar: vi.fn(async () => ({ ok: true as const, negocio: "HE Testing" })),
    dono: vi.fn(async () => ({ nome: "Rafael", email: "dono@exemplo.com", negocio: "HE Testing" })),
    avisar: vi.fn(),
    origem: "https://he.exemplo.com",
    ...extra,
  };
}

describe("fluxos da suspensão (servicos.ts)", () => {
  it("suspender: valida antes de gravar, avisa o Dono e explica cada recusa", async () => {
    const d = deps();
    expect(await servicos.suspender({ negocioId: NEGOCIO, motivo: "X" }, d)).toEqual({ status: "erro", erros: { motivo: S.motivoObrigatorio, descricao: S.descricaoObrigatoria } });
    expect(await servicos.suspender({ negocioId: "x", motivo: "USO_INDEVIDO", descricao: "y" }, d)).toEqual({ status: "erro", mensagem: S.inexistente });
    expect(d.suspender).not.toHaveBeenCalled();

    expect(await servicos.suspender({ negocioId: NEGOCIO, motivo: "USO_INDEVIDO", descricao: "Spam em massa" }, d)).toEqual({ status: "ok", mensagem: S.suspenso });
    expect(d.suspender).toHaveBeenCalledWith(NEGOCIO, ADMIN, { motivo: "USO_INDEVIDO", descricao: "Spam em massa" }, AGORA);
    const email = vi.mocked(d.avisar).mock.calls[0][0];
    expect(email).toMatchObject({ para: "dono@exemplo.com", assunto: "O HE Testing foi suspenso pela plataforma do HE" });
    expect(email.texto).toContain("Motivo: Uso indevido segundo os Termos de Uso — Spam em massa");
    expect(email.texto).toContain("Nada foi apagado");
    expect(email.texto).toContain("https://he.exemplo.com/conta");

    const com = (erro: "NegocioEncerrado" | "JaSuspenso" | "NegocioInexistente") =>
      servicos.suspender({ negocioId: NEGOCIO, motivo: "USO_INDEVIDO", descricao: "y" }, deps({ suspender: async () => ({ ok: false, erro }) }));
    expect(await com("NegocioEncerrado")).toEqual({ status: "erro", mensagem: S.encerrado });
    expect(await com("JaSuspenso")).toEqual({ status: "erro", mensagem: S.jaSuspenso });
    expect(await com("NegocioInexistente")).toEqual({ status: "erro", mensagem: S.inexistente });
  });

  it("reativar: pede a descrição, avisa o Dono e recusa o negócio que não está suspenso", async () => {
    const d = deps();
    expect(await servicos.reativar({ negocioId: NEGOCIO }, d)).toEqual({ status: "erro", erros: { descricao: S.descricaoDaReativacao } });
    expect(await servicos.reativar({ negocioId: NEGOCIO, descricao: "Resolvido" }, d)).toEqual({ status: "ok", mensagem: S.reativado });
    expect(d.reativar).toHaveBeenCalledWith(NEGOCIO, ADMIN, "Resolvido", AGORA);
    expect(vi.mocked(d.avisar).mock.calls[0][0]).toMatchObject({ assunto: "O HE Testing foi reativado" });
    expect(await servicos.reativar({ negocioId: NEGOCIO, descricao: "x" }, deps({ reativar: async () => ({ ok: false, erro: "NaoSuspenso" }) }))).toEqual({
      status: "erro",
      mensagem: S.naoSuspenso,
    });
  });

  it("sem o Dono (conta excluída), nada de e-mail, e a suspensão vale do mesmo jeito", async () => {
    const d = deps({ dono: async () => null });
    expect(await servicos.suspender({ negocioId: NEGOCIO, motivo: "ORDEM_JUDICIAL", descricao: "Ofício" }, d)).toEqual({ status: "ok", mensagem: S.suspenso });
    expect(d.avisar).not.toHaveBeenCalled();
  });
});
