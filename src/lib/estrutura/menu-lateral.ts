/**
 * Menu lateral recolhível (SPEC-016, nota N8). A escolha fica só no navegador, como o tema
 * (N8.1): o layout raiz aplica a classe no <html> antes da primeira pintura, e as variantes
 * `trilho:` e `largo:` do CSS fazem o resto — sem piscar e sem ida ao servidor.
 */

export const CHAVE_DO_MENU = "he-menu";
export const CLASSE_MENU_RECOLHIDO = "menu-recolhido";

export type EstadoDoMenu = "recolhido" | "expandido";

/** Valor guardado → estado. Ausente ou inválido = expandido (N8.7). */
export function estadoDoMenu(valor: string | null | undefined): EstadoDoMenu {
  return valor === "recolhido" ? "recolhido" : "expandido";
}

/** Trecho do script do layout raiz que aplica a escolha antes da pintura (N8-INV3). */
export const SCRIPT_DO_MENU = `try{if(localStorage.getItem('${CHAVE_DO_MENU}')==='recolhido')document.documentElement.classList.add('${CLASSE_MENU_RECOLHIDO}')}catch(e){}`;
