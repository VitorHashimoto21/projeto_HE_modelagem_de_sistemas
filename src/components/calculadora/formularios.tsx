"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Aviso, MensagemDeCampo } from "@/components/acesso/campos";
import { classeDoCampo } from "@/components/ui/classes";
import { camposDoFormulario, type ErrosDeCampo } from "@/lib/auth/validacao";
import { acaoConfirmarPreco, acaoSalvarParametros } from "@/lib/calculadora/acoes";
import { CONFIRMACAO_INICIAL } from "@/lib/calculadora/servicos";
import { faturamentoSugerido, validarParametros } from "@/lib/calculadora/validacao";
import { lerNumero } from "@/lib/dominio/catalogo";
import { reaisDeCentavos } from "@/lib/dominio/venda";

const botao =
  "inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70";

/**
 * Confirmar o preço (UC10a, OPEN-004): o exato (arredondado para cima ao centavo) ou o próximo
 * real inteiro. O servidor recalcula e só grava se o valor for o mesmo que a pessoa vê aqui.
 */
export function FormularioConfirmacao({ itemId, margem, precoCentavos, arredondadoCentavos }: { itemId: string; margem: string; precoCentavos: number; arredondadoCentavos: number }) {
  const [estado, executar, enviando] = useActionState(acaoConfirmarPreco, CONFIRMACAO_INICIAL);
  const [escolha, setEscolha] = useState<"exato" | "real">("exato");
  const visto = escolha === "real" ? arredondadoCentavos : precoCentavos;
  const iguais = arredondadoCentavos === precoCentavos;

  if (estado.status === "confirmado") return <Aviso tipo="sucesso">{estado.mensagem}</Aviso>;
  return (
    <form action={executar} className="space-y-4">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="margem" value={margem} />
      <input type="hidden" name="precoVisto" value={visto} />
      <input type="hidden" name="arredondar" value={escolha} />
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      {estado.status === "mudou" && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      {!iguais && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-foreground">Preço a confirmar</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["exato", `${reaisDeCentavos(precoCentavos)} (calculado)`],
                ["real", `${reaisDeCentavos(arredondadoCentavos)} (arredondado para cima)`],
              ] as const
            ).map(([valor, texto]) => (
              <label key={valor} className="flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-foreground has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20">
                <input type="radio" name="escolha" checked={escolha === valor} onChange={() => setEscolha(valor)} className="accent-[var(--color-primary)]" />
                {texto}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <button type="submit" disabled={enviando || estado.status === "mudou"} className={botao}>
        {enviando ? "Confirmando…" : `Confirmar ${reaisDeCentavos(visto)} como preço oficial`}
      </button>
      {estado.status === "mudou" && <p className="text-xs text-muted-foreground">Recarregue a página para ver o cálculo atualizado.</p>}
    </form>
  );
}

export type ParametrosExibidos = {
  taxaCartao: string;
  capacidadeMensal: string;
  unidadeCapacidade: string;
  ticketMedio: string;
  faturamentoEstimado: string;
  cmvEstimado: string;
  margemMeta: string;
};

function Campo({ id, rotulo, erro, dica, children }: { id: string; rotulo: string; erro?: string; dica?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {rotulo}
      </label>
      {children}
      {dica && !erro && <p className="mt-1 text-xs text-muted-foreground">{dica}</p>}
      <MensagemDeCampo id={`${id}-erro`} erro={erro} />
    </div>
  );
}

/** Parâmetros de precificação (UC16, 5.5): o faturamento estimado sugerido é capacidade × ticket. */
export function FormularioParametros({ atuais }: { atuais: ParametrosExibidos }) {
  const [estado, executar, enviando] = useActionState(acaoSalvarParametros, { status: "ocioso" } as const);
  const [locais, setLocais] = useState<ErrosDeCampo | null>(null);
  const [visto, setVisto] = useState<typeof estado>(estado);
  const [capacidade, setCapacidade] = useState(atuais.capacidadeMensal);
  const [ticket, setTicket] = useState(atuais.ticketMedio);
  if (estado !== visto) {
    setVisto(estado);
    setLocais(null);
  }
  const erros = locais ?? (estado.status === "erro" ? estado.erros : {});
  const c = lerNumero(capacidade);
  const t = lerNumero(ticket);
  const sugerido = c && t && c > 0 && t > 0 ? faturamentoSugerido(c, Math.round(t * 100)) : null;

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    const v = validarParametros(camposDoFormulario(new FormData(e.currentTarget)));
    if (!v.ok) {
      e.preventDefault();
      setLocais(v.erros);
    } else setLocais({});
  }
  const campo = (nome: keyof ParametrosExibidos, rotulo: string, props: { dica?: string; placeholder?: string; onChange?: (v: string) => void } = {}) => (
    <Campo id={nome} rotulo={rotulo} erro={erros[nome]} dica={props.dica}>
      <input
        id={nome}
        name={nome}
        inputMode={nome === "unidadeCapacidade" ? "text" : "decimal"}
        defaultValue={atuais[nome]}
        placeholder={props.placeholder}
        aria-invalid={erros[nome] ? true : undefined}
        aria-describedby={erros[nome] ? `${nome}-erro` : undefined}
        onChange={(e) => {
          props.onChange?.(e.target.value);
          if (erros[nome]) setLocais({ ...erros, [nome]: undefined });
        }}
        className={classeDoCampo(erros[nome])}
      />
    </Campo>
  );

  return (
    <form action={executar} onSubmit={aoEnviar} noValidate className="space-y-6">
      {estado.status === "salvo" && <Aviso tipo="sucesso">{estado.mensagem}</Aviso>}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-card-foreground">Vendas no cartão</h2>
        <div className="sm:max-w-xs">{campo("taxaCartao", "Taxa média da maquininha (%)", { placeholder: "Ex.: 3,5", dica: "Entra como despesa variável em todo preço." })}</div>
      </section>
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-card-foreground">Estimativas para começar</h2>
          <p className="text-sm text-muted-foreground">Usadas enquanto ainda não há vendas nos meses anteriores. Depois, valem os números reais.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {campo("capacidadeMensal", "Capacidade por mês", { placeholder: "Ex.: 120", onChange: setCapacidade })}
          {campo("unidadeCapacidade", "Unidade", { placeholder: "Ex.: atendimentos" })}
          {campo("ticketMedio", "Ticket médio (R$)", { placeholder: "Ex.: 60", onChange: setTicket })}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {campo("faturamentoEstimado", "Faturamento mensal estimado (R$)", {
            placeholder: sugerido ? (sugerido / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "Ex.: 7.200",
            dica: sugerido ? `Sugerido: capacidade × ticket = ${reaisDeCentavos(sugerido)}. Deixe vazio para usar a sugestão.` : "Capacidade × ticket médio, ou informe o seu.",
          })}
          {campo("cmvEstimado", "Custo dos produtos e insumos (% do faturamento)", { placeholder: "Ex.: 30", dica: "CMV% estimado, usado no ponto de equilíbrio." })}
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-card-foreground">Objetivo</h2>
        <div className="sm:max-w-xs">{campo("margemMeta", "Margem de lucro desejada no mês (%)", { placeholder: "Ex.: 20", dica: "Usada no faturamento meta." })}</div>
      </section>
      <button type="submit" disabled={enviando} className={botao}>
        {enviando ? "Salvando…" : "Salvar parâmetros"}
      </button>
    </form>
  );
}
