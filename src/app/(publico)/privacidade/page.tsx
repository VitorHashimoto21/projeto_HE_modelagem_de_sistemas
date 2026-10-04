import type { Metadata } from "next";
import { PaginaDocumentoLegal } from "@/components/legal/documento-legal";

export const metadata: Metadata = { title: "Política de Privacidade" };
export const dynamic = "force-static";

export default function Privacidade() {
  return <PaginaDocumentoLegal documento="privacidade" />;
}
