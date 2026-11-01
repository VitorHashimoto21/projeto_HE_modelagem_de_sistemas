import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Pencil, Receipt } from "lucide-react";
import { SeloParaNota } from "@/components/clientes/selo-para-nota";
import { reais, SeloDaConta } from "@/components/financeiro/exibicao";
import { ExcluirFornecedor } from "@/components/fornecedores/excluir-fornecedor";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao, classeDoLink } from "@/components/ui/estilos";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { FornecedorNaoEncontrado, fornecedores, LIMITE_DE_CONTAS_DO_FORNECEDOR } from "@/lib/db";
import { nomeDeExibicao, ROTULO_SITUACAO_IE, ROTULO_TIPO_CLIENTE, textoDoQueFalta } from "@/lib/dominio/cliente";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";

export const metadata: Metadata = { title: "Fornecedor" };

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b py-3 last:border-b-0 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm font-medium break-words text-foreground sm:text-right">{valor || "—"}</dd>
    </div>
  );
}

/** Endereço numa linha: "Rua X, 123, apto 4 — Bairro, Município/UF, CEP 00000-000". */
function endereco(c: { logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; municipio: string | null; uf: string | null; cep: string | null }) {
  const rua = [c.logradouro, c.numero, c.complemento].filter(Boolean).join(", ");
  const cidade = c.municipio && c.uf ? `${c.municipio}/${c.uf}` : (c.municipio ?? c.uf);
  const resto = [c.bairro, cidade, c.cep && `CEP ${c.cep}`].filter(Boolean).join(", ");
  return [rua, resto].filter(Boolean).join(" — ");
}

