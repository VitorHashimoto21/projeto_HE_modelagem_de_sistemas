import { ContaEmGaveta } from "@/components/financeiro/em-gaveta";

// Rota interceptada (SPEC-016, OPEN-003): a nova conta abre na gaveta por cima das contas.
export default async function NovaContaNaGaveta({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { tipo } = await searchParams;
  return <ContaEmGaveta tipo={tipo} />;
}
