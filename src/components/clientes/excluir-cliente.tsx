"use client";

import dynamic from "next/dynamic";
import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { Aviso } from "@/components/acesso/campos";
import { useConfirmacaoDoEnvio } from "@/components/ui/confirmacao-do-envio";
import { classeDoBotao } from "@/components/ui/estilos";
import { acaoExcluirCliente } from "@/lib/clientes/acoes";

// O diálogo (Radix) só é baixado quando a pessoa clica em "Excluir cliente".
const DialogoDeConfirmacao = dynamic(() => import("@/components/ui/confirmacao").then((m) => m.DialogoDeConfirmacao), { ssr: false });

/**
 * Exclusão do cliente (SPEC-022, 5.6; OPEN-005): sem compras, apaga; com compras, anonimiza.
 * O texto da confirmação diz qual dos dois vai acontecer; o servidor decide de novo ao gravar.
 */
export function ExcluirCliente({ clienteId, nome, compras }: { clienteId: string; nome: string; compras: number }) {
  const [estado, executar, enviando] = useActionState(acaoExcluirCliente, undefined);
  const confirmacao = useConfirmacaoDoEnvio();
  const descricao =
    compras === 0
      ? `Excluir ${nome}? O cadastro será apagado.`
      : `${nome} tem ${compras} ${compras === 1 ? "compra" : "compras"}. Os dados pessoais serão apagados, e as vendas continuarão registradas, sem identificação e com os mesmos valores. Isso não pode ser desfeito.`;
  return (
    <form action={executar} onSubmit={confirmacao.aoEnviar} className="space-y-3">
      {estado?.status === "erro" && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <input type="hidden" name="clienteId" value={clienteId} />
      <button type="submit" disabled={enviando} className={classeDoBotao("fantasma", "sm", "-ml-4 text-status-danger hover:bg-status-danger-bg")}>
        <Trash2 aria-hidden="true" />
        Excluir cliente
      </button>
      {confirmacao.aberto && (
        <DialogoDeConfirmacao
          aberto
          aoMudar={confirmacao.setAberto}
          titulo={compras === 0 ? "Excluir o cliente?" : "Excluir os dados do cliente?"}
          descricao={descricao}
          confirmar="Excluir cliente"
          aoConfirmar={confirmacao.confirmar}
        />
      )}
    </form>
  );
}
