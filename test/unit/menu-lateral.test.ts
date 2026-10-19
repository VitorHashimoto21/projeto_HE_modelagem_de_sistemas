import { describe, expect, it } from "vitest";
import { textoDaDica } from "@/lib/equipe/menu";
import { CHAVE_DO_MENU, CLASSE_MENU_RECOLHIDO, estadoDoMenu, SCRIPT_DO_MENU } from "@/lib/estrutura/menu-lateral";

// SPEC-016, nota N8 — N8-T1 e N8-T2.

/** Roda o trecho do layout raiz com um <html> e um armazenamento falsos. */
function rodarScript(guardado: string | null, armazenamentoFalha = false): string[] {
  const classes = new Set<string>();
  const documento = { documentElement: { classList: { add: (c: string) => classes.add(c) } } };
  const armazenamento = {
    getItem: (chave: string) => {
      if (armazenamentoFalha) throw new Error("bloqueado");
      return chave === CHAVE_DO_MENU ? guardado : null;
    },
  };
  new Function("localStorage", "document", SCRIPT_DO_MENU)(armazenamento, documento);
  return [...classes];
}

describe("N8-T1 — preferência do menu lateral", () => {
  it("estado: só \"recolhido\" recolhe; ausente ou inválido = expandido (N8.7)", () => {
    expect(estadoDoMenu("recolhido")).toBe("recolhido");
    expect(estadoDoMenu("expandido")).toBe("expandido");
    expect(estadoDoMenu(null)).toBe("expandido");
    expect(estadoDoMenu(undefined)).toBe("expandido");
    expect(estadoDoMenu("RECOLHIDO")).toBe("expandido");
    expect(estadoDoMenu("")).toBe("expandido");
  });

  it("script antes da pintura: aplica a classe só com a escolha \"recolhido\"", () => {
    expect(rodarScript("recolhido")).toEqual([CLASSE_MENU_RECOLHIDO]);
    expect(rodarScript("expandido")).toEqual([]);
    expect(rodarScript(null)).toEqual([]);
    expect(rodarScript("lixo")).toEqual([]);
  });

  it("armazenamento bloqueado (navegação privada, política do navegador): segue expandido, sem erro", () => {
    expect(rodarScript("recolhido", true)).toEqual([]);
  });
});

describe("N8-T2 — texto da dica", () => {
  it("o nome do item e, se houver, o selo", () => {
    expect(textoDaDica({ rotulo: "Vendas", href: "/vendas" })).toBe("Vendas");
    expect(textoDaDica({ rotulo: "Relatórios", href: "/relatorios", selo: "Plano pago" })).toBe("Relatórios — Plano pago");
  });
});
