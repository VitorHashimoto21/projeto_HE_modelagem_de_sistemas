import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { autorizar, type NivelDeAcesso } from "@/lib/auth/autorizacao";
import { resolverContextoDaRequisicao, type DependenciasDoContexto, type LiberacaoDoContexto } from "@/lib/auth/contexto";
import { linhasDaCorrecao } from "@/components/suporte/campos-da-correcao";
import { autorDoHistorico } from "@/lib/db/autor";
import { confere, diferenca } from "@/lib/db/correcoes";
import {
  CORRECOES_PERMITIDAS,
  correcaoPermitida,
  correcoesDoModulo,
  corrige,
  dentroDoPrazoDeDesfazer,
  ehCorrigivel,
  MENSAGENS_DAS_CORRECOES as M,
  MODULOS_CORRIGIVEIS,
} from "@/lib/dominio/correcoes";
import type { Acao, Modulo } from "@/lib/dominio/permissoes";
import { MENSAGENS_SUPORTE, validarLiberacao } from "@/lib/dominio/suporte";
import { MENSAGENS_DO_SEGUNDO_FATOR } from "@/lib/dominio/segundo-fator";
import { entrar, sair, type DependenciasDoAdministrador } from "@/lib/suporte/servicos";

// SPEC-019, etapa 2a — correções do suporte no Catálogo e no Estoque (T02, parte do T03 e do T04,
// CA-06, CA-07; INV-003). O que depende do banco (a transação única, o desfazer) está nos testes de
// integração (test/integracao/correcoes.test.ts).

const AGORA = new Date("2026-11-02T15:00:00Z");
const ADMIN = "a0000000-0000-4000-8000-000000000001";
const NEGOCIO = "b0000000-0000-4000-8000-000000000001";
const ACESSO = "c0000000-0000-4000-8000-000000000001";
const VERSAO = "2026-10-17";
const LOGIN = new Date(AGORA.getTime() - 3_600_000);

// ---------------------------------------------------------------------------------------
// A lista fechada (5.4) num lugar só.

