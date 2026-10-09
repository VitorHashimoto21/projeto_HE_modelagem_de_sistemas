"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Aviso, MensagemDeCampo } from "@/components/acesso/campos";
import { classeDoCampo } from "@/components/ui/classes";
import { camposDoFormulario, type ErrosDeCampo } from "@/lib/auth/validacao";
import { MOTIVOS_SAIDA, somarDias } from "@/lib/dominio/estoque";
import { acaoDefinirMinimo, acaoRegistrarEntrada, acaoRegistrarSaida } from "@/lib/estoque/acoes";
import { ESTOQUE_INICIAL, type EstadoDoEstoque } from "@/lib/estoque/servicos";
import { acaoDefinirDiasCobertura, type EstadoDosDiasDeCobertura } from "@/lib/negocio/acoes";
import { validarMinimo, validarMovimentacao } from "@/lib/estoque/validacao";

type Acao = (anterior: EstadoDoEstoque, form: FormData) => Promise<EstadoDoEstoque>;

/** Estado + validação dupla (navegador e servidor), como nas outras telas. */
function useFormularioDoEstoque(acao: Acao, validar: (campos: Record<string, string>) => { ok: boolean; erros?: ErrosDeCampo }) {
  const [estado, executar, enviando] = useActionState(acao, ESTOQUE_INICIAL);
  const [locais, setLocais] = useState<ErrosDeCampo | null>(null);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    setLocais(null);
  }
  const erros = locais ?? (estado.status === "erro" ? (estado.erros ?? {}) : {});
  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    const v = validar(camposDoFormulario(new FormData(e.currentTarget)));
    if (!v.ok) {
      e.preventDefault();
      setLocais(v.erros ?? {});
    } else setLocais({});
  }
  const limpar = (campo: string) => erros[campo] && setLocais({ ...erros, [campo]: undefined });
  return { estado, executar, enviando, erros, aoEnviar, limpar };
}

function Campo({ id, rotulo, erro, children }: { id: string; rotulo: string; erro?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {rotulo}
      </label>
      {children}
      <MensagemDeCampo id={`${id}-erro`} erro={erro} />
    </div>
  );
}

const botao =
  "rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70";

