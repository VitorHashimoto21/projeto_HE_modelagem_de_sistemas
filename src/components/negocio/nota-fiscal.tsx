"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Aviso } from "@/components/acesso/campos";
import { useConfirmacaoDoEnvio } from "@/components/ui/confirmacao-do-envio";
import { classeDoBotao, classeDoLink } from "@/components/ui/estilos";
import { acaoDefinirNotaFiscal, type EstadoDaNotaFiscal } from "@/lib/negocio/acoes";

// O diálogo só serve para ligar a opção com produtos sem NCM: carrega sob demanda, quando a caixa
// é marcada, para não pesar na página.
const DialogoDeConfirmacao = dynamic(() => import("@/components/ui/confirmacao").then((m) => m.DialogoDeConfirmacao), { ssr: false });

const produtos = (n: number) => `${n} ${n === 1 ? "produto físico está" : "produtos físicos estão"} sem NCM`;

/**
 * "Emito nota fiscal de produtos (NF-e ou NFC-e)" (SPEC-021, 5.6): só o Dono. Ligar com produtos sem
 * NCM pede confirmação, porque eles saem da venda até receberem o código (OPEN-006).
 */
export function FormularioNotaFiscal({ emite, produtosSemNcm }: { emite: boolean; produtosSemNcm: number }) {
  const [estado, executar, pendente] = useActionState<EstadoDaNotaFiscal, FormData>(acaoDefinirNotaFiscal, { status: "ocioso" });
  const atual = estado.status === "salvo" ? estado.emite : emite;
  const [marcado, setMarcado] = useState(emite);
  const confirmacao = useConfirmacaoDoEnvio();
  const precisaConfirmar = marcado && !atual && produtosSemNcm > 0;

  // Envio pela transição, e não por <form action>: o React reinicia o formulário depois da action, e a
  // caixa de seleção voltaria a aparecer desmarcada com a opção já ligada.
  function enviar(e: FormEvent<HTMLFormElement>) {
    if (precisaConfirmar) {
      confirmacao.aoEnviar(e);
      if (e.defaultPrevented) return;
    }
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(() => executar(dados));
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {estado.status === "salvo" && (
        <Aviso tipo="sucesso">
          {estado.emite ? "Opção ligada: o NCM passa a ser obrigatório nos produtos físicos." : "Opção desligada: o NCM volta a ser opcional."}
        </Aviso>
      )}
      {estado.status === "erro" && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <input type="hidden" name="emiteNotaDeProduto" value={marcado ? "1" : "0"} />
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary" />
        <span>
          <span className="text-sm font-medium text-foreground">Emito nota fiscal de produtos (NF-e ou NFC-e)</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Ligada, o NCM passa a ser obrigatório nos produtos físicos, e produto sem NCM não pode ser vendido.
          </span>
        </span>
      </label>
      {produtosSemNcm > 0 && (
        <p className="text-sm text-muted-foreground">
          {produtos(produtosSemNcm)}.{" "}
          <Link href="/catalogo?ncm=sem" className={classeDoLink()}>
            Ver produtos sem NCM
          </Link>
        </p>
      )}
      <button type="submit" disabled={marcado === atual || pendente} className={classeDoBotao("secundario")}>
        Salvar
      </button>
      {precisaConfirmar && (
        <DialogoDeConfirmacao
          aberto={confirmacao.aberto}
          aoMudar={confirmacao.setAberto}
          titulo="Ligar a nota fiscal de produtos?"
          descricao={`${produtos(produtosSemNcm)}. Com a opção ligada, ${produtosSemNcm === 1 ? "ele não poderá ser vendido" : "eles não poderão ser vendidos"} até receber${produtosSemNcm === 1 ? "" : "em"} o código.`}
          confirmar="Ligar mesmo assim"
          aoConfirmar={confirmacao.confirmar}
        />
      )}
    </form>
  );
}
