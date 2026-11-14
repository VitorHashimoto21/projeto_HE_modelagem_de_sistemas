import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GRAVAM_NA_SUSPENSAO, MODELOS, relacoesEntreOperacionais } from "@/lib/db/modelos";

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

  it("as migrações cobrem todas as ligações entre modelos operacionais (INV-005)", () => {
    // Vale a última definição do gatilho de cada tabela: migrações posteriores à de isolamento
    // recriam o gatilho quando a tabela ganha uma ligação nova (ex.: estorno, SPEC-009).
    const pastas = readdirSync("prisma/migrations").filter((p) => /^\d+_/.test(p)).sort();
    const migracoes = pastas.map((p) => readFileSync(`prisma/migrations/${p}/migration.sql`, "utf8")).join("\n");
    for (const { modelo, fk, destino } of relacoesEntreOperacionais()) {
      const definicoes = [...migracoes.matchAll(new RegExp(`ON "${modelo}"\\s+FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio\\(([^)]*)\\)`, "g"))];
      const ultima = definicoes.at(-1)?.[1] ?? "";
      expect(ultima, `${modelo}.${fk} sem gatilho he_mesmo_negocio`).toContain(`'${destino}', '${fk}'`);
    }
  });

  it("negócio suspenso: as tabelas dos módulos têm o gatilho que recusa gravar (SPEC-019, INV-008)", () => {
    const pastas = readdirSync("prisma/migrations").filter((p) => /^\d+_/.test(p)).sort();
    const migracoes = pastas.map((p) => readFileSync(`prisma/migrations/${p}/migration.sql`, "utf8")).join("\n");
    // A lista do laço que cria o gatilho (a última, se uma migração posterior a refizer).
    const lista = [...migracoes.matchAll(/FOREACH tabela IN ARRAY ARRAY\[([^\]]*)\][^$]*?he_recusar_no_negocio_suspenso/g)].at(-1)?.[1] ?? "";
    const comGatilho = new Set([...lista.matchAll(/'(\w+)'/g)].map((m) => m[1]));
    for (const [modelo, def] of Object.entries(MODELOS)) {
      if (def.classe !== "operacional") continue;
      const livre = Object.hasOwn(GRAVAM_NA_SUSPENSAO, modelo);
      expect(comGatilho.has(modelo), `${modelo}: ${livre ? "grava na suspensão e não deveria ter o gatilho" : "sem o gatilho he_negocio_suspenso"}`).toBe(!livre);
    }
    expect(migracoes).toMatch(/CREATE TRIGGER he_negocio_suspenso BEFORE UPDATE ON "Negocio"/);
  });
});