/** Entrada (UC7) ou saída manual (UC8). "hoje" vem do servidor (dia de São Paulo). */
export function FormularioMovimentacao({ itemId, tipo, hoje, unidade }: { itemId: string; tipo: "entrada" | "saida"; hoje: string; unidade: string }) {
  const { estado, executar, enviando, erros, aoEnviar, limpar } = useFormularioDoEstoque(
    tipo === "entrada" ? acaoRegistrarEntrada : acaoRegistrarSaida,
    (c) => validarMovimentacao(c, tipo, hoje),
  );
  const [motivo, setMotivo] = useState("");
  const [chave, setChave] = useState(0);
  const [vistoSalvo, setVistoSalvo] = useState(estado);
  // Depois de salvar, limpa o formulário para o próximo lançamento.
  if (estado !== vistoSalvo) {
    setVistoSalvo(estado);
    if (estado.status === "salvo") {
      setChave((k) => k + 1);
      setMotivo("");
    }
  }
  const p = `${tipo}-`;

  return (
    <div className="space-y-3">
      {estado.status === "salvo" && <Aviso tipo="sucesso">{estado.mensagem}</Aviso>}
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <form key={chave} action={executar} onSubmit={aoEnviar} noValidate className="space-y-4">
        <input type="hidden" name="itemId" value={itemId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id={`${p}quantidade`} rotulo={`Quantidade (${unidade})`} erro={erros.quantidade}>
            <input
              id={`${p}quantidade`}
              name="quantidade"
              inputMode="decimal"
              placeholder="Ex.: 10 ou 1,5"
              aria-invalid={erros.quantidade ? true : undefined}
              aria-describedby={erros.quantidade ? `${p}quantidade-erro` : undefined}
              onChange={() => limpar("quantidade")}
              className={classeDoCampo(erros.quantidade)}
            />
          </Campo>
          <Campo id={`${p}data`} rotulo="Data" erro={erros.data}>
            <input
              id={`${p}data`}
              name="data"
              type="date"
              defaultValue={hoje}
              max={hoje}
              min={somarDias(hoje, -90)}
              aria-invalid={erros.data ? true : undefined}
              aria-describedby={erros.data ? `${p}data-erro` : undefined}
              onChange={() => limpar("data")}
              className={classeDoCampo(erros.data)}
            />
          </Campo>
        </div>
        {tipo === "saida" && (
          <Campo id={`${p}motivo`} rotulo="Motivo" erro={erros.motivo}>
            <select
              id={`${p}motivo`}
              name="motivo"
              value={motivo}
              aria-invalid={erros.motivo ? true : undefined}
              aria-describedby={erros.motivo ? `${p}motivo-erro` : undefined}
              onChange={(e) => {
                setMotivo(e.target.value);
                limpar("motivo");
              }}
              className={classeDoCampo(erros.motivo)}
            >
              <option value="">Selecione…</option>
              {Object.entries(MOTIVOS_SAIDA).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo id={`${p}observacao`} rotulo={motivo === "OUTRO" ? "Observação (obrigatória)" : "Observação (opcional)"} erro={erros.observacao}>
          <input
            id={`${p}observacao`}
            name="observacao"
            maxLength={200}
            placeholder={tipo === "entrada" ? "Ex.: compra no fornecedor X" : "Ex.: frasco quebrou na entrega"}
            aria-invalid={erros.observacao ? true : undefined}
            aria-describedby={erros.observacao ? `${p}observacao-erro` : undefined}
            onChange={() => limpar("observacao")}
            className={classeDoCampo(erros.observacao)}
          />
        </Campo>
        <button type="submit" disabled={enviando} className={botao}>
          {enviando ? "Registrando…" : tipo === "entrada" ? "Registrar entrada" : "Registrar saída"}
        </button>
      </form>
    </div>
  );
}

/** Mínimo manual (5.3): vazio remove e volta à sugestão. */
export function FormularioMinimo({ itemId, atual }: { itemId: string; atual: number | null }) {
  const { estado, executar, enviando, erros, aoEnviar, limpar } = useFormularioDoEstoque(acaoDefinirMinimo, validarMinimo);
  return (
    <div className="space-y-3">
      {estado.status === "salvo" && <Aviso tipo="sucesso">{estado.mensagem}</Aviso>}
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <form action={executar} onSubmit={aoEnviar} noValidate className="flex flex-wrap items-start gap-3">
        <input type="hidden" name="itemId" value={itemId} />
        <div className="min-w-0 flex-1">
          <label htmlFor="estoqueMinimo" className="sr-only">
            Mínimo manual
          </label>
          <input
            id="estoqueMinimo"
            name="estoqueMinimo"
            inputMode="decimal"
            defaultValue={atual === null ? "" : atual.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
            placeholder="Vazio = usar a sugestão"
            aria-invalid={erros.estoqueMinimo ? true : undefined}
            aria-describedby={erros.estoqueMinimo ? "estoqueMinimo-erro" : undefined}
            onChange={() => limpar("estoqueMinimo")}
            className={classeDoCampo(erros.estoqueMinimo)}
          />
          <MensagemDeCampo id="estoqueMinimo-erro" erro={erros.estoqueMinimo} />
        </div>
        <button type="submit" disabled={enviando} className={botao}>
          Salvar mínimo
        </button>
      </form>
    </div>
  );
}

/** Dias de cobertura do estoque (SPEC-007, OPEN-010): só o Dono, em "Dados do negócio". */
export function FormularioDiasCobertura({ atual }: { atual: number }) {
  const [estado, executar, enviando] = useActionState<EstadoDosDiasDeCobertura, FormData>(acaoDefinirDiasCobertura, { status: "ocioso" });
  const erro = estado.status === "erro" ? estado.mensagem : undefined;
  return (
    <form action={executar} noValidate className="space-y-3">
      {estado.status === "salvo" && <Aviso tipo="sucesso">Dias de cobertura salvos.</Aviso>}
      <div>
        <label htmlFor="diasCoberturaEstoque" className="text-sm font-medium text-foreground">
          Dias de cobertura do estoque
        </label>
        <p className="mt-0.5 mb-1.5 text-xs text-muted-foreground">
          Quantos dias de consumo o estoque mínimo sugerido deve cobrir (1 a 90; padrão 7).
        </p>
        <div className="flex flex-wrap items-start gap-3">
          <input
            id="diasCoberturaEstoque"
            name="diasCoberturaEstoque"
            inputMode="numeric"
            defaultValue={atual}
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? "diasCoberturaEstoque-erro" : undefined}
            className={`${classeDoCampo(erro)} max-w-32`}
          />
          <button type="submit" disabled={enviando} className={botao}>
            Salvar
          </button>
        </div>
        <MensagemDeCampo id="diasCoberturaEstoque-erro" erro={erro} />
      </div>
    </form>
  );
}
