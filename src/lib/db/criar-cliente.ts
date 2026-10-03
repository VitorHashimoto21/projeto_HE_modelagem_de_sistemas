import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** Cria um PrismaClient (Prisma 7 + adaptador pg) para a URL informada. */
export function criarPrismaClient(connectionString: string): PrismaClient {
  // Tempo limite de conexão: com o banco fora do ar, a requisição falha em vez de ficar presa (CA-10).
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000 }) });
}
