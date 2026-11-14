"use client";

import dynamic from "next/dynamic";
import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { Aviso } from "@/components/acesso/campos";
import { useConfirmacaoDoEnvio } from "@/components/ui/confirmacao-do-envio";
import { classeDoBotao } from "@/components/ui/estilos";
import { acaoExcluirFornecedor } from "@/lib/fornecedores/acoes";

// O diálogo (Radix) só é baixado quando a pessoa clica em "Excluir fornecedor".
const DialogoDeConfirmacao = dynamic(() => import("@/components/ui/confirmacao").then((m) => m.DialogoDeConfirmacao), { ssr: false });

/**
 * Exclusão do fornecedor (SPEC-026, 5.3; OPEN-004): sem contas nem despesas fixas, apaga; com elas,
 * anonimiza. O texto da confirmação diz qual dos dois vai acontecer; o servidor decide de novo ao gravar.
 */
export function ExcluirFornecedor({ fornecedorId, nome, contas, despesas }: { fornecedorId: string; nome: string; contas: number; despesas: number }) {
  const [estado, executar, enviando] = useActionState(acaoExcluirFornecedor, undefined);
  const confirmacao = useConfirmacaoDoEnvio();
  const ligados = [
    contas > 0 && `${contas} ${contas === 1 ? "conta" : "contas"}`,
    despesas > 0 && `${despesas} ${despesas === 1 ? "despesa fixa" : "despesas fixas"}`,
  ].filter(Boolean);
  const descricao =
    ligados.length === 0
      ? `Excluir ${nome}? O cadastro será apagado.`
      : `${nome} tem ${ligados.join(" e ")}. Os dados do fornecedor serão apagados, e as contas continuarão registradas, sem identificação e com os mesmos valores. Isso não pode ser desfeito.`;
  return (
    <form action={executar} onSubmit={confirmacao.aoEnviar} className="space-y-3">
      {estado?.status === "erro" && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <input type="hidden" name="fornecedorId" value={fornecedorId} />
      <button type="submit" disabled={enviando} className={classeDoBotao("fantasma", "sm", "-ml-4 text-status-danger hover:bg-status-danger-bg")}>
        <Trash2 aria-hidden="true" />
        Excluir fornecedor
      </button>
      {confirmacao.aberto && (
        <DialogoDeConfirmacao
          aberto
          aoMudar={confirmacao.setAberto}
          titulo={ligados.length === 0 ? "Excluir o fornecedor?" : "Excluir os dados do fornecedor?"}
          descricao={descricao}
          confirmar="Excluir fornecedor"
          aoConfirmar={confirmacao.confirmar}
        />
      )}
    </form>
  );
}