describe("T02 — lista fechada (5.4 ↔ CORRECOES_PERMITIDAS)", () => {
  it("a tabela 5.4 inteira: Catálogo, Estoque, Calculadora e Financeiro, cada uma com o desfazer", () => {
    expect(Object.keys(CORRECOES_PERMITIDAS).sort()).toEqual(
      [
        "catalogo.arquivarItem",
        "catalogo.criarSubcategoria",
        "catalogo.definirPreco",
        "catalogo.editarItem",
        "catalogo.renomearSubcategoria",
        "estoque.definirMinimo",
        "estoque.registrarEntrada",
        "estoque.registrarSaida",
        "calculadora.salvarParametros",
        "calculadora.confirmarPreco",
        "financeiro.lancarAvulso",
        "financeiro.criarConta",
        "financeiro.editarConta",
        "financeiro.criarDespesa",
        "financeiro.editarDespesa",
        "financeiro.definirAtivo",
      ].sort(),
    );
    for (const [id, c] of Object.entries(CORRECOES_PERMITIDAS)) {
      expect(id.startsWith(`${c.modulo}.`), id).toBe(true);
      expect(c.desfazer.length, id).toBeGreaterThan(0);
    }
    expect(correcoesDoModulo("estoque")).toEqual(["Registrar entrada", "Registrar saída manual", "Definir estoque mínimo"]);
  });

  it("só os módulos com correções na lista oferecem 'ver e corrigir'; Vendas e Dashboard nunca", () => {
    expect([...MODULOS_CORRIGIVEIS]).toEqual(["catalogo", "estoque", "calculadora", "financeiro"]);
    for (const m of MODULOS_CORRIGIVEIS) expect(correcoesDoModulo(m).length).toBeGreaterThan(0);
    for (const m of ["vendas", "dashboard"]) expect(ehCorrigivel(m)).toBe(false);
    // RN37: o que o suporte nunca faz não está na lista, mesmo nos módulos corrigíveis.
    for (const fora of ["catalogo.criarItem", "catalogo.excluirSubcategoria", "financeiro.estornar", "financeiro.registrarPagamento", "financeiro.cancelarConta", "financeiro.informarSaldoInicial", "financeiro.corrigirVinculo"]) {
      expect(fora in CORRECOES_PERMITIDAS, fora).toBe(false);
    }
  });

  it("a correção é aceita só na lista e com o módulo dela em correção", () => {
    expect(correcaoPermitida("catalogo.editarItem", ["catalogo"])).toBe(true);
    expect(correcaoPermitida("catalogo.editarItem", ["estoque"])).toBe(false);
    expect(correcaoPermitida("catalogo.criarItem", ["catalogo"])).toBe(false);
    expect(correcaoPermitida(undefined, ["catalogo"])).toBe(false);
    expect(correcaoPermitida("toString", ["catalogo"])).toBe(false);
    expect(corrige({ suporte: { modulosComCorrecao: ["estoque"] } }, "estoque.definirMinimo")).toBe(true);
    expect(corrige({ suporte: null }, "estoque.definirMinimo")).toBe(false);
    expect(corrige({}, "catalogo.editarItem")).toBe(false);
  });

  it("o desfazer vale por 30 dias", () => {
    const dia = 86_400_000;
    expect(dentroDoPrazoDeDesfazer(new Date(AGORA.getTime() - 30 * dia), AGORA)).toBe(true);
    expect(dentroDoPrazoDeDesfazer(new Date(AGORA.getTime() - 30 * dia - 1), AGORA)).toBe(false);
  });

  // As Server Actions marcadas no código são exatamente as da lista, cada uma uma vez e no módulo dela.
  it("as Server Actions marcadas são exatamente as da lista; Vendas, clientes e fornecedores nunca", () => {
    const arquivos = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const c = join(dir, n);
        return statSync(c).isDirectory() ? arquivos(c) : /acoes\.ts$/.test(n) ? [c] : [];
      });
    const marcadas = new Map<string, string[]>();
    const consultas: string[] = [];
    for (const arquivo of arquivos("src/lib")) {
      const codigo = readFileSync(arquivo, "utf-8");
      for (const bloco of codigo.split(/(?=export const )/)) {
        const cabeca = bloco.match(/^export const (\w+) = acaoComPermissao\(\s*"(\w+)",/);
        if (!cabeca) continue;
        // A marca é o último argumento da fábrica, depois do corpo: `}, "modulo.acao");` ou `),\n  "modulo.acao",\n);`.
        const marca = bloco.match(/[)}],\s*"(consulta|[a-z]+\.[A-Za-z]+)",?\s*\);\s*(?:\/\/.*\s*|\/\*[\s\S]*?\*\/\s*)*$/)?.[1];
        if (!marca) continue;
        if (marca === "consulta") consultas.push(cabeca[1]);
        else marcadas.set(marca, [...(marcadas.get(marca) ?? []), `${cabeca[2]}:${cabeca[1]}`]);
      }
    }
    expect([...marcadas.keys()].sort()).toEqual(Object.keys(CORRECOES_PERMITIDAS).sort());
    for (const [id, acoes] of marcadas) {
      expect(acoes, id).toHaveLength(1);
      expect(acoes[0].startsWith(`${CORRECOES_PERMITIDAS[id as keyof typeof CORRECOES_PERMITIDAS].modulo}:`), id).toBe(true);
    }
    // 5.4, "Detalhes das correções": só as consultas do NCM, que a correção "Editar item" usa.
    expect(consultas.sort()).toEqual(["acaoBuscarNcm", "acaoConferirNcm"]);
    for (const arquivo of ["src/lib/vendas/acoes.ts", "src/lib/clientes/acoes.ts", "src/lib/fornecedores/acoes.ts"]) {
      expect(readFileSync(arquivo, "utf-8"), arquivo).not.toMatch(/"(consulta|\w+\.\w+)",?\s*\);/);
    }
  });
});

// ---------------------------------------------------------------------------------------
// A liberação com correção (5.2).

