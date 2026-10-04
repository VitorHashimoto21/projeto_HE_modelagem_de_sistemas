import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AdaptadorDeAutenticacao } from "@/lib/auth/adaptador";

/**
 * Dublê do provedor de autenticação (SPEC-002, seção 12). Imita o comportamento do
 * Supabase Auth que importa para os fluxos e grava cada conta nova no auth.users do
 * banco de teste — o mesmo INSERT que dispara o gatilho he_criar_usuario.
 */
export function criarAutenticacaoFalsa(banco: PrismaClient) {
  const contas = new Map<string, { id: string; senha: string; confirmada: boolean }>();
  const registro = {
    sessao: null as string | null,
    outrasSessoesEncerradas: 0,
    emails: [] as { tipo: "confirmacao" | "recuperacao"; email: string }[],
    chamadasDeCadastro: 0,
  };

  const adaptador: AdaptadorDeAutenticacao = {
    async cadastrar({ nome, email, senha, versaoTermos }) {
      registro.chamadasDeCadastro++;
      if (contas.has(email)) return { ok: true, contaJaExistia: true };
      const id = randomUUID();
      const metadados = JSON.stringify({ nome, aceiteTermos: "true", versaoTermosAceita: versaoTermos });
      try {
        await banco.$executeRaw`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (${id}::uuid, ${email}, ${metadados}::jsonb)`;
      } catch {
        // O Supabase responde "Database error saving new user" quando o gatilho falha.
        return { ok: false, erro: "FalhaInterna" };
      }
      contas.set(email, { id, senha, confirmada: false });
      registro.emails.push({ tipo: "confirmacao", email });
      return { ok: true, contaJaExistia: false };
    },
    async entrar(email, senha) {
      const conta = contas.get(email);
      if (!conta || conta.senha !== senha) return { ok: false, erro: "CredenciaisInvalidas" };
      if (!conta.confirmada) return { ok: false, erro: "EmailNaoConfirmado" };
      registro.sessao = conta.id;
      return { ok: true, usuarioId: conta.id };
    },
    async sair(escopo) {
      if (escopo === "outras") registro.outrasSessoesEncerradas++;
      else registro.sessao = null;
    },
    async reenviarConfirmacao(email) {
      const conta = contas.get(email);
      if (conta && !conta.confirmada) registro.emails.push({ tipo: "confirmacao", email });
      return { ok: true };
    },
    async pedirRecuperacao(email) {
      if (contas.has(email)) registro.emails.push({ tipo: "recuperacao", email });
      return { ok: true };
    },
    async confirmarLink() {
      return { ok: false };
    },
    async definirSenha(senha) {
      const conta = [...contas.values()].find((c) => c.id === registro.sessao);
      if (!conta) return { ok: false, erro: "SemSessao" };
      if (conta.senha === senha) return { ok: false, erro: "MesmaSenha" };
      conta.senha = senha;
      return { ok: true };
    },
    async usuarioDaSessao() {
      return registro.sessao;
    },
  };

  return {
    adaptador,
    registro,
    /** Simula o clique no link de confirmação. */
    confirmar(email: string) {
      const conta = contas.get(email);
      if (conta) conta.confirmada = true;
    },
    /** Simula a sessão aberta pelo link de recuperação. */
    abrirSessaoDeRecuperacao(email: string) {
      registro.sessao = contas.get(email)?.id ?? null;
    },
  };
}
