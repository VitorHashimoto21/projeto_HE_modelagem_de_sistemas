import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, TriangleAlert } from "lucide-react";
import { FormularioExclusao } from "@/components/conta/exclusao";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDaSuperficie, classeDoBotao } from "@/components/ui/estilos";
import { exigirSessao } from "@/lib/auth/servidor";
import { ROTA_ENTRAR } from "@/lib/auth/rotas";
import { lgpd } from "@/lib/db";
import { dataBrasileira } from "@/lib/dominio/datas";
import { ROTULO_PAPEL } from "@/lib/dominio/permissoes";

export const metadata: Metadata = { title: "Minha conta" };

const cartao = classeDaSuperficie("cartao", "p-5 sm:p-6");

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b py-3 last:border-b-0 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm font-medium break-words text-foreground sm:text-right">{valor}</dd>
    </div>
  );
}

// Minha conta (SPEC-014, 5.1): dados do titular, exportação (RNF04) e exclusão (RN27). Só o
// usuário da sessão; aberta mesmo sem negócio ativo.
export default async function MinhaConta() {
  const { usuarioId, termosPendentes } = await exigirSessao();
  const consultas = lgpd();
  const [perfil, resumo] = await Promise.all([consultas.perfil(usuarioId), consultas.resumoDaExclusao(usuarioId)]);
  if (!perfil || !resumo) redirect(ROTA_ENTRAR);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <CabecalhoDePagina titulo="Minha conta" descricao="Seus dados pessoais, a exportação e a exclusão da conta." />

      {termosPendentes && (
        // SPEC-018 (RF78): até aceitar a versão vigente, só esta página e Sair ficam abertas.
        <AvisoDaPagina tom="atencao">
          Atualizamos a Política de Privacidade e os Termos de Uso. <Link href="/aceite-dos-termos">Ler e aceitar a nova versão</Link> para voltar a usar o app.
        </AvisoDaPagina>
      )}

      <section aria-labelledby="titulo-dados" className={cartao}>
        <h2 id="titulo-dados" className="mb-1 text-[17px] font-bold text-card-foreground">
          Seus dados
        </h2>
        <dl>
          <Linha rotulo="Nome" valor={perfil.nome} />
          <Linha rotulo="E-mail" valor={perfil.email} />
          <Linha rotulo="Conta criada em" valor={dataBrasileira(perfil.createdAt)} />
          <Linha rotulo="Consentimento (cadastro)" valor={perfil.consentimentoLgpdEm ? dataBrasileira(perfil.consentimentoLgpdEm) : "—"} />
          {/* SPEC-018 (RF78): a versão aceita por último e quando. */}
          <Linha
            rotulo="Política e termos aceitos"
            valor={
              perfil.versaoTermosAceita
                ? `Versão ${perfil.versaoTermosAceita}${(perfil.termosAceitosEm ?? perfil.consentimentoLgpdEm) ? `, em ${dataBrasileira((perfil.termosAceitosEm ?? perfil.consentimentoLgpdEm)!)}` : ""}`
                : "—"
            }
          />
        </dl>
      </section>

      <section aria-labelledby="titulo-exportar" className={cartao}>
        <h2 id="titulo-exportar" className="text-[17px] font-bold text-card-foreground">
          Exportar meus dados
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Um arquivo .zip com tudo em JSON e uma planilha (CSV) por tabela: seus dados, seus vínculos, os dados completos dos negócios em que você é o Dono e, dos
          negócios de outros Donos, o que você registrou.
        </p>
        <a href="/conta/exportar" download className={classeDoBotao("secundario", "md", "mt-4")}>
          <Download aria-hidden="true" />
          Exportar meus dados (.zip)
        </a>
      </section>

      <section aria-labelledby="titulo-excluir" className="rounded-2xl bg-card p-5 ring-1 ring-status-danger/30 sm:p-6">
        <h2 id="titulo-excluir" className="flex items-center gap-2 text-[17px] font-bold text-status-danger">
          <TriangleAlert className="size-4.5" aria-hidden="true" />
          Excluir minha conta
        </h2>
        <div className="mt-2 space-y-2 text-sm text-foreground">
          <p>Seu acesso é bloqueado na hora e seus dados pessoais (nome, e-mail e senha) são anonimizados. Exporte seus dados antes, se quiser guardá-los.</p>
          {resumo.encerrar.length > 0 && (
            <div className="rounded-lg bg-status-danger-bg px-4 py-3">
              <p className="font-medium text-status-danger">Negócios que serão encerrados (você é o Dono):</p>
              <ul className="mt-1 list-disc pl-5">
                {resumo.encerrar.map((n) => (
                  <li key={n.id}>
                    <span className="font-medium">{n.nome}</span>
                    {n.membrosAfetados > 0 && ` — ${n.membrosAfetados} ${n.membrosAfetados === 1 ? "pessoa da equipe perde" : "pessoas da equipe perdem"} o acesso`}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Os clientes desses negócios são anonimizados. Vendas, lançamentos, contas e movimentações ficam guardados por 5 anos, sem identificação, por obrigação
                legal.
              </p>
            </div>
          )}
          {resumo.deixar.length > 0 && (
            <p>
              Você vai deixar: {resumo.deixar.map((n) => `${n.nome} (${ROTULO_PAPEL[n.papel]})`).join(", ")}. O que você registrou nesses negócios continua lá, como
              &ldquo;Usuário excluído&rdquo;.
            </p>
          )}
        </div>
        <div className="mt-5">
          <FormularioExclusao email={resumo.email} />
        </div>
      </section>
    </div>
  );
}
