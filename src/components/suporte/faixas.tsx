import Link from "next/link";
import { Eye, LifeBuoy, LogOut } from "lucide-react";
import { classeDoBotao } from "@/components/ui/estilos";
import { dataHoraCurta, listaDeModulos } from "@/lib/dominio/suporte";
import { acaoSairDoModoSuporte } from "@/lib/suporte/acoes";
import { cn } from "@/lib/utils";

// Avisos do acesso de suporte (SPEC-018, 5.5 e 5.6). Dois lados da mesma liberação:
// o Administrador vê sempre onde está e até quando; a equipe do negócio vê que o suporte
// pode ver os módulos liberados, e o Dono chega ao registro com um toque.

/**
 * Faixa do Administrador em modo suporte (5.5): cor própria, somente leitura, até quando, e a saída.
 * Fixa a partir de 768 px; no celular rola com a página e passa por baixo do cabeçalho fixo
 * (por isso o z-index só a partir de md — decisão de 18/10/2026, seção 9).
 */
export function FaixaDoModoSuporte({ negocio, expiraEm }: { negocio: string; expiraEm: Date }) {
  return (
    <div role="region" aria-label="Modo suporte" className="bg-ambar md:sticky md:top-0 md:z-40 text-ambar-foreground shadow-[0_6px_16px_color-mix(in_srgb,var(--estrutura)_18%,transparent)]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-10">
        <p className="flex min-w-0 items-center gap-2 text-sm font-bold">
          <Eye className="size-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
          <span className="min-w-0">
            <span className="font-extrabold">Modo suporte</span>
            <span aria-hidden="true"> · </span>
            <span className="break-words">{negocio}</span>
            <span aria-hidden="true"> · </span>
            <span className="font-semibold">somente leitura · até {dataHoraCurta(expiraEm)}</span>
          </span>
        </p>
        <form action={acaoSairDoModoSuporte}>
          <button type="submit" className={classeDoBotao("secundario", "sm", "border-ambar-foreground/30 bg-ambar-foreground/10 text-ambar-foreground hover:bg-ambar-foreground/15")}>
            <LogOut aria-hidden="true" />
            Sair do modo suporte
          </button>
        </form>
      </div>
    </div>
  );
}

/** Faixa para a equipe do negócio enquanto houver liberação ativa (5.6); o Dono ganha o atalho para o registro. */
export function FaixaDoSuporteLiberado({ modulos, expiraEm, ehDono }: { modulos: string[]; expiraEm: Date; ehDono: boolean }) {
  return (
    <div role="status" className="border-b border-status-warn/20 bg-status-warn-bg text-status-warn">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-2.5 text-sm sm:px-6 lg:px-10">
        <p className="flex min-w-0 items-start gap-2 font-semibold">
          <LifeBuoy className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
          <span>
            O suporte do HE pode ver {listaDeModulos(modulos)} deste negócio (somente leitura) até {dataHoraCurta(expiraEm)}.
          </span>
        </p>
        {ehDono && (
          <Link href="/negocio/suporte" className={cn("shrink-0 pl-6 font-bold underline underline-offset-2 sm:pl-0")}>
            Ver acessos do suporte
          </Link>
        )}
      </div>
    </div>
  );
}
