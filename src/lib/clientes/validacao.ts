import type { ErrosDeCampo, Validacao } from "@/lib/auth/validacao";
import { cnpjValido, normalizarCnpj } from "@/lib/dominio/cnpj";
import {
  cpfValido,
  ehUf,
  emailValido,
  normalizarCep,
  normalizarCpf,
  normalizarInscricao,
  normalizarTelefone,
  SITUACOES_IE,
  TIPOS_CLIENTE,
  type SituacaoIe,
  type TipoCliente,
} from "@/lib/dominio/cliente";

/**
 * Cadastro e edição do cliente (SPEC-022, 5.2 e 5.8). Só o nome (razão social, na empresa) é
 * obrigatório; os campos do outro tipo são descartados. Usada no navegador e de novo no servidor.
 */

export const MAX_NOME_PF = 120;
export const MAX_NOME_PJ = 150;
export const MAX_INSCRICAO_ESTADUAL = 14;
export const MAX_INSCRICAO_MUNICIPAL = 20;

export const MENSAGENS_CLIENTE = {
  nomeObrigatorio: "Informe o nome do cliente.",
  razaoSocialObrigatoria: "Informe a razão social.",
  nomeLongo: (max: number) => `Use no máximo ${max} caracteres.`,
  tipoInvalido: "Escolha pessoa física ou empresa.",
  cpfInvalido: "CPF inválido.",
  cnpjInvalido: "CNPJ inválido.",
  situacaoIeInvalida: "Escolha a situação na inscrição estadual.",
  inscricaoEstadualObrigatoria: "Informe o número da inscrição estadual.",
  inscricaoEstadualInvalida: `Use de 1 a ${MAX_INSCRICAO_ESTADUAL} letras ou números.`,
  inscricaoMunicipalInvalida: `Use de 1 a ${MAX_INSCRICAO_MUNICIPAL} letras ou números.`,
  emailInvalido: "E-mail inválido.",
  telefoneInvalido: "Informe o telefone com DDD.",
  cepInvalido: "Informe os 8 dígitos do CEP.",
  ufInvalida: "Escolha a UF.",
  campoLongo: (max: number) => `Use no máximo ${max} caracteres.`,
} as const;

export type DadosDoCliente = {
  tipo: TipoCliente;
  nome: string;
  nomeFantasia: string | null;
  documento: string | null;
  situacaoIe: SituacaoIe | null;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
  nomeContato: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
};

/** Valores já gravados: e-mail e telefone antigos fora do formato são mantidos se não mudarem (5.2, item 10). */
export type ValoresAtuais = { email: string | null; telefone: string | null };

const texto = (v: string | undefined) => (v ?? "").trim().replace(/\s+/g, " ");
const opcional = (v: string | undefined) => texto(v) || null;

/** Limites dos campos de endereço (5.8). */
const LIMITES = { logradouro: 120, numero: 30, complemento: 30, bairro: 120, municipio: 120, nomeFantasia: 150, nomeContato: 120 } as const;

