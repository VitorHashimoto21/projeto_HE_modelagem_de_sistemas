import { lerCodigo, lerNomeDoAutenticador, MENSAGENS_DO_SEGUNDO_FATOR as M } from "@/lib/dominio/segundo-fator";
import type { AdaptadorDeAutenticacao, FatorDoUsuario } from "./adaptador";

/**
 * Fluxos do 2º fator do Administrador (SPEC-019, 5.1), independentes do Next.js: as Server Actions
 * só leem o formulário, chamam estas funções e redirecionam. Os testes as exercitam com o dublê do
 * provedor de autenticação, que gera e confere códigos TOTP de verdade (RFC 6238).
 */

export type EventoDoSegundoFator = "SEGUNDO_FATOR_CADASTRADO" | "SEGUNDO_FATOR_REMOVIDO";

export type DependenciasDoSegundoFator = {
  auth: AdaptadorDeAutenticacao;
  /** Grava o evento no registro do suporte, sem negócio (RF77). */
  registrar(evento: EventoDoSegundoFator, descricao: string): Promise<void>;
  /** Emissor do ambiente no aplicativo autenticador ("Health Enterprise" ou "HE Homologação"). */
  emissor: string;
};

type Erros = Partial<Record<"nome" | "codigo", string>>;

export type EstadoDoCadastroDoFator =
  | { status: "ocioso" }
  | { status: "erro"; erros?: Erros; mensagem?: string; nome?: string }
  /** QR code gerado: falta o código para concluir. */
  | { status: "qr"; fatorId: string; qrCode: string; segredo: string; nome: string; erros?: Erros }
  /** `primeiro`: era o primeiro autenticador da conta (a tela sugere um segundo). */
  | { status: "concluido"; primeiro: boolean };

export type EstadoDoCodigo = { status: "ocioso" } | { status: "erro"; erros?: Erros; mensagem?: string } | { status: "verificado" };

export type EstadoDaRemocao = { status: "ocioso" } | { status: "erro"; mensagem: string } | { status: "removido"; mensagem: string };

const erroDoProvedor = (erro: "MuitasTentativas" | "FalhaInterna") => (erro === "MuitasTentativas" ? M.muitasTentativas : M.falhaInterna);

const verificados = (fatores: FatorDoUsuario[]) => fatores.filter((f) => f.verificado);

/** Passo 1 do cadastro (CA-01): o nome do autenticador; o Supabase gera o QR code e o segredo. */
export async function iniciarCadastro(campos: Record<string, string>, deps: DependenciasDoSegundoFator): Promise<EstadoDoCadastroDoFator> {
  const nome = lerNomeDoAutenticador(campos.nome);
  if (!nome.ok) return { status: "erro", erros: { nome: nome.erro }, nome: campos.nome ?? "" };
  const r = await deps.auth.iniciarCadastroDoFator(nome.nome, deps.emissor);
  if (!r.ok) {
    switch (r.erro) {
      case "NomeRepetido":
        return { status: "erro", erros: { nome: M.nomeRepetido }, nome: nome.nome };
      case "MuitosFatores":
        return { status: "erro", mensagem: M.muitosFatores, nome: nome.nome };
      case "SegundoFatorNecessario":
        return { status: "erro", mensagem: M.reconfirmar, nome: nome.nome };
      default:
        return { status: "erro", mensagem: erroDoProvedor(r.erro), nome: nome.nome };
    }
  }
  return { status: "qr", fatorId: r.fatorId, qrCode: r.qrCode, segredo: r.segredo, nome: nome.nome };
}

/**
 * Passo 2 (CA-01): o código do aplicativo ativa o autenticador e sobe a sessão para `aal2`. Só um
 * cadastro em andamento da própria conta é aceito (o id vem do formulário, conferido aqui).
 */
export async function concluirCadastro(
  campos: Record<string, string>,
  pendente: { qrCode: string; segredo: string; nome: string },
  deps: DependenciasDoSegundoFator,
): Promise<EstadoDoCadastroDoFator> {
  const voltar = (erros: Erros): EstadoDoCadastroDoFator => ({ status: "qr", fatorId: campos.fator ?? "", ...pendente, erros });
  const codigo = lerCodigo(campos.codigo);
  if (!codigo.ok) return voltar({ codigo: codigo.erro });
  const fatores = await deps.auth.fatores();
  const fator = fatores.find((f) => f.id === campos.fator && !f.verificado);
  if (!fator) return { status: "erro", mensagem: M.falhaInterna };
  const primeiro = verificados(fatores).length === 0;
  const r = await deps.auth.verificarCodigo(fator.id, codigo.codigo);
  if (!r.ok) return r.erro === "CodigoInvalido" ? voltar({ codigo: M.codigoInvalido }) : { status: "qr", fatorId: fator.id, ...pendente, erros: { codigo: erroDoProvedor(r.erro) } };
  await deps.registrar("SEGUNDO_FATOR_CADASTRADO", `Autenticador "${fator.nome}" cadastrado`);
  return { status: "concluido", primeiro };
}

/** Login seguinte e reconfirmação (5.1): o código de um dos autenticadores ativos da conta. */
export async function verificarCodigo(campos: Record<string, string>, deps: DependenciasDoSegundoFator): Promise<EstadoDoCodigo> {
  const codigo = lerCodigo(campos.codigo);
  if (!codigo.ok) return { status: "erro", erros: { codigo: codigo.erro } };
  const ativos = verificados(await deps.auth.fatores());
  const fator = ativos.find((f) => f.id === campos.fator) ?? ativos[0];
  if (!fator) return { status: "erro", mensagem: M.falhaInterna };
  const r = await deps.auth.verificarCodigo(fator.id, codigo.codigo);
  if (!r.ok) return r.erro === "CodigoInvalido" ? { status: "erro", erros: { codigo: M.codigoInvalido } } : { status: "erro", mensagem: erroDoProvedor(r.erro) };
  return { status: "verificado" };
}

/** Remover um autenticador (5.1): ação crítica; nunca o último, para a conta não ficar sem 2º fator. */
export async function removerAutenticador(fatorId: string, deps: DependenciasDoSegundoFator): Promise<EstadoDaRemocao> {
  const ativos = verificados(await deps.auth.fatores());
  const fator = ativos.find((f) => f.id === fatorId);
  if (!fator) return { status: "erro", mensagem: M.falhaInterna };
  if (ativos.length <= 1) return { status: "erro", mensagem: M.ultimoAutenticador };
  const r = await deps.auth.removerFator(fator.id);
  if (!r.ok) return { status: "erro", mensagem: r.erro === "SegundoFatorNecessario" ? M.reconfirmar : M.falhaInterna };
  await deps.registrar("SEGUNDO_FATOR_REMOVIDO", `Autenticador "${fator.nome}" removido`);
  return { status: "removido", mensagem: M.autenticadorRemovido };
}
