"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Toaster, toast } from "sonner";

// Avisos flutuantes (SPEC-016, 5.4; OPEN-002): confirmação rápida depois de uma ação, com
// o mesmo verbo do botão ("Salvar" → "Salvo"). Leitores de tela recebem o texto pela
// região viva do sonner. Movimento curto, desligado com prefers-reduced-motion.

export function AvisosFlutuantes() {
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
    toast.success(mensagem);
    const resto = new URLSearchParams(busca);
    resto.delete("ok");
    const q = resto.toString();
    router.replace(q ? `${caminho}?${q}` : caminho, { scroll: false });
  }, [mensagem, busca, caminho, router]);
  return null;
}

