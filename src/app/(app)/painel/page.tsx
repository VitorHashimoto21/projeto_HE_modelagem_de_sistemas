import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { ArrowDownCircle, Package, Plus, Star } from "lucide-react";
import { FaixaDoCaixaGrande } from "@/components/estrutura/faixa-do-caixa";
import { GraficoDeBarras, type PontoDeBarra } from "@/components/graficos/barras";
import { BarraEmpilhada, BarrasHorizontais } from "@/components/graficos/barras-de-parte";
import { Legenda, TabelaDeValores } from "@/components/graficos/comuns";
import { Medidor } from "@/components/graficos/medidor";
import { Minigrafico } from "@/components/graficos/minigrafico";
import { GraficoDeProjecao } from "@/components/graficos/projecao";
import { ROTULO_ANEXO, ROTULO_ATIVIDADE_MEI, ROTULO_REGIME } from "@/components/negocio/rotulos";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { classeDoBotao, classeDoLink } from "@/components/ui/estilos";
import { Numero } from "@/components/ui/numero";
import { Segmentos } from "@/components/ui/segmentos";
import { Selo } from "@/components/ui/selo";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { exigirMembro } from "@/lib/auth/servidor";
import {
  carregarAnoAnterior,
  carregarFaixa,
  carregarFormas,
  carregarGrafico,
  carregarProjecao,
  carregarSemaforo,
  carregarVendasDoDia,
  cartaoSeguro,
  MENSAGENS_DASHBOARD,
  type EstadoDoSemaforo,
} from "@/lib/dashboard/servicos";
import { dependenciasDoDashboard } from "@/lib/dashboard/servidor";
import { consultasDeAcesso, estoque, negocios } from "@/lib/db";
import { CARTOES_FINANCEIROS, cartoesPermitidos, type CartaoDoDashboard } from "@/lib/dominio/dashboard";
import { competenciaDoDia } from "@/lib/dominio/financeiro";
import { saudacao } from "@/lib/dominio/graficos";
import { pode } from "@/lib/dominio/permissoes";
import { podeNoPlano } from "@/lib/dominio/planos";
import { reaisDeCentavos as reais } from "@/lib/dominio/venda";
import { menuDoMembro } from "@/lib/equipe/menu";
import { conferirFinanceiro } from "@/lib/financeiro/conferencia";
import { planoDoMembro } from "@/lib/planos/servidor";
import { carregarRentabilidade } from "@/lib/relatorios/servicos";
import { dependenciasDosRelatorios } from "@/lib/relatorios/servidor";

export const metadata: Metadata = { title: "Painel" };

const ROTULO_DO_CARTAO: Record<CartaoDoDashboard, string> = {
  vendasDoDia: "Vendas de hoje",
  saldo: "Saldo em caixa",
  estoque: "Estoque",
  semaforo: "Como está o mês",
  grafico: "Vendas",
  projecao: "Caixa nos próximos meses",
  formas: "Como os clientes pagam",
  rentabilidade: "O que mais deixa lucro",
};

const NOMES_DOS_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const mesPorExtenso = (comp: string) => NOMES_DOS_MESES[Number(comp.slice(5, 7)) - 1];
const mesCurto = (comp: string) => mesPorExtenso(comp).slice(0, 3);
const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

function Falha({ cartao }: { cartao: CartaoDoDashboard }) {
  return (
    <Superficie aria-label={ROTULO_DO_CARTAO[cartao]}>
      <TituloDaSuperficie titulo={ROTULO_DO_CARTAO[cartao]} />
      <p className="text-sm text-muted-foreground">{MENSAGENS_DASHBOARD.falhaNoCartao}</p>
    </Superficie>
  );
}

