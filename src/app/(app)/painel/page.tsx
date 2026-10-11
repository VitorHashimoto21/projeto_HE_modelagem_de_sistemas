import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import {
  CartaoComFalha,
  CartaoEstoque,
  CartaoGrafico,
  CartaoProjecao,
  CartaoSaldo,
  CartaoSemaforo,
  CartaoVendasDoDia,
} from "@/components/dashboard/cartoes";
import { ROTULO_ANEXO, ROTULO_ATIVIDADE_MEI, ROTULO_REGIME } from "@/components/negocio/rotulos";
import { exigirMembro } from "@/lib/auth/servidor";
import { carregarGrafico, carregarProjecao, carregarSemaforo, carregarVendasDoDia, cartaoSeguro } from "@/lib/dashboard/servicos";
import { dependenciasDoDashboard } from "@/lib/dashboard/servidor";
import { estoque, negocios } from "@/lib/db";
import { formatarCnpj } from "@/lib/dominio/cnpj";
import { CARTOES_FINANCEIROS, cartoesPermitidos, type CartaoDoDashboard } from "@/lib/dominio/dashboard";
import { competenciaDoDia } from "@/lib/dominio/financeiro";
import { pode } from "@/lib/dominio/permissoes";
import { menuDoMembro } from "@/lib/equipe/menu";
import { conferirFinanceiro } from "@/lib/financeiro/conferencia";

export const metadata: Metadata = { title: "Painel" };

const ROTULO_DO_CARTAO: Record<CartaoDoDashboard, string> = {
  vendasDoDia: "Vendas de hoje",
  saldo: "Saldo em caixa",
  estoque: "Estoque",
  semaforo: "Saúde financeira",
  grafico: "Vendas",
  projecao: "Projeção de caixa",
};

// Dashboard (SPEC-012): a página inicial do negócio (OPEN-001). "Dashboard: ver" mostra o
// restrito (vendas do dia e alertas); as partes financeiras exigem também "Financeiro: ver"
// (SPEC-005, OPEN-003). Só os cartões permitidos são carregados (INV-004).
export default async function Painel({ searchParams }: PageProps<"/painel">) {
  const membro = await exigirMembro();
  const { negocioId, papel, permissoes } = membro;
  const cartoes = cartoesPermitidos({
    dashboard: pode(permissoes, "dashboard", "ver"),
    estoque: pode(permissoes, "estoque", "ver"),
    financeiro: pode(permissoes, "financeiro", "ver"),
  });
  const tem = (c: CartaoDoDashboard) => cartoes.includes(c);

  // Conferência do Financeiro (SPEC-009, 5.5): antes de ler saldo e projeção (5.1); sem as
  // partes financeiras, depois da resposta.
  if (cartoes.some((c) => CARTOES_FINANCEIROS.includes(c))) await conferirFinanceiro(membro);
  else after(() => conferirFinanceiro(membro));

  const deps = dependenciasDoDashboard(membro);
  const busca = await searchParams;
  const visao = busca.grafico === "meses" ? "meses" : "dias";
  const nada = Promise.resolve(null);
  const [n, vendasDoDia, saldo, alertas, semaforo, grafico, projecao] = await Promise.all([
    negocios().dadosFiscais(negocioId),
    tem("vendasDoDia") ? cartaoSeguro("vendasDoDia", () => carregarVendasDoDia(deps)) : nada,
    tem("saldo") ? cartaoSeguro("saldo", () => deps.saldoAtual(deps.hoje)) : nada,
    tem("estoque") ? cartaoSeguro("estoque", () => estoque(membro).contarAlertas(deps.hoje)) : nada,
    tem("semaforo") ? cartaoSeguro("semaforo", () => carregarSemaforo(deps)) : nada,
    tem("grafico") ? cartaoSeguro("grafico", () => carregarGrafico(visao, deps)) : nada,
    tem("projecao") ? cartaoSeguro("projecao", () => carregarProjecao(deps)) : nada,
  ]);
  if (!n) notFound();

  const falha = (c: CartaoDoDashboard) => <CartaoComFalha key={c} rotulo={ROTULO_DO_CARTAO[c]} />;
  const fiscal = [
    ROTULO_REGIME[n.regime],
    n.anexoSimples && ROTULO_ANEXO[n.anexoSimples],
    n.atividadeMei && ROTULO_ATIVIDADE_MEI[n.atividadeMei],
    n.cnpj && `CNPJ ${formatarCnpj(n.cnpj)}`,
  ].filter(Boolean);
  const atalhos = cartoes.length === 0 ? menuDoMembro(papel, permissoes).filter((i) => i.href !== "/painel") : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Painel</p>
        <h1 className="font-display text-3xl font-semibold break-words text-foreground">{n.nome}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {fiscal.join(" · ")}
          {papel === "DONO" && (
            <>
              {" · "}
              <Link href="/negocio/dados" className="font-medium text-primary underline-offset-2 hover:underline">
                Dados do negócio
              </Link>
            </>
          )}
        </p>
      </div>

      {busca.salvo && (
        <p role="status" className="rounded-xl border border-status-ok/30 bg-status-ok-bg px-4 py-3 text-sm text-status-ok">
          Dados do negócio salvos.
        </p>
      )}

      {(vendasDoDia || saldo || alertas) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vendasDoDia &&
            (vendasDoDia.ok ? (
              <CartaoVendasDoDia dados={vendasDoDia.dados} podeVer={pode(permissoes, "vendas", "ver")} podeVender={pode(permissoes, "vendas", "criar")} />
            ) : (
              falha("vendasDoDia")
            ))}
          {saldo && (saldo.ok ? <CartaoSaldo centavos={saldo.dados} /> : falha("saldo"))}
          {alertas && (alertas.ok ? <CartaoEstoque alertas={alertas.dados} /> : falha("estoque"))}
        </div>
      )}

      {semaforo &&
        (semaforo.ok ? (
          <CartaoSemaforo
            estado={semaforo.dados}
            competencia={competenciaDoDia(deps.hoje)}
            linkParametros={pode(permissoes, "calculadora", "editar")}
            linkDadosDoNegocio={papel === "DONO"}
          />
        ) : (
          falha("semaforo")
        ))}

      {(grafico || projecao) && (
        <div className="space-y-6">
          {grafico && (grafico.ok ? <CartaoGrafico serie={grafico.dados} visao={visao} hoje={deps.hoje} /> : falha("grafico"))}
          {projecao && (projecao.ok ? <CartaoProjecao projecao={projecao.dados} /> : falha("projecao"))}
        </div>
      )}

      {cartoes.length === 0 && (
        // OPEN-005: sem "Dashboard: ver", o nome do negócio e atalhos para o que o membro pode usar.
        <section aria-labelledby="titulo-atalhos" className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 id="titulo-atalhos" className="font-display text-xl font-semibold text-card-foreground">
            Atalhos
          </h2>
          {atalhos.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Nenhum módulo liberado para você neste negócio. Fale com o Dono.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {atalhos.map((a) => (
                <li key={a.href}>
                  <Link href={a.href} className="inline-flex rounded-xl border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
                    {a.rotulo}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