export function validarCliente(campos: Record<string, string>, atuais: ValoresAtuais | null = null): Validacao<DadosDoCliente> {
  const erros: ErrosDeCampo = {};
  const tipo = (campos.tipo || "PESSOA_FISICA") as TipoCliente;
  if (!(TIPOS_CLIENTE as readonly string[]).includes(tipo)) erros.tipo = MENSAGENS_CLIENTE.tipoInvalido;
  const empresa = tipo === "PESSOA_JURIDICA";

  const nome = texto(campos.nome);
  const maxNome = empresa ? MAX_NOME_PJ : MAX_NOME_PF;
  if (!nome) erros.nome = empresa ? MENSAGENS_CLIENTE.razaoSocialObrigatoria : MENSAGENS_CLIENTE.nomeObrigatorio;
  else if (nome.length > maxNome) erros.nome = MENSAGENS_CLIENTE.nomeLongo(maxNome);

  let documento: string | null = null;
  const docInformado = texto(campos.documento);
  if (docInformado) {
    if (empresa) {
      documento = cnpjValido(docInformado) ? normalizarCnpj(docInformado) : null;
      if (!documento) erros.documento = MENSAGENS_CLIENTE.cnpjInvalido;
    } else {
      documento = cpfValido(docInformado) ? normalizarCpf(docInformado) : null;
      if (!documento) erros.documento = MENSAGENS_CLIENTE.cpfInvalido;
    }
  }

  // Campos só da empresa (5.2, item 3): descartados na pessoa física.
  let situacaoIe: SituacaoIe | null = null;
  let inscricaoEstadual: string | null = null;
  let inscricaoMunicipal: string | null = null;
  let nomeFantasia: string | null = null;
  let nomeContato: string | null = null;
  if (empresa) {
    const situacao = texto(campos.situacaoIe);
    if (situacao) {
      if ((SITUACOES_IE as readonly string[]).includes(situacao)) situacaoIe = situacao as SituacaoIe;
      else erros.situacaoIe = MENSAGENS_CLIENTE.situacaoIeInvalida;
    }
    if (situacaoIe === "CONTRIBUINTE") {
      const ie = texto(campos.inscricaoEstadual);
      if (!ie) erros.inscricaoEstadual = MENSAGENS_CLIENTE.inscricaoEstadualObrigatoria;
      else if (!(inscricaoEstadual = normalizarInscricao(ie, MAX_INSCRICAO_ESTADUAL))) erros.inscricaoEstadual = MENSAGENS_CLIENTE.inscricaoEstadualInvalida;
    }
    const im = texto(campos.inscricaoMunicipal);
    if (im && !(inscricaoMunicipal = normalizarInscricao(im, MAX_INSCRICAO_MUNICIPAL))) erros.inscricaoMunicipal = MENSAGENS_CLIENTE.inscricaoMunicipalInvalida;
    nomeFantasia = opcional(campos.nomeFantasia);
    nomeContato = opcional(campos.nomeContato);
  }

  let email = opcional(campos.email);
  if (email && email !== atuais?.email) {
    if (emailValido(email)) email = email.toLowerCase();
    else erros.email = MENSAGENS_CLIENTE.emailInvalido;
  }

  let telefone = opcional(campos.telefone);
  if (telefone && telefone !== atuais?.telefone) {
    const t = normalizarTelefone(telefone);
    if (t) telefone = t;
    else erros.telefone = MENSAGENS_CLIENTE.telefoneInvalido;
  }

  let cep: string | null = null;
  const cepInformado = texto(campos.cep);
  if (cepInformado && !(cep = normalizarCep(cepInformado))) erros.cep = MENSAGENS_CLIENTE.cepInvalido;

  let uf: string | null = texto(campos.uf).toUpperCase() || null;
  if (uf && !ehUf(uf)) {
    erros.uf = MENSAGENS_CLIENTE.ufInvalida;
    uf = null;
  }

  const limitado: Record<keyof typeof LIMITES, string | null> = {
    logradouro: opcional(campos.logradouro),
    numero: opcional(campos.numero),
    complemento: opcional(campos.complemento),
    bairro: opcional(campos.bairro),
    municipio: opcional(campos.municipio),
    nomeFantasia,
    nomeContato,
  };
  for (const [campo, max] of Object.entries(LIMITES) as [keyof typeof LIMITES, number][]) {
    if ((limitado[campo]?.length ?? 0) > max) erros[campo] = MENSAGENS_CLIENTE.campoLongo(max);
  }

  if (Object.keys(erros).length) return { ok: false, erros };
  return {
    ok: true,
    dados: {
      tipo,
      nome,
      nomeFantasia,
      documento,
      situacaoIe,
      inscricaoEstadual,
      inscricaoMunicipal,
      nomeContato,
      email,
      telefone,
      cep,
      logradouro: limitado.logradouro,
      numero: limitado.numero,
      complemento: limitado.complemento,
      bairro: limitado.bairro,
      municipio: limitado.municipio,
      uf,
    },
  };
}
