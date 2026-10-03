import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { ambiente } from "@/lib/env";
import { criarPrismaClient } from "./criar-cliente";

/**
 * Cliente Prisma "bruto", sem filtro de negócio. Uso restrito a src/lib/db:
 * o resto da aplicação usa clienteDoNegocio() (regra de lint — ADR-001/ADR-002).
 */
const global = globalThis as unknown as { prismaHE?: PrismaClient };

export function prismaBase(): PrismaClient {
  if (!global.prismaHE) {
    global.prismaHE = criarPrismaClient(ambiente().DATABASE_URL);
  }
  return global.prismaHE;
}
