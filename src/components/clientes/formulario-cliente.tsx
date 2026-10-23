"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Aviso, MensagemDeCampo } from "@/components/acesso/campos";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao } from "@/components/ui/estilos";
import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { acaoCadastrarCliente, acaoConsultarCep, acaoConsultarEmpresa, acaoEditarCliente } from "@/lib/clientes/acoes";
import { CLIENTE_INICIAL, type EstadoDoCliente } from "@/lib/clientes/servicos";
import { MAX_NOME_PF, MAX_NOME_PJ, validarCliente, type DadosDoCliente } from "@/lib/clientes/validacao";
import { formatarCnpj, normalizarCnpj } from "@/lib/dominio/cnpj";
import {
  formatarCep,
  formatarCpf,
  formatarTelefone,
  normalizarCep,
  normalizarCpf,
  normalizarTelefone,
  ROTULO_SITUACAO_IE,
  ROTULO_TIPO_CLIENTE,
  SITUACOES_IE,
  TIPOS_CLIENTE,
  UFS,
  type TipoCliente,
} from "@/lib/dominio/cliente";
import { cn } from "@/lib/utils";

const rotulo = "mb-1.5 block text-sm font-medium text-foreground";
const ajuda = "mb-1.5 block text-xs text-muted-foreground";

type Campos = { [K in Exclude<keyof DadosDoCliente, "tipo">]: string };
const ENDERECO = ["cep", "logradouro", "numero", "complemento", "bairro", "municipio", "uf"] as const;
const VAZIO: Campos = {
  nome: "",
  nomeFantasia: "",
  documento: "",
  situacaoIe: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  nomeContato: "",
  email: "",
  telefone: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  municipio: "",
  uf: "",
};

function camposIniciais(v: DadosDoCliente | undefined): Campos {
  if (!v) return VAZIO;
  return {
    nome: v.nome,
    nomeFantasia: v.nomeFantasia ?? "",
    documento: v.documento ? (v.tipo === "PESSOA_FISICA" ? formatarCpf(v.documento) : formatarCnpj(v.documento)) : "",
    situacaoIe: v.situacaoIe ?? "",
    inscricaoEstadual: v.inscricaoEstadual ?? "",
    inscricaoMunicipal: v.inscricaoMunicipal ?? "",
    nomeContato: v.nomeContato ?? "",
    email: v.email ?? "",
    telefone: v.telefone ? formatarTelefone(v.telefone) : "",
    cep: v.cep ? formatarCep(v.cep) : "",
    logradouro: v.logradouro ?? "",
    numero: v.numero ?? "",
    complemento: v.complemento ?? "",
    bairro: v.bairro ?? "",
    municipio: v.municipio ?? "",
    uf: v.uf ?? "",
  };
}

/** Preenchimento vindo do CEP ou do CNPJ que trocaria o que já foi digitado: só com confirmação (5.2). */
type Pendente = { texto: string; valores: Partial<Campos> };

/**
 * Cadastro e edição do cliente (SPEC-022, 5.2): pessoa física ou empresa, só o nome obrigatório.
 * Na tela de Clientes o endereço fica aberto; no "Novo cliente" da Nova venda (5.10), num bloco que
 * abre sob demanda. Envia pela transição, para um erro do servidor não apagar o que foi digitado.
 */
