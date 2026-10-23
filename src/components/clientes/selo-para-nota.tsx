import { Selo } from "@/components/ui/selo";

/** Selo "completo para nota" (SPEC-022, 5.4; OPEN-006): calculado a cada leitura. */
export function SeloParaNota({ completo }: { completo: boolean }) {
  return completo ? <Selo tom="ok">Completo para nota</Selo> : <Selo tom="atencao">Faltam dados para nota</Selo>;
}
