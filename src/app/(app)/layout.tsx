import { Suspense } from "react";
import { FaixaDoCaixaCompacta } from "@/components/estrutura/faixa-do-caixa";
import { Navegacao } from "@/components/estrutura/navegacao";
import { Minigrafico } from "@/components/graficos/minigrafico";
import { AvisoDaUrl, AvisosFlutuantes } from "@/components/ui/avisos-flutuantes";
import { exigirSessao } from "@/lib/auth/servidor";
import { carregarFaixa, cartaoSeguro } from "@/lib/dashboard/servicos";
import { dependenciasDoDashboard } from "@/lib/dashboard/servidor";
import { consultasDeAcesso, negocios, planos } from "@/lib/db";
import { reaisDeCentavos as reais } from "@/lib/dominio/venda";
import { veDashboardCompleto } from "@/lib/dominio/permissoes";
import { menuDoMembro } from "@/lib/equipe/menu";

// Área autenticada (SPEC-002, 5.5): a sessão é validada no servidor em toda página,
// além do proxy (INV-005). Estrutura da SPEC-016 (5.2): menu lateral, trilho ou barra
// inferior conforme a largura; o menu segue as permissões efetivas (SPEC-005, 5.5) — é
// conveniência: a barreira é a guarda no servidor de cada página e ação. A faixa do caixa
// (5.3, OPEN-005) só é calculada para quem vê o Dashboard completo (INV-002).
export default async function LayoutDaAplicacao({ children }: LayoutProps<"/">) {
  const contexto = await exigirSessao();
  const membro =
    contexto.negocioId && contexto.papel && contexto.permissoes
      ? { usuarioId: contexto.usuarioId, negocioId: contexto.negocioId, papel: contexto.papel, permissoes: contexto.permissoes }
      : null;
  const comFaixa = membro !== null && veDashboardCompleto(membro.permissoes);
  const [perfil, meusNegocios, plano, faixa] = await Promise.all([
    consultasDeAcesso().perfil(contexto.usuarioId),
    negocios().listarDoUsuario(contexto.usuarioId),
    contexto.negocioId ? planos().planoDoNegocio(contexto.negocioId) : Promise.resolve(null),
    comFaixa ? cartaoSeguro("faixa", () => carregarFaixa(dependenciasDoDashboard(membro))) : Promise.resolve(null),
  ]);
  const menu = menuDoMembro(contexto.papel, contexto.permissoes, plano ?? "GRATUITO");

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background md:flex-row">
      <Navegacao itens={menu} negocios={meusNegocios.filter((n) => !n.suspenso)} ativo={contexto.negocioId} perfil={perfil} />
      <div className="flex min-w-0 flex-1 flex-col">
        {faixa?.ok && (
          <FaixaDoCaixaCompacta
            dados={faixa.dados}
            minigrafico={
              <Minigrafico
                valores={faixa.dados.tendencia}
                largura={96}
                altura={28}
                descricao={`Saldo dos últimos 30 dias: de ${reais(faixa.dados.tendencia[0] ?? 0)} para ${reais(faixa.dados.saldoCentavos)}`}
              />
            }
          />
        )}
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-28 sm:px-6 md:pb-10 lg:px-10 lg:pt-8">{children}</main>
      </div>
      <AvisosFlutuantes />
      <Suspense fallback={null}>
        <AvisoDaUrl />
      </Suspense>
    </div>
  );
}