export function FormularioCliente({
  modo,
  clienteId,
  valores,
  cancelarHref,
  aoCriar,
  aoCancelar,
}: {
  modo: "tela" | "venda";
  clienteId?: string;
  valores?: DadosDoCliente;
  cancelarHref?: string;
  aoCriar?: (c: { id: string; nome: string; faltando: string[] }) => void;
  aoCancelar?: () => void;
}) {
  const editando = Boolean(clienteId);
  const [estado, executar, enviando] = useActionState<EstadoDoCliente, FormData>(editando ? acaoEditarCliente : acaoCadastrarCliente, CLIENTE_INICIAL);
  const [tipo, setTipo] = useState<TipoCliente>(valores?.tipo ?? "PESSOA_FISICA");
  const [v, setV] = useState<Campos>(() => camposIniciais(valores));
  const [errosLocais, setErrosLocais] = useState<ErrosDeCampo>({});
  const [enderecoAberto, setEnderecoAberto] = useState(modo === "tela" || ENDERECO.some((c) => valores?.[c]));
  const [situacaoCep, setSituacaoCep] = useState("");
  const [situacaoCnpj, setSituacaoCnpj] = useState("");
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [consultando, iniciarConsulta] = useTransition();
  const ultimoCep = useRef(valores?.cep ?? "");
  // As consultas terminam depois de outras digitações: comparam com os valores do momento.
  const atual = useRef(v);
  useEffect(() => {
    atual.current = v;
  }, [v]);
  const empresa = tipo === "PESSOA_JURIDICA";
  const p = (campo: string) => `cliente-${campo}`;

  useEffect(() => {
    if (estado.status === "salvo" && aoCriar) aoCriar(estado.cliente);
    // aoCriar muda a cada renderização do pai; o efeito só deve rodar quando o estado muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const erros: ErrosDeCampo = { ...(estado.status === "erro" ? estado.erros : {}), ...errosLocais };
  const atualizar = (campo: keyof Campos, valor: string) => {
    setV((a) => ({ ...a, [campo]: valor }));
    if (errosLocais[campo]) setErrosLocais((e) => ({ ...e, [campo]: undefined }));
  };

  /**
   * Preenche os vazios; o que trocaria um valor digitado espera a confirmação. Os campos de
   * `soVazios` (telefone e e-mail do CNPJ, OPEN-009) nunca trocam um valor digitado.
   */
  function preencher(novos: Partial<Campos>, pergunta: string, soVazios: (keyof Campos)[] = []) {
    const vazios: Partial<Campos> = {};
    const trocas: Partial<Campos> = {};
    for (const [campo, valor] of Object.entries(novos) as [keyof Campos, string][]) {
      const digitado = atual.current[campo].trim();
      if (!valor) continue;
      if (!digitado) vazios[campo] = valor;
      else if (!soVazios.includes(campo) && digitado.toLowerCase() !== valor.toLowerCase()) trocas[campo] = valor;
    }
    setV((a) => ({ ...a, ...vazios }));
    setPendente(Object.keys(trocas).length ? { texto: pergunta, valores: trocas } : null);
  }

  /** Ao trocar o tipo, o documento que não serve para o novo tipo sai do campo (CPF ≠ CNPJ). */
  function trocarTipo(novo: TipoCliente) {
    setTipo(novo);
    const serve = novo === "PESSOA_FISICA" ? normalizarCpf(v.documento) : normalizarCnpj(v.documento);
    if (v.documento && !serve) atualizar("documento", "");
    setSituacaoCnpj("");
  }

  function consultarCep(texto: string) {
    const cep = normalizarCep(texto);
    if (!cep || cep === ultimoCep.current) return;
    ultimoCep.current = cep;
    setSituacaoCep("Buscando o endereço…");
    iniciarConsulta(async () => {
      const r = await acaoConsultarCep(cep);
      if (r.status === "erro") return setSituacaoCep(r.mensagem);
      setSituacaoCep("Endereço do CEP preenchido. Confira e complete o número.");
      const e = r.endereco;
      preencher({ logradouro: e.logradouro ?? "", bairro: e.bairro ?? "", municipio: e.municipio ?? "", uf: e.uf ?? "" }, "Trocar o endereço pelo do CEP?");
    });
  }

  function consultarCnpj() {
    setSituacaoCnpj("Buscando os dados da empresa…");
    iniciarConsulta(async () => {
      const r = await acaoConsultarEmpresa(v.documento);
      if (r.status === "erro") return setSituacaoCnpj(r.mensagem);
      const d = r.dados;
      setSituacaoCnpj("Dados da empresa preenchidos. Confira e informe a inscrição estadual.");
      if (ENDERECO.some((c) => d[c])) setEnderecoAberto(true);
      if (d.cep) ultimoCep.current = d.cep;
      preencher(
        {
          nome: d.razaoSocial,
          nomeFantasia: d.nomeFantasia ?? "",
          cep: d.cep ? formatarCep(d.cep) : "",
          logradouro: d.logradouro ?? "",
          numero: d.numero ?? "",
          complemento: d.complemento ?? "",
          bairro: d.bairro ?? "",
          municipio: d.municipio ?? "",
          uf: d.uf ?? "",
          telefone: d.telefone ? formatarTelefone(d.telefone) : "",
          email: d.email ?? "",
        },
        "Alguns campos já preenchidos são diferentes dos dados da Receita. Trocar pelos da Receita?",
        ["telefone", "email"],
      );
    });
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const campos = Object.fromEntries([...dados].map(([k, valor]) => [k, String(valor)]));
    const r = validarCliente(campos, valores ? { email: valores.email, telefone: valores.telefone } : null);
    if (!r.ok) {
      setErrosLocais(r.erros);
      return;
    }
    setErrosLocais({});
    startTransition(() => executar(dados));
  }

  const descreve = (campo: string, extra?: string) => [erros[campo] ? `${p(campo)}-erro` : null, extra].filter(Boolean).join(" ") || undefined;
  const campo = (nome: keyof Campos, props: React.InputHTMLAttributes<HTMLInputElement> & { rotuloTexto: string; dica?: string; className?: string }) => {
    const { rotuloTexto, dica, className, ...resto } = props;
    return (
      <div className={className}>
        <label htmlFor={p(nome)} className={rotulo}>
          {rotuloTexto}
        </label>
        {dica && (
          <span id={`${p(nome)}-ajuda`} className={ajuda}>
            {dica}
          </span>
        )}
        <input
          id={p(nome)}
          name={nome}
          value={v[nome]}
          onChange={(e) => atualizar(nome, e.target.value)}
          aria-invalid={erros[nome] ? true : undefined}
          aria-describedby={descreve(nome, dica ? `${p(nome)}-ajuda` : undefined)}
          className={classeDoCampo(erros[nome])}
          {...resto}
        />
        <MensagemDeCampo id={`${p(nome)}-erro`} erro={erros[nome]} />
      </div>
    );
  };

  const trocaDeTipo = editando && valores && valores.tipo !== tipo && (valores.documento || valores.tipo === "PESSOA_JURIDICA");

  return (
    <form onSubmit={(e) => enviar(e)} noValidate className="space-y-6">
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      {clienteId && <input type="hidden" name="clienteId" value={clienteId} />}
      {!editando && modo === "tela" && <input type="hidden" name="destino" value="detalhe" />}

      <fieldset className="space-y-4">
        <legend className={cn(rotulo, modo === "tela" && "text-base font-bold")}>{modo === "tela" ? "Identificação" : "Tipo de cliente"}</legend>
        <div role="radiogroup" aria-label="Tipo de cliente" className="inline-flex flex-wrap gap-1 rounded-[22px] bg-muted p-1">
          {TIPOS_CLIENTE.map((t) => (
            <label
              key={t}
              className={cn(
                "cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-ring",
                tipo === t ? "bg-estrutura text-estrutura-foreground" : "text-foreground hover:bg-accent",
              )}
            >
              <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => trocarTipo(t)} className="sr-only" />
              {ROTULO_TIPO_CLIENTE[t]}
            </label>
          ))}
        </div>
        {trocaDeTipo && (
          <p className="rounded-xl bg-status-warn-bg px-4 py-3 text-sm text-status-warn">
            {valores?.tipo === "PESSOA_FISICA"
              ? "Ao salvar, o CPF será removido."
              : "Ao salvar, o CNPJ, o nome fantasia, as inscrições e o nome de quem compra serão removidos."}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {campo("nome", { rotuloTexto: empresa ? "Razão social" : "Nome", maxLength: empresa ? MAX_NOME_PJ : MAX_NOME_PF, autoComplete: "off", className: "sm:col-span-2" })}
          {empresa && campo("nomeFantasia", { rotuloTexto: "Nome fantasia (opcional)", maxLength: 150, autoComplete: "off", className: "sm:col-span-2" })}
          <div className="sm:col-span-2">
            <label htmlFor={p("documento")} className={rotulo}>
              {empresa ? "CNPJ (opcional)" : "CPF (opcional)"}
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id={p("documento")}
                name="documento"
                value={v.documento}
                onChange={(e) => atualizar("documento", e.target.value)}
                onBlur={() => {
                  const d = empresa ? normalizarCnpj(v.documento) : normalizarCpf(v.documento);
                  if (d) atualizar("documento", empresa ? formatarCnpj(d) : formatarCpf(d));
                }}
                inputMode={empresa ? undefined : "numeric"}
                autoCapitalize={empresa ? "characters" : undefined}
                spellCheck={false}
                autoComplete="off"
                placeholder={empresa ? "00.000.000/0000-00" : "000.000.000-00"}
                aria-invalid={erros.documento ? true : undefined}
                aria-describedby={descreve("documento", empresa ? `${p("documento")}-situacao` : undefined)}
                className={cn(classeDoCampo(erros.documento), "min-w-0 flex-1 basis-56")}
              />
              {empresa && (
                <button type="button" onClick={consultarCnpj} disabled={consultando || !normalizarCnpj(v.documento)} className={classeDoBotao("secundario")}>
                  <Search aria-hidden="true" />
                  Buscar dados do CNPJ
                </button>
              )}
            </div>
            {empresa && (
              <p id={`${p("documento")}-situacao`} aria-live="polite" className="mt-1.5 text-xs text-muted-foreground empty:hidden">
                {situacaoCnpj}
              </p>
            )}
            <MensagemDeCampo id={`${p("documento")}-erro`} erro={erros.documento} />
          </div>
          {empresa && (
            <>
              <div>
                <label htmlFor={p("situacaoIe")} className={rotulo}>
                  Inscrição estadual
                </label>
                <select
                  id={p("situacaoIe")}
                  name="situacaoIe"
                  value={v.situacaoIe}
                  onChange={(e) => atualizar("situacaoIe", e.target.value)}
                  aria-invalid={erros.situacaoIe ? true : undefined}
                  aria-describedby={descreve("situacaoIe")}
                  className={classeDoCampo(erros.situacaoIe)}
                >
                  <option value="">Não informada</option>
                  {SITUACOES_IE.map((s) => (
                    <option key={s} value={s}>
                      {ROTULO_SITUACAO_IE[s]}
                    </option>
                  ))}
                </select>
                <MensagemDeCampo id={`${p("situacaoIe")}-erro`} erro={erros.situacaoIe} />
              </div>
              {v.situacaoIe === "CONTRIBUINTE" ? (
                campo("inscricaoEstadual", { rotuloTexto: "Número da inscrição estadual", maxLength: 20, autoCapitalize: "characters", spellCheck: false, autoComplete: "off" })
              ) : (
                <div className="hidden sm:block" aria-hidden="true" />
              )}
              {campo("inscricaoMunicipal", { rotuloTexto: "Inscrição municipal (opcional)", maxLength: 25, autoCapitalize: "characters", spellCheck: false, autoComplete: "off" })}
              {campo("nomeContato", { rotuloTexto: "Nome de quem compra (opcional)", maxLength: 120, autoComplete: "off" })}
            </>
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className={cn(rotulo, modo === "tela" && "text-base font-bold")}>Contato</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {campo("telefone", {
            rotuloTexto: "Telefone (opcional)",
            type: "tel",
            inputMode: "tel",
            autoComplete: "off",
            placeholder: "(11) 98765-4321",
            onBlur: () => {
              const t = normalizarTelefone(v.telefone);
              if (t) atualizar("telefone", formatarTelefone(t));
            },
          })}
          {campo("email", { rotuloTexto: "E-mail (opcional)", type: "email", inputMode: "email", autoComplete: "off", maxLength: 254 })}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        {modo === "venda" ? (
          <button
            type="button"
            onClick={() => setEnderecoAberto((a) => !a)}
            aria-expanded={enderecoAberto}
            aria-controls={p("endereco")}
            className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", enderecoAberto && "rotate-180")} />
            Endereço (para nota fiscal)
          </button>
        ) : (
          <legend className={cn(rotulo, "text-base font-bold")}>Endereço (para nota fiscal)</legend>
        )}
        <div id={p("endereco")} hidden={!enderecoAberto} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor={p("cep")} className={rotulo}>
                CEP
              </label>
              <input
                id={p("cep")}
                name="cep"
                value={v.cep}
                onChange={(e) => {
                  atualizar("cep", e.target.value);
                  consultarCep(e.target.value);
                }}
                onBlur={() => {
                  const c = normalizarCep(v.cep);
                  if (c) atualizar("cep", formatarCep(c));
                }}
                inputMode="numeric"
                autoComplete="off"
                placeholder="00000-000"
                aria-invalid={erros.cep ? true : undefined}
                aria-describedby={descreve("cep", `${p("cep")}-situacao`)}
                className={classeDoCampo(erros.cep)}
              />
              <p id={`${p("cep")}-situacao`} aria-live="polite" className="mt-1.5 text-xs text-muted-foreground empty:hidden">
                {situacaoCep}
              </p>
              <MensagemDeCampo id={`${p("cep")}-erro`} erro={erros.cep} />
            </div>
            {campo("logradouro", { rotuloTexto: "Rua, avenida…", maxLength: 120, autoComplete: "off", className: "sm:col-span-2" })}
            {campo("numero", { rotuloTexto: "Número", maxLength: 30, autoComplete: "off" })}
            {campo("complemento", { rotuloTexto: "Complemento", maxLength: 30, autoComplete: "off", className: "sm:col-span-2" })}
            {campo("bairro", { rotuloTexto: "Bairro", maxLength: 120, autoComplete: "off" })}
            {campo("municipio", { rotuloTexto: "Município", maxLength: 120, autoComplete: "off" })}
            <div>
              <label htmlFor={p("uf")} className={rotulo}>
                UF
              </label>
              <select
                id={p("uf")}
                name="uf"
                value={v.uf}
                onChange={(e) => atualizar("uf", e.target.value)}
                aria-invalid={erros.uf ? true : undefined}
                aria-describedby={descreve("uf")}
                className={classeDoCampo(erros.uf)}
              >
                <option value="">—</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
              <MensagemDeCampo id={`${p("uf")}-erro`} erro={erros.uf} />
            </div>
          </div>
        </div>
      </fieldset>

      {pendente && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl bg-status-warn-bg px-4 py-3 text-sm text-status-warn sm:flex-row sm:items-center sm:justify-between">
          <span>{pendente.texto}</span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setV((a) => ({ ...a, ...pendente.valores }));
                setPendente(null);
              }}
              className={classeDoBotao("secundario", "sm")}
            >
              Trocar
            </button>
            <button type="button" onClick={() => setPendente(null)} className={classeDoBotao("fantasma", "sm")}>
              Manter o que digitei
            </button>
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-5">
        <button type="submit" disabled={enviando} className={classeDoBotao("principal", modo === "tela" ? "lg" : "md")}>
          {editando ? "Salvar alterações" : "Cadastrar cliente"}
        </button>
        {cancelarHref ? (
          <Link href={cancelarHref} className={classeDoBotao("fantasma")}>
            Cancelar
          </Link>
        ) : (
          aoCancelar && (
            <button type="button" onClick={aoCancelar} className={classeDoBotao("secundario")}>
              Cancelar
            </button>
          )
        )}
      </div>
    </form>
  );
}
