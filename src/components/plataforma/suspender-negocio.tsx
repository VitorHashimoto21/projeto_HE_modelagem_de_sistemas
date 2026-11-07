"use client";

import { OctagonPause, Play } from "lucide-react";
import { useState, type FormEvent } from "react";
import { MensagemDeCampo } from "@/components/acesso/campos";
import type { Autenticador } from "@/components/segundo-fator/codigo";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao } from "@/components/ui/estilos";
import { Gaveta } from "@/components/ui/gaveta";
import { camposDoFormulario } from "@/lib/auth/validacao";
import {
  MAX_DESCRICAO_DA_SUSPENSAO,
  MOTIVOS_DA_SUSPENSAO,
  ROTULO_MOTIVO_DA_SUSPENSAO,
  validarReativacao,
  validarSuspensao,
  type CampoDaSuspensao,
  type MotivoDaSuspensao,
} from "@/lib/dominio/suspensao";
import { acaoReativarNegocio, acaoSuspenderNegocio } from "@/lib/plataforma/acoes";
import { SUSPENSAO_INICIAL } from "@/lib/plataforma/servicos";
import { cn } from "@/lib/utils";
import { useAcaoCritica } from "./use-acao-critica";

// Suspender e reativar o negócio (SPEC-019, 5.7 — OPEN-011, OPEN-012): um Administrador, numa gaveta, com o
// código pedido de novo se passaram 10 min. Suspender pede o motivo da lista e a descrição; reativar, a
// descrição. Os componentes ficam montados depois do sucesso, para o aviso sair da resposta da ação.

const rotulo = "mb-1.5 block text-sm font-medium text-foreground";

const opcao = (ativa: boolean) =>
  cn(
    "flex cursor-pointer items-start gap-3 rounded-lg px-4 py-3 text-sm ring-1 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
    ativa ? "bg-card ring-primary" : "bg-muted ring-transparent",
  );

