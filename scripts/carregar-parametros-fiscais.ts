/**
 * Comando de carga dos parâmetros fiscais (SPEC-003; ADR-004).
 *
 *   npm run fiscal:carregar              valida o arquivo e grava o que mudou
 *   npm run fiscal:carregar -- --simular só mostra o que mudaria
 *   npm run fiscal:carregar -- --corrigir substitui valores da mesma vigência (erro de digitação)
 *   npm run fiscal:validar               só valida o arquivo, sem banco (usado no CI)
 *
 * Conexão: DIRECT_URL ou, se vazia, DATABASE_URL (a mesma regra do prisma.config.ts).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { ArquivoInvalido, avisosDosParametros, CAMINHO_DO_ARQUIVO, validarParametros } from "@/lib/fiscal/arquivo";
import { TABELAS_FISCAIS } from "@/lib/fiscal/plano";
import { carregarParametros, ConflitoDeVigencia } from "./fiscal/carga";

const argumentos = new Set(process.argv.slice(2));
const noActions = process.env.GITHUB_ACTIONS === "true";

function avisar(mensagem: string) {
  console.warn(noActions ? `::warning title=Parâmetros fiscais::${mensagem}` : `⚠ ${mensagem}`);
}

function falhar(mensagem: string): never {
  console.error(noActions ? `::error title=Parâmetros fiscais::${mensagem.replace(/\n/g, "%0A")}` : `✖ ${mensagem}`);
  process.exit(1);
}

async function principal() {
  let parametros;
  try {
    parametros = validarParametros(JSON.parse(readFileSync(CAMINHO_DO_ARQUIVO, "utf-8")));
  } catch (erro) {
    if (erro instanceof ArquivoInvalido || erro instanceof SyntaxError) falhar(erro.message);
    throw erro;
  }
  console.log(`✓ ${CAMINHO_DO_ARQUIVO} válido.`);
  for (const aviso of avisosDosParametros(parametros)) avisar(aviso);

  if (argumentos.has("--validar")) return;

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) falhar("Defina DIRECT_URL ou DATABASE_URL para gravar os parâmetros (veja o .env.example).");

  const cliente = criarPrismaClient(url);
  try {
    const { resumo, plano, gravado } = await carregarParametros(cliente, parametros, {
      simular: argumentos.has("--simular"),
      corrigir: argumentos.has("--corrigir"),
    });
    console.log(argumentos.has("--simular") ? "Simulação (nada foi gravado):" : gravado ? "Carga concluída:" : "Nada a mudar:");
    console.table(Object.fromEntries(TABELAS_FISCAIS.map((t) => [t, resumo[t]])));
    for (const op of plano.operacoes) {
      if (op.tipo === "corrigir") console.log(`Corrigido: ${op.tabela} ${JSON.stringify(op.anterior)} → ${JSON.stringify(op.registro)}`);
    }
    for (const chave of plano.somenteNoBanco) avisar(`No banco, mas não no arquivo (mantido): ${chave}`);
  } catch (erro) {
    if (erro instanceof ConflitoDeVigencia) falhar(erro.message);
    if (erro instanceof Error && /does not exist|não existe/i.test(erro.message)) {
      falhar("As tabelas fiscais não existem neste banco. Aplique as migrações antes (npx prisma migrate deploy).");
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