describe("CA-06 — liberação com correção: módulos e prazos", () => {
  const base = { motivo: "Custo errado", "modulo.catalogo": "on", "modulo.financeiro": "on" };

  it("com correção, o prazo é de 1 h ou 12 h; sem ela, os prazos de leitura", () => {
    expect(validarLiberacao({ ...base, "corrigir.catalogo": "on", prazo: "1h" })).toEqual({
      ok: true,
      dados: { motivo: "Custo errado", modulos: ["catalogo", "financeiro"], modulosComCorrecao: ["catalogo"], prazo: "1h" },
    });
    expect(validarLiberacao({ ...base, "corrigir.catalogo": "on", prazo: "12h" }).ok).toBe(true);
    expect(validarLiberacao({ ...base, "corrigir.catalogo": "on", prazo: "24h" })).toEqual({ ok: false, erros: { prazo: M.prazoComCorrecao } });
    expect(validarLiberacao({ ...base, prazo: "12h" })).toEqual({ ok: false, erros: { prazo: MENSAGENS_SUPORTE.prazoInvalido } });
    expect(validarLiberacao({ ...base, prazo: "7d" }).ok).toBe(true);
  });

  it("corrigir só os módulos marcados e que têm correções", () => {
    expect(validarLiberacao({ ...base, "corrigir.estoque": "on", prazo: "1h" })).toEqual({ ok: false, erros: { modulos: M.correcaoForaDosModulos } });
    // Vendas não tem correções na lista: o pedido é ignorado.
    expect(validarLiberacao({ ...base, "corrigir.vendas": "on", prazo: "24h" })).toMatchObject({ ok: true, dados: { modulosComCorrecao: [] } });
    expect(validarLiberacao({ ...base, "corrigir.financeiro": "on", prazo: "12h" })).toMatchObject({ ok: true, dados: { modulosComCorrecao: ["financeiro"] } });
    // "Ver" manda o campo vazio: não é correção.
    expect(validarLiberacao({ ...base, "corrigir.catalogo": "", prazo: "24h" })).toMatchObject({ ok: true, dados: { modulosComCorrecao: [] } });
  });
});

// ---------------------------------------------------------------------------------------
// Contexto e autorização no modo suporte com correção (5.3; INV-003; CA-06, CA-07).

function liberacao(extra: Partial<LiberacaoDoContexto> = {}): LiberacaoDoContexto {
  return {
    id: ACESSO,
    negocioId: NEGOCIO,
    negocio: "Negócio X",
    negocioEncerrado: false,
    modulos: ["vendas", "catalogo", "financeiro", "estoque"],
    modulosComCorrecao: ["catalogo"],
    entradaComCorrecaoEm: new Date(LOGIN.getTime() + 60_000),
    expiraEm: new Date(AGORA.getTime() + 3_600_000),
    revogadoEm: null,
    ...extra,
  };
}

function deps(lida: LiberacaoDoContexto | null = liberacao()): DependenciasDoContexto & { pedidos: [string, string][] } {
  const pedidos: [string, string][] = [];
  return {
    pedidos,
    filiacao: async () => ({ papel: "DONO", permissoesCustom: null }),
    conta: async () => ({ administradorEm: AGORA, versaoTermosAceita: VERSAO }),
    liberacao: async (acessoId, administradorId) => {
      pedidos.push([acessoId, administradorId]);
      return lida;
    },
  };
}

const entrada = (extra: Partial<Parameters<typeof resolverContextoDaRequisicao>[0]> = {}) => ({
  usuarioId: ADMIN,
  negocioDoCookie: NEGOCIO,
  suporteDoCookie: ACESSO,
  autenticadoEm: LOGIN,
  nivelDaSessao: "aal2" as const,
  codigoEm: new Date(AGORA.getTime() - 3_000_000),
  agora: AGORA,
  versaoDosTermos: VERSAO,
  ...extra,
});

/** Uma Server Action de módulo, com a marca da correção (ou "consulta") quando o código a tem. */
const acao = (modulo: Modulo, a: Acao, correcao?: string): NivelDeAcesso => ({ tipo: "permissao", modulo, acao: a, origem: "acao", correcao }) as NivelDeAcesso;

