import { Siren } from "lucide-react";
import { Selo } from "@/components/ui/selo";

/** Selo do acesso de emergência (SPEC-019, 5.6 e 5.10): o tom de perigo, com a sirene no lugar da seta. */
export function SeloDaEmergencia({ children }: { children: React.ReactNode }) {
  return (
    <Selo tom="perigo" semIcone>
      <Siren className="size-3.5" strokeWidth={2.6} aria-hidden="true" />
      {children}
    </Selo>
  );
}
