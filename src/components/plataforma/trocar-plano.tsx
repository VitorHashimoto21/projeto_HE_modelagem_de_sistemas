"use client";

import { ArrowLeftRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { MensagemDeCampo } from "@/components/acesso/campos";
import type { Autenticador } from "@/components/segundo-fator/codigo";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao } from "@/components/ui/estilos";
import { Gaveta } from "@/components/ui/gaveta";
import { camposDoFormulario } from "@/lib/auth/validacao";
import {
  DICA_DO_MOTIVO_DA_TROCA,
  MAX_DESCRICAO_DO_PEDIDO,
  MENSAGENS_DA_PLATAFORMA,
  MOTIVOS_DA_TROCA,
  ROTULO_MOTIVO_DA_TROCA,
  validarPedidoDePlano,
  type CampoDoPedidoDePlano,
  type MotivoDaTroca,
} from "@/lib/dominio/plataforma";
import { ROTULO_PLANO, type Plano } from "@/lib/dominio/planos";
import { acaoPedirTrocaDePlano } from "@/lib/plataforma/acoes";
import { PEDIDO_INICIAL } from "@/lib/plataforma/servicos";
import { cn } from "@/lib/utils";
import { useAcaoCritica } from "./use-acao-critica";

// Trocar o plano pela plataforma (SPEC-019, 5.8): o Administrador A pede, numa gaveta, com o plano de
// destino, o motivo da lista e a descrição; o código é pedido de novo se passaram 10 min. A troca só
// acontece quando outra conta de Administrador aprovar, em até 12 h.

const rotulo = "mb-1.5 block text-sm font-medium text-foreground";
const PLANOS: Plano[] = ["GRATUITO", "PAGO"];

const opcao = (ativa: boolean, desligada = false) =>
  cn(
    "flex cursor-pointer items-start gap-3 rounded-lg px-4 py-3 text-sm ring-1 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
    ativa ? "bg-card ring-primary" : "bg-muted ring-transparent",
    desligada && "cursor-not-allowed opacity-60",
  );

export function TrocarPlano({
  negocioId,
  negocio,
  planoAtual,
  autenticadores,
  umaContaSo,
  disponivel,
}: {
  negocioId: string;
  negocio: string;
  planoAtual: Plano;
  autenticadores: Autenticador[];
  /** CA-16: com uma conta só de Administrador, ninguém aprova, e o pedido expira. */
  umaContaSo: boolean;
  /** Sem pedido de plano pendente e com o negócio não encerrado. Desligado, o botão fica na tela. */
  disponivel: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const { estado, enviar, enviando, dialogo } = useAcaoCritica(acaoPedirTrocaDePlano, PEDIDO_INICIAL, autenticadores);
  const [para, setPara] = useState<Plano>(planoAtual === "PAGO" ? "GRATUITO" : "PAGO");
  const [motivo, setMotivo] = useState<MotivoDaTroca | null>(null);
  const [locais, setLocais] = useState<Partial<Record<CampoDoPedidoDePlano, string>> | null>(null);
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
    const v = validarPedidoDePlano(camposDoFormulario(dados));
    setLocais(v.ok ? {} : v.erros);
    if (v.ok) enviar(dados);
  }

  return (
    <Gaveta
      aberta={aberta && disponivel}
      aoMudar={setAberta}
      titulo="Trocar o plano"
      descricao={`Pedido de troca do plano do ${negocio}. Só vale com a aprovação de outra conta de Administrador, em até 12 horas.`}
      gatilho={
        <button type="button" disabled={!disponivel} className={classeDoBotao("secundario")}>
          <ArrowLeftRight aria-hidden="true" />
          Trocar plano
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
        {umaContaSo && <p className="rounded-lg bg-status-warn-bg px-4 py-3 text-sm text-status-warn">{MENSAGENS_DA_PLATAFORMA.semOutraConta}</p>}

        <fieldset aria-describedby={erros.para ? "para-erro" : undefined}>
          <legend className={rotulo}>Plano de destino</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PLANOS.map((p) => {
              const atual = p === planoAtual;
              return (
                <label key={p} className={opcao(para === p, atual)}>
                  <input type="radio" name="para" value={p} checked={para === p} disabled={atual} onChange={() => setPara(p)} className="mt-0.5 size-4 accent-primary" />
                  <span className="font-medium text-foreground">
                    {ROTULO_PLANO[p]}
                    {atual && <span className="block text-xs font-normal text-muted-foreground">plano atual</span>}
                  </span>
                </label>
              );
            })}
          </div>
          <MensagemDeCampo id="para-erro" erro={erros.para} />
        </fieldset>

        <fieldset aria-describedby={erros.motivo ? "motivo-troca-erro" : undefined}>
          <legend className={rotulo}>Motivo</legend>
          <div className="space-y-2">
            {MOTIVOS_DA_TROCA.map((m) => (
              <label key={m} className={opcao(motivo === m)}>
                <input type="radio" name="motivo" value={m} checked={motivo === m} onChange={() => setMotivo(m)} className="mt-0.5 size-4 accent-primary" />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{ROTULO_MOTIVO_DA_TROCA[m]}</span>
                  <span className="block text-xs text-muted-foreground">{DICA_DO_MOTIVO_DA_TROCA[m]}</span>
                </span>
              </label>
            ))}
          </div>
          <MensagemDeCampo id="motivo-troca-erro" erro={erros.motivo} />
        </fieldset>

        <div>
          <label htmlFor="descricao-troca" className={rotulo}>
            Descrição
          </label>
          <textarea
            id="descricao-troca"
            name="descricao"
            rows={3}
            maxLength={MAX_DESCRICAO_DO_PEDIDO}
            placeholder="Ex.: cortesia de 3 meses combinada com o Dono no atendimento de hoje"
            aria-invalid={erros.descricao ? true : undefined}
            aria-describedby={erros.descricao ? "descricao-troca-dica descricao-troca-erro" : "descricao-troca-dica"}
            className={classeDoCampo(erros.descricao)}
          />
          <p id="descricao-troca-dica" className="mt-1 text-xs text-muted-foreground">
            Até {MAX_DESCRICAO_DO_PEDIDO} caracteres. Quem aprova e o Dono leem esta descrição.
          </p>
          <MensagemDeCampo id="descricao-troca-erro" erro={erros.descricao} />
        </div>

        <div className="rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
          <p className="font-medium">Na aprovação:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {para === "PAGO" ? (
              <>
                <li>os recursos do pago ficam disponíveis na hora, e quem estava sem acesso pelo limite do gratuito volta;</li>
                <li>simulação: nenhuma cobrança é feita.</li>
              </>
            ) : (
              <>
                <li>nada é apagado; as listas passam a mostrar os últimos 12 meses;</li>
                <li>com mais de um colaborador com acesso, todos ficam sem acesso até o Dono escolher quem continua; os convites pendentes são cancelados.</li>
              </>
            )}
            <li>o Dono é avisado na tela Plano, em Acessos do suporte e por e-mail.</li>
          </ul>
        </div>

        <button type="submit" disabled={enviando} className={classeDoBotao("principal", "md", "w-full sm:w-auto")}>
          {enviando ? "Enviando…" : "Pedir a troca"}
        </button>
      </form>
      {dialogo}
    </Gaveta>
  );
}
