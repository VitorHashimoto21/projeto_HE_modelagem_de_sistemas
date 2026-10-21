import Link from "next/link";
import { AvisoDaPagina } from "@/components/ui/aviso";

/**
 * Nota da Nova venda e da troca (SPEC-021, 5.6): com a nota fiscal de produtos ligada, os produtos
 * sem NCM ficam fora da venda (RN35). O link para completar aparece só para quem edita o Catálogo.
 */
export function AvisoForaPorNcm({ quantidade, podeCompletar }: { quantidade: number; podeCompletar: boolean }) {
  if (quantidade <= 0) return null;
  return (
    <AvisoDaPagina tom="atencao">
      {quantidade === 1 ? "1 produto está fora da venda por falta de NCM." : `${quantidade} produtos estão fora da venda por falta de NCM.`}
      {podeCompletar && (
        <>
          {" "}
          <Link href="/catalogo?ncm=sem">Completar no Catálogo</Link>
        </>
      )}
    </AvisoDaPagina>
  );
}
