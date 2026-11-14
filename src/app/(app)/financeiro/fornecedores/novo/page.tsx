import type { Metadata } from "next";
import { FormularioCliente } from "@/components/clientes/formulario-cliente";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { Superficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { pode } from "@/lib/dominio/permissoes";

export const metadata: Metadata = { title: "Novo fornecedor" };

// Cadastro do fornecedor (SPEC-026, 5.1): Financeiro — criar. Os mesmos campos do cliente (OPEN-002).
export default async function NovoFornecedor() {
  const membro = await exigirPermissao("financeiro", "criar");
  const podeVer = pode(membro.permissoes, "financeiro", "ver");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CabecalhoDePagina
        voltar={podeVer ? { href: "/financeiro/fornecedores", rotulo: "Fornecedores" } : undefined}
        titulo="Novo fornecedor"
        descricao="Só o nome é obrigatório. Digite o CNPJ para buscar os dados da empresa."
      />
      <Superficie>
        <FormularioCliente modo="tela" pessoa="fornecedor" cancelarHref={podeVer ? "/financeiro/fornecedores" : "/financeiro"} />
      </Superficie>
    </div>
  );
}
