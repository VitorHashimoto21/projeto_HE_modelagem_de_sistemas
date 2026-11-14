import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormularioCliente } from "@/components/clientes/formulario-cliente";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { Superficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { FornecedorNaoEncontrado, fornecedores } from "@/lib/db";
import { nomeDeExibicao } from "@/lib/dominio/cliente";

export const metadata: Metadata = { title: "Editar fornecedor" };

// Edição do fornecedor (SPEC-026, 5.1 e 5.2): Financeiro — editar, a única visão com os dados completos.
export default async function EditarFornecedor({ params }: PageProps<"/financeiro/fornecedores/[id]/editar">) {
  const membro = await exigirPermissao("financeiro", "editar");
  const { id } = await params;
  const valores = await fornecedores(membro)
    .valores(id)
    .catch((e) => {
      if (e instanceof FornecedorNaoEncontrado) notFound();
      throw e;
    });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CabecalhoDePagina voltar={{ href: `/financeiro/fornecedores/${id}`, rotulo: "Fornecedor" }} titulo={`Editar ${nomeDeExibicao(valores)}`} />
      <Superficie>
        <FormularioCliente modo="tela" pessoa="fornecedor" clienteId={id} valores={valores} cancelarHref={`/financeiro/fornecedores/${id}`} />
      </Superficie>
    </div>
  );
}
