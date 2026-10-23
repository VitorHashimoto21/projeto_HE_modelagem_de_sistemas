import type { DadosDoCliente } from "@/lib/clientes/validacao";
import { formatarCnpj } from "@/lib/dominio/cnpj";
import { dataBrasileira } from "@/lib/dominio/datas";
import {
  faltandoParaNota,
  formatarCep,
  formatarCpf,
  formatarTelefone,
  mascararDocumento,
  mascararEmailDoCliente,
  mascararTelefoneDoCliente,
  nomeDeExibicao,
  type SituacaoIe,
  type TipoCliente,
} from "@/lib/dominio/cliente";
import { CLIENTE_ANONIMO } from "@/lib/dominio/lgpd";
import { pode, type Matriz } from "@/lib/dominio/permissoes";
import { mascararContato, mascararNome } from "@/lib/dominio/suporte";
import type { ClienteDoNegocio } from "./cliente-do-negocio";

/**
 * Clientes do negócio (SPEC-022): lista, detalhe com as compras, cadastro, edição e exclusão.
 * A máscara é aplicada aqui, no servidor (OPEN-002, INV-003): quem não pode editar clientes nunca
 * recebe o documento, o e-mail, o telefone nem o endereço completos; o suporte, nem o nome.
 */

export class ClienteNaoEncontrado extends Error {
  constructor() {
    super("Cliente não encontrado.");
    this.name = "ClienteNaoEncontrado";
  }
}

/** Documento já usado por outro cliente ativo do negócio (5.2, item 9; INV-002). */
export class DocumentoRepetido extends Error {
  constructor(
    public readonly tipo: TipoCliente,
    /** Nome do outro cliente, já com a máscara de quem pediu (null no modo suporte). */
    public readonly outro: string | null,
  ) {
    super("Documento repetido.");
    this.name = "DocumentoRepetido";
  }
}

/** Quem vê o quê (5.5): completo (Vendas — editar), mascarado (só ver) ou suporte (tudo mascarado). */
export type Visao = "completa" | "mascarada" | "suporte";

/** A visão sai do contexto (OPEN-002): suporte; Vendas — editar vê tudo; quem só vê, mascarado. */
export function visaoDoCliente(contexto: { modoSuporte?: boolean; permissoes: Matriz }): Visao {
  if (contexto.modoSuporte) return "suporte";
  return pode(contexto.permissoes, "vendas", "editar") ? "completa" : "mascarada";
}

export const FILTRO_INCOMPLETOS = "incompletos";
export const LIMITE_DA_LISTA = 500;
export const LIMITE_DE_COMPRAS = 50;

export type ClienteDaLista = {
  id: string;
  tipo: TipoCliente;
  /** Na empresa, o nome fantasia quando houver (OPEN-009). */
  nome: string;
  /** Razão social abaixo do nome fantasia (só empresa com nome fantasia). */
  razaoSocial: string | null;
  documento: string | null;
  municipioUf: string | null;
  completoParaNota: boolean;
};

export type CompraDoCliente = { id: string; numero: number; /** dd/mm/aaaa, no fuso do negócio. */ data: string; valor: number; cancelada: boolean; troca: boolean };

export type DetalheDoCliente = {
  id: string;
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
  faltando: string[];
  visao: Visao;
};

/** Valores para preencher o formulário de edição (só para quem edita: sempre completos). */
export type ValoresDoCliente = { [K in keyof DadosDoCliente]: DadosDoCliente[K] };

const CAMPOS_DO_FORMULARIO = {
  tipo: true,
  nome: true,
  nomeFantasia: true,
  documento: true,
  situacaoIe: true,
  inscricaoEstadual: true,
  inscricaoMunicipal: true,
  nomeContato: true,
  email: true,
  telefone: true,
  cep: true,
  logradouro: true,
  numero: true,
  complemento: true,
  bairro: true,
  municipio: true,
  uf: true,
} as const;

const CAMPOS = { id: true, ...CAMPOS_DO_FORMULARIO } as const;

type Linha = { id: string } & DadosDoCliente;

const ehUnicidade = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
const municipioUf = (c: { municipio: string | null; uf: string | null }) =>
  c.municipio && c.uf ? `${c.municipio}/${c.uf}` : (c.municipio ?? c.uf ?? null);

