/**
 * Comando de carga da tabela NCM oficial (SPEC-021, 5.1; ADR-004).
 *
 *   npm run ncm:carregar   valida o arquivo e grava o que mudou
 *   npm run ncm:validar    só valida o arquivo, sem banco (usado no CI)
 *
 * Conexão: DIRECT_URL ou, se vazia, DATABASE_URL (a mesma regra do prisma.config.ts).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { CAMINHO_DA_TABELA_NCM, lerTabelaNcm, TabelaNcmInvalida } from "@/lib/ncm/arquivo";
import { carregarTabelaNcm } from "./ncm/carga";

const noActions = process.env.GITHUB_ACTIONS === "true";

function falhar(mensagem: string): never {
  console.error(noActions ? `::error title=Tabela NCM::${mensagem.replace(/\n/g, "%0A")}` : `✖ ${mensagem}`);
  process.exit(1);
}

async function principal() {
  let tabela;
  try {
    tabela = lerTabelaNcm(JSON.parse(readFileSync(CAMINHO_DA_TABELA_NCM, "utf-8")));
  } catch (erro) {
    if (erro instanceof TabelaNcmInvalida || erro instanceof SyntaxError) falhar(erro.message);
    throw erro;
  }
  console.log(`✓ ${CAMINHO_DA_TABELA_NCM} válido: ${tabela.codigos.length} códigos de 8 dígitos, vigente em ${tabela.atualizadaEm} (${tabela.ato}).`);
  if (process.argv.includes("--validar")) return;

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) falhar("Defina DIRECT_URL ou DATABASE_URL para gravar a tabela (veja o .env.example).");

  const cliente = criarPrismaClient(url);
  try {
    const r = await carregarTabelaNcm(cliente, tabela);
    if (!r.inseridos && !r.alterados && !r.encerrados && !r.versao) console.log("Nada a mudar.");
    else console.log(`Carga concluída: ${r.inseridos} inseridos, ${r.alterados} alterados, ${r.encerrados} encerrados${r.versao ? ", versão atualizada" : ""}.`);
  } catch (erro) {
    if (erro instanceof Error && /does not exist|não existe/i.test(erro.message)) {
      falhar("A tabela Ncm não existe neste banco. Aplique as migrações antes (npx prisma migrate deploy).");
    }
    throw erro;
  } finally {
    await cliente.$disconnect();
  }
}

principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
