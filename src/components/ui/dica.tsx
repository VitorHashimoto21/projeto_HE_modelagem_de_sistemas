"use client";

import { useState } from "react";
import { Tooltip } from "radix-ui";

// Dica (SPEC-016, OPEN-002; N8.5): o nome de um botão ou item que só mostra o ícone. Radix
// Tooltip — aparece ao passar o mouse e no foco pelo teclado, sai com Esc, e fica num portal
// (o menu lateral rola e cortaria a dica). Movimento conforme a 5.6. `desativada` mantém a
// mesma árvore (o item não é recriado e não perde o foco) quando a dica deixa de valer.

export function Dica({
  texto,
  lado = "right",
  desativada = false,
  children,
}: {
  texto: string;
  lado?: "top" | "right" | "bottom" | "left";
  desativada?: boolean;
  children: React.ReactNode;
}) {
  const [aberta, setAberta] = useState(false);
  return (
    <Tooltip.Provider delayDuration={200} skipDelayDuration={400}>
      <Tooltip.Root open={aberta && !desativada} onOpenChange={setAberta}>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={lado}
            sideOffset={10}
            collisionPadding={8}
            className="z-50 max-w-60 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background shadow-[0_6px_16px_color-mix(in_srgb,var(--estrutura)_25%,transparent)] data-[state=delayed-open]:animate-[dica-entrar_var(--duracao-toque)_var(--ease-saida)]"
          >
            {texto}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
