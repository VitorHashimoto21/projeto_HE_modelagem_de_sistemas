import type { Metadata } from "next";
import { FormularioCliente } from "@/components/clientes/formulario-cliente";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { Superficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";

export const metadata: Metadata = { title: "Novo cliente" };

// Cadastro do cliente (SPEC-022, 5.2): Vendas — criar. Só o nome é obrigatório.
export default async function NovoCliente() {
  await exigirPermissao("vendas", "criar");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CabecalhoDePagina
        voltar={{ href: "/vendas/clientes", rotulo: "Clientes" }}
        titulo="Novo cliente"
        descricao="Só o nome é obrigatório. Os dados de documento e endereço servem para a nota fiscal."
      />
      <Superficie>
        <FormularioCliente modo="tela" cancelarHref="/vendas/clientes" />
      </Superficie>
    </div>
  );
}
