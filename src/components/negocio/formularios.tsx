"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import type { RegimeTributario } from "@/generated/prisma/enums";
import { Aviso, BotaoEnviar, MensagemDeCampo } from "@/components/acesso/campos";
import { camposDoFormulario, type ErrosDeCampo } from "@/lib/auth/validacao";
import { acaoCadastrarNegocio, acaoConsultarCnpj, acaoEditarNegocio } from "@/lib/negocio/acoes";
import { CONSULTA_INICIAL, FORMULARIO_INICIAL, type EstadoDoFormularioDeNegocio } from "@/lib/negocio/servicos";
import { validarNegocio } from "@/lib/negocio/validacao";
import { cnpjValido } from "@/lib/dominio/cnpj";
import { classeDoCampo } from "@/components/ui/classes";
import { CamposFiscais, type ValoresFiscais } from "./campos-fiscais";

type AcaoDoFormulario = (anterior: EstadoDoFormularioDeNegocio, form: FormData) => Promise<EstadoDoFormularioDeNegocio>;

/** Validação dupla (navegador + servidor), como nas telas de acesso (SPEC-002, CA-03). */
function useFormularioDeNegocio(acao: AcaoDoFormulario) {
  const [estado, executar] = useActionState(acao, FORMULARIO_INICIAL);
  const [locais, setLocais] = useState<ErrosDeCampo | null>(null);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    setLocais(null);
  }
  const erros = locais ?? (estado.status === "erro" ? (estado.erros ?? {}) : {});

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    const v = validarNegocio(camposDoFormulario(new FormData(e.currentTarget)));
    if (!v.ok) {
      e.preventDefault();
      setLocais(v.erros);
    } else setLocais({});
  }
  const limparErro = (campo: string) => erros[campo] && setLocais({ ...erros, [campo]: undefined });
  return { estado, executar, erros, aoEnviar, limparErro };
}

function Confirmacao({
  valores,
  regimes,
  avisos = [],
  aoVoltar,
}: {
  valores: ValoresFiscais;
  regimes: RegimeTributario[];
  avisos?: string[];
  aoVoltar: () => void;
}) {
  const { estado, executar, erros, aoEnviar, limparErro } = useFormularioDeNegocio(acaoCadastrarNegocio);
  return (
    <div className="space-y-5">
      {avisos.map((a) => (
        <p key={a} role="note" className="rounded-xl border border-status-warn/30 bg-status-warn-bg px-4 py-3 text-sm text-status-warn">
          {a}
        </p>
      ))}
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <form action={executar} onSubmit={aoEnviar} noValidate className="space-y-5">
        <CamposFiscais valores={valores} erros={erros} regimes={regimes} limparErro={limparErro} />
        <BotaoEnviar enviando="Cadastrando…">Cadastrar negócio</BotaoEnviar>
      </form>
      <button type="button" onClick={aoVoltar} className="text-sm font-medium text-primary underline-offset-2 hover:underline">
        ← Voltar
      </button>
    </div>
  );
}

