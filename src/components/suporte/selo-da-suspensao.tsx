import { OctagonPause } from "lucide-react";
import { Selo } from "@/components/ui/selo";

/** Selo do negócio suspenso (SPEC-019, 5.7 e 5.9): o tom de perigo, com o octógono de pausa no lugar da seta. */
export function SeloDaSuspensao({ children }: { children: React.ReactNode }) {
  return (
    <Selo tom="perigo" semIcone>
      <OctagonPause className="size-3.5" strokeWidth={2.6} aria-hidden="true" />
      {children}
    </Selo>
  );
}
