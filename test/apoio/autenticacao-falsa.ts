import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AdaptadorDeAutenticacao } from "@/lib/auth/adaptador";
import { codigoAtual, novoSegredo } from "./totp";

type FatorFalso = { id: string; nome: string; segredo: string; criadoEm: Date; verificado: boolean };

/**
 * Dublê do provedor de autenticação (SPEC-002, seção 12). Imita o comportamento do
 * Supabase Auth que importa para os fluxos e grava cada conta nova no auth.users do
 * banco de teste — o mesmo INSERT que dispara o gatilho he_criar_usuario.
 */
export function criarAutenticacaoFalsa(banco: PrismaClient) {
  const contas = new Map<string, { id: string; senha: string; confirmada: boolean }>();
  // SPEC-019: autenticadores por conta, como o MFA TOTP do Supabase Auth.
  const fatoresPorConta = new Map<string, FatorFalso[]>();
  const fatoresDaSessao = () => (registro.sessao ? (fatoresPorConta.get(registro.sessao) ?? []) : []);
  const temVerificado = (id: string | null) => Boolean(id && (fatoresPorConta.get(id) ?? []).some((f) => f.verificado));
  const registro = {
    sessao: null as string | null,
    /** Nível da sessão e horários do login com senha e do último código (o `aal` e o `amr` do JWT). */
    nivel: null as "aal1" | "aal2" | null,
    senhaEm: null as Date | null,
    codigoEm: null as Date | null,
    emissores: [] as string[],
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
      registro.nivel = "aal1";
      registro.senhaEm = new Date();
      registro.codigoEm = null;
      return { ok: true, usuarioId: conta.id };
    },
    async sair(escopo) {
      if (escopo === "outras") registro.outrasSessoesEncerradas++;
      else {
        registro.sessao = null;
        registro.nivel = null;
        registro.senhaEm = null;
        registro.codigoEm = null;
      }
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
      // O Supabase só troca a senha de uma conta com 2º fator numa sessão aal2.
      if (temVerificado(conta.id) && registro.nivel !== "aal2") return { ok: false, erro: "SegundoFatorNecessario" };
      if (conta.senha === senha) return { ok: false, erro: "MesmaSenha" };
      conta.senha = senha;
      return { ok: true };
    },
    async usuarioDaSessao() {
      return registro.sessao;
    },
    async sessaoAtual() {
      return registro.sessao ? { usuarioId: registro.sessao, autenticadoEm: registro.senhaEm, nivel: registro.nivel, codigoEm: registro.codigoEm } : null;
    },
    async fatores() {
      return fatoresDaSessao().map(({ id, nome, criadoEm, verificado }) => ({ id, nome, criadoEm, verificado }));
    },
    async iniciarCadastroDoFator(nome, emissor) {
      if (!registro.sessao) return { ok: false, erro: "FalhaInterna" };
      if (temVerificado(registro.sessao) && registro.nivel !== "aal2") return { ok: false, erro: "SegundoFatorNecessario" };
      const lista = fatoresDaSessao().filter((f) => f.verificado);
      if (lista.some((f) => f.nome === nome)) return { ok: false, erro: "NomeRepetido" };
      if (lista.length >= 10) return { ok: false, erro: "MuitosFatores" };
      const fator: FatorFalso = { id: randomUUID(), nome, segredo: novoSegredo(), criadoEm: new Date(), verificado: false };
      fatoresPorConta.set(registro.sessao, [...lista, fator]);
      registro.emissores.push(emissor);
      return { ok: true, fatorId: fator.id, qrCode: `data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"/>`, segredo: fator.segredo };
    },
    async verificarCodigo(fatorId, codigo) {
      const fator = fatoresDaSessao().find((f) => f.id === fatorId);
      if (!fator || codigo !== codigoAtual(fator.segredo)) return { ok: false, erro: "CodigoInvalido" };
      fator.verificado = true;
      registro.nivel = "aal2";
      registro.codigoEm = new Date();
      return { ok: true };
    },
    async removerFator(fatorId) {
      if (registro.nivel !== "aal2") return { ok: false, erro: "SegundoFatorNecessario" };
      fatoresPorConta.set(registro.sessao!, fatoresDaSessao().filter((f) => f.id !== fatorId));
      return { ok: true };
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
    /** Simula a sessão aberta pelo link de recuperação: sem o login com senha, ainda em aal1. */
    abrirSessaoDeRecuperacao(email: string) {
      registro.sessao = contas.get(email)?.id ?? null;
      registro.nivel = "aal1";
      registro.senhaEm = null;
      registro.codigoEm = null;
    },
    /** Código que o aplicativo mostraria agora para um autenticador da conta. */
    codigoDe(fatorId: string): string {
      for (const lista of fatoresPorConta.values()) {
        const f = lista.find((x) => x.id === fatorId);
        if (f) return codigoAtual(f.segredo);
      }
      throw new Error("autenticador inexistente");
    },
  };
}
