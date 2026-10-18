import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { arquivosDaExportacao, conferirConfirmacao, csvDeLinhas, dataDeEliminacao, emailAnonimo, MENSAGENS_LGPD, nomeDoZip, type DadosDoTitular } from "@/lib/dominio/lgpd";
import { excluirConta, removerCredenciaisPendentes, type DependenciasDaLgpd } from "@/lib/lgpd/servicos";

// SPEC-014 — testes unitários (seção 12).

const dados: DadosDoTitular = {
  geradoEm: "2026-10-11T15:00:00.000Z",
  titular: { id: "u1", nome: "Gisele", email: "gisele@exemplo.com", consentimentoLgpdEm: "2026-10-01T10:00:00.000Z" },
  vinculos: [{ negocioId: "n1", papel: "DONO", negocio: "Studio" }],
  convitesRecebidos: [],
  negociosComoDono: [
    {
      negocio: { id: "n1", nome: "Studio" },
      tabelas: {
        vendas: [{ id: "v1", numero: 1, valorTotal: "36.00", status: "CONCLUIDA" }],
        lancamentosFinanceiros: [{ id: "l1", valor: "36.00", estorno: false, descricao: "Venda; PIX" }],
      },
    },
  ],
  registrosEmOutrosNegocios: [{ negocio: { id: "n2", nome: "Clínica" }, tabelas: { vendasRegistradas: [{ id: "v9", numero: 7, valorTotal: "50.00" }] } }],
};

describe("T01 — valores anônimos, confirmação e montagem", () => {
  it("e-mail anônimo único e não entregável; eliminação = encerramento + 5 anos (29/02 vira 28/02)", () => {
    expect(emailAnonimo("abc")).toBe("excluido-abc@anonimo.invalid");
    expect(dataDeEliminacao("2026-10-11")).toBe("2031-10-11");
    expect(dataDeEliminacao("2028-02-29")).toBe("2033-02-28");
    expect(nomeDoZip("2026-10-11")).toBe("he-meus-dados-2026-10-11.zip");
  });

  it("OPEN-002: o e-mail da conta (sem diferenciar maiúsculas) e a ciência marcada", () => {
    expect(conferirConfirmacao({ email: " Gisele@Exemplo.com ", ciencia: "on" }, "gisele@exemplo.com")).toEqual({ ok: true });
    expect(conferirConfirmacao({ email: "outro@exemplo.com", ciencia: "on" }, "gisele@exemplo.com")).toEqual({ ok: false, erros: { email: MENSAGENS_LGPD.emailDiferente } });
    expect(conferirConfirmacao({ email: "gisele@exemplo.com" }, "gisele@exemplo.com")).toEqual({ ok: false, erros: { ciencia: MENSAGENS_LGPD.semCiencia } });
  });

  it("CSV por tabela: união das colunas, vírgula decimal, booleanos em português, aspas", () => {
    expect(csvDeLinhas([{ a: "36.00", b: true }, { a: null, c: "x;y" }])).toBe('﻿a;b;c\r\n36,00;sim;\r\n;;"x;y"\r\n');
  });

  it("arquivos: LEIA-ME, dados.json completo, CSVs do titular, dos negócios (com a coluna do negócio) e de outros negócios", () => {
    const a = arquivosDaExportacao(dados);
    expect(Object.keys(a).sort()).toEqual(
      ["LEIA-ME.txt", "convites-recebidos.csv", "dados.json", "lancamentos-financeiros.csv", "negocios.csv", "outros-negocios-vendas-registradas.csv", "usuario.csv", "vendas.csv", "vinculos.csv"].sort(),
    );
    expect(JSON.parse(a["dados.json"])).toEqual(dados);
    expect(a["vendas.csv"]).toBe("﻿negocio;id;numero;valorTotal;status\r\nStudio;v1;1;36,00;CONCLUIDA\r\n");
    expect(a["outros-negocios-vendas-registradas.csv"]).toContain("Clínica;v9;7;50,00");
  });
});

describe("T02 — .zip válido", () => {
  it("o .zip abre e traz os arquivos com o mesmo conteúdo", () => {
    const a = arquivosDaExportacao(dados);
    const zip = zipSync(Object.fromEntries(Object.entries(a).map(([n, t]) => [n, strToU8(t)])));
    const aberto = unzipSync(zip);
    expect(Object.keys(aberto).sort()).toEqual(Object.keys(a).sort());
    expect(Array.from(aberto["usuario.csv"].slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]); // BOM preservado no arquivo
    expect(strFromU8(aberto["dados.json"])).toBe(a["dados.json"]);
  });
});

describe("fluxo da exclusão com dublês", () => {
  const deps = (extra: Partial<DependenciasDaLgpd> = {}): DependenciasDaLgpd & { chamadas: string[] } => {
    const chamadas: string[] = [];
    return {
      chamadas,
      usuarioId: "u1",
      agora: new Date("2026-10-11T15:00:00Z"),
      hoje: "2026-10-11",
      lgpd: {
        resumoDaExclusao: async () => ({ email: "gisele@exemplo.com", encerrar: [], deixar: [] }),
        excluirConta: async () => (chamadas.push("excluir"), { ok: true as const, negociosEncerrados: 0 }),
        marcarCredencialRemovida: async (id: string) => void chamadas.push(`marcar:${id}`),
        credenciaisPendentes: async () => ["u1", "u2"],
      } as unknown as DependenciasDaLgpd["lgpd"],
      removerCredencial: async () => (chamadas.push("remover"), "removida" as const),
      sair: async () => void chamadas.push("sair"),
      ...extra,
    };
  };

  it("confirmação errada não chama nada; certa: exclui, remove a credencial, marca e sai, nessa ordem", async () => {
    const d1 = deps();
    expect(await excluirConta({ email: "x@x.com", ciencia: "on" }, d1)).toMatchObject({ status: "erro" });
    expect(d1.chamadas).toEqual([]);
    const d2 = deps();
    expect(await excluirConta({ email: "gisele@exemplo.com", ciencia: "on" }, d2)).toEqual({ status: "excluida", credencial: "removida" });
    expect(d2.chamadas).toEqual(["excluir", "remover", "marcar:u1", "sair"]);
  });

  it("OPEN-001: sem a chave ou com falha, a conta é excluída e a credencial fica pendente (sem marcar)", async () => {
    const d = deps({ removerCredencial: async () => "sem-chave" });
    expect(await excluirConta({ email: "gisele@exemplo.com", ciencia: "on" }, d)).toEqual({ status: "excluida", credencial: "sem-chave" });
    expect(d.chamadas).toEqual(["excluir", "sair"]);
    const r = deps({ removerCredencial: async (id) => (id === "u1" ? "removida" : "falha") });
    expect(await removerCredenciaisPendentes(r)).toEqual({ removidas: 1, pendentes: 1 });
  });
});
