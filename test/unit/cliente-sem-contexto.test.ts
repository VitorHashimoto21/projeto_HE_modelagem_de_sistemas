import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { comNegocio } from "@/lib/db/cliente-do-negocio";
import { ContextoDeNegocioAusente } from "@/lib/db/erros";

// T03 (parte unitária) — CA-05, INV-001: sem contexto, nada chega ao banco.
describe("cliente do negócio sem contexto", () => {
  it.each([undefined, null, {} as { negocioId: string }, { negocioId: "" }])(
    "recusa o contexto %j antes de qualquer consulta",
    (contexto) => {
      const $extends = vi.fn();
      const clienteFalso = { $extends } as unknown as PrismaClient;
      expect(() => comNegocio(clienteFalso, contexto)).toThrow(ContextoDeNegocioAusente);
      expect($extends).not.toHaveBeenCalled();
    },
  );
});
