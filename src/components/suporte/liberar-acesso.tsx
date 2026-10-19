"use client";

import { LifeBuoy } from "lucide-react";
import { useActionState, useEffect, useState, type FormEvent } from "react";
import { MensagemDeCampo } from "@/components/acesso/campos";
import { avisar } from "@/components/ui/avisar";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao } from "@/components/ui/estilos";
import { Gaveta } from "@/components/ui/gaveta";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { MODULOS, ROTULO_MODULO } from "@/lib/dominio/permissoes";
import { campoDoModulo, MAX_MOTIVO_SUPORTE, PRAZO_PADRAO, PRAZOS, validarLiberacao, type Prazo } from "@/lib/dominio/suporte";
import { acaoLiberarSuporte } from "@/lib/suporte/acoes";
import { LIBERACAO_INICIAL } from "@/lib/suporte/servicos";

// Liberar o acesso do suporte (SPEC-018, 5.4): motivo, módulos e prazo, numa gaveta. A
// validação roda aqui e de novo no servidor; o texto explica o que o suporte vai ver.

const rotulo = "mb-1.5 block text-sm font-medium text-foreground";

export function LiberarAcesso({ substitui }: { substitui: boolean }) {
  const [aberta, setAberta] = useState(false);
  const [estado, executar, enviando] = useActionState(acaoLiberarSuporte, LIBERACAO_INICIAL);
  const [locais, setLocais] = useState<Partial<Record<"motivo" | "modulos" | "prazo", string>> | null>(null);
  const [prazo, setPrazo] = useState<Prazo>(PRAZO_PADRAO);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    setLocais(null);
    if (estado.status === "ok") setAberta(false);
  }
  const erros = locais ?? (estado.status === "erro" ? (estado.erros ?? {}) : {});

  useEffect(() => {
    if (estado.status === "ok") avisar(estado.mensagem);
  }, [estado]);

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    const v = validarLiberacao(camposDoFormulario(new FormData(e.currentTarget)));
    if (!v.ok) {
      e.preventDefault();
      setLocais(v.erros);
    } else setLocais({});
  }

  return (
    <Gaveta
      aberta={aberta}
      aoMudar={setAberta}
      titulo="Liberar acesso ao suporte"
      descricao="O suporte do HE poderá ver (sem alterar) os módulos marcados até o fim do prazo. Nomes e contatos dos seus clientes e e-mails da equipe aparecem mascarados. Tudo fica registrado aqui e você pode revogar quando quiser."
      gatilho={
        <button type="button" className={classeDoBotao("principal")}>
          <LifeBuoy aria-hidden="true" />
          {substitui ? "Nova liberação" : "Liberar acesso ao suporte"}
        </button>
      }
    >
      <form action={executar} onSubmit={aoEnviar} onChange={() => Object.keys(erros).length > 0 && setLocais({})} noValidate className="space-y-5">
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
          <div className="grid gap-2 sm:grid-cols-2">
            {MODULOS.map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-3 rounded-lg bg-muted px-4 py-3 text-sm font-medium text-foreground has-[:checked]:bg-card has-[:checked]:ring-1 has-[:checked]:ring-primary">
                <input type="checkbox" name={campoDoModulo(m)} className="size-4 accent-primary" />
                {ROTULO_MODULO[m]}
              </label>
            ))}
          </div>
          {/* Valores não são mascarados (decisão de 18/10/2026): o Dono decide sabendo disso. */}
          <p id="modulos-suporte-dica" className="mt-2 text-xs text-muted-foreground">
            Os valores dos módulos marcados aparecem para o suporte: Vendas mostra o valor de cada venda e, com Dashboard e Financeiro, o suporte vê também o saldo, as entradas e as saídas.
          </p>
          <MensagemDeCampo id="modulos-suporte-erro" erro={erros.modulos} />
        </fieldset>

        <fieldset>
          <legend className={rotulo}>Por quanto tempo</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PRAZOS) as Prazo[]).map((p) => (
              <label key={p} className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold ring-1 ${prazo === p ? "bg-estrutura text-estrutura-foreground ring-estrutura" : "bg-card text-foreground ring-input"}`}>
                <input type="radio" name="prazo" value={p} checked={prazo === p} onChange={() => setPrazo(p)} className="sr-only" />
                {PRAZOS[p].rotulo}
              </label>
            ))}
          </div>
          <MensagemDeCampo id="prazo-suporte-erro" erro={erros.prazo} />
        </fieldset>

        <button type="submit" disabled={enviando} className={classeDoBotao("principal", "md", "w-full sm:w-auto")}>
          {enviando ? "Liberando…" : "Liberar acesso"}
        </button>
      </form>
    </Gaveta>
  );
}
