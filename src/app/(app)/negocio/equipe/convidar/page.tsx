import type { Metadata } from "next";
import Link from "next/link";
import { FormularioConvite } from "@/components/equipe/formulario-convite";
import { exigirDono } from "@/lib/auth/servidor";

export const metadata: Metadata = { title: "Convidar pessoa" };

// Convidar (SPEC-005, 5.2 — UC3 e UC4): só o Dono.
export default async function Convidar() {
  await exigirDono();
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/negocio/equipe" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
          ← Equipe
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">Convidar pessoa</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          A pessoa recebe um link por e-mail, que vale por 7 dias. Se ainda não tiver conta, pode criá-la pelo link.
        </p>
      </div>
      <FormularioConvite />
    </div>
  );
}
