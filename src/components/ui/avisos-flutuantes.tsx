"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { avisar, EVENTO_DE_AVISO } from "./avisar";

// Avisos flutuantes (SPEC-016, 5.4; OPEN-002): confirmação rápida depois de uma ação, com
// o mesmo verbo do botão ("Salvar" → "Salvo"). Leitores de tela recebem o texto pela
// região viva do sonner. Movimento curto, desligado com prefers-reduced-motion.

export function AvisosFlutuantes() {
  const [sonner, setSonner] = useState<typeof import("sonner") | null>(null);
  const carregado = useRef<typeof import("sonner") | null>(null);
  const fila = useRef<string[]>([]);
  useEffect(() => {
    const ouvir = (e: Event) => {
      const mensagem = (e as CustomEvent<string>).detail;
      if (carregado.current) return void carregado.current.toast.success(mensagem);
      fila.current.push(mensagem);
      import("sonner").then((m) => {
        carregado.current = m;
        setSonner(m);
      });
    };
    window.addEventListener(EVENTO_DE_AVISO, ouvir);
    return () => window.removeEventListener(EVENTO_DE_AVISO, ouvir);
  }, []);
  // Os efeitos do Toaster (filho) rodam antes deste: quando a fila é esvaziada, ele já escuta.
  useEffect(() => {
    if (sonner) for (const m of fila.current.splice(0)) sonner.toast.success(m);
  }, [sonner]);
  if (!sonner) return null;
  const { Toaster } = sonner;
  return (
    <Toaster
      position="bottom-center"
      offset={88}
      mobileOffset={96}
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !bg-estrutura !text-estrutura-foreground !border-0 !font-sans !shadow-xl",
          description: "!text-estrutura-suave",
          actionButton: "!bg-ambar !text-ambar-foreground !rounded-full !font-semibold",
        },
      }}
    />
  );
}

/**
 * Mostra como aviso flutuante o parâmetro `?ok=` da URL (as Server Actions redirecionam com
 * ele) e o tira da URL em seguida, para não reaparecer ao recarregar.
 */
export function AvisoDaUrl() {
  const busca = useSearchParams();
  const router = useRouter();
  const caminho = usePathname();
  const mensagem = busca.get("ok");
  useEffect(() => {
    if (!mensagem) return;
    avisar(mensagem);
    const resto = new URLSearchParams(busca);
    resto.delete("ok");
    const q = resto.toString();
    router.replace(q ? `${caminho}?${q}` : caminho, { scroll: false });
  }, [mensagem, busca, caminho, router]);
  return null;
}

