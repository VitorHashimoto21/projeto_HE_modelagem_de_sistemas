// Aviso flutuante sob demanda (SPEC-016, 5.4 e critério de desempenho): quem quer confirmar uma
// ação chama avisar(); o componente AvisosFlutuantes, no layout, só baixa a biblioteca de avisos
// (sonner) quando o primeiro aviso acontece. Sem "use client": é só uma função de navegador.

export const EVENTO_DE_AVISO = "he:aviso";

export function avisar(mensagem: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENTO_DE_AVISO, { detail: mensagem }));
}
