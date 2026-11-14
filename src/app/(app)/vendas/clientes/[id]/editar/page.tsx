import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormularioCliente } from "@/components/clientes/formulario-cliente";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { Superficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { ClienteNaoEncontrado, clientes } from "@/lib/db";
import { nomeDeExibicao } from "@/lib/dominio/cliente";

export const metadata: Metadata = { title: "Editar cliente" };

// Edição do cliente (SPEC-022, 5.2 e 5.5): Vendas — editar, a única visão com os dados completos.
export default async function EditarCliente({ params }: PageProps<"/vendas/clientes/[id]/editar">) {
  const membro = await exigirPermissao("vendas", "editar");
  const { id } = await params;
  const valores = await clientes(membro)
    .valores(id)
    .catch((e) => {
      if (e instanceof ClienteNaoEncontrado) notFound();
      throw e;
    });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CabecalhoDePagina voltar={{ href: `/vendas/clientes/${id}`, rotulo: "Cliente" }} titulo={`Editar ${nomeDeExibicao(valores)}`} />
      <Superficie>
        <FormularioCliente modo="tela" clienteId={id} valores={valores} cancelarHref={`/vendas/clientes/${id}`} />
      </Superficie>
    </div>
  );
}
