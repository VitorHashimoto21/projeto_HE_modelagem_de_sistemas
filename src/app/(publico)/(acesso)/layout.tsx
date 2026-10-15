import Link from "next/link";
import { Minigrafico } from "@/components/graficos/minigrafico";
import { Logo } from "@/components/marca/logo";
import { AlternarTema } from "@/components/tema/alternar-tema";
import { Selo } from "@/components/ui/selo";

// Layout das telas de acesso (SPEC-002, OPEN-006; redesenhado na SPEC-016): painel da marca
// na cor da estrutura, com a faixa do caixa — a assinatura do produto — como ilustração, e o
// formulário ao lado. No celular, só o formulário.

const recursos = ["Calculadora de preços", "Controle de estoque", "Fluxo de caixa", "Gestão de equipe"];
// Saldo de exemplo dos últimos 30 dias, só para a ilustração (não é dado de ninguém).
const EXEMPLO = [3120, 3080, 3260, 3240, 3410, 3380, 3300, 3520, 3610, 3580, 3700, 3650, 3820, 3790, 3900, 3880, 4010, 3960, 4120, 4090, 4180, 4150, 4230, 4200, 4290, 4260, 4330, 4310, 4360, 4380];

export default function LayoutDeAcesso({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-1 bg-background">
      <aside className="hidden w-[46%] flex-col justify-between bg-estrutura px-14 py-12 text-estrutura-foreground lg:flex">
        <header>
          <Logo negativo />
        </header>

        <div>
          <p className="max-w-md text-[44px] leading-[1.08] font-extrabold tracking-tight">A saúde do seu negócio, visual e sob controle.</p>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-estrutura-suave">
            Controle o estoque, precifique produtos e serviços com precisão e acompanhe cada centavo do seu caixa, tudo em um só lugar.
          </p>

          <div role="img" aria-label="Exemplo da faixa do caixa: saldo de R$ 4.380,00, subindo nos últimos 30 dias" className="mt-10 max-w-md rounded-3xl bg-estrutura-foreground/[0.07] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-estrutura-suave">Saldo</p>
                <p className="mt-1 text-[32px] leading-none font-extrabold tracking-tight tabular-nums">R$ 4.380,00</p>
              </div>
              <Selo tom="ok">Caixa saudável</Selo>
            </div>
            <div className="mt-4 text-ambar" aria-hidden="true">
              <Minigrafico valores={EXEMPLO} largura={360} altura={56} area descricao="" className="h-auto w-full" />
            </div>
            <p className="mt-3 text-sm text-estrutura-suave">
              Hoje <span className="font-bold text-estrutura-foreground">+ R$ 620,00</span> e <span className="font-bold text-estrutura-foreground">− R$ 85,00</span>
            </p>
          </div>
        </div>

        <ul className="flex flex-wrap gap-2" aria-label="Recursos incluídos">
          {recursos.map((r) => (
            <li key={r} className="rounded-full bg-estrutura-foreground/10 px-3 py-1.5 text-xs font-semibold text-estrutura-foreground">
              {r}
            </li>
          ))}
        </ul>
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
          © 2026 Health Enterprise.{" "}
          <Link href="/termos" className="underline-offset-2 hover:underline">
            Termos
          </Link>{" "}
          e{" "}
          <Link href="/privacidade" className="underline-offset-2 hover:underline">
            Privacidade
          </Link>
        </p>
      </main>
    </div>
  );
}