/** Texto do semáforo (RF57), com o selo de status: nunca só cor. */
function textoDoMes(e: Extract<EstadoDoSemaforo, { status: "ok" }>) {
  const s = e.semaforo;
  if (s.cor === "vermelho") return { tom: "perigo" as const, selo: "Déficit", texto: `Faltam ${reais(s.faltaParaPeCentavos)} para cobrir as despesas do mês.` };
  if (s.cor === "amarelo")
    return { tom: "atencao" as const, selo: "Atenção", texto: `As despesas já estão pagas. Faltam ${reais(s.faltaParaMetaCentavos ?? 0)} para a meta de ${e.margemMeta}% de lucro.` };
  if (s.cor === "verde") return { tom: "ok" as const, selo: "Saudável", texto: "A meta do mês foi atingida." };
  return { tom: "ok" as const, selo: "Equilíbrio atingido", texto: "As vendas do mês já cobrem as despesas." };
}

// Painel (SPEC-012, redesenhado na SPEC-016): "Dashboard: ver" mostra o restrito (vendas
// do dia e alertas); as partes financeiras exigem também "Financeiro: ver" (SPEC-005,
// OPEN-003). Só os cartões permitidos são carregados (INV-004). Rentabilidade e ano
// anterior seguem o plano (SPEC-016, OPEN-007).
export default async function Painel({ searchParams }: PageProps<"/painel">) {
  const membro = await exigirMembro();
  const { negocioId, papel, permissoes, usuarioId } = membro;
  const cartoes = cartoesPermitidos({
    dashboard: pode(permissoes, "dashboard", "ver"),
    estoque: pode(permissoes, "estoque", "ver"),
    financeiro: pode(permissoes, "financeiro", "ver"),
    vendas: pode(permissoes, "vendas", "ver"),
  });
  const tem = (c: CartaoDoDashboard) => cartoes.includes(c);

  // Conferência do Financeiro (SPEC-009, 5.5): antes de ler saldo e projeção; sem as partes
  // financeiras, depois da resposta.
  if (cartoes.some((c) => CARTOES_FINANCEIROS.includes(c))) await conferirFinanceiro(membro);
  else after(() => conferirFinanceiro(membro));

  const deps = dependenciasDoDashboard(membro);
  const busca = await searchParams;
  const visao = busca.grafico === "meses" ? "meses" : "dias";
  const nada = Promise.resolve(null);
  const plano = await planoDoMembro(membro);
  const pago = podeNoPlano(plano, "relatorios");
  const [n, perfil, vendasDoDia, saldo, alertas, semaforo, grafico, projecao, formas, anterior, rentabilidade] = await Promise.all([
    negocios().dadosFiscais(negocioId),
    consultasDeAcesso().perfil(usuarioId),
    tem("vendasDoDia") ? cartaoSeguro("vendasDoDia", () => carregarVendasDoDia(deps)) : nada,
    tem("saldo") ? cartaoSeguro("saldo", () => carregarFaixa(deps)) : nada,
    tem("estoque") ? cartaoSeguro("estoque", () => estoque(membro).contarAlertas(deps.hoje)) : nada,
    tem("semaforo") ? cartaoSeguro("semaforo", () => carregarSemaforo(deps)) : nada,
    tem("grafico") ? cartaoSeguro("grafico", () => carregarGrafico(visao, deps)) : nada,
    tem("projecao") ? cartaoSeguro("projecao", () => carregarProjecao(deps)) : nada,
    tem("formas") ? cartaoSeguro("formas", () => carregarFormas(deps)) : nada,
    tem("grafico") && visao === "meses" && pago ? cartaoSeguro("anterior", () => carregarAnoAnterior(deps)) : nada,
    tem("rentabilidade") && pago
      ? cartaoSeguro("rentabilidade", async () => carregarRentabilidade(`${competenciaDoDia(deps.hoje)}-01`, deps.hoje, "margem", await dependenciasDosRelatorios(membro)))
      : nada,
  ]);
  if (!n) notFound();

  const primeiroNome = perfil?.nome.split(/\s+/)[0] ?? "";
  const fiscal = [ROTULO_REGIME[n.regime], n.anexoSimples && ROTULO_ANEXO[n.anexoSimples], n.atividadeMei && ROTULO_ATIVIDADE_MEI[n.atividadeMei]].filter(Boolean).join(", ");
  const atalhos = cartoes.length === 0 ? menuDoMembro(papel, permissoes, plano).filter((i) => i.href !== "/painel") : [];
  const comp = competenciaDoDia(deps.hoje);

  const pontos: PontoDeBarra[] | null =
    grafico?.ok
      ? grafico.dados.pontos.map((p, i, todos) => ({
          chave: p.periodo,
          rotulo: visao === "dias" ? diaCurto(p.periodo) : mesCurto(p.periodo),
          valorCentavos: p.totalCentavos,
          parcial: i === todos.length - 1,
          anteriorCentavos: anterior?.ok ? (anterior.dados[p.periodo] ?? 0) : null,
        }))
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-extrabold break-words text-foreground">
            {saudacao(new Date())}
            {primeiroNome && `, ${primeiroNome}`}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {n.nome}
            {fiscal && `, ${fiscal}`}
            {papel === "DONO" && (
              <>
                {". "}
                <Link href="/negocio/dados" className={classeDoLink()}>
                  Dados do negócio
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pode(permissoes, "financeiro", "criar") && (
            <Link href="/financeiro/lancar" className={classeDoBotao("secundario")}>
              <ArrowDownCircle aria-hidden="true" />
              Lançar despesa
            </Link>
          )}
          {pode(permissoes, "vendas", "criar") && (
            <Link href="/vendas/nova" className={classeDoBotao("principal")}>
              <Plus aria-hidden="true" />
              Nova venda
            </Link>
          )}
        </div>
      </div>

      {typeof busca.salvo === "string" && <AvisoDaPagina tom="sucesso">Dados do negócio salvos.</AvisoDaPagina>}

      {saldo &&
        (saldo.ok ? (
          <FaixaDoCaixaGrande
            dados={saldo.dados}
            nomeDoNegocio={n.nome}
            minigrafico={
              <Minigrafico
                valores={saldo.dados.tendencia}
                largura={260}
                altura={80}
                area
                descricao={`Saldo dos últimos 30 dias: de ${reais(saldo.dados.tendencia[0] ?? 0)} para ${reais(saldo.dados.saldoCentavos)}`}
                className="h-auto w-full"
              />
            }
          />
        ) : (
          <Falha cartao="saldo" />
        ))}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-6">
          {semaforo &&
            (!semaforo.ok ? (
              <Falha cartao="semaforo" />
            ) : semaforo.dados.status === "indisponivel" ? (
              <Superficie aria-labelledby="titulo-mes">
                <TituloDaSuperficie id="titulo-mes" titulo={`Como está ${mesPorExtenso(comp)}`} acoes={<Selo tom="neutro">Indisponível</Selo>} />
                <p className="text-sm">{semaforo.dados.mensagem}</p>
                {pode(permissoes, "calculadora", "editar") && (
                  <p className="mt-3 text-sm">
                    <Link href="/calculadora/parametros" className={classeDoLink()}>
                      Abrir os parâmetros de precificação
                    </Link>
                  </p>
                )}
              </Superficie>
            ) : (
              (() => {
                const e = semaforo.dados;
                const t = textoDoMes(e);
                return (
                  <Superficie aria-labelledby="titulo-mes">
                    <TituloDaSuperficie id="titulo-mes" titulo={`Como está ${mesPorExtenso(comp)}`} acoes={<Selo tom={t.tom}>{t.selo}</Selo>} />
                    <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                      <Numero rotulo={`Faturado até hoje, dia ${Number(deps.hoje.slice(8, 10))}`} valor={reais(e.semaforo.faturamentoCentavos)} tamanho="lg" />
                      <p className="max-w-sm pb-1 text-[15px] leading-relaxed">{t.texto}</p>
                    </div>
                    <div className="mt-6">
                      <Medidor
                        faturadoCentavos={e.semaforo.faturamentoCentavos}
                        equilibrioCentavos={e.semaforo.pontoDeEquilibrioCentavos}
                        metaCentavos={e.semaforo.metaCentavos}
                        ritmoCentavos={e.semaforo.ritmoCentavos}
                        tom={t.tom}
                      />
                    </div>
                    <Legenda
                      className="mt-2"
                      itens={[
                        { rotulo: "Faturado", marca: "barra", cor: "var(--primary)" },
                        ...(e.semaforo.ritmoCentavos !== null
                          ? [{ rotulo: <>No ritmo atual, o mês fecha em <strong>{reais(e.semaforo.ritmoCentavos)}</strong> (estimativa)</>, marca: "hachurado" as const }]
                          : []),
                      ]}
                    />
                    {e.semaforo.metaCentavos === null && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {MENSAGENS_DASHBOARD.semMeta}{" "}
                        {pode(permissoes, "calculadora", "editar") && (
                          <Link href="/calculadora/parametros" className={classeDoLink()}>
                            Configurar
                          </Link>
                        )}
                      </p>
                    )}
                  </Superficie>
                );
              })()
            ))}

          {grafico &&
            (grafico.ok && pontos ? (
              <Superficie aria-labelledby="titulo-vendas">
                <TituloDaSuperficie
                  id="titulo-vendas"
                  titulo="Vendas"
                  descricao={`Total ${visao === "dias" ? "nos últimos 30 dias" : "nos últimos 12 meses"}: ${reais(grafico.dados.totalCentavos)}`}
                  acoes={
                    <Segmentos
                      rotulo="Período do gráfico"
                      itens={[
                        { href: "/painel", rotulo: "30 dias", ativo: visao === "dias" },
                        { href: "/painel?grafico=meses", rotulo: "12 meses", ativo: visao === "meses" },
                      ]}
                    />
                  }
                />
                <GraficoDeBarras
                  pontos={pontos}
                  descricao={`Vendas ${visao === "dias" ? "por dia nos últimos 30 dias" : "por mês nos últimos 12 meses"}; total ${reais(grafico.dados.totalCentavos)}`}
                  rotuloParcial={visao === "dias" ? "até agora" : "até hoje"}
                />
                <Legenda
                  className="mt-3"
                  itens={[
                    { rotulo: "Vendas", marca: "barra", cor: "var(--chart-1)" },
                    { rotulo: visao === "dias" ? "Hoje, até agora" : `${mesPorExtenso(comp)}, até hoje`, marca: "hachurado" },
                    { rotulo: "Média do período", marca: "tracejado" },
                    ...(anterior?.ok ? [{ rotulo: "Mesmo mês, ano anterior", marca: "linha" as const }] : []),
                  ]}
                />
                {visao === "meses" && !pago && (
                  <p className="mt-3 text-[13px] text-muted-foreground">
                    <Star className="mr-1 inline size-3.5 text-ambar" aria-hidden="true" />
                    No plano pago, cada mês mostra também o mesmo mês do ano anterior.
                  </p>
                )}
                <TabelaDeValores
                  className="mt-3"
                  legenda="Vendas por período"
                  colunas={anterior?.ok ? [visao === "dias" ? "Dia" : "Mês", "Vendas", "Ano anterior"] : [visao === "dias" ? "Dia" : "Mês", "Vendas"]}
                  linhas={[...pontos].reverse().map((p) => [p.rotulo + (p.parcial ? " (até agora)" : ""), reais(p.valorCentavos), ...(anterior?.ok ? [reais(p.anteriorCentavos ?? 0)] : [])])}
                />
              </Superficie>
            ) : (
              <Falha cartao="grafico" />
            ))}

          {projecao &&
            (projecao.ok ? (
              <Superficie aria-labelledby="titulo-projecao">
                <TituloDaSuperficie id="titulo-projecao" titulo="Caixa nos próximos meses" descricao={MENSAGENS_DASHBOARD.rodapeProjecao} />
                <GraficoDeProjecao
                  meses={projecao.dados.meses.map((m) => ({
                    chave: m.competencia,
                    nome: mesPorExtenso(m.competencia).replace(/^./, (c) => c.toUpperCase()),
                    curto: mesCurto(m.competencia),
                    entradasCentavos: m.entradasCentavos,
                    saidasCentavos: m.saidasCentavos,
                    saldoCentavos: m.saldoProjetadoCentavos,
                  }))}
                  descricao="Entradas previstas acima e saídas abaixo da linha do zero, com o saldo previsto em linha"
                />
                <Legenda
                  className="mt-2"
                  itens={[
                    { rotulo: "Entradas previstas", marca: "barra", cor: "var(--chart-1)" },
                    { rotulo: "Saídas previstas", marca: "barra", cor: "var(--chart-2)" },
                    { rotulo: "Saldo previsto", marca: "linha" },
                  ]}
                />
                {projecao.dados.atrasadas.quantidade > 0 && (
                  <AvisoDaPagina tom="atencao" className="mt-3">
                    {projecao.dados.atrasadas.quantidade} {projecao.dados.atrasadas.quantidade === 1 ? "conta atrasada entra" : "contas atrasadas entram"} no mês atual
                    {projecao.dados.atrasadas.entradasCentavos > 0 && `, ${reais(projecao.dados.atrasadas.entradasCentavos)} a receber`}
                    {projecao.dados.atrasadas.saidasCentavos > 0 && `, ${reais(projecao.dados.atrasadas.saidasCentavos)} a pagar`}.{" "}
                    <Link href={`/financeiro/contas?tipo=${projecao.dados.atrasadas.saidasCentavos > 0 ? "PAGAR" : "RECEBER"}&situacao=atrasadas`}>Ver as contas</Link>
                  </AvisoDaPagina>
                )}
                <TabelaDeValores
                  className="mt-3"
                  legenda="Caixa previsto por mês"
                  colunas={["Mês", "Entradas", "Saídas", "Saldo previsto"]}
                  linhas={projecao.dados.meses.map((m) => [mesPorExtenso(m.competencia), reais(m.entradasCentavos), reais(m.saidasCentavos), reais(m.saldoProjetadoCentavos)])}
                />
              </Superficie>
            ) : (
              <Falha cartao="projecao" />
            ))}
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
          {vendasDoDia &&
            (vendasDoDia.ok ? (
              <Superficie aria-labelledby="titulo-hoje">
                <TituloDaSuperficie id="titulo-hoje" titulo="Vendas de hoje" />
                <Numero
                  rotulo={vendasDoDia.dados.quantidade === 0 ? "Nenhuma venda ainda" : `${vendasDoDia.dados.quantidade} ${vendasDoDia.dados.quantidade === 1 ? "venda" : "vendas"}, média ${reais(vendasDoDia.dados.ticketMedioCentavos ?? 0)}`}
                  valor={reais(vendasDoDia.dados.totalCentavos)}
                  tamanho="md"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {pode(permissoes, "vendas", "ver") && vendasDoDia.dados.quantidade > 0 && (
                    <Link href="/vendas?periodo=hoje" className={classeDoBotao("secundario", "sm")}>
                      Ver as vendas de hoje
                    </Link>
                  )}
                  {pode(permissoes, "vendas", "criar") && vendasDoDia.dados.quantidade === 0 && (
                    <Link href="/vendas/nova" className={classeDoBotao("principal", "sm")}>
                      Nova venda
                    </Link>
                  )}
                </div>
              </Superficie>
            ) : (
              <Falha cartao="vendasDoDia" />
            ))}

          {formas &&
            (formas.ok ? (
              <Superficie aria-labelledby="titulo-formas">
                <TituloDaSuperficie id="titulo-formas" titulo="Como os clientes pagam" descricao={`${mesPorExtenso(comp).replace(/^./, (c) => c.toUpperCase())} até hoje`} />
                <BarraEmpilhada
                  itens={formas.dados.itens}
                  descricao={formas.dados.itens.map((i) => `${i.nome} ${reais(i.valorCentavos)}`).join(", ")}
                />
                {formas.dados.taxaCentavos > 0 && (
                  <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                    No cartão, a taxa média da maquininha ({formas.dados.taxaCartao.toLocaleString("pt-BR")}%) fica com cerca de{" "}
                    <strong className="text-foreground">{reais(formas.dados.taxaCentavos)}</strong> neste mês.
                  </p>
                )}
              </Superficie>
            ) : (
              <Falha cartao="formas" />
            ))}

          {tem("rentabilidade") &&
            (pago ? (
              rentabilidade?.ok ? (
                <Superficie aria-labelledby="titulo-rent">
                  <TituloDaSuperficie
                    id="titulo-rent"
                    titulo="O que mais deixa lucro"
                    descricao={`Margem em ${mesPorExtenso(comp)}, depois do custo`}
                    acoes={
                      <Link href="/relatorios" className={classeDoLink("text-sm")}>
                        Relatório
                      </Link>
                    }
                  />
                  {rentabilidade.dados.itens.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ainda sem vendas neste mês.</p>
                  ) : (
                    <BarrasHorizontais
                      itens={rentabilidade.dados.itens.slice(0, 5).map((i) => ({
                        chave: i.itemId,
                        nome: i.nome,
                        valorCentavos: i.margemCentavos,
                        detalhe: i.margemPercentual === null ? undefined : `${i.margemPercentual.toLocaleString("pt-BR")}%`,
                      }))}
                    />
                  )}
                </Superficie>
              ) : (
                <Falha cartao="rentabilidade" />
              )
            ) : (
              <Superficie aria-labelledby="titulo-rent">
                <TituloDaSuperficie id="titulo-rent" titulo="O que mais deixa lucro" acoes={<Selo tom="info">Plano pago</Selo>} />
                <p className="text-sm text-muted-foreground">Veja quanto cada produto e serviço deixa de margem depois do custo.</p>
                <p className="mt-3 text-sm">
                  {papel === "DONO" ? (
                    <Link href="/negocio/plano" className={classeDoLink()}>
                      Conhecer o plano pago
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Peça ao Dono do negócio para mudar para o plano pago.</span>
                  )}
                </p>
              </Superficie>
            ))}

          {alertas &&
            (alertas.ok ? (
              <Superficie aria-labelledby="titulo-estoque">
                <TituloDaSuperficie
                  id="titulo-estoque"
                  titulo="Estoque"
                  acoes={
                    <Link href={alertas.dados.baixo + alertas.dados.semEstoque > 0 ? "/estoque?situacao=baixo" : "/estoque"} className={classeDoLink("text-sm")}>
                      Ver estoque
                    </Link>
                  }
                />
                {alertas.dados.baixo + alertas.dados.semEstoque === 0 ? (
                  <p className="flex items-center gap-2 text-sm">
                    <Package className="size-4 text-primary" aria-hidden="true" />
                    Nenhum produto com estoque baixo.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {alertas.dados.semEstoque > 0 && (
                      <Selo tom="perigo">
                        {alertas.dados.semEstoque} sem estoque
                      </Selo>
                    )}
                    {alertas.dados.baixo > 0 && (
                      <Selo tom="atencao">
                        {alertas.dados.baixo} com estoque baixo
                      </Selo>
                    )}
                  </div>
                )}
              </Superficie>
            ) : (
              <Falha cartao="estoque" />
            ))}
        </div>
      </div>

      {cartoes.length === 0 && (
        // SPEC-012, OPEN-005: sem "Dashboard: ver", atalhos para o que o membro pode usar.
        <Superficie aria-labelledby="titulo-atalhos">
          <TituloDaSuperficie id="titulo-atalhos" titulo="Atalhos" />
          {atalhos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum módulo liberado para você neste negócio. Fale com o Dono.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {atalhos.map((a) => (
                <li key={a.href}>
                  <Link href={a.href} className={classeDoBotao("secundario")}>
                    {a.rotulo}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Superficie>
      )}
    </div>
  );
}
