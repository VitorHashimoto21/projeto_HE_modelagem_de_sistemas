// Sem "use client": é uma função comum, chamada só pelos formulários de cliente (como avisar()).

import { startTransition, type FormEvent } from "react";

/**
 * Envio pela transição, e não pelo `action` do formulário: o React 19 volta os campos não controlados
 * ao valor inicial depois de cada envio pelo `action`, e a pessoa perderia o que digitou quando o
 * servidor recusa (ex.: saída maior que o saldo, CNPJ já cadastrado). Mesmo padrão dos formulários de
 * clientes (SPEC-022) e do item (SPEC-006). `aceitar` é a validação no navegador; o botão que enviou
 * vai junto nos dados (name/value), como no envio comum.
 */
export function enviarSemReiniciar(e: FormEvent<HTMLFormElement>, executar: (dados: FormData) => void, aceitar?: (dados: FormData) => boolean) {
  e.preventDefault();
  const dados = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
  if (aceitar && !aceitar(dados)) return;
  startTransition(() => executar(dados));
}