/** Termo da busca (5.1, item 2): o texto como veio e, se houver, só os dígitos e letras (documento e telefone). */
function condicaoDaBusca(busca: string) {
  const termo = busca.trim();
  if (!termo) return {};
  const compacto = termo.replace(/[\s./()-]/g, "").toUpperCase();
  const ou: object[] = [
    { nome: { contains: termo, mode: "insensitive" as const } },
    { nomeFantasia: { contains: termo, mode: "insensitive" as const } },
    { email: { contains: termo, mode: "insensitive" as const } },
  ];
  if (compacto.length >= 3 && /^[0-9A-Z]+$/.test(compacto)) ou.push({ documento: { contains: compacto } });
  if (/^\d{3,}$/.test(compacto)) ou.push({ telefone: { contains: compacto } });
  return { OR: ou };
}

export function criarConsultasDeClientes(cliente: ClienteDoNegocio, negocioId: string, visao: Visao) {
  const nomeVisto = (nome: string) => (visao === "suporte" ? mascararNome(nome) : nome);

  function paraLista(c: Linha): ClienteDaLista {
    const fantasia = c.tipo === "PESSOA_JURIDICA" && c.nomeFantasia ? c.nomeFantasia : null;
    return {
      id: c.id,
      tipo: c.tipo,
      nome: nomeVisto(nomeDeExibicao(c)),
      razaoSocial: fantasia ? nomeVisto(c.nome) : null,
      documento: c.documento ? mascararDocumento(c.tipo, c.documento) : null,
      municipioUf: municipioUf(c),
      completoParaNota: faltandoParaNota(c).length === 0,
    };
  }

  function paraDetalhe(c: Linha): DetalheDoCliente {
    const faltando = faltandoParaNota(c);
    if (visao === "completa") {
      return {
        ...c,
        documento: c.documento && (c.tipo === "PESSOA_FISICA" ? formatarCpf(c.documento) : formatarCnpj(c.documento)),
        telefone: c.telefone && formatarTelefone(c.telefone),
        cep: c.cep && formatarCep(c.cep),
        faltando,
        visao,
      };
    }
    const suporte = visao === "suporte";
    return {
      id: c.id,
      tipo: c.tipo,
      nome: nomeVisto(c.nome),
      nomeFantasia: c.nomeFantasia && nomeVisto(c.nomeFantasia),
      documento: c.documento && mascararDocumento(c.tipo, c.documento),
      situacaoIe: c.situacaoIe,
      inscricaoEstadual: c.inscricaoEstadual && (suporte ? mascararContato(c.inscricaoEstadual) : c.inscricaoEstadual),
      inscricaoMunicipal: c.inscricaoMunicipal && (suporte ? mascararContato(c.inscricaoMunicipal) : c.inscricaoMunicipal),
      nomeContato: c.nomeContato && nomeVisto(c.nomeContato),
      email: c.email && mascararEmailDoCliente(c.email),
      telefone: c.telefone && mascararTelefoneDoCliente(c.telefone),
      // Do endereço, só município e UF (5.5).
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      municipio: c.municipio,
      uf: c.uf,
      faltando,
      visao,
    };
  }

  /** O outro cliente com o mesmo documento, para a mensagem de repetido. */
  async function conferirDocumento(tx: ClienteDoNegocio, dados: DadosDoCliente, exceto?: string) {
    if (!dados.documento) return;
    const outro = await tx.cliente.findFirst({
      where: { documento: dados.documento, anonimizadoEm: null, ...(exceto ? { id: { not: exceto } } : {}) },
      select: { tipo: true, nome: true, nomeFantasia: true },
    });
    if (outro) throw new DocumentoRepetido(dados.tipo, visao === "suporte" ? null : nomeDeExibicao(outro));
  }

  return {
    visao,

    async listar(filtro: { busca?: string; incompletos?: boolean } = {}): Promise<{ clientes: ClienteDaLista[]; maisClientes: boolean }> {
      const linhas = await cliente.cliente.findMany({
        where: { anonimizadoEm: null, ...condicaoDaBusca(filtro.busca ?? "") },
        select: CAMPOS,
        orderBy: { nome: "asc" },
        take: LIMITE_DA_LISTA + 1,
      });
      const lista = linhas
        .slice(0, LIMITE_DA_LISTA)
        .map(paraLista)
        .filter((c) => !filtro.incompletos || !c.completoParaNota)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return { clientes: lista, maisClientes: linhas.length > LIMITE_DA_LISTA };
    },

    /** Detalhe (5.3) com as compras (OPEN-008): só as não canceladas entram no total. */
    async detalhar(id: string) {
      const c = await cliente.cliente.findFirst({ where: { id, anonimizadoEm: null }, select: CAMPOS });
      if (!c) throw new ClienteNaoEncontrado();
      const [vendas, quantidade, soma] = await Promise.all([
        cliente.venda.findMany({
          where: { clienteId: id },
          select: { id: true, numero: true, data: true, valorTotal: true, status: true, vendaOrigemId: true },
          orderBy: [{ data: "desc" }, { numero: "desc" }],
          take: LIMITE_DE_COMPRAS,
        }),
        cliente.venda.count({ where: { clienteId: id } }),
        cliente.venda.aggregate({ where: { clienteId: id, status: "CONCLUIDA" }, _sum: { valorTotal: true } }),
      ]);
      const compras: CompraDoCliente[] = vendas.map((v) => ({
        id: v.id,
        numero: v.numero,
        data: dataBrasileira(v.data),
        valor: Number(v.valorTotal.toString()),
        cancelada: v.status === "CANCELADA",
        troca: v.vendaOrigemId !== null,
      }));
      return {
        cliente: paraDetalhe(c),
        compras,
        quantidadeDeCompras: quantidade,
        totalComprado: Number(soma._sum.valorTotal?.toString() ?? "0"),
      };
    },

    /** Valores do formulário de edição: só para quem edita (a página já exige Vendas — editar). */
    async valores(id: string): Promise<ValoresDoCliente> {
      if (visao !== "completa") throw new ClienteNaoEncontrado();
      const c = await cliente.cliente.findFirst({ where: { id, anonimizadoEm: null }, select: CAMPOS_DO_FORMULARIO });
      if (!c) throw new ClienteNaoEncontrado();
      return c;
    },

    /** E-mail e telefone gravados (para aceitar os antigos fora do formato, 5.2 item 10). */
    async atuais(id: string): Promise<{ email: string | null; telefone: string | null } | null> {
      return cliente.cliente.findFirst({ where: { id, anonimizadoEm: null }, select: { email: true, telefone: true } });
    },

    async criar(dados: DadosDoCliente) {
      try {
        return await cliente.$transaction(async (tx) => {
          await conferirDocumento(tx as ClienteDoNegocio, dados);
          const c = await tx.cliente.create({ data: { ...dados, negocioId }, select: CAMPOS });
          return { id: c.id, nome: nomeVisto(nomeDeExibicao(c)), faltando: faltandoParaNota(c) };
        });
      } catch (e) {
        if (ehUnicidade(e)) throw new DocumentoRepetido(dados.tipo, null);
        throw e;
      }
    },

    async editar(id: string, dados: DadosDoCliente) {
      try {
        await cliente.$transaction(async (tx) => {
          const atual = await tx.cliente.findFirst({ where: { id, anonimizadoEm: null }, select: { id: true } });
          if (!atual) throw new ClienteNaoEncontrado();
          await conferirDocumento(tx as ClienteDoNegocio, dados, id);
          await tx.cliente.update({ where: { id }, data: dados });
        });
      } catch (e) {
        if (ehUnicidade(e)) throw new DocumentoRepetido(dados.tipo, null);
        throw e;
      }
    },

    /**
     * Exclusão (OPEN-005, 5.6): sem vendas, apaga; com vendas, anonimiza — as vendas, pagamentos,
     * contas e lançamentos não mudam. A linha do cliente fica travada até o fim da transação.
     */
    async excluir(id: string): Promise<"apagado" | "anonimizado"> {
      return cliente.$transaction(async (tx) => {
        const travado = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Cliente" WHERE "id" = ${id}::uuid AND "negocioId" = ${negocioId}::uuid AND "anonimizadoEm" IS NULL FOR UPDATE`;
        if (!travado.length) throw new ClienteNaoEncontrado();
        if ((await tx.venda.count({ where: { clienteId: id } })) === 0) {
          await tx.cliente.delete({ where: { id } });
          return "apagado";
        }
        await tx.cliente.update({ where: { id }, data: { ...DADOS_ANONIMOS, anonimizadoEm: new Date() } });
        return "anonimizado";
      });
    },

    /** Quantas compras tem (para o texto da confirmação de exclusão, 5.6). */
    async quantidadeDeCompras(id: string) {
      return cliente.venda.count({ where: { clienteId: id } });
    },
  };
}

/** Todos os dados pessoais vazios (INV-005; o banco confere com Cliente_anonimizado_sem_dados). */
export const DADOS_ANONIMOS = {
  nome: CLIENTE_ANONIMO,
  nomeFantasia: null,
  documento: null,
  situacaoIe: null,
  inscricaoEstadual: null,
  inscricaoMunicipal: null,
  nomeContato: null,
  email: null,
  telefone: null,
  cep: null,
  logradouro: null,
  numero: null,
  complemento: null,
  bairro: null,
  municipio: null,
  uf: null,
} as const;

export type ConsultasDeClientes = ReturnType<typeof criarConsultasDeClientes>;
