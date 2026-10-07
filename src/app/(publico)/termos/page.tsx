import type { Metadata } from "next";
import { PaginaDocumentoLegal } from "@/components/legal/documento-legal";

export const metadata: Metadata = { title: "Termos de Uso" };
export const dynamic = "force-static";

export default function Termos() {
  return <PaginaDocumentoLegal documento="termos" />;
}
