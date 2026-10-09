import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioDiasCobertura } from "@/components/estoque/formularios";
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
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Dados do negócio</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {dados.cnpj ? "O CNPJ não muda depois do cadastro." : "Para virar MEI ou Simples, informe o CNPJ."}
        </p>
      </div>
      <FormularioDadosDoNegocio valores={dados} />
      <section className="rounded-2xl border bg-card p-6 shadow-sm" aria-label="Estoque">
        <FormularioDiasCobertura atual={diasCobertura} />
      </section>
    </div>
  );
}
