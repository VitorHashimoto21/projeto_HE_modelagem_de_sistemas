import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioDadosDoNegocio } from "@/components/negocio/formularios";
import { exigirNegocio } from "@/lib/auth/servidor";
import { negocios } from "@/lib/db";

export const metadata: Metadata = { title: "Dados do negócio" };

// "Dados do negócio" (SPEC-004, 5.5): só o Dono edita o enquadramento (INV-007).
export default async function DadosDoNegocio() {
  const { negocioId, usuarioId } = await exigirNegocio();
  const [papel, dados] = await Promise.all([negocios().papel(usuarioId!, negocioId), negocios().dadosFiscais(negocioId)]);
  if (papel !== "DONO" || !dados) redirect("/painel");

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Dados do negócio</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {dados.cnpj ? "O CNPJ não muda depois do cadastro." : "Para virar MEI ou Simples, informe o CNPJ."}
        </p>
      </div>
      <FormularioDadosDoNegocio valores={dados} />
    </div>
  );
}
