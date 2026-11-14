import type { Metadata } from "next";
import Link from "next/link";
import { OctagonPause } from "lucide-react";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao } from "@/components/ui/estilos";
import { Superficie } from "@/components/ui/superficie";
import { exigirMembro } from "@/lib/auth/servidor";
import { explicacaoDaSuspensao, MENSAGENS_DA_SUSPENSAO } from "@/lib/dominio/suspensao";

export const metadata: Metadata = { title: "Negócio suspenso" };

// SPEC-019 (5.7, RN39): a recusa de uma gravação no negócio suspenso. A barreira é a guarda no servidor (e o
// gatilho do banco); esta é só a explicação. Ler e exportar continuam.
export default async function NegocioSuspenso() {
  const membro = await exigirMembro();
  const suspensao = membro.negocioSuspenso ?? null;
  const suporte = membro.modoSuporte === true;
  return (
    <Superficie className="mx-auto max-w-lg" aria-labelledby="titulo-negocio-suspenso">
      <EstadoVazio
        Icone={OctagonPause}
        titulo={<span id="titulo-negocio-suspenso">{suspensao ? "Este negócio está suspenso" : "O negócio não está mais suspenso"}</span>}
        acao={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/painel" className={classeDoBotao("secundario")}>
              Voltar ao painel
            </Link>
            {suspensao && !suporte && (
              <Link href="/conta" className={classeDoBotao("fantasma")}>
                Exportar meus dados
              </Link>
            )}
          </div>
        }
      >
        {!suspensao
          ? "A gravação já voltou. Tente de novo."
          : suporte
            ? MENSAGENS_DA_SUSPENSAO.correcoes
            : explicacaoDaSuspensao(suspensao)}
      </EstadoVazio>
    </Superficie>
  );
}
