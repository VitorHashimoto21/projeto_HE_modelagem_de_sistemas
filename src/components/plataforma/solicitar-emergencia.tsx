"use client";

import { Siren } from "lucide-react";
import { useState, type FormEvent } from "react";
import { MensagemDeCampo } from "@/components/acesso/campos";
import type { Autenticador } from "@/components/segundo-fator/codigo";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao } from "@/components/ui/estilos";
import { Gaveta } from "@/components/ui/gaveta";
import { camposDoFormulario } from "@/lib/auth/validacao";
import {
  DICA_DA_REFERENCIA,
  MAX_JUSTIFICATIVA,
  MAX_REFERENCIA,
  MOTIVOS_DA_EMERGENCIA,
  PRAZOS_DA_EMERGENCIA,
  ROTULO_MOTIVO_DA_EMERGENCIA,
  validarPedidoDeEmergencia,
  type CampoDaEmergencia,
  type MotivoDaEmergencia,
  type PrazoDaEmergencia,
} from "@/lib/dominio/emergencia";
import { MODULOS, ROTULO_MODULO, type Modulo } from "@/lib/dominio/permissoes";
import { MENSAGENS_DA_PLATAFORMA } from "@/lib/dominio/plataforma";
import { campoDoModulo, PRAZOS } from "@/lib/dominio/suporte";
import { acaoPedirEmergencia } from "@/lib/plataforma/acoes";
import { EMERGENCIA_INICIAL } from "@/lib/plataforma/servicos";
import { cn } from "@/lib/utils";
import { useAcaoCritica } from "./use-acao-critica";

// Solicitar acesso de emergência (SPEC-019, 5.6): só sem a liberação do Dono. O Administrador A pede, numa
// gaveta, com o motivo da lista, a referência, a justificativa, os módulos e o prazo; o código é pedido de
// novo se passaram 10 min. O Dono vê o pedido na hora, e o acesso só começa com a aprovação de outra conta.

const rotulo = "mb-1.5 block text-sm font-medium text-foreground";

const opcao = (ativa: boolean) =>
  cn(
    "flex cursor-pointer items-start gap-3 rounded-lg px-4 py-3 text-sm ring-1 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
    ativa ? "bg-card ring-primary" : "bg-muted ring-transparent",
  );

const pilula = (ativa: boolean) =>
  cn(
    "cursor-pointer rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
    ativa ? "bg-estrutura text-estrutura-foreground ring-estrutura" : "bg-card text-foreground ring-input",
  );

