import { afterEach, describe, expect, it, vi } from "vitest";
import { urlDoBancoDeTeste } from "../apoio/banco-de-teste";

const urlOriginal = process.env.DATABASE_URL;

async function chamarSaude(databaseUrl: string) {
  process.env.DATABASE_URL = databaseUrl;
  delete (globalThis as { prismaHE?: unknown }).prismaHE;
  vi.resetModules();
  const { GET } = await import("@/app/api/saude/route");
  const resposta = await GET();
  return { status: resposta.status, corpo: await resposta.json() };
}

afterEach(async () => {
  const g = globalThis as { prismaHE?: { $disconnect(): Promise<void> } };
  await g.prismaHE?.$disconnect();
  delete g.prismaHE;
  process.env.DATABASE_URL = urlOriginal;
});

// T08 — CA-10
describe("rota de saúde", () => {
  it("com o banco disponível, responde ok para aplicação e banco", async () => {
    const { status, corpo } = await chamarSaude(urlDoBancoDeTeste());
    expect(status).toBe(200);
    expect(corpo).toEqual({ aplicacao: "ok", banco: "ok" });
  });

  it("com o banco indisponível, responde 503 sem detalhes internos", async () => {
    const { status, corpo } = await chamarSaude("postgresql://postgres:postgres@127.0.0.1:1/he_test");
    expect(status).toBe(503);
    expect(corpo).toEqual({ aplicacao: "ok", banco: "indisponivel" });
  });
});
