import Link from "next/link";
import { Logo } from "@/components/marca/logo";
import { AlternarTema } from "@/components/tema/alternar-tema";

// Layout das telas de acesso (SPEC-002, OPEN-006): painel institucional + formulário,
// conforme o protótipo revisado (docs/design/prototipo_revisado/App.tsx).

const recursos = ["Calculadora de preços", "Controle de estoque", "Fluxo de caixa", "Gestão de equipe"];

export default function LayoutDeAcesso({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-1 bg-background">
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-brand-deep px-14 py-12 lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 60% 30%, rgba(245,158,11,0.10) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 20% 80%, rgba(16,82,57,0.4) 0%, transparent 60%)",
          }}
        />
        <header className="relative z-10">
          <Logo negativo />
        </header>

        <div className="relative z-10">
          <p className="mb-5 text-xs font-medium tracking-widest text-brand-amber uppercase">
            ERP para microempreendedores e autônomos
          </p>
          <p className="mb-6 font-display text-5xl leading-[1.1] font-semibold text-white">
            A saúde do seu negócio,
            <br />
            visual e sob controle.
          </p>
          <p className="max-w-sm text-base leading-relaxed text-white/75">
            Controle o estoque, precifique produtos e serviços com precisão e acompanhe cada centavo do seu caixa — tudo em
            um só lugar.
          </p>
        </div>

        <footer className="relative z-10">
          <p className="mb-4 text-xs tracking-widest text-white/60 uppercase">Recursos incluídos</p>
          <ul className="flex flex-wrap gap-2">
            {recursos.map((r) => (
              <li key={r} className="rounded-full border border-white/25 px-3 py-1.5 text-xs text-white/80">
                {r}
              </li>
            ))}
          </ul>
        </footer>
      </aside>

      <main className="relative flex flex-1 flex-col items-center justify-center px-6 pt-20 pb-20 lg:px-16 lg:pt-12">
        <div className="absolute top-4 right-4">
          <AlternarTema />
        </div>
        <div className="mb-10 lg:hidden">
          <Logo />
        </div>

        <div className="w-full max-w-sm">{children}</div>

        <p className="absolute bottom-6 text-xs text-muted-foreground">
          © 2026 Health Enterprise ·{" "}
          <Link href="/termos" className="hover:underline">
            Termos
          </Link>{" "}
          ·{" "}
          <Link href="/privacidade" className="hover:underline">
            Privacidade
          </Link>
        </p>
      </main>
    </div>
  );
}
