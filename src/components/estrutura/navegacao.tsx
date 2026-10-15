"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import {
  ArrowDownCircle,
  BarChart3,
  Building2,
  Calculator,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Plus,
  Receipt,
  Star,
  Sun,
  Tags,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { acaoSair } from "@/lib/auth/acoes";
import type { ItemDoMenu } from "@/lib/equipe/menu";
import { acaoTrocarNegocio } from "@/lib/negocio/acoes";
import { useTema } from "@/components/tema/alternar-tema";
import { cn } from "@/lib/utils";

// A gaveta (Radix) só é baixada quando a pessoa abre o "Mais" (SPEC-016, critério de desempenho).
const Gaveta = dynamic(() => import("@/components/ui/gaveta").then((m) => m.Gaveta), { ssr: false });

// Estrutura do app (SPEC-016, 5.2): menu lateral verde-escuro no computador, trilho de
// ícones no tablet e barra inferior com "Vender" no celular. Os itens vêm de menuDoMembro
// (SPEC-005): esconder é conveniência, a barreira continua no servidor.

const ICONES: Record<string, LucideIcon> = {
  "/painel": LayoutDashboard,
  "/catalogo": Tags,
  "/estoque": Package,
  "/vendas/nova": Plus,
  "/vendas": Receipt,
  "/calculadora": Calculator,
  "/financeiro": Wallet,
  "/financeiro/lancar": ArrowDownCircle,
  "/relatorios": BarChart3,
  "/negocio/equipe": Users,
  "/negocio/dados": Building2,
  "/negocio/plano": Star,
};

const CONFIGURACOES = new Set(["/negocio/equipe", "/negocio/dados", "/negocio/plano"]);

type Props = {
  itens: ItemDoMenu[];
  negocios: { id: string; nome: string }[];
  ativo: string | null;
  perfil: { nome: string; email: string } | null;
};

/** O item ativo é o de href mais longo que casa com o caminho (/vendas/nova ganha de /vendas). */
function hrefAtivo(caminho: string, itens: ItemDoMenu[]): string | null {
  const casam = itens.filter((i) => caminho === i.href || caminho.startsWith(`${i.href}/`));
  return casam.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

function Simbolo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path d="M16 27V14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-estrutura-suave" />
      <path d="M16 15c-5.5 0-9-3.3-9-9 5.5 0 9 3.3 9 9z" fill="var(--brand-amber)" />
      <path d="M16 18.5c4.5 0 7.5-2.8 7.5-7.5-4.5 0-7.5 2.8-7.5 7.5z" fill="var(--brand-amber-light)" />
    </svg>
  );
}