describe("contexto do modo suporte com correção (5.3, item 1)", () => {
  it("a correção vale da entrada com o código reconfirmado, nesta sessão, para este Administrador", async () => {
    const d = deps();
    const c = await resolverContextoDaRequisicao(entrada(), d);
    expect(d.pedidos).toEqual([[ACESSO, ADMIN]]);
    expect(c?.suporte).toMatchObject({ modulosComCorrecao: ["catalogo"], correcaoPendente: false });
    // A matriz continua só de leitura: a correção passa pela guarda da ação, não pelas permissões.
    expect(c!.permissoes!.catalogo).toEqual({ ver: true, criar: false, editar: false, excluir: false });
  });

  it("sem a entrada reconfirmada (outra sessão, saída, ou nunca entrou): só leitura, com o aviso", async () => {
    for (const lida of [
      liberacao({ entradaComCorrecaoEm: null }),
      liberacao({ entradaComCorrecaoEm: undefined }),
      // Entrou com o código antes deste login: o cookie veio de outra sessão.
      liberacao({ entradaComCorrecaoEm: new Date(LOGIN.getTime() - 1) }),
    ]) {
      const c = await resolverContextoDaRequisicao(entrada(), deps(lida));
      expect(c?.suporte).toMatchObject({ modulosComCorrecao: [], correcaoPendente: true });
      expect(autorizar(c, acao("catalogo", "editar", "catalogo.editarItem"))).toEqual({ ok: false, motivo: "SomenteLeitura" });
    }
    const leitura = await resolverContextoDaRequisicao(entrada(), deps(liberacao({ modulosComCorrecao: [], entradaComCorrecaoEm: null })));
    expect(leitura?.suporte).toMatchObject({ modulosComCorrecao: [], correcaoPendente: false });
  });

  it("um módulo em correção que não está entre os liberados não vale", async () => {
    const c = await resolverContextoDaRequisicao(entrada(), deps(liberacao({ modulos: ["vendas"], modulosComCorrecao: ["catalogo"] })));
    expect(c?.suporte?.modulosComCorrecao).toEqual([]);
  });
});

