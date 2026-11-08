import { Suspense } from "react";
import { AtualizadorDasFaixas } from "@/components/estrutura/atualizador-das-faixas";
import { FaixaDoCaixaCompacta } from "@/components/estrutura/faixa-do-caixa";
import { Navegacao } from "@/components/estrutura/navegacao";
import { Minigrafico } from "@/components/graficos/minigrafico";
import { FaixaDaEmergencia, FaixaDaSuspensao, FaixaDoModoSuporte, FaixaDoSuporteLiberado } from "@/components/suporte/faixas";
import { AvisoDaUrl, AvisosFlutuantes } from "@/components/ui/avisos-flutuantes";
import { exigirSessao } from "@/lib/auth/servidor";
import { carregarFaixa, cartaoSeguro } from "@/lib/dashboard/servicos";
import { dependenciasDoDashboard } from "@/lib/dashboard/servidor";
import { consultasDeAcesso, negocios } from "@/lib/db";
import { MOTIVO_CURTO_DA_EMERGENCIA } from "@/lib/dominio/emergencia";
import { reaisDeCentavos as reais } from "@/lib/dominio/venda";
import { veDashboardCompleto } from "@/lib/dominio/permissoes";
import { menuDoMembro, menuDoSuporte } from "@/lib/equipe/menu";
import { carregarFaixas } from "@/lib/estrutura/faixas";

// Área autenticada (SPEC-002, 5.5): a sessão é validada no servidor em toda página,
// além do proxy (INV-005). Estrutura da SPEC-016 (5.2): menu lateral, trilho ou barra
// inferior conforme a largura; o menu segue as permissões efetivas (SPEC-005, 5.5) — é
// conveniência: a barreira é a guarda no servidor de cada página e ação. A faixa do caixa
// (5.3, OPEN-005) só é calculada para quem vê o Dashboard completo (INV-002).
// SPEC-018: no modo suporte, o menu tem só os módulos liberados e a faixa do modo suporte fica
// fixa no topo; para a equipe do negócio, a faixa do acesso liberado aparece enquanto ele valer.
// SPEC-019 (5.7): com o negócio suspenso, a faixa da suspensão aparece para todos os membros.
// Este layout não é recalculado ao navegar (o Next.js troca só a página): o AtualizadorDasFaixas
// confere a assinatura das faixas e do menu e atualiza o layout quando outra pessoa muda o estado
// (emergência, suspensão, liberação, plano, permissões) — correção da homologação da SPEC-019 (T17).
export default async function LayoutDaAplicacao({ children, gaveta }: LayoutProps<"/">) {
  const contexto = await exigirSessao();
  const modoSuporte = contexto.suporte ?? null;
  const membro =
    contexto.negocioId && contexto.permissoes && (contexto.papel || modoSuporte)
      ? { usuarioId: contexto.usuarioId, negocioId: contexto.negocioId, papel: contexto.papel, permissoes: contexto.permissoes, modoSuporte: modoSuporte !== null }
      : null;
  const comFaixa = membro !== null && veDashboardCompleto(membro.permissoes);
  // Plano, liberação e emergência (5.6, INV-007) vêm de carregarFaixas, com a assinatura que o
  // AtualizadorDasFaixas compara a cada navegação: este layout não é recalculado ao navegar.
  const [perfil, meusNegocios, faixa, { plano, liberacao, emergencia, assinatura }] = await Promise.all([
    consultasDeAcesso().perfil(contexto.usuarioId),
    contexto.administrador ? Promise.resolve([]) : negocios().listarDoUsuario(contexto.usuarioId),
    comFaixa ? cartaoSeguro("faixa", () => carregarFaixa(dependenciasDoDashboard(membro))) : Promise.resolve(null),
    carregarFaixas(contexto, new Date()),
  ]);
  const menu = modoSuporte && contexto.permissoes ? menuDoSuporte(contexto.permissoes) : menuDoMembro(contexto.papel, contexto.permissoes, plano ?? "GRATUITO");

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background md:flex-row">
      <Navegacao
        itens={menu}
        negocios={meusNegocios.filter((n) => !n.suspenso)}
        ativo={contexto.negocioId}
        perfil={perfil}
        administrador={contexto.administrador ? { negocio: modoSuporte?.negocio ?? null } : undefined}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {modoSuporte && (
          <FaixaDoModoSuporte
            negocio={modoSuporte.negocio}
            expiraEm={modoSuporte.expiraEm}
            corrigir={modoSuporte.modulosComCorrecao}
            correcaoPendente={modoSuporte.correcaoPendente}
            emergencia={modoSuporte.emergencia}
            suspenso={Boolean(contexto.negocioSuspenso)}
          />
        )}
        {/* SPEC-019 (5.7): a faixa da suspensão para todos os membros, antes das do suporte. */}
        {membro && !modoSuporte && contexto.negocioSuspenso && <FaixaDaSuspensao suspensao={contexto.negocioSuspenso} ehDono={membro.papel === "DONO"} />}
        {emergencia && <FaixaDaEmergencia acessoId={emergencia.id} motivo={MOTIVO_CURTO_DA_EMERGENCIA[emergencia.motivo]} expiraEm={emergencia.expiraEm} ehDono={membro?.papel === "DONO"} />}
        {liberacao && (
          <FaixaDoSuporteLiberado
            modulos={liberacao.modulos}
            modulosComCorrecao={liberacao.modulosComCorrecao}
            expiraEm={liberacao.expiraEm}
            ehDono={membro?.papel === "DONO"}
            suspenso={Boolean(contexto.negocioSuspenso)}
          />
        )}
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
      {gaveta}
      <AtualizadorDasFaixas assinatura={assinatura} />
      <AvisosFlutuantes />
      <Suspense fallback={null}>
        <AvisoDaUrl />
      </Suspense>
    </div>
  );
}
