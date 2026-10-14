import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Sem acesso" };

// Área sem permissão (SPEC-005, 5.5): a barreira é a guarda no servidor; esta é só a explicação.
export default function SemAcesso() {
  return (
    <section className="mx-auto max-w-md space-y-4 rounded-2xl bg-card px-6 py-12 text-center" aria-labelledby="titulo-sem-acesso">
      <h1 id="titulo-sem-acesso" className="text-xl font-extrabold text-card-foreground">
        Você não tem acesso a esta área
      </h1>
      <p className="text-sm text-muted-foreground">Fale com o Dono do negócio se precisar dessa permissão.</p>
      <Link href="/painel" className="inline-block text-sm font-medium text-primary underline-offset-2 hover:underline">
        Voltar ao painel
      </Link>
    </section>
  );
}
