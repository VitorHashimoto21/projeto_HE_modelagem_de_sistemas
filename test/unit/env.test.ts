import { describe, expect, it } from "vitest";
import { AmbienteInvalido, carregarAmbiente } from "@/lib/env";

// T09 — CA-11
describe("validação das variáveis de ambiente", () => {
  it("aceita a configuração mínima", () => {
    const amb = carregarAmbiente({ DATABASE_URL: "postgresql://u:p@localhost:5432/he" });
    expect(amb.DATABASE_URL).toContain("localhost");
  });

  it("informa o nome da variável ausente, sem expor valores", () => {
    try {
      carregarAmbiente({ DIRECT_URL: "postgresql://u:segredo@host:5432/db" });
      expect.unreachable();
    } catch (erro) {
      expect(erro).toBeInstanceOf(AmbienteInvalido);
      const e = erro as AmbienteInvalido;
      expect(e.variaveis).toEqual(["DATABASE_URL"]);
      expect(e.message).toContain("DATABASE_URL");
      expect(e.message).not.toContain("segredo");
    }
  });

  it("recusa URL que não é do PostgreSQL", () => {
    expect(() => carregarAmbiente({ DATABASE_URL: "mysql://u:p@h/db" })).toThrow(AmbienteInvalido);
  });
});
