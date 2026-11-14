"use client";

import { LifeBuoy } from "lucide-react";
import { useActionState, useEffect, useState, type FormEvent } from "react";
import { MensagemDeCampo } from "@/components/acesso/campos";
import { avisar } from "@/components/ui/avisar";
import { classeDoCampo } from "@/components/ui/classes";
import { enviarSemReiniciar } from "@/components/ui/envio";
import { classeDoBotao } from "@/components/ui/estilos";
import { Gaveta } from "@/components/ui/gaveta";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { correcoesDoModulo, ehCorrigivel, MENSAGENS_DAS_CORRECOES, PRAZOS_COM_CORRECAO } from "@/lib/dominio/correcoes";
import { MODULOS, ROTULO_MODULO, type Modulo } from "@/lib/dominio/permissoes";
import { campoDaCorrecao, campoDoModulo, MAX_MOTIVO_SUPORTE, PRAZO_PADRAO, PRAZOS, PRAZOS_DE_LEITURA, validarLiberacao, type Prazo } from "@/lib/dominio/suporte";
import { acaoLiberarSuporte } from "@/lib/suporte/acoes";
import { LIBERACAO_INICIAL } from "@/lib/suporte/servicos";
import { cn } from "@/lib/utils";

// Liberar o acesso do suporte (SPEC-018, 5.4): motivo, módulos e prazo, numa gaveta. A
// validação roda aqui e de novo no servidor; o texto explica o que o suporte vai ver.
// SPEC-019 (5.2): cada módulo com correções ganha "Ver" (padrão) ou "Ver e corrigir"; com alguma
// correção, a gaveta mostra o que o suporte poderá alterar e o prazo passa a ser 1 h ou 12 h.

const rotulo = "mb-1.5 block text-sm font-medium text-foreground";
const PRAZO_COM_CORRECAO: Prazo = "1h";

const pilula = (ativa: boolean) =>
  cn(
    "cursor-pointer rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
    ativa ? "bg-estrutura text-estrutura-foreground ring-estrutura" : "bg-card text-foreground ring-input",
  );

