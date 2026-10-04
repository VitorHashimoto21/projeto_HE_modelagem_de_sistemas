import { describe, expect, it } from "vitest";
import { AmbienteInvalido, carregarAmbiente } from "@/lib/env";

const supabase = {
  NEXT_PUBLIC_SUPABASE_URL: "https://exemplo.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_exemplo",
};

// T09 — CA-11
describe("validação das variáveis de ambiente", () => {
  it("aceita a configuração mínima", () => {
    const amb = carregarAmbiente({ DATABASE_URL: "postgresql://u:p@localhost:5432/he", ...supabase });
    expect(amb.DATABASE_URL).toContain("localhost");
  });

  it("informa o nome da variável ausente, sem expor valores", () => {
    try {
      carregarAmbiente({ DIRECT_URL: "postgresql://u:segredo@host:5432/db", ...supabase });
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
    expect(() => carregarAmbiente({ DATABASE_URL: "mysql://u:p@h/db", ...supabase })).toThrow(AmbienteInvalido);
  });

  it("exige as variáveis do Supabase Auth (SPEC-002)", () => {
    try {
      carregarAmbiente({ DATABASE_URL: "postgresql://u:p@localhost:5432/he" });
      expect.unreachable();
    } catch (erro) {
      expect((erro as AmbienteInvalido).variaveis).toEqual([
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      ]);
    }
  });
});
