import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Pencil, Receipt } from "lucide-react";
import { ExcluirCliente } from "@/components/clientes/excluir-cliente";
import { SeloParaNota } from "@/components/clientes/selo-para-nota";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao } from "@/components/ui/estilos";
import { Selo } from "@/components/ui/selo";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { brl } from "@/components/vendas/rotulos";
import { exigirPermissao } from "@/lib/auth/servidor";
import { ClienteNaoEncontrado, clientes, LIMITE_DE_COMPRAS } from "@/lib/db";
import { nomeDeExibicao, ROTULO_SITUACAO_IE, ROTULO_TIPO_CLIENTE, textoDoQueFalta } from "@/lib/dominio/cliente";
import { pode } from "@/lib/dominio/permissoes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cliente" };

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

// Detalhe do cliente (SPEC-022, 5.3; OPEN-008): Vendas — ver. Os dados chegam do servidor já com a
// máscara de quem vê (5.5); as compras vêm do histórico de vendas do negócio.
export default async function DetalheDoCliente({ params, searchParams }: PageProps<"/vendas/clientes/[id]">) {
  const membro = await exigirPermissao("vendas", "ver");
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  const { cliente: c, compras, quantidadeDeCompras, totalComprado } = await clientes(membro)
    .detalhar(id)
    .catch((e) => {
      if (e instanceof ClienteNaoEncontrado) notFound();
      throw e;
    });
  const suporte = membro.modoSuporte === true;
  const podeEditar = !suporte && pode(membro.permissoes, "vendas", "editar");
  const podeExcluir = !suporte && pode(membro.permissoes, "vendas", "excluir");
  const empresa = c.tipo === "PESSOA_JURIDICA";
  const nome = nomeDeExibicao(c);

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        voltar={{ href: "/vendas/clientes", rotulo: "Clientes" }}
        titulo={<span className="break-words">{nome}</span>}
        descricao={
          <span className="inline-flex flex-wrap items-center gap-2">
            {ROTULO_TIPO_CLIENTE[c.tipo]}
            <SeloParaNota completo={c.faltando.length === 0} />
          </span>
        }
        acoes={
          podeEditar && (
            <Link href={`/vendas/clientes/${c.id}/editar`} className={classeDoBotao("secundario", "sm")}>
              <Pencil aria-hidden="true" />
              Editar
            </Link>
          )
        }
      />

      {busca.salvo && <AvisoDaPagina tom="sucesso">Cliente salvo.</AvisoDaPagina>}
      {c.faltando.length > 0 && (
        <AvisoDaPagina
          tom="atencao"
          acao={
            podeEditar && (
              <Link href={`/vendas/clientes/${c.id}/editar`} className="font-semibold underline underline-offset-2">
                Completar
              </Link>
            )
          }
        >
          {textoDoQueFalta(c.faltando)}.
        </AvisoDaPagina>
      )}
      {c.visao === "mascarada" && (
        <p className="text-sm text-muted-foreground">Documento, e-mail, telefone e endereço aparecem em parte. Os dados completos ficam com quem pode editar as vendas.</p>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Superficie aria-labelledby="titulo-dados">
            <TituloDaSuperficie id="titulo-dados" titulo="Dados do cliente" />
            <dl>
              <Linha rotulo={empresa ? "Razão social" : "Nome"} valor={c.nome} />
              {empresa && <Linha rotulo="Nome fantasia" valor={c.nomeFantasia} />}
              <Linha rotulo={empresa ? "CNPJ" : "CPF"} valor={c.documento && <span className="tabular-nums">{c.documento}</span>} />
              {empresa && (
                <>
                  <Linha
                    rotulo="Inscrição estadual"
                    valor={c.situacaoIe && (c.situacaoIe === "CONTRIBUINTE" && c.inscricaoEstadual ? `${c.inscricaoEstadual} (contribuinte do ICMS)` : ROTULO_SITUACAO_IE[c.situacaoIe])}
                  />
                  <Linha rotulo="Inscrição municipal" valor={c.inscricaoMunicipal} />
                  <Linha rotulo="Nome de quem compra" valor={c.nomeContato} />
                </>
              )}
              <Linha rotulo="Telefone" valor={c.telefone && <span className="tabular-nums">{c.telefone}</span>} />
              <Linha rotulo="E-mail" valor={c.email} />
              <Linha rotulo="Endereço" valor={endereco(c)} />
            </dl>
          </Superficie>
          {podeExcluir && (
            <div className="px-1 text-sm">
              <ExcluirCliente clienteId={c.id} nome={nome} compras={quantidadeDeCompras} />
              <p className="mt-1 text-muted-foreground">
                {quantidadeDeCompras === 0 ? "Sem compras: o cadastro é apagado." : "Com compras: os dados pessoais são apagados e as vendas continuam registradas."}
              </p>
            </div>
          )}
        </div>

        <Superficie aria-labelledby="titulo-compras" espaco="nenhum" className="w-full lg:w-[28rem]">
          <div className="px-6 pt-6">
            <TituloDaSuperficie
              id="titulo-compras"
              titulo="Compras"
              descricao={
                quantidadeDeCompras > 0
                  ? `${quantidadeDeCompras} ${quantidadeDeCompras === 1 ? "compra" : "compras"} · total de ${brl(totalComprado)}`
                  : undefined
              }
            />
          </div>
          {compras.length === 0 ? (
            <EstadoVazio Icone={Receipt} titulo="Nenhuma compra registrada" className="pt-2" />
          ) : (
            <>
              <ul className="divide-y border-t">
                {compras.map((v) => (
                  <li key={v.id}>
                    <Link href={`/vendas/${v.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">
                          Venda nº {v.numero}
                          {v.troca && (
                            <Selo tom="info" className="ml-2">
                              Troca
                            </Selo>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {v.data}, {v.cancelada ? "Cancelada" : "Concluída"}
                        </p>
                      </div>
                      <p className={cn("font-bold tabular-nums", v.cancelada && "text-muted-foreground line-through")}>{brl(v.valor)}</p>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              {quantidadeDeCompras > LIMITE_DE_COMPRAS && (
                <p className="border-t px-6 py-3 text-sm text-muted-foreground">Mostrando as {LIMITE_DE_COMPRAS} mais recentes.</p>
              )}
            </>
          )}
        </Superficie>
      </div>
    </div>
  );
}
