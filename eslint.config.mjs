import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Fronteiras entre camadas (SPEC-001, seção 8; ADR-001 e ADR-002).
const acessoBrutoAoBanco = {
  group: ["@/lib/db/prisma", "@/lib/db/criar-cliente", "@/generated/prisma/*", "@prisma/*", "pg"],
  allowTypeImports: true,
  message: "Use clienteDoNegocio() de @/lib/db: o acesso aos dados passa sempre pelo filtro de negócio.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Rotas, páginas e interface não acessam o Prisma bruto (T13).
    files: ["src/app/**", "src/components/**", "src/hooks/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", { patterns: [acessoBrutoAoBanco] }],
    },
  },
  {
    // Domínio é puro: sem framework, sem banco (ADR-001, ADR-005).
    files: ["src/lib/dominio/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*", "react", "react-dom", "@/lib/db", "@/lib/db/*", "@/generated/*", "@prisma/*", "pg"],
              message: "A camada de domínio não depende de framework nem de banco.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**", "coverage/**"]),
]);

export default eslintConfig;
