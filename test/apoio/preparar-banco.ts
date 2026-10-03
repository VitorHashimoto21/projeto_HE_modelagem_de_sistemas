import { execSync } from "node:child_process";
import "dotenv/config";
import { urlDoBancoDeTeste } from "./banco-de-teste";

/**
 * Aplica as migrações pendentes no banco de teste antes dos testes de integração.
 * Usa `migrate deploy` (não destrutivo); cada teste limpa os próprios dados.
 */
export default function prepararBanco(): void {
  const url = urlDoBancoDeTeste();
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
