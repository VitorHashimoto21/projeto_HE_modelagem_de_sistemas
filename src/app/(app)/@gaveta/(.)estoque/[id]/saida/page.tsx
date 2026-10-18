import { MovimentacaoEmGaveta } from "@/components/estoque/movimentacao";

// Rota interceptada (SPEC-016, OPEN-003): abre na gaveta por cima da tela do produto.
export default async function SaidaNaGaveta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MovimentacaoEmGaveta id={id} tipo="saida" />;
}
