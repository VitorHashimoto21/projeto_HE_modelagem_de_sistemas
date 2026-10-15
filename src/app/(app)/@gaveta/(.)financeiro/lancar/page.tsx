import { LancamentoEmGaveta } from "@/components/financeiro/em-gaveta";

// Rota interceptada (SPEC-016, OPEN-003): o lançamento avulso abre na gaveta por cima da tela.
export default function LancarNaGaveta() {
  return <LancamentoEmGaveta />;
}