function SeletorNaEstrutura({ negocios, ativo, compacto }: { negocios: Props["negocios"]; ativo: string | null; compacto?: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  if (negocios.length === 0) return null;
  return (
    <form ref={form} action={acaoTrocarNegocio} className="min-w-0">
      <label htmlFor={compacto ? "seletor-negocio-celular" : "seletor-negocio"} className="sr-only">
        Negócio ativo
      </label>
      <select
        id={compacto ? "seletor-negocio-celular" : "seletor-negocio"}
        name="negocioId"
        defaultValue={ativo ?? ""}
        onChange={() => form.current?.requestSubmit()}
        className={cn(
          "w-full truncate rounded-full border-0 bg-estrutura-foreground/10 py-2 pr-8 pl-4 text-sm font-bold text-estrutura-foreground",
          "focus-visible:outline-2 focus-visible:outline-ambar [&>option]:bg-card [&>option]:text-foreground",
          compacto && "max-w-[11rem]",
        )}
      >
        {!ativo && (
          <option value="" disabled>
            Escolha um negócio
          </option>
        )}
        {negocios.map((n) => (
          <option key={n.id} value={n.id}>
            {n.nome}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="ml-2 text-sm text-estrutura-foreground underline">
          Trocar
        </button>
      </noscript>
    </form>
  );
}

function BotaoTema({ comRotulo }: { comRotulo?: boolean }) {
  const { escuro, alternar } = useTema();
  const rotulo = escuro ? "Tema claro" : "Tema escuro";
  const Icone = escuro ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={escuro}
      className={cn(
        "flex items-center gap-3 rounded-full text-sm font-medium text-estrutura-suave hover:bg-estrutura-foreground/10 hover:text-estrutura-foreground focus-visible:outline-2 focus-visible:outline-ambar",
        comRotulo ? "w-full px-4 py-2.5" : "size-10 justify-center",
      )}
    >
      <Icone className="size-5 shrink-0" aria-hidden="true" />
      <span className={comRotulo ? "" : "sr-only"}>{rotulo}</span>
    </button>
  );
}

function ItemLateral({ item, ativo }: { item: ItemDoMenu; ativo: boolean }) {
  const Icone = ICONES[item.href] ?? LayoutDashboard;
  return (
    <Link
      href={item.href}
      aria-current={ativo ? "page" : undefined}
      title={item.rotulo}
      className={cn(
        "group flex items-center gap-3 rounded-full px-3 py-2.5 text-[15px] font-medium transition-colors duration-(--duracao-estado) ease-(--ease-saida)",
        "focus-visible:outline-2 focus-visible:outline-ambar md:justify-center lg:justify-start lg:px-4",
        ativo ? "bg-ambar font-bold text-ambar-foreground" : "text-estrutura-suave hover:bg-estrutura-foreground/10 hover:text-estrutura-foreground",
      )}
    >
      <Icone className="size-5 shrink-0" aria-hidden="true" />
      <span className="md:sr-only lg:not-sr-only">{item.rotulo}</span>
      {item.selo && (
        <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold md:hidden lg:inline", ativo ? "bg-ambar-foreground/15" : "bg-ambar text-ambar-foreground")}>
          {item.selo}
        </span>
      )}
    </Link>
  );
}

export function Navegacao({ itens, negocios, ativo, perfil }: Props) {
  const caminho = usePathname();
  const atual = hrefAtivo(caminho, itens);
  const [maisAberto, setMaisAberto] = useState(false);
  const botaoMais = useRef<HTMLButtonElement>(null);
  const modulos = itens.filter((i) => !CONFIGURACOES.has(i.href));
  const configuracoes = itens.filter((i) => CONFIGURACOES.has(i.href));

  // Barra inferior: Painel, Vendas, Vender (destaque), Caixa ou Estoque, Mais.
  const tem = (href: string) => itens.find((i) => i.href === href);
  const barra = [tem("/painel"), tem("/vendas")].filter(Boolean) as ItemDoMenu[];
  const vender = tem("/vendas/nova");
  const quarto = tem("/financeiro") ?? tem("/estoque") ?? tem("/catalogo");

  return (
    <>
      {/* Computador (rótulos) e tablet (só ícones) */}
      <aside
        aria-label="Menu do negócio"
        className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-6 overflow-y-auto bg-estrutura px-3 py-5 text-estrutura-foreground md:flex md:w-20 lg:w-64 lg:px-4"
      >
        <Link
          href={ativo ? "/painel" : "/negocios"}
          aria-label="Health Enterprise — página inicial"
          className="flex items-center gap-2.5 rounded-full px-2 focus-visible:outline-2 focus-visible:outline-ambar md:justify-center lg:justify-start"
        >
          <Simbolo className="size-9 shrink-0" />
          <span className="text-base font-bold md:hidden lg:inline">Health Enterprise</span>
        </Link>
        <div className="md:hidden lg:block">
          <SeletorNaEstrutura negocios={negocios} ativo={ativo} />
        </div>
        {modulos.length > 0 && (
          <nav aria-label="Módulos" className="flex flex-col gap-1">
            {modulos.map((i) => (
              <ItemLateral key={i.href} item={i} ativo={atual === i.href} />
            ))}
          </nav>
        )}
        {configuracoes.length > 0 && (
          <nav aria-labelledby="titulo-config" className="flex flex-col gap-1 border-t border-estrutura-linha pt-4">
            <h2 id="titulo-config" className="px-4 pb-1 text-xs font-medium text-estrutura-suave md:sr-only lg:not-sr-only">
              Configurações
            </h2>
            {configuracoes.map((i) => (
              <ItemLateral key={i.href} item={i} ativo={atual === i.href} />
            ))}
          </nav>
        )}
        <div className="mt-auto flex flex-col gap-1 border-t border-estrutura-linha pt-4">
          <Link
            href="/negocios"
            className="flex items-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium text-estrutura-suave hover:bg-estrutura-foreground/10 hover:text-estrutura-foreground focus-visible:outline-2 focus-visible:outline-ambar md:justify-center lg:justify-start lg:px-4"
            title="Meus negócios"
          >
            <Building2 className="size-5 shrink-0" aria-hidden="true" />
            <span className="md:sr-only lg:not-sr-only">Meus negócios</span>
          </Link>
          {perfil && (
            <Link
              href="/conta"
              title={`${perfil.email} — Minha conta`}
              aria-current={caminho === "/conta" ? "page" : undefined}
              className="flex items-center gap-3 rounded-full px-2 py-2 text-sm text-estrutura-foreground hover:bg-estrutura-foreground/10 focus-visible:outline-2 focus-visible:outline-ambar md:justify-center lg:justify-start"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-estrutura-linha text-xs font-bold" aria-hidden="true">
                {iniciais(perfil.nome) || <UserRound className="size-4" />}
              </span>
              <span className="min-w-0 truncate md:sr-only lg:not-sr-only">
                {perfil.nome}
                <span className="sr-only"> — Minha conta</span>
              </span>
            </Link>
          )}
          <div className="flex items-center gap-1 md:flex-col lg:flex-row">
            <BotaoTema />
            <form action={acaoSair}>
              <button
                type="submit"
                className="flex size-10 items-center justify-center rounded-full text-estrutura-suave hover:bg-estrutura-foreground/10 hover:text-estrutura-foreground focus-visible:outline-2 focus-visible:outline-ambar"
              >
                <LogOut className="size-5" aria-hidden="true" />
                <span className="sr-only">Sair</span>
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Celular: topo com o negócio e barra inferior */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-estrutura px-4 py-3 text-estrutura-foreground md:hidden">
        <Link href={ativo ? "/painel" : "/negocios"} aria-label="Health Enterprise — página inicial" className="rounded-full focus-visible:outline-2 focus-visible:outline-ambar">
          <Simbolo className="size-8" />
        </Link>
        <div className="min-w-0 flex-1">
          <SeletorNaEstrutura negocios={negocios} ativo={ativo} compacto />
        </div>
        <BotaoTema />
        {perfil && (
          <Link
            href="/conta"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-estrutura-linha text-xs font-bold focus-visible:outline-2 focus-visible:outline-ambar"
          >
            <span aria-hidden="true">{iniciais(perfil.nome)}</span>
            <span className="sr-only">Minha conta</span>
          </Link>
        )}
      </header>

      {itens.length > 0 && (
        <nav
          aria-label="Menu principal"
          className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-full bg-estrutura px-2 py-1.5 text-estrutura-suave shadow-[0_10px_24px_color-mix(in_srgb,var(--estrutura)_30%,transparent)] md:hidden"
        >
          {barra.map((i) => (
            <ItemInferior key={i.href} item={i} ativo={atual === i.href} />
          ))}
          {vender && (
            <Link
              href={vender.href}
              aria-current={atual === vender.href ? "page" : undefined}
              className="flex flex-col items-center gap-0.5 px-2 text-[11px] font-bold text-estrutura-foreground focus-visible:outline-2 focus-visible:outline-ambar"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-ambar text-ambar-foreground">
                <Plus className="size-6" strokeWidth={2.6} aria-hidden="true" />
              </span>
              Vender
            </Link>
          )}
          {quarto && <ItemInferior item={quarto} ativo={atual === quarto.href} rotulo={quarto.href === "/financeiro" ? "Caixa" : undefined} />}
          <button
            ref={botaoMais}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={maisAberto}
            onClick={() => setMaisAberto(true)}
            className="flex min-w-14 flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-ambar"
          >
            <Menu className="size-[22px]" aria-hidden="true" />
            Mais
          </button>
          {maisAberto && (
          <Gaveta aberta aoMudar={setMaisAberto} titulo="Menu" focoAoFechar={botaoMais}>
            <nav aria-label="Todas as áreas" className="flex flex-col gap-1" onClick={() => setMaisAberto(false)}>
              {[...modulos, ...configuracoes].map((i) => {
                const Icone = ICONES[i.href] ?? LayoutDashboard;
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    aria-current={atual === i.href ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-ring",
                      atual === i.href ? "bg-estrutura text-estrutura-foreground" : "hover:bg-accent",
                    )}
                  >
                    <Icone className="size-5" aria-hidden="true" />
                    {i.rotulo}
                    {i.selo && <span className="ml-auto rounded-full bg-ambar px-2 py-0.5 text-[10px] font-bold text-ambar-foreground">{i.selo}</span>}
                  </Link>
                );
              })}
              <Link href="/negocios" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold hover:bg-accent">
                <Building2 className="size-5" aria-hidden="true" />
                Meus negócios
              </Link>
              <form action={acaoSair}>
                <button type="submit" className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold text-destructive hover:bg-accent">
                  <LogOut className="size-5" aria-hidden="true" />
                  Sair
                </button>
              </form>
            </nav>
          </Gaveta>
          )}
        </nav>
      )}
    </>
  );
}

function ItemInferior({ item, ativo, rotulo }: { item: ItemDoMenu; ativo: boolean; rotulo?: string }) {
  const Icone = ICONES[item.href] ?? LayoutDashboard;
  return (
    <Link
      href={item.href}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "flex min-w-14 flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-ambar",
        ativo ? "text-ambar" : "text-estrutura-suave",
      )}
    >
      <Icone className="size-[22px]" aria-hidden="true" />
      {rotulo ?? item.rotulo}
    </Link>
  );
}
