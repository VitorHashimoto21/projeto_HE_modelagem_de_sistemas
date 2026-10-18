import type { Metadata } from "next";
import { MovimentacaoEmPagina } from "@/components/estoque/movimentacao";

export const metadata: Metadata = { title: "Saída do estoque" };

export default async function SaidaDoEstoque({ params }: PageProps<"/estoque/[id]/saida">) {
  const { id } = await params;
  return <MovimentacaoEmPagina id={id} tipo="saida" />;
}
