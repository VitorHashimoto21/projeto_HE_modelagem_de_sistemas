import { describe, expect, it } from "vitest";
import { chaveDasFaixas, type EstadoDasFaixas } from "@/lib/dominio/faixas";

// Correção da homologação da SPEC-019 (T17): o layout da área do negócio não é recalculado ao navegar, e as
// faixas ficavam para trás até a página ser atualizada. A chave resume o que as faixas e o menu mostram; o
// navegador só atualiza o layout quando ela muda.

const DIA = new Date("2026-11-08T17:36:00Z");
const base: EstadoDasFaixas = {
  negocioId: "n1",
  papel: "DONO",
  permissoes: { vendas: { ver: true, registrar: true }, catalogo: { ver: true, editar: false } },
  plano: "PAGO",
  modoSuporte: null,
  suspensao: null,
  liberacao: null,
  emergencia: null,
};
const com = (mudanca: Partial<EstadoDasFaixas>) => chaveDasFaixas({ ...base, ...mudanca });

describe("chave das faixas e do menu", () => {
  it("o mesmo estado dá sempre a mesma chave, sem depender da ordem das listas nem das chaves", () => {
    expect(chaveDasFaixas(base)).toBe(chaveDasFaixas({ ...base }));
    const liberacao = { id: "l1", expiraEm: DIA, modulos: ["vendas", "catalogo"], modulosComCorrecao: ["catalogo"] };
    expect(com({ liberacao })).toBe(com({ liberacao: { ...liberacao, modulos: ["catalogo", "vendas"] } }));
    expect(com({ permissoes: { catalogo: { editar: false, ver: true }, vendas: { registrar: true, ver: true } } })).toBe(chaveDasFaixas(base));
  });

  it("a emergência aprovada e o fim dela mudam a chave; ao terminar, volta a de antes", () => {
    const antes = chaveDasFaixas(base);
    const durante = com({ emergencia: { id: "e1", expiraEm: DIA } });
    expect(durante).not.toBe(antes);
    expect(com({ emergencia: null })).toBe(antes);
  });

  it("a suspensão, a liberação do suporte, o plano e as permissões mudam a chave", () => {
    const antes = chaveDasFaixas(base);
    const mudancas: Partial<EstadoDasFaixas>[] = [
      { suspensao: { desde: DIA, motivo: "INCIDENTE" } },
      { liberacao: { id: "l1", expiraEm: DIA, modulos: ["vendas"], modulosComCorrecao: [] } },
      { plano: "GRATUITO" },
      { permissoes: { vendas: { ver: true, registrar: false }, catalogo: { ver: true, editar: false } } },
      { papel: "GERENTE" },
      { negocioId: "n2" },
    ];
    const chaves = mudancas.map(com);
    for (const chave of chaves) expect(chave).not.toBe(antes);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("no modo suporte, o prazo, as correções e a suspensão do negócio mudam a chave da faixa do suporte", () => {
    const suporte = { acessoId: "a1", expiraEm: DIA, modulos: ["catalogo"], modulosComCorrecao: ["catalogo"], correcaoPendente: false, emergencia: false };
    const antes = com({ modoSuporte: suporte, papel: null });
    expect(com({ modoSuporte: { ...suporte, modulosComCorrecao: [] }, papel: null })).not.toBe(antes);
    expect(com({ modoSuporte: { ...suporte, correcaoPendente: true }, papel: null })).not.toBe(antes);
    expect(com({ modoSuporte: suporte, papel: null, suspensao: { desde: DIA, motivo: "USO_INDEVIDO" } })).not.toBe(antes);
    expect(com({ modoSuporte: { ...suporte, expiraEm: new Date(DIA.getTime() + 1) }, papel: null })).not.toBe(antes);
  });
});
