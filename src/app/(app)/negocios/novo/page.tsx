import type { Metadata } from "next";
import { FormularioNovoNegocio } from "@/components/negocio/formularios";
import { exigirSessao } from "@/lib/auth/servidor";

export const metadata: Metadata = { title: "Cadastrar negócio" };

// Cadastro do negócio (SPEC-004, UC0). Quem cadastra vira o Dono.
export default async function NovoNegocio() {
  await exigirSessao();
  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Cadastrar negócio</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Com o enquadramento certo, a calculadora já embute o imposto correto no preço.
        </p>
      </div>
      <FormularioNovoNegocio />
    </div>
  );
}
