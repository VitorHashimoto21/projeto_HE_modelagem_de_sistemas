/**
 * Papel de Administrador da plataforma (SPEC-018, 5.1; OPEN-001). Nenhuma tela concede o papel.
 *
 *   ADMIN_RESPONSAVEL="Nome" npm run admin:conceder <e-mail>
 *   ADMIN_RESPONSAVEL="Nome" npm run admin:retirar <e-mail>
 *
 * Em desenvolvimento, roda com o banco do .env. Em homologação e produção, roda pelo workflow
 * manual "Administradores" do GitHub Actions, com o segredo DIRECT_URL do ambiente escolhido
 * (o responsável é o usuário do GitHub que disparou a execução).
 *
 * Conexão: DIRECT_URL ou, se vazia, DATABASE_URL (a mesma regra do prisma.config.ts).
 */
import "dotenv/config";
import { criarPrismaClient } from "@/lib/db/criar-cliente";
import { criarConsultasDeSuporte } from "@/lib/db/suporte";
import { mascararEmail } from "@/lib/dominio/suporte";

const noActions = process.env.GITHUB_ACTIONS === "true";

function falhar(mensagem: string): never {
  console.error(noActions ? `::error title=Administradores::${mensagem}` : `✖ ${mensagem}`);
  process.exit(1);
}

const MENSAGENS = {
  ContaInexistente: "Conta não encontrada. A pessoa precisa se cadastrar (e confirmar o e-mail) antes.",
  ContaExcluida: "Conta excluída não pode ser administradora.",
  ConvitePendente: "Há convite pendente para esta conta. Cancele o convite antes.",
} as const;

async function principal() {
  const [acao, email] = process.argv.slice(2);
  if (acao !== "conceder" && acao !== "retirar") falhar("Use: admin.ts conceder|retirar <e-mail>");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) falhar("Informe o e-mail da conta.");
  const responsavel = (process.env.ADMIN_RESPONSAVEL ?? "").trim().slice(0, 80);
  if (!responsavel) falhar('Informe quem está rodando o comando: ADMIN_RESPONSAVEL="Nome".');

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) falhar("Defina DIRECT_URL ou DATABASE_URL (veja o .env.example).");

  const cliente = criarPrismaClient(url);
  const consultas = criarConsultasDeSuporte(cliente);
  const conta = mascararEmail(email.trim().toLowerCase());
  try {
    if (acao === "conceder") {
      const r = await consultas.concederPapel(email, responsavel, new Date());
      if (!r.ok) {
        if (r.erro === "ContaComVinculo") falhar(`A conta participa de ${r.negocios?.length ?? 0} negócio(s). Use uma conta exclusiva para o suporte.`);
        falhar(MENSAGENS[r.erro]);
      }
      console.log(r.jaEra ? `A conta ${conta} já é administradora desde ${r.desde.toISOString().slice(0, 10)}. Nada mudou.` : `Pronto: ${conta} agora é administradora (concedido por ${responsavel}).`);
    } else {
      const r = await consultas.retirarPapel(email, responsavel, new Date());
      if (!r.ok) falhar(MENSAGENS[r.erro]);
      console.log(r.naoEra ? `A conta ${conta} não era administradora. Nada mudou.` : `Pronto: ${conta} não é mais administradora (retirado por ${responsavel}).`);
    }
  } finally {
    await cliente.$disconnect();
  }
}

principal().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
