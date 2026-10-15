import type { Metadata } from "next";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { FormularioNovoNegocio } from "@/components/negocio/formularios";
import { exigirSessao } from "@/lib/auth/servidor";

export const metadata: Metadata = { title: "Cadastrar negócio" };

// Cadastro do negócio (SPEC-004, UC0). Quem cadastra vira o Dono.
export default async function NovoNegocio() {
  await exigirSessao();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <CabecalhoDePagina
        voltar={{ href: "/negocios", rotulo: "Meus negócios" }}
        titulo="Cadastrar negócio"
        descricao="Com o enquadramento certo, a calculadora já embute o imposto correto no preço."
      />
      <FormularioNovoNegocio />
    </div>
  );
}
