import { describe, expect, it } from "vitest";
import { decidirRota, destinoSeguro, ROTA_INICIAL } from "@/lib/auth/rotas";

// SPEC-002 — T09 (INV-007): o destino de retorno é sempre interno.
describe("destino de retorno após o login", () => {
  it.each(["/negocios", "/convites/abc?x=1", "/estoque#topo"])("mantém o caminho interno %s", (destino) => {
    expect(destinoSeguro(destino)).toBe(destino);
  });

  it.each([
    "https://malicioso.com",
    "//malicioso.com",
    "/\\malicioso.com",
    " /negocios",
    "javascript:alert(1)",
    "negocios",
    "",
    undefined,
    null,
    42,
    "/entrar",
    "/a\nb",
  ])("ignora %s", (destino) => {
    expect(destinoSeguro(destino)).toBe(ROTA_INICIAL);
  });
});

// SPEC-002 — T08 (CA-08, INV-005): páginas autenticadas exigem sessão.
describe("proteção das rotas", () => {
  it("sem sessão, página autenticada vai para o login guardando o destino", () => {
    expect(decidirRota("/negocios", "?aba=1", false)).toEqual({
      tipo: "redirecionar",
      para: "/entrar?proximo=%2Fnegocios%3Faba%3D1",
    });
    expect(decidirRota("/", "", false)).toEqual({ tipo: "redirecionar", para: "/entrar" });
  });

  it("com sessão, página autenticada segue", () => {
    expect(decidirRota("/negocios", "", true)).toEqual({ tipo: "seguir" });
  });

  it("login e cadastro levam quem já entrou para a inicial", () => {
    expect(decidirRota("/entrar", "", true)).toEqual({ tipo: "redirecionar", para: ROTA_INICIAL });
    expect(decidirRota("/cadastro", "", false)).toEqual({ tipo: "seguir" });
  });

  it("páginas públicas ficam abertas com ou sem sessão", () => {
    for (const caminho of ["/privacidade", "/termos", "/auth/confirmar", "/api/saude", "/link-invalido"]) {
      expect(decidirRota(caminho, "", false)).toEqual({ tipo: "seguir" });
      expect(decidirRota(caminho, "", true)).toEqual({ tipo: "seguir" });
    }
  });

  it("nova senha sem a sessão do link vai para a tela de link expirado", () => {
    expect(decidirRota("/nova-senha", "", false)).toEqual({ tipo: "redirecionar", para: "/link-invalido?tipo=recuperacao" });
  });

  it("caminho parecido com um público não escapa da proteção", () => {
    expect(decidirRota("/termos-falsos", "", false).tipo).toBe("redirecionar");
    expect(decidirRota("/authx", "", false).tipo).toBe("redirecionar");
  });
});