function Descricao({ id, erro, placeholder, dica }: { id: string; erro?: string; placeholder: string; dica: string }) {
  return (
    <div>
      <label htmlFor={id} className={rotulo}>
        Descrição
      </label>
      <textarea
        id={id}
        name="descricao"
        rows={4}
        maxLength={MAX_DESCRICAO_DA_SUSPENSAO}
        placeholder={placeholder}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-dica ${id}-erro` : `${id}-dica`}
        className={classeDoCampo(erro)}
      />
      <p id={`${id}-dica`} className="mt-1 text-xs text-muted-foreground">
        Até {MAX_DESCRICAO_DA_SUSPENSAO} caracteres. {dica}
      </p>
      <MensagemDeCampo id={`${id}-erro`} erro={erro} />
    </div>
  );
}

export function SuspenderNegocio({
  negocioId,
  negocio,
  autenticadores,
  disponivel,
}: {
  negocioId: string;
  negocio: string;
  autenticadores: Autenticador[];
  /** Negócio não encerrado e ainda não suspenso. */
  disponivel: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const { estado, enviar, enviando, dialogo } = useAcaoCritica(acaoSuspenderNegocio, SUSPENSAO_INICIAL, autenticadores);
  const [motivo, setMotivo] = useState<MotivoDaSuspensao | null>(null);
  const [locais, setLocais] = useState<Partial<Record<CampoDaSuspensao, string>> | null>(null);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    setLocais(null);
    if (estado.status === "ok") setAberta(false);
  }
  const erros = locais ?? (estado.status === "erro" ? (estado.erros ?? {}) : {});

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const v = validarSuspensao(camposDoFormulario(dados));
    setLocais(v.ok ? {} : v.erros);
    if (v.ok) enviar(dados);
  }

  return (
    <Gaveta
      aberta={aberta && disponivel}
      aoMudar={setAberta}
      titulo="Suspender o negócio"
      descricao={`O ${negocio} fica somente leitura até a reativação: os membros continuam vendo e exportando os dados, mas nada é gravado. Nada é apagado, e o Dono é avisado na hora.`}
      gatilho={
        <button type="button" disabled={!disponivel} className={classeDoBotao("perigo")}>
          <OctagonPause aria-hidden="true" />
          Suspender
        </button>
      }
    >
      <form onSubmit={aoEnviar} onChange={() => Object.keys(erros).length > 0 && setLocais({})} noValidate className="space-y-5">
        <input type="hidden" name="negocioId" value={negocioId} />
        {estado.status === "erro" && estado.mensagem && (
          <p role="alert" className="rounded-lg bg-status-danger-bg px-4 py-3 text-sm text-status-danger">
            {estado.mensagem}
          </p>
        )}

        <fieldset aria-describedby={erros.motivo ? "motivo-suspensao-erro" : undefined}>
          <legend className={rotulo}>Motivo</legend>
          <div className="space-y-2">
            {MOTIVOS_DA_SUSPENSAO.map((m) => (
              <label key={m} className={opcao(motivo === m)}>
                <input type="radio" name="motivo" value={m} checked={motivo === m} onChange={() => setMotivo(m)} className="mt-0.5 size-4 accent-primary" />
                <span className="font-medium text-foreground">{ROTULO_MOTIVO_DA_SUSPENSAO[m]}</span>
              </label>
            ))}
          </div>
          <MensagemDeCampo id="motivo-suspensao-erro" erro={erros.motivo} />
        </fieldset>

        <Descricao
          id="descricao-suspensao"
          erro={erros.descricao}
          placeholder="Ex.: pedido do Dono por e-mail em 07/11, depois de um acesso não reconhecido"
          dica="O Dono lê esta descrição em Acessos do suporte."
        />

        <div className="rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
          <p className="font-medium">Enquanto durar a suspensão:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            <li>os membros veem a faixa e todos os dados, e toda gravação é recusada;</li>
            <li>a exportação e a exclusão de conta continuam, e convites pendentes não são aceitos;</li>
            <li>o Dono continua liberando o suporte, sem correções; a emergência e a troca de plano continuam;</li>
            <li>a rotina diária pula o negócio, e a conferência do Financeiro volta na reativação.</li>
          </ul>
        </div>

        <button type="submit" disabled={enviando} className={classeDoBotao("perigo", "md", "w-full sm:w-auto")}>
          {enviando ? "Suspendendo…" : "Suspender o negócio"}
        </button>
      </form>
      {dialogo}
    </Gaveta>
  );
}

export function ReativarNegocio({
  negocioId,
  negocio,
  autenticadores,
  disponivel,
}: {
  negocioId: string;
  negocio: string;
  autenticadores: Autenticador[];
  /** Negócio suspenso. */
  disponivel: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const { estado, enviar, enviando, dialogo } = useAcaoCritica(acaoReativarNegocio, SUSPENSAO_INICIAL, autenticadores);
  const [local, setLocal] = useState<string | null>(null);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    setLocal(null);
    if (estado.status === "ok") setAberta(false);
  }
  const erro = local ?? (estado.status === "erro" ? estado.erros?.descricao : undefined);

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const v = validarReativacao(camposDoFormulario(dados));
    setLocal(v.ok ? null : v.erro);
    if (v.ok) enviar(dados);
  }

  return (
    <Gaveta
      aberta={aberta && disponivel}
      aoMudar={setAberta}
      titulo="Reativar o negócio"
      descricao={`A faixa some e a gravação volta para a equipe do ${negocio}. O Dono é avisado, e a reativação fica no registro com a descrição.`}
      gatilho={
        <button type="button" disabled={!disponivel} className={classeDoBotao("principal")}>
          <Play aria-hidden="true" />
          Reativar
        </button>
      }
    >
      <form onSubmit={aoEnviar} noValidate className="space-y-5">
        <input type="hidden" name="negocioId" value={negocioId} />
        {estado.status === "erro" && estado.mensagem && (
          <p role="alert" className="rounded-lg bg-status-danger-bg px-4 py-3 text-sm text-status-danger">
            {estado.mensagem}
          </p>
        )}
        <Descricao
          id="descricao-reativacao"
          erro={erro ?? undefined}
          placeholder="Ex.: incidente resolvido; o Dono trocou a senha e revisou a equipe"
          dica="O Dono lê esta descrição em Acessos do suporte."
        />
        <button type="submit" disabled={enviando} className={classeDoBotao("principal", "md", "w-full sm:w-auto")}>
          {enviando ? "Reativando…" : "Reativar o negócio"}
        </button>
      </form>
      {dialogo}
    </Gaveta>
  );
}
