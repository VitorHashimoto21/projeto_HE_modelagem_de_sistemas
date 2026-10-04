import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const raiz = (caminho: string) => fileURLToPath(new URL(caminho, import.meta.url));

const resolve = {
  alias: {
    "@": raiz("./src"),
    // "server-only" impede import no navegador; nos testes (Node) vira um módulo vazio.
    "server-only": raiz("./test/apoio/server-only.ts"),
  },
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve,
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        resolve,
        test: {
          name: "integracao",
          include: ["test/integracao/**/*.test.ts"],
          environment: "node",
          globalSetup: ["test/apoio/preparar-banco.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