export function SolicitarEmergencia({
  negocioId,
  negocio,
  autenticadores,
  umaContaSo,
  disponivel,
}: {
  negocioId: string;
  negocio: string;
  autenticadores: Autenticador[];
  /** Com uma conta só de Administrador, ninguém aprova: a emergência não existe (falha fechada). */
  umaContaSo: boolean;
  /** Sem liberação ativa, sem outro pedido ou acesso de emergência e com o negócio não encerrado. */
  disponivel: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const { estado, enviar, enviando, dialogo } = useAcaoCritica(acaoPedirEmergencia, EMERGENCIA_INICIAL, autenticadores);
  const [motivo, setMotivo] = useState<MotivoDaEmergencia | null>(null);
  const [marcados, setMarcados] = useState<Modulo[]>([]);
  const [prazo, setPrazo] = useState<PrazoDaEmergencia>("1h");
  const [locais, setLocais] = useState<Partial<Record<CampoDaEmergencia, string>> | null>(null);
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
    const v = validarPedidoDeEmergencia(camposDoFormulario(dados));
    setLocais(v.ok ? {} : v.erros);
    if (v.ok) enviar(dados);
  }

  return (
    <Gaveta
      aberta={aberta && disponivel}
      aoMudar={setAberta}
      titulo="Solicitar acesso de emergência"
      descricao={`Acesso somente leitura ao ${negocio}, sem a liberação do Dono. O Dono vê o pedido na hora, e o acesso só começa com a aprovação de outra conta de Administrador, em até 12 horas.`}
      gatilho={
        <button type="button" disabled={!disponivel} className={classeDoBotao("perigo")}>
          <Siren aria-hidden="true" />
          Solicitar acesso de emergência
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

        <fieldset aria-describedby={erros.motivo ? "motivo-emergencia-erro" : undefined}>
          <legend className={rotulo}>Motivo</legend>
          <div className="space-y-2">
            {MOTIVOS_DA_EMERGENCIA.map((m) => (
              <label key={m} className={opcao(motivo === m)}>
                <input type="radio" name="motivo" value={m} checked={motivo === m} onChange={() => setMotivo(m)} className="mt-0.5 size-4 accent-primary" />
                <span className="font-medium text-foreground">{ROTULO_MOTIVO_DA_EMERGENCIA[m]}</span>
              </label>
            ))}
          </div>
          <MensagemDeCampo id="motivo-emergencia-erro" erro={erros.motivo} />
        </fieldset>

        <div>
          <label htmlFor="referencia-emergencia" className={rotulo}>
            Referência
          </label>
          <input
            id="referencia-emergencia"
            name="referencia"
            maxLength={MAX_REFERENCIA}
            aria-invalid={erros.referencia ? true : undefined}
            aria-describedby={erros.referencia ? "referencia-emergencia-dica referencia-emergencia-erro" : "referencia-emergencia-dica"}
            className={classeDoCampo(erros.referencia)}
          />
          <p id="referencia-emergencia-dica" className="mt-1 text-xs text-muted-foreground">
            {motivo ? DICA_DA_REFERENCIA[motivo] : "O processo ou ofício, o incidente, ou o membro que pediu e por qual canal."} Até {MAX_REFERENCIA} caracteres.
          </p>
          <MensagemDeCampo id="referencia-emergencia-erro" erro={erros.referencia} />
        </div>

        <div>
          <label htmlFor="justificativa-emergencia" className={rotulo}>
            Justificativa
          </label>
          <textarea
            id="justificativa-emergencia"
            name="justificativa"
            rows={3}
            maxLength={MAX_JUSTIFICATIVA}
            placeholder="Ex.: as vendas de ontem sumiram depois da falha; preciso ver o caixa para achar a causa"
            aria-invalid={erros.justificativa ? true : undefined}
            aria-describedby={erros.justificativa ? "justificativa-emergencia-dica justificativa-emergencia-erro" : "justificativa-emergencia-dica"}
            className={classeDoCampo(erros.justificativa)}
          />
          <p id="justificativa-emergencia-dica" className="mt-1 text-xs text-muted-foreground">
            Até {MAX_JUSTIFICATIVA} caracteres. Quem aprova e o Dono leem esta justificativa.
          </p>
          <MensagemDeCampo id="justificativa-emergencia-erro" erro={erros.justificativa} />
        </div>

        <fieldset aria-describedby={erros.modulos ? "modulos-emergencia-erro" : undefined}>
          <legend className={rotulo}>Módulos (somente leitura)</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODULOS.map((m) => {
              const marcado = marcados.includes(m);
              return (
                <label key={m} className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-foreground", marcado ? "bg-card ring-1 ring-primary" : "bg-muted")}>
                  <input
                    type="checkbox"
                    name={campoDoModulo(m)}
                    checked={marcado}
                    onChange={(e) => setMarcados((atuais) => (e.target.checked ? [...atuais, m] : atuais.filter((x) => x !== m)))}
                    className="size-4 accent-primary"
                  />
                  {ROTULO_MODULO[m]}
                </label>
              );
            })}
          </div>
          <MensagemDeCampo id="modulos-emergencia-erro" erro={erros.modulos} />
        </fieldset>

        <fieldset aria-describedby="prazo-emergencia-dica">
          <legend className={rotulo}>Por quanto tempo</legend>
          <div className="flex flex-wrap gap-2">
            {PRAZOS_DA_EMERGENCIA.map((p) => (
              <label key={p} className={pilula(prazo === p)}>
                <input type="radio" name="prazo" value={p} checked={prazo === p} onChange={() => setPrazo(p)} className="sr-only" />
                {PRAZOS[p].rotulo}
              </label>
            ))}
          </div>
          <p id="prazo-emergencia-dica" className="mt-2 text-xs text-muted-foreground">
            Conta da aprovação, sem renovação. Para continuar depois, é preciso um novo pedido.
          </p>
          <MensagemDeCampo id="prazo-emergencia-erro" erro={erros.prazo} />
        </fieldset>

        <div className="rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
          <p className="font-medium">Durante o acesso:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            <li>só você entra, somente leitura, sem exportar, com os clientes e fornecedores mascarados;</li>
            <li>cada tela aberta fica registrada, e os membros veem uma faixa vermelha;</li>
            <li>o Dono pode encerrar a qualquer momento;</li>
            <li>ao terminar, você registra o resultado. Sem ele, não há novo pedido.</li>
          </ul>
        </div>

        <button type="submit" disabled={enviando} className={classeDoBotao("perigo", "md", "w-full sm:w-auto")}>
          {enviando ? "Enviando…" : "Pedir o acesso"}
        </button>
      </form>
      {dialogo}
    </Gaveta>
  );
}
