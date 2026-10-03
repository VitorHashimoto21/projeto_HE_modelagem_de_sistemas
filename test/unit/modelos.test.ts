import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODELOS, relacoesEntreOperacionais } from "@/lib/db/modelos";

type CampoSchema = { nome: string; tipo: string; fk?: string };

/** Lê os modelos e campos de prisma/schema.prisma (fonte da verdade — OPEN-30). */
function lerSchema(): Map<string, CampoSchema[]> {
  const texto = readFileSync("prisma/schema.prisma", "utf8");
  const modelos = new Map<string, CampoSchema[]>();
  for (const bloco of texto.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const campos: CampoSchema[] = [];
    for (const linha of bloco[2].split("\n")) {
      const m = /^\s+(\w+)\s+(\w+)(\[\])?\??/.exec(linha);
      if (!m || linha.trim().startsWith("//") || linha.trim().startsWith("@@")) continue;
      const fk = /@relation\([^)]*fields:\s*\[(\w+)\]/.exec(linha)?.[1];
      campos.push({ nome: m[1], tipo: m[2], fk });
    }
    modelos.set(bloco[1], campos);
  }
  return modelos;
}

const schema = lerSchema();
const nomesNoSchema = [...schema.keys()];

// T06 — CA-08, INV-006
describe("classificação dos modelos", () => {
  it("todo modelo do schema está classificado e não há modelo sobrando no mapa", () => {
    expect(Object.keys(MODELOS).sort()).toEqual([...nomesNoSchema].sort());
  });

  it("todo modelo operacional tem negocioId; nenhum global tem", () => {
    for (const [modelo, def] of Object.entries(MODELOS)) {
      const temNegocioId = schema.get(modelo)!.some((c) => c.nome === "negocioId");
      if (def.classe === "operacional") expect(temNegocioId, `${modelo} sem negocioId`).toBe(true);
      if (def.classe === "global") expect(temNegocioId, `${modelo} global com negocioId`).toBe(false);
    }
  });

  it("as relações do mapa são exatamente as do schema (destino e FK)", () => {
    for (const [modelo, def] of Object.entries(MODELOS)) {
      const relacoesSchema = Object.fromEntries(
        schema
          .get(modelo)!
          .filter((c) => schema.has(c.tipo))
          .map((c) => [c.nome, c.fk ? { modelo: c.tipo, fk: c.fk } : { modelo: c.tipo }]),
      );
      expect(def.relacoes, `relações de ${modelo}`).toEqual(relacoesSchema);
    }
  });

  it("a migração de isolamento cobre todas as ligações entre modelos operacionais (INV-005)", () => {
    const migracao = readFileSync("prisma/migrations/20261003120100_isolamento/migration.sql", "utf8");
    for (const { modelo, fk, destino } of relacoesEntreOperacionais()) {
      const gatilho = new RegExp(
        `ON "${modelo}"\\s+FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio\\([^)]*'${destino}', '${fk}'`,
      );
      expect(migracao, `${modelo}.${fk} sem gatilho he_mesmo_negocio`).toMatch(gatilho);
    }
  });
});
