import Image from "next/image";
import { AlternarTema } from "@/components/tema/alternar-tema";
import { Button } from "@/components/ui/button";

// Página de verificação da fundação (SPEC-001, CA-01 e CA-13). Será substituída
// pela tela de login na SPEC-002.

const semaforo = [
  { rotulo: "Saudável", classes: "bg-status-ok-bg text-status-ok", icone: "●" },
  { rotulo: "Atenção", classes: "bg-status-warn-bg text-status-warn", icone: "▲" },
  { rotulo: "Déficit", classes: "bg-status-danger-bg text-status-danger", icone: "■" },
];

export default function Inicio() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Image
            src="/marca/he-logo-horizontal.svg"
            alt="Health Enterprise"
            width={220}
            height={48}
            priority
            className="h-12 w-auto dark:hidden"
          />
          <Image
            src="/marca/he-logo-horizontal-negativo.svg"
            alt="Health Enterprise"
            width={220}
            height={48}
            priority
            className="hidden h-12 w-auto dark:block"
          />
          <AlternarTema />
        </header>

        <section className="space-y-3">
          <h1 className="text-4xl font-semibold leading-tight text-foreground">
            A saúde do seu negócio, visual e sob controle.
          </h1>
          <p className="text-muted-foreground">
            Fundação técnica pronta: Next.js, Prisma com isolamento por negócio, identidade visual e CI.
            As telas chegam a partir da SPEC-002.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-6 shadow-sm" aria-labelledby="titulo-componentes">
          <h2 id="titulo-componentes" className="mb-4 text-xl font-semibold text-card-foreground">
            Verificação da identidade
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button>Ação principal</Button>
            <Button variant="secondary">Secundária</Button>
            <Button variant="outline">Contorno</Button>
            <Button variant="destructive">Destrutivo</Button>
          </div>
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Semáforo de saúde financeira">
            {semaforo.map((s) => (
              <li key={s.rotulo} className={`rounded-full px-3 py-1 text-sm font-medium ${s.classes}`}>
                <span aria-hidden="true">{s.icone}</span> {s.rotulo}
              </li>
            ))}
          </ul>
        </section>

        <footer className="text-xs text-muted-foreground">
          © 2026 Health Enterprise · <a className="underline-offset-2 hover:underline" href="/api/saude">Saúde do sistema</a>
        </footer>
      </div>
    </main>
  );
}