// Detalhe do fornecedor (SPEC-026, 5.1, item 7): Financeiro — ver. Os dados chegam do servidor já
// com a máscara de quem vê (5.2); as contas a pagar e as despesas fixas ligadas a ele, com os totais.
export default async function DetalheDoFornecedor({ params, searchParams }: PageProps<"/financeiro/fornecedores/[id]">) {
  const membro = await exigirPermissao("financeiro", "ver");
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  const consultas = fornecedores(membro);
  const [{ fornecedor: f, contas, quantidadeDeContas, pagoCentavos, emAbertoCentavos, despesas }, vinculos] = await Promise.all([
    consultas.detalhar(id, hoje()),
    consultas.vinculos(id),
  ]).catch((e) => {
    if (e instanceof FornecedorNaoEncontrado) notFound();
    throw e;
  });
  const suporte = membro.modoSuporte === true;
  const podeEditar = !suporte && pode(membro.permissoes, "financeiro", "editar");
  const podeExcluir = !suporte && pode(membro.permissoes, "financeiro", "excluir");
  const empresa = f.tipo === "PESSOA_JURIDICA";
  const nome = nomeDeExibicao(f);

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        voltar={{ href: "/financeiro/fornecedores", rotulo: "Fornecedores" }}
        titulo={<span className="break-words">{nome}</span>}
        descricao={
          <span className="inline-flex flex-wrap items-center gap-2">
            {ROTULO_TIPO_CLIENTE[f.tipo]}
            <SeloParaNota completo={f.faltando.length === 0} />
          </span>
        }
        acoes={
          podeEditar && (
            <Link href={`/financeiro/fornecedores/${f.id}/editar`} className={classeDoBotao("secundario", "sm")}>
              <Pencil aria-hidden="true" />
              Editar
            </Link>
          )
        }
      />

      {busca.salvo && <AvisoDaPagina tom="sucesso">Fornecedor salvo.</AvisoDaPagina>}
      {f.faltando.length > 0 && (
        <AvisoDaPagina
          tom="atencao"
          acao={
            podeEditar && (
              <Link href={`/financeiro/fornecedores/${f.id}/editar`} className="font-semibold underline underline-offset-2">
                Completar
              </Link>
            )
          }
        >
          {textoDoQueFalta(f.faltando)}.
        </AvisoDaPagina>
      )}
      {f.visao === "mascarada" && (
        <p className="text-sm text-muted-foreground">Documento, e-mail, telefone e endereço aparecem em parte. Os dados completos ficam com quem pode editar no Financeiro.</p>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Superficie aria-labelledby="titulo-dados">
            <TituloDaSuperficie id="titulo-dados" titulo="Dados do fornecedor" />
            <dl>
              <Linha rotulo={empresa ? "Razão social" : "Nome"} valor={f.nome} />
              {empresa && <Linha rotulo="Nome fantasia" valor={f.nomeFantasia} />}
              <Linha rotulo={empresa ? "CNPJ" : "CPF"} valor={f.documento && <span className="tabular-nums">{f.documento}</span>} />
              {empresa && (
                <>
                  <Linha
                    rotulo="Inscrição estadual"
                    valor={f.situacaoIe && (f.situacaoIe === "CONTRIBUINTE" && f.inscricaoEstadual ? `${f.inscricaoEstadual} (contribuinte do ICMS)` : ROTULO_SITUACAO_IE[f.situacaoIe])}
                  />
                  <Linha rotulo="Inscrição municipal" valor={f.inscricaoMunicipal} />
                  <Linha rotulo="Nome do contato" valor={f.nomeContato} />
                </>
              )}
              <Linha rotulo="Telefone" valor={f.telefone && <span className="tabular-nums">{f.telefone}</span>} />
              <Linha rotulo="E-mail" valor={f.email} />
              <Linha rotulo="Endereço" valor={endereco(f)} />
            </dl>
          </Superficie>

          {despesas.length > 0 && (
            <Superficie aria-labelledby="titulo-despesas">
              <TituloDaSuperficie id="titulo-despesas" titulo="Despesas fixas" descricao="As contas que elas gerarem já nascem com este fornecedor." />
              <ul className="divide-y">
                {despesas.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <Link href={`/financeiro/despesas-fixas/${d.id}`} className={classeDoLink()}>
                      {d.descricao}
                    </Link>
                    <span className="text-muted-foreground">{d.ativo ? "Ativa" : "Desativada"}</span>
                  </li>
                ))}
              </ul>
            </Superficie>
          )}

          {podeExcluir && (
            <div className="px-1 text-sm">
              <ExcluirFornecedor fornecedorId={f.id} nome={nome} contas={vinculos.contas} despesas={vinculos.despesas} />
              <p className="mt-1 text-muted-foreground">
                {vinculos.contas + vinculos.despesas === 0
                  ? "Sem contas nem despesas fixas: o cadastro é apagado."
                  : "Com contas ou despesas fixas: os dados do fornecedor são apagados e as contas continuam registradas."}
              </p>
            </div>
          )}
        </div>

        <Superficie aria-labelledby="titulo-contas" espaco="nenhum" className="w-full lg:w-[28rem]">
          <div className="px-6 pt-6">
            <TituloDaSuperficie
              id="titulo-contas"
              titulo="Contas a pagar"
              descricao={quantidadeDeContas > 0 ? `${quantidadeDeContas} ${quantidadeDeContas === 1 ? "conta" : "contas"} · pago ${reais(pagoCentavos)} · em aberto ${reais(emAbertoCentavos)}` : undefined}
            />
          </div>
          {contas.length === 0 ? (
            <EstadoVazio Icone={Receipt} titulo="Nenhuma conta ligada" className="pt-2" />
          ) : (
            <>
              <ul className="divide-y border-t">
                {contas.map((c) => (
                  <li key={c.id}>
                    <Link href={`/financeiro/contas/${c.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-semibold break-words text-foreground">{c.descricao ?? "Conta"}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          Vence em {c.vencimento}
                          {c.numeroDocumento && `, documento ${c.numeroDocumento}`}
                        </p>
                        <SeloDaConta tipo="PAGAR" status={c.status} atrasada={c.atrasada} />
                      </div>
                      <p className="font-bold tabular-nums">{reais(c.valorCentavos)}</p>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              {quantidadeDeContas > LIMITE_DE_CONTAS_DO_FORNECEDOR && (
                <p className="border-t px-6 py-3 text-sm text-muted-foreground">
                  Mostrando as {LIMITE_DE_CONTAS_DO_FORNECEDOR} mais recentes.{" "}
                  <Link href={`/financeiro/contas?tipo=PAGAR&situacao=todas&pessoa=${f.id}`} className={classeDoLink()}>
                    Ver todas nas contas
                  </Link>
                </p>
              )}
            </>
          )}
        </Superficie>
      </div>
    </div>
  );
}