function EtapaCnpj({ aoVoltar }: { aoVoltar: () => void }) {
  const [consulta, consultar, consultando] = useActionState(acaoConsultarCnpj, CONSULTA_INICIAL);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  if (consulta.status === "sugerido" && tentativa === 0) {
    const s = consulta.sugestao;
    return (
      <Confirmacao
        valores={{ ...s, cnpj: consulta.cnpj }}
        regimes={["MEI", "SIMPLES_NACIONAL"]}
        avisos={s.avisos}
        aoVoltar={() => setTentativa(1)}
      />
    );
  }
  if (consulta.status === "manual" && tentativa === 0) {
    return (
      <Confirmacao
        valores={{ cnpj: consulta.cnpj }}
        regimes={["MEI", "SIMPLES_NACIONAL"]}
        avisos={[consulta.mensagem]}
        aoVoltar={() => setTentativa(1)}
      />
    );
  }

  const erroDoServidor = consulta.status === "erro" ? (consulta.erros?.cnpj ?? consulta.mensagem) : undefined;
  const erro = erroLocal ?? (tentativa === 0 ? erroDoServidor : undefined);

  return (
    <div className="space-y-5">
      {consulta.status === "bloqueado" && tentativa === 0 && <Aviso tipo="erro">{consulta.mensagem}</Aviso>}
      <form
        action={(f) => {
          setTentativa(0);
          return consultar(f);
        }}
        onSubmit={(e) => {
          const valor = String(new FormData(e.currentTarget).get("cnpj") ?? "");
          if (!cnpjValido(valor)) {
            e.preventDefault();
            setErroLocal(valor.trim() ? "CNPJ inválido" : "Informe o CNPJ");
          } else setErroLocal(null);
        }}
        noValidate
        className="space-y-5"
      >
        <div>
          <label htmlFor="cnpj" className="mb-1.5 block text-sm font-medium text-foreground">
            CNPJ
          </label>
          <input
            id="cnpj"
            name="cnpj"
            inputMode="numeric"
            autoComplete="off"
            placeholder="00.000.000/0000-00"
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? "cnpj-erro" : "cnpj-ajuda"}
            onChange={() => setErroLocal(null)}
            className={classeDoCampo(erro)}
          />
          <p id="cnpj-ajuda" className="mt-1.5 text-xs text-muted-foreground">
            Buscamos razão social, atividade e regime na base pública da Receita Federal.
          </p>
          <MensagemDeCampo id="cnpj-erro" erro={erro} />
        </div>
        <button
          type="submit"
          disabled={consultando}
          className="flex w-full items-center justify-center rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
        >
          {consultando ? "Consultando…" : "Consultar CNPJ"}
        </button>
      </form>
      <button type="button" onClick={aoVoltar} className="text-sm font-medium text-primary underline-offset-2 hover:underline">
        ← Voltar
      </button>
    </div>
  );
}

/** Cadastro do negócio (UC0): escolha → CNPJ ou autônomo → confirmação. */
export function FormularioNovoNegocio() {
  const [modo, setModo] = useState<"inicio" | "cnpj" | "autonomo">("inicio");
  const [chave, setChave] = useState(0);
  const voltar = () => {
    setModo("inicio");
    setChave((c) => c + 1);
  };

  if (modo === "cnpj") return <EtapaCnpj key={chave} aoVoltar={voltar} />;
  if (modo === "autonomo") return <Confirmacao key={chave} valores={{ regime: "AUTONOMO" }} regimes={["AUTONOMO"]} aoVoltar={voltar} />;

  const opcao =
    "w-full rounded-2xl border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <button type="button" className={opcao} onClick={() => setModo("cnpj")}>
        <span className="block font-display text-lg font-semibold text-card-foreground">Tenho CNPJ</span>
        <span className="mt-1 block text-sm text-muted-foreground">MEI ou Simples Nacional. Preenchemos os dados pela Receita.</span>
      </button>
      <button type="button" className={opcao} onClick={() => setModo("autonomo")}>
        <span className="block font-display text-lg font-semibold text-card-foreground">Não tenho CNPJ</span>
        <span className="mt-1 block text-sm text-muted-foreground">Autônomo: você informa o percentual de imposto que paga.</span>
      </button>
    </div>
  );
}

/** "Dados do negócio" (5.5): edição pelo Dono. */
export function FormularioDadosDoNegocio({ valores }: { valores: ValoresFiscais }) {
  const { estado, executar, erros, aoEnviar, limparErro } = useFormularioDeNegocio(acaoEditarNegocio);
  const regimes: RegimeTributario[] = valores.cnpj ? ["MEI", "SIMPLES_NACIONAL"] : ["MEI", "SIMPLES_NACIONAL", "AUTONOMO"];
  return (
    <div className="space-y-5">
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <form action={executar} onSubmit={aoEnviar} noValidate className="space-y-5">
        <CamposFiscais valores={valores} erros={erros} regimes={regimes} limparErro={limparErro} cnpjEditavel={!valores.cnpj} />
        <BotaoEnviar enviando="Salvando…">Salvar</BotaoEnviar>
      </form>
      <Link href="/painel" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
        Cancelar
      </Link>
    </div>
  );
}
