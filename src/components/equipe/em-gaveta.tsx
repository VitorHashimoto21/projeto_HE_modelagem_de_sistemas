import { FormularioConvite } from "@/components/equipe/formulario-convite";
import { GavetaDaRota } from "@/components/ui/gaveta";
import { exigirDono } from "@/lib/auth/servidor";

// Convidar em gaveta (SPEC-016, OPEN-003): a mesma guarda da página (só o Dono). Depois de
// criar o convite, a gaveta mostra o link para copiar; fechar volta para a Equipe.

export const TEXTO_DO_CONVITE = "A pessoa recebe um link por e-mail, que vale por 7 dias. Se ainda não tiver conta, pode criá-la pelo link.";

export async function ConviteEmGaveta() {
  await exigirDono();
  return (
    <GavetaDaRota titulo="Convidar pessoa" descricao={TEXTO_DO_CONVITE}>
      <FormularioConvite />
    </GavetaDaRota>
  );
}
