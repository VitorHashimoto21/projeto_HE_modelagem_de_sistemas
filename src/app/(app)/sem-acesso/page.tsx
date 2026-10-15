import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao } from "@/components/ui/estilos";
import { Superficie } from "@/components/ui/superficie";

export const metadata: Metadata = { title: "Sem acesso" };

// Área sem permissão (SPEC-005, 5.5): a barreira é a guarda no servidor; esta é só a explicação.
export default function SemAcesso() {
  return (
    <Superficie className="mx-auto max-w-lg" aria-labelledby="titulo-sem-acesso">
      <EstadoVazio
        Icone={Lock}
        titulo={<span id="titulo-sem-acesso">Você não tem acesso a esta área</span>}
        acao={
          <Link href="/painel" className={classeDoBotao("secundario")}>
            Voltar ao painel
          </Link>
        }
      >
        Fale com o Dono do negócio se precisar dessa permissão.
      </EstadoVazio>
    </Superficie>
  );
}