describe("T02/CA-06/CA-07 — autorização no modo suporte com o Catálogo em correção (INV-003)", () => {
  it("as correções da lista no módulo em correção passam, pelo motor, com o módulo liberado só para o corpo", async () => {
    const c = await resolverContextoDaRequisicao(entrada(), deps());
    for (const [a, id] of [
      ["editar", "catalogo.editarItem"],
      ["editar", "catalogo.definirPreco"],
      ["excluir", "catalogo.arquivarItem"],
      ["ver", "catalogo.criarSubcategoria"],
      ["editar", "catalogo.renomearSubcategoria"],
    ] as const) {
      const r = autorizar(c, acao("catalogo", a, id));
      expect(r, id).toMatchObject({ ok: true, membro: { modoSuporte: true, papel: null, correcao: id } });
      if (r.ok) {
        expect(r.membro!.permissoes.catalogo).toEqual({ ver: true, criar: true, editar: true, excluir: true });
        expect(r.membro!.permissoes.financeiro).toEqual({ ver: true, criar: false, editar: false, excluir: false });
      }
    }
  });

  it("fora da lista no módulo em correção: ForaDaListaDeCorrecoes (criar item, excluir subcategoria)", async () => {
    const c = await resolverContextoDaRequisicao(entrada(), deps());
    expect(autorizar(c, acao("catalogo", "criar"))).toEqual({ ok: false, motivo: "ForaDaListaDeCorrecoes" });
    expect(autorizar(c, acao("catalogo", "excluir"))).toEqual({ ok: false, motivo: "ForaDaListaDeCorrecoes" });
    // Uma marca de outro módulo, ou inventada, não abre o Catálogo.
    expect(autorizar(c, acao("catalogo", "editar", "estoque.definirMinimo"))).toEqual({ ok: false, motivo: "ForaDaListaDeCorrecoes" });
    expect(autorizar(c, acao("catalogo", "criar", "catalogo.criarItem"))).toEqual({ ok: false, motivo: "ForaDaListaDeCorrecoes" });
  });

  it("nos módulos só em 'ver', e fora dos módulos: SomenteLeitura (vendas, clientes, Financeiro, Configurações)", async () => {
    const c = await resolverContextoDaRequisicao(entrada(), deps());
    const niveis: NivelDeAcesso[] = [
      acao("vendas", "excluir"), // cancelar venda
      acao("vendas", "editar"), // editar cliente
      acao("financeiro", "criar"), // lançamento avulso (CA-06)
      acao("estoque", "criar", "estoque.registrarEntrada"), // Estoque liberado só para ver
      acao("vendas", "ver", "consulta"), // CEP e CNPJ nunca
      acao("calculadora", "editar"),
      { tipo: "dono", origem: "acao" },
      { tipo: "sessao", origem: "acao" },
    ];
    for (const n of niveis) expect(autorizar(c, n), JSON.stringify(n)).toEqual({ ok: false, motivo: "SomenteLeitura" });
  });

  it("as consultas do formulário (NCM) só no módulo em correção, sem virar correção", async () => {
    const c = await resolverContextoDaRequisicao(entrada(), deps());
    const r = autorizar(c, acao("catalogo", "ver", "consulta"));
    expect(r).toMatchObject({ ok: true, membro: { modoSuporte: true } });
    if (r.ok) expect(r.membro!.correcao).toBeUndefined();
    const leitura = await resolverContextoDaRequisicao(entrada(), deps(liberacao({ modulosComCorrecao: [] })));
    expect(autorizar(leitura, acao("catalogo", "ver", "consulta"))).toEqual({ ok: false, motivo: "SomenteLeitura" });
  });

  it("páginas: a tela da correção abre (editar item, entrada); as outras telas de escrita, não", async () => {
    const c = await resolverContextoDaRequisicao(entrada(), deps(liberacao({ modulosComCorrecao: ["catalogo", "estoque"] })));
    expect(autorizar(c, { tipo: "permissao", modulo: "catalogo", acao: "editar", correcao: "catalogo.editarItem" }).ok).toBe(true);
    expect(autorizar(c, { tipo: "permissao", modulo: "estoque", acao: "criar", correcao: "estoque.registrarSaida" }).ok).toBe(true);
    expect(autorizar(c, { tipo: "permissao", modulo: "catalogo", acao: "criar" })).toEqual({ ok: false, motivo: "SemPermissao" });
    expect(autorizar(c, { tipo: "permissao", modulo: "catalogo", acao: "editar", correcao: "consulta" })).toEqual({ ok: false, motivo: "SemPermissao" });
    const leitura = await resolverContextoDaRequisicao(entrada(), deps(liberacao({ modulosComCorrecao: [] })));
    expect(autorizar(leitura, { tipo: "permissao", modulo: "catalogo", acao: "editar", correcao: "catalogo.editarItem" })).toEqual({ ok: false, motivo: "SemPermissao" });
  });

  it("para os membros, a marca da correção não muda nada: valem as permissões", async () => {
    const membro = await resolverContextoDaRequisicao(
      entrada({ suporteDoCookie: undefined }),
      { ...deps(), conta: async () => ({ administradorEm: null, versaoTermosAceita: VERSAO }), filiacao: async () => ({ papel: "COLABORADOR", permissoesCustom: null }) },
    );
    expect(autorizar(membro, acao("catalogo", "editar", "catalogo.editarItem"))).toEqual({ ok: false, motivo: "SemPermissao" });
    const r = autorizar(membro, acao("catalogo", "ver", "consulta"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.membro!.correcao).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------
// Entrar com correção pede o código de novo (5.3, item 1).

function depsDoAdministrador(modulosComCorrecao: string[], correcoesDaVisita = 0) {
  const entradas: unknown[][] = [];
  const emails: { assunto: string; texto: string }[] = [];
  const saidas: unknown[][] = [];
  const d: DependenciasDoAdministrador = {
    administradorId: ADMIN,
    agora: () => AGORA,
    liberacaoAtiva: async () => ({ id: ACESSO, modulosComCorrecao: modulosComCorrecao as never }),
    encerrarEmergencia: vi.fn(async () => true),
    entrar: vi.fn(async (...args: unknown[]) => {
      entradas.push(args);
      return { ok: true as const, primeira: false, negocioId: NEGOCIO };
    }),
    liberacao: async () => liberacao({ modulosComCorrecao }),
    sair: async (...args: unknown[]) => {
      saidas.push(args);
    },
    correcoesDaVisita: async () => correcoesDaVisita,
    dono: async () => ({ nome: "Rafael", email: "dono@exemplo.com", negocio: "Papelaria" }),
    avisar: (m) => emails.push({ assunto: m.assunto, texto: m.texto }),
    origem: "http://localhost",
  };
  return { d, entradas, emails, saidas };
}

describe("entrar em modo suporte com correção (5.3, item 1)", () => {
  it("sem o código dos últimos 10 min, pede o código e não entra", async () => {
    const { d, entradas } = depsDoAdministrador(["catalogo"]);
    const velho = new Date(AGORA.getTime() - 11 * 60_000);
    expect(await entrar(NEGOCIO, d, velho)).toEqual({ ok: false, mensagem: MENSAGENS_DO_SEGUNDO_FATOR.reconfirmar, reconfirmar: true });
    expect(await entrar(NEGOCIO, d, null)).toMatchObject({ reconfirmar: true });
    expect(entradas).toEqual([]);
  });

  it("com o código recente, entra e a entrada fica marcada como reconfirmada", async () => {
    const { d, entradas } = depsDoAdministrador(["catalogo"]);
    expect(await entrar(NEGOCIO, d, new Date(AGORA.getTime() - 60_000))).toMatchObject({ ok: true, acessoId: ACESSO, destino: "/vendas" });
    expect(entradas).toEqual([[ACESSO, ADMIN, AGORA, true]]);
  });

  it("a liberação só de leitura não pede o código", async () => {
    const { d, entradas } = depsDoAdministrador([]);
    expect(await entrar(NEGOCIO, d, null)).toMatchObject({ ok: true });
    expect(entradas).toEqual([[ACESSO, ADMIN, AGORA, false]]);
  });
});

describe("e-mail ao Dono na saída: o resumo das correções (5.3, item 5)", () => {
  it("com correções nesta visita, 'O suporte fez N correções'; sem elas, nenhum e-mail", async () => {
    const com = depsDoAdministrador(["catalogo"], 2);
    expect(await sair(ACESSO, com.d)).toBe(NEGOCIO);
    expect(com.saidas).toEqual([[NEGOCIO, ACESSO, ADMIN]]);
    expect(com.emails).toEqual([
      {
        assunto: "O suporte fez 2 correções no Papelaria",
        texto: expect.stringContaining("Veja o antes e o depois de cada uma em http://localhost/negocio/suporte. Você pode desfazer cada correção em até 30 dias."),
      },
    ]);
    const uma = depsDoAdministrador(["catalogo"], 1);
    await sair(ACESSO, uma.d);
    expect(uma.emails[0].assunto).toBe("O suporte fez 1 correção no Papelaria");

    const sem = depsDoAdministrador(["catalogo"], 0);
    await sair(ACESSO, sem.d);
    expect(sem.emails).toEqual([]);
  });

  it("a primeira entrada avisa o Dono do que o suporte pode corrigir", async () => {
    const { d, emails } = depsDoAdministrador(["catalogo"]);
    d.entrar = async () => ({ ok: true, primeira: true, negocioId: NEGOCIO });
    await entrar(NEGOCIO, d, new Date(AGORA.getTime() - 60_000));
    expect(emails[0].texto).toContain("podendo corrigir Catálogo");
  });
});

// ---------------------------------------------------------------------------------------
// O antes e o depois (5.3, item 4) e a conferência do desfazer (INV-005).

describe("antes e depois só dos campos alterados", () => {
  const item = {
    tipo: "PRODUTO_FISICO",
    nome: "Caneta",
    codigo: "C-1",
    categoria: "PRODUTOS",
    subcategoriaId: null,
    subcategoria: null,
    ncm: null,
    unidadeMedida: "UN",
    custoBase: "40.00",
    comissaoPercentual: null,
    materiais: [] as unknown[],
  };

  it("guarda só o que mudou; a troca de subcategoria leva o nome", () => {
    expect(diferenca(item, { ...item, custoBase: "42.00" })).toEqual({ antes: { custoBase: "40.00" }, depois: { custoBase: "42.00" } });
    expect(diferenca(item, { ...item, subcategoriaId: "s1", subcategoria: "Azuis" })).toEqual({
      antes: { subcategoriaId: null, subcategoria: null },
      depois: { subcategoriaId: "s1", subcategoria: "Azuis" },
    });
    expect(diferenca(item, { ...item })).toBeNull();
    expect(diferenca(null, null)).toBeNull();
    expect(diferenca(null, { nome: "Azuis", categoria: "PRODUTOS" })).toEqual({ antes: null, depois: { nome: "Azuis", categoria: "PRODUTOS" } });
  });

  it("o nome do material não conta: só o material e a quantidade", () => {
    const servico = { ...item, materiais: [{ materialId: "m1", nome: "Tinta", quantidade: "1.000" }] };
    expect(diferenca(servico, { ...servico, materiais: [{ materialId: "m1", nome: "Tinta azul", quantidade: "1.000" }] })).toBeNull();
    expect(diferenca(servico, { ...servico, materiais: [{ materialId: "m1", nome: "Tinta", quantidade: "2.000" }] })).not.toBeNull();
  });

  it("confere o estado atual só nos campos da correção", () => {
    const depois = { custoBase: "42.00" };
    expect(confere({ ...item, custoBase: "42.00", nome: "Caneta azul" }, depois)).toBe(true);
    expect(confere({ ...item, custoBase: "43.00" }, depois)).toBe(false);
    expect(confere(null, depois)).toBe(false);
    expect(confere(null, null)).toBe(true);
  });

  it("a tela do Dono lê os campos com rótulo e formato", () => {
    // O Intl separa "R$" do valor com espaço sem quebra.
    expect(linhasDaCorrecao({ custoBase: "40.00" }, { custoBase: "42.00" })).toEqual([{ campo: "Custo", antes: "R$\u00a040,00", depois: "R$\u00a042,00" }]);
    expect(linhasDaCorrecao(null, { itemId: "i1", item: "Caneta", movimento: "ENTRADA", quantidade: "10.000", motivo: null })).toEqual([
      { campo: "Item", antes: "—", depois: "Caneta" },
      { campo: "Movimentação", antes: "—", depois: "Entrada" },
      { campo: "Quantidade", antes: "—", depois: "10" },
      { campo: "Motivo", antes: "—", depois: "—" },
    ]);
    expect(linhasDaCorrecao({ arquivado: false }, { arquivado: true })).toEqual([{ campo: "Situação", antes: "Ativo", depois: "Arquivado" }]);
    expect(linhasDaCorrecao({ estoqueMinimo: null }, { estoqueMinimo: "5.000" })).toEqual([{ campo: "Estoque mínimo", antes: "Sem mínimo", depois: "5" }]);
    // Financeiro e Calculadora (etapa 2b).
    expect(linhasDaCorrecao(null, { descricao: "Frete", tipo: "SAIDA", categoria: "FORNECEDORES", valor: "35.00", data: "2026-11-02" })).toEqual([
      { campo: "Descrição", antes: "—", depois: "Frete" },
      { campo: "Tipo", antes: "—", depois: "Saída" },
      { campo: "Categoria", antes: "—", depois: "Fornecedores" },
      { campo: "Valor", antes: "—", depois: "R$\u00a035,00" },
      { campo: "Data", antes: "—", depois: "02/11/2026" },
    ]);
    expect(linhasDaCorrecao({ ativo: false, geradas: ["2026-10"] }, { ativo: true, geradas: ["2026-10", "2026-11"] })).toEqual([
      { campo: "Situação", antes: "Desativada", depois: "Ativa" },
      { campo: "Contas geradas", antes: "10/2026", depois: "10/2026, 11/2026" },
    ]);
    expect(linhasDaCorrecao({ taxaCartao: "3.50", margemMeta: null }, { taxaCartao: "4.00", margemMeta: "20.00" })).toEqual([
      { campo: "Taxa média do cartão", antes: "3,5%", depois: "4%" },
      { campo: "Margem de lucro meta", antes: "—", depois: "20%" },
    ]);
  });

  it("os históricos mostram o Administrador como suporte do HE", () => {
    expect(autorDoHistorico({ nome: "Ana", administradorEm: AGORA })).toBe("Ana (suporte do HE)");
    expect(autorDoHistorico({ nome: "Bia", administradorEm: null })).toBe("Bia");
  });
});
