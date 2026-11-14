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
export function ExcluirCliente({ clienteId, nome, compras, contas = 0 }: { clienteId: string; nome: string; compras: number; contas?: number }) {
  const [estado, executar, enviando] = useActionState(acaoExcluirCliente, undefined);
  const confirmacao = useConfirmacaoDoEnvio();
  // SPEC-026: com contas a receber ligadas, também anonimiza (as contas continuam).
  const ligados = [compras > 0 && `${compras} ${compras === 1 ? "compra" : "compras"}`, contas > 0 && `${contas} ${contas === 1 ? "conta a receber" : "contas a receber"}`].filter(Boolean);
  const registros = compras > 0 && contas > 0 ? "as vendas e as contas continuarão registradas" : compras > 0 ? "as vendas continuarão registradas" : "as contas continuarão registradas";
  const descricao =
    ligados.length === 0
      ? `Excluir ${nome}? O cadastro será apagado.`
      : `${nome} tem ${ligados.join(" e ")}. Os dados pessoais serão apagados, e ${registros}, sem identificação e com os mesmos valores. Isso não pode ser desfeito.`;
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
          titulo={ligados.length === 0 ? "Excluir o cliente?" : "Excluir os dados do cliente?"}
          descricao={descricao}
          confirmar="Excluir cliente"
          aoConfirmar={confirmacao.confirmar}
        />
      )}
    </form>
  );
}
