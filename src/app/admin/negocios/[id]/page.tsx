import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Eye, Lock } from "lucide-react";
import { ROTULO_REGIME } from "@/components/negocio/rotulos";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoBotao } from "@/components/ui/estilos";
import { Selo } from "@/components/ui/selo";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { exigirAdministrador } from "@/lib/auth/servidor";
import { suporte } from "@/lib/db";
import { dataBrasileira } from "@/lib/dominio/datas";
import { ROTULO_PLANO } from "@/lib/dominio/planos";
import { dataHoraCompleta, listaDeModulos, MENSAGENS_SUPORTE } from "@/lib/dominio/suporte";
import { acaoEntrarEmModoSuporte } from "@/lib/suporte/acoes";

export const metadata: Metadata = { title: "Negócio — administração" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ficha do negócio no painel (SPEC-018, 5.3): os mesmos metadados, a liberação ativa do Dono
// e a entrada em modo suporte — habilitada só com liberação ativa, conferida de novo no servidor.
export default async function NegocioNoPainel({ params, searchParams }: PageProps<"/admin/negocios/[id]">) {
  await exigirAdministrador();
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const n = await suporte().negocioNoPainel(id, new Date());
  if (!n) notFound();

  const dados: [string, React.ReactNode][] = [
    ["Regime", ROTULO_REGIME[n.regime]],
    ["Plano", ROTULO_PLANO[n.plano]],
    ["Criado em", dataBrasileira(n.criadoEm)],
    ["Membros", String(n.membros)],
    ["Situação", n.encerrado ? "Encerrado" : "Ativo"],
    ["Dono", n.dono ? `${n.dono.nome} (${n.dono.email})` : "—"],
  ];

  return (
    <div className="space-y-6">
      <CabecalhoDePagina voltar={{ href: "/admin", rotulo: "Negócios" }} titulo={n.nome} descricao="Dados de cadastro do negócio. Nada de vendas, valores, clientes ou estoque." />

      {typeof busca.erro === "string" && <AvisoDaPagina tom="erro">{busca.erro}</AvisoDaPagina>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Superficie aria-labelledby="titulo-cadastro">
          <TituloDaSuperficie id="titulo-cadastro" titulo="Cadastro" />
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 text-sm">
            {dados.map(([rotulo, valor]) => (
              <div key={rotulo} className="contents">
                <dt className="text-muted-foreground">{rotulo}</dt>
                <dd className="font-medium break-words text-foreground">{valor}</dd>
              </div>
            ))}
          </dl>
        </Superficie>

        <Superficie tom={n.liberacao ? "atencao" : "cartao"} aria-labelledby="titulo-suporte">
          <TituloDaSuperficie id="titulo-suporte" titulo="Acesso de suporte" />
          {n.liberacao ? (
            <div className="space-y-4">
              <Selo tom="atencao">Liberado até {dataHoraCompleta(n.liberacao.expiraEm)}</Selo>
              <p className="text-sm break-words">
                <span className="font-semibold">Motivo:</span> {n.liberacao.motivo}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Módulos:</span> {listaDeModulos(n.liberacao.modulos)} — somente leitura.
              </p>
              <p className="text-sm text-muted-foreground">Ao entrar, cada tela aberta fica registrada e o Dono acompanha tudo. Clientes e e-mails da equipe aparecem mascarados.</p>
              <form action={acaoEntrarEmModoSuporte}>
                <input type="hidden" name="negocioId" value={n.id} />
                <button type="submit" className={classeDoBotao("principal")}>
                  <Eye aria-hidden="true" />
                  Entrar em modo suporte
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="flex items-start gap-2 text-sm">
                <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {n.encerrado ? "Negócio encerrado: não há acesso de suporte." : MENSAGENS_SUPORTE.semLiberacao}
              </p>
              <button type="button" disabled className={classeDoBotao("principal")}>
                <Eye aria-hidden="true" />
                Entrar em modo suporte
              </button>
            </div>
          )}
        </Superficie>
      </div>
    </div>
  );
}
