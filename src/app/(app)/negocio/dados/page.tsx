import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioDiasCobertura } from "@/components/estoque/formularios";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { FormularioDadosDoNegocio } from "@/components/negocio/formularios";
import { exigirDono } from "@/lib/auth/servidor";
import { negocios } from "@/lib/db";

export const metadata: Metadata = { title: "Dados do negócio" };

// "Dados do negócio" (SPEC-004, 5.5): só o Dono edita o enquadramento (INV-007). Faz parte
// das Configurações do negócio (SPEC-005, OPEN-002): os demais veem "Sem acesso".
export default async function DadosDoNegocio() {
  const { negocioId } = await exigirDono();
  const [dados, diasCobertura] = await Promise.all([negocios().dadosFiscais(negocioId), negocios().diasCobertura(negocioId)]);
  if (!dados) redirect("/painel");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <CabecalhoDePagina titulo="Dados do negócio" descricao={dados.cnpj ? "O CNPJ não muda depois do cadastro." : "Para virar MEI ou Simples, informe o CNPJ."} />
      <Superficie aria-labelledby="titulo-enquadramento">
        <TituloDaSuperficie id="titulo-enquadramento" titulo="Enquadramento" descricao="Regime e dados fiscais: definem o imposto embutido no preço de venda." />
        <FormularioDadosDoNegocio valores={dados} />
      </Superficie>
      <Superficie aria-labelledby="titulo-estoque">
        <TituloDaSuperficie id="titulo-estoque" titulo="Estoque" />
        <FormularioDiasCobertura atual={diasCobertura} />
      </Superficie>
    </div>
  );
}
