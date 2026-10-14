import type { Metadata } from "next";
import { MovimentacaoEmPagina } from "@/components/estoque/movimentacao";

export const metadata: Metadata = { title: "Entrada no estoque" };

export default async function EntradaDoEstoque({ params }: PageProps<"/estoque/[id]/entrada">) {
  const { id } = await params;
  return <MovimentacaoEmPagina id={id} tipo="entrada" />;
}