export function LiberarAcesso({ substitui }: { substitui: boolean }) {
  const [aberta, setAberta] = useState(false);
  const [estado, executar, enviando] = useActionState(acaoLiberarSuporte, LIBERACAO_INICIAL);
  const [locais, setLocais] = useState<Partial<Record<"motivo" | "modulos" | "prazo", string>> | null>(null);
  const [marcados, setMarcados] = useState<Modulo[]>([]);
  const [corrigir, setCorrigir] = useState<Modulo[]>([]);
  const [prazo, setPrazo] = useState<Prazo>(PRAZO_PADRAO);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    setLocais(null);
    if (estado.status === "ok") setAberta(false);
  }
  const erros = locais ?? (estado.status === "erro" ? (estado.erros ?? {}) : {});
  const comCorrecao = corrigir.length > 0;
  const prazos: readonly Prazo[] = comCorrecao ? PRAZOS_COM_CORRECAO : PRAZOS_DE_LEITURA;

  useEffect(() => {
    if (estado.status === "ok") avisar(estado.mensagem);
  }, [estado]);

  /** Mantém o prazo entre os oferecidos: 1 h ao ligar a correção; 24 h ao voltar para só leitura. */
  function ajustarPrazo(novos: Modulo[]) {
    const permitidos: readonly Prazo[] = novos.length > 0 ? PRAZOS_COM_CORRECAO : PRAZOS_DE_LEITURA;
    if (!permitidos.includes(prazo)) setPrazo(novos.length > 0 ? PRAZO_COM_CORRECAO : PRAZO_PADRAO);
  }

  function marcar(m: Modulo, ligado: boolean) {
    setMarcados((atuais) => (ligado ? [...atuais, m] : atuais.filter((x) => x !== m)));
    if (!ligado && corrigir.includes(m)) {
      const novos = corrigir.filter((x) => x !== m);
      setCorrigir(novos);
      ajustarPrazo(novos);
    }
  }

  function nivel(m: Modulo, comCorrecaoNoModulo: boolean) {
    const novos = comCorrecaoNoModulo ? [...corrigir.filter((x) => x !== m), m] : corrigir.filter((x) => x !== m);
    setCorrigir(novos);
    ajustarPrazo(novos);
  }

  /** Envio pela transição, para não perder o motivo e os módulos quando o servidor recusa. */
  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    enviarSemReiniciar(e, executar, (dados) => {
      const v = validarLiberacao(camposDoFormulario(dados));
      setLocais(v.ok ? {} : v.erros);
      return v.ok;
    });
  }

  return (
    <Gaveta
      aberta={aberta}
      aoMudar={setAberta}
      titulo="Liberar acesso ao suporte"
      descricao="O suporte do HE poderá ver os módulos marcados até o fim do prazo e, só se você escolher, corrigir alguns deles. Os dados dos seus clientes (nome, documento, contato e endereço) e os e-mails da equipe aparecem mascarados. Tudo fica registrado aqui e você pode revogar quando quiser."
      gatilho={
        <button type="button" className={classeDoBotao("principal")}>
          <LifeBuoy aria-hidden="true" />
          {substitui ? "Nova liberação" : "Liberar acesso ao suporte"}
        </button>
      }
    >
      <form onSubmit={aoEnviar} onChange={() => Object.keys(erros).length > 0 && setLocais({})} noValidate className="space-y-5">
        {estado.status === "erro" && estado.mensagem && (
          <p role="alert" className="rounded-lg bg-status-danger-bg px-4 py-3 text-sm text-status-danger">
            {estado.mensagem}
          </p>
        )}
        {substitui && (
          <p className="rounded-lg bg-status-warn-bg px-4 py-3 text-sm text-status-warn">A liberação ativa será encerrada e substituída por esta.</p>
        )}
        <div>
          <label htmlFor="motivo-suporte" className={rotulo}>
            O que o suporte precisa ver?
          </label>
          <textarea
            id="motivo-suporte"
            name="motivo"
            rows={3}
            maxLength={MAX_MOTIVO_SUPORTE}
            placeholder="Ex.: as vendas de ontem não aparecem no caixa"
            aria-invalid={erros.motivo ? true : undefined}
            aria-describedby={erros.motivo ? "motivo-suporte-erro" : undefined}
            className={classeDoCampo(erros.motivo)}
          />
          <MensagemDeCampo id="motivo-suporte-erro" erro={erros.motivo} />
        </div>

        <fieldset aria-describedby={erros.modulos ? "modulos-suporte-dica modulos-suporte-erro" : "modulos-suporte-dica"}>
          <legend className={rotulo}>Módulos que o suporte pode ver</legend>
          <div className="space-y-2">
            {MODULOS.map((m) => {
              const marcado = marcados.includes(m);
              const corrige = corrigir.includes(m);
              const podeCorrigir = ehCorrigivel(m);
              return (
                <div key={m} className={cn("rounded-lg px-4 py-3", marcado ? "bg-card ring-1 ring-primary" : "bg-muted")}>
                  <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-foreground">
                    <input type="checkbox" name={campoDoModulo(m)} checked={marcado} onChange={(e) => marcar(m, e.target.checked)} className="size-4 accent-primary" />
                    {ROTULO_MODULO[m]}
                  </label>
                  {marcado && podeCorrigir && (
                    <div className="mt-3 space-y-3 pl-7">
                      <div role="radiogroup" aria-label={`O que o suporte pode fazer em ${ROTULO_MODULO[m]}`} className="flex flex-wrap gap-2">
                        <label className={pilula(!corrige)}>
                          <input type="radio" name={campoDaCorrecao(m)} value="" checked={!corrige} onChange={() => nivel(m, false)} className="sr-only" />
                          Ver
                        </label>
                        <label className={pilula(corrige)}>
                          <input type="radio" name={campoDaCorrecao(m)} value="on" checked={corrige} onChange={() => nivel(m, true)} className="sr-only" />
                          Ver e corrigir
                        </label>
                      </div>
                      {corrige && (
                        <div className="text-sm text-muted-foreground">
                          <p className="font-medium text-foreground">O suporte poderá:</p>
                          <ul className="mt-1 list-disc space-y-0.5 pl-5">
                            {correcoesDoModulo(m).map((c) => (
                              <li key={c}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Valores não são mascarados (decisão de 18/10/2026): o Dono decide sabendo disso. */}
          <p id="modulos-suporte-dica" className="mt-2 text-xs text-muted-foreground">
            Os valores dos módulos marcados aparecem para o suporte: Vendas mostra o valor de cada venda e, com Dashboard e Financeiro, o suporte vê também o saldo, as entradas e as saídas.
          </p>
          <MensagemDeCampo id="modulos-suporte-erro" erro={erros.modulos} />
        </fieldset>

        {comCorrecao && <p className="rounded-lg bg-status-warn-bg px-4 py-3 text-sm text-status-warn">{MENSAGENS_DAS_CORRECOES.textoDaGaveta}</p>}

        <fieldset aria-describedby={comCorrecao ? "prazo-suporte-dica" : undefined}>
          <legend className={rotulo}>Por quanto tempo</legend>
          <div className="flex flex-wrap gap-2">
            {prazos.map((p) => (
              <label key={p} className={pilula(prazo === p)}>
                <input type="radio" name="prazo" value={p} checked={prazo === p} onChange={() => setPrazo(p)} className="sr-only" />
                {PRAZOS[p].rotulo}
              </label>
            ))}
          </div>
          {comCorrecao && (
            <p id="prazo-suporte-dica" className="mt-2 text-xs text-muted-foreground">
              Com correção, o prazo é de 1 hora ou 12 horas.
            </p>
          )}
          <MensagemDeCampo id="prazo-suporte-erro" erro={erros.prazo} />
        </fieldset>

        <button type="submit" disabled={enviando} className={classeDoBotao("principal", "md", "w-full sm:w-auto")}>
          {enviando ? "Liberando…" : "Liberar acesso"}
        </button>
      </form>
    </Gaveta>
  );
}
