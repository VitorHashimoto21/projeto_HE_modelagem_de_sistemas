import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, PackageSearch } from "lucide-react";
import { reais } from "@/components/catalogo/rotulos";
import { quantidade } from "@/components/estoque/situacao";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoCampo } from "@/components/ui/classes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao } from "@/components/ui/estilos";
import { Superficie } from "@/components/ui/superficie";
import { exigirMembroForaDoSuporte } from "@/lib/auth/servidor";
import { ROTA_SEM_ACESSO } from "@/lib/auth/rotas";
import { estoque } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import { dataPadraoDoInventario, siglaDaUnidade, type AvisosDoInventario, type LinhaDoInventario } from "@/lib/dominio/inventario";
import { diaBrasileiro } from "@/lib/dominio/relatorios";
import { carregarInventario, podeVerInventario } from "@/lib/estoque/inventario";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Inventário do estoque" };

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// Inventário do estoque numa data (SPEC-025, 5.2): Estoque e Catálogo — ver; fora do modo suporte (5.6).
export default async function InventarioDoEstoque({ searchParams }: PageProps<"/estoque/inventario">) {
  const membro = await exigirMembroForaDoSuporte();
  if (!podeVerInventario(membro.permissoes)) redirect(ROTA_SEM_ACESSO);
  const p = await searchParams;
  const dia = hoje();
  const pedida = texto(p.data);
  const r = await carregarInventario(pedida, { estoque: estoque(membro), hoje: dia });
  const erro = r.ok ? texto(p.erro) : r.erro;
  const data = r.ok ? r.inventario.data : (pedida ?? dataPadraoDoInventario(dia));

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        voltar={{ href: "/estoque", rotulo: "Estoque" }}
        titulo="Inventário do estoque"
        descricao="A posição do estoque ao fim de um dia, com o custo de cada produto, para enviar à contabilidade."
      />

      <Superficie>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-0">
            <label htmlFor="data" className="mb-1.5 block text-sm font-medium text-foreground">
              Posição ao fim do dia
            </label>
            <input
              id="data"
              name="data"
              type="date"
              defaultValue={data}
              max={dia}
              aria-invalid={!r.ok ? true : undefined}
              aria-describedby={!r.ok ? "data-erro" : undefined}
              className={cn(classeDoCampo(!r.ok ? r.erro : undefined), "w-auto")}
            />
          </div>
          <button type="submit" className={classeDoBotao("secundario")}>
            Ver inventário
          </button>
        </form>
        {!r.ok && (
          <p id="data-erro" role="alert" className="mt-2 text-sm text-status-danger">
            {r.erro}
          </p>
        )}
      </Superficie>

      {r.ok && erro && <AvisoDaPagina tom="erro">{erro}</AvisoDaPagina>}

      {r.ok && <Conteudo inventario={r.inventario} />}
    </div>
  );
}

function Conteudo({ inventario }: { inventario: { data: string; linhas: LinhaDoInventario[]; totalCentavos: number; avisos: AvisosDoInventario } }) {
  const { data, linhas, totalCentavos, avisos } = inventario;
  const vazio = linhas.length === 0;
  const arquivo = (formato: "csv" | "pdf") => `/estoque/inventario/exportar?${new URLSearchParams({ data, formato })}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-foreground">
          Posição ao fim do dia <strong>{diaBrasileiro(data)}</strong>
          {!vazio && (
            <>
              : {plural(linhas.length, "produto", "produtos")}, valor total <strong className="tabular-nums">{reais(totalCentavos / 100)}</strong>
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {(["csv", "pdf"] as const).map((f) =>
            vazio ? (
              <span key={f} aria-disabled="true" className={cn(classeDoBotao("secundario"), "pointer-events-none opacity-50")}>
                <Download aria-hidden="true" />
                Baixar {f.toUpperCase()}
              </span>
            ) : (
              // Arquivo baixado pela rota (Content-Disposition), sem pré-carregar.
              <a key={f} href={arquivo(f)} className={classeDoBotao(f === "csv" ? "principal" : "secundario")}>
                <Download aria-hidden="true" />
                Baixar {f.toUpperCase()}
              </a>
            ),
          )}
        </div>
      </div>

      <Avisos avisos={avisos} />

      {vazio ? (
        <Superficie>
          <EstadoVazio Icone={PackageSearch} titulo={`Nenhum produto com quantidade em ${diaBrasileiro(data)}`}>
            Escolha outra data. O inventário mostra os produtos que tinham quantidade ao fim do dia escolhido.
          </EstadoVazio>
        </Superficie>
      ) : (
        <>
          <Superficie espaco="nenhum" className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Inventário do estoque em {diaBrasileiro(data)}</caption>
              <thead>
                <tr className="border-b text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-3 font-semibold">Código</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Descrição</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Unidade</th>
                  <th scope="col" className="px-4 py-3 font-semibold">NCM</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Quantidade</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Custo unitário</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Valor total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linhas.map((l) => (
                  <tr key={l.itemId} className={cn(l.quantidadeNegativa && "shadow-[inset_3px_0_0_var(--status-danger)]")}>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{l.codigo ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {l.nome}
                      {l.arquivado && <span className="font-normal text-muted-foreground"> (arquivado)</span>}
                    </td>
                    <td className="px-4 py-3">{siglaDaUnidade(l.unidade)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{l.ncm ?? "—"}</td>
                    <td className={cn("px-4 py-3 text-right tabular-nums", l.quantidadeNegativa && "font-bold text-status-danger")}>{quantidade(l.quantidade)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      <Custo linha={l} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{l.valorCentavos === null ? "—" : reais(l.valorCentavos / 100)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <th scope="row" colSpan={6} className="px-4 py-3 text-left">
                    Total
                  </th>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{reais(totalCentavos / 100)}</td>
                </tr>
              </tfoot>
            </table>
          </Superficie>

          <Superficie espaco="nenhum" className="overflow-hidden md:hidden">
            <ul className="divide-y" aria-label={`Inventário do estoque em ${diaBrasileiro(data)}`}>
              {linhas.map((l) => (
                <li key={l.itemId} className={cn("space-y-1 px-4 py-3.5", l.quantidadeNegativa && "shadow-[inset_3px_0_0_var(--status-danger)]")}>
                  <p className="font-bold text-foreground">
                    {l.nome}
                    {l.arquivado && <span className="font-normal text-muted-foreground"> (arquivado)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {l.codigo ?? "Sem código"} · NCM {l.ncm ?? "—"}
                  </p>
                  <p className="flex flex-wrap justify-between gap-x-3 text-sm tabular-nums">
                    <span className={cn(l.quantidadeNegativa && "font-bold text-status-danger")}>
                      {quantidade(l.quantidade)} {siglaDaUnidade(l.unidade)} × <Custo linha={l} />
                    </span>
                    <span className="font-semibold">{l.valorCentavos === null ? "—" : reais(l.valorCentavos / 100)}</span>
                  </p>
                </li>
              ))}
              <li className="flex justify-between px-4 py-3.5 font-bold">
                <span>Total</span>
                <span className="tabular-nums">{reais(totalCentavos / 100)}</span>
              </li>
            </ul>
          </Superficie>

          {avisos.custoDoInicio > 0 && <p className="text-xs text-muted-foreground">* Custo do início do histórico: o HE ainda não guardava o custo nesta data.</p>}
        </>
      )}

      <p className="text-xs text-muted-foreground">As movimentações registradas depois com data retroativa mudam o inventário de uma data já passada.</p>
    </>
  );
}

/** Custo unitário da linha: marcado quando vem do início do histórico; sem custo leva ao item (OPEN-006). */
function Custo({ linha }: { linha: LinhaDoInventario }) {
  if (linha.valorCentavos === null) {
    return (
      <Link href={`/catalogo/${linha.itemId}`} className="font-semibold text-status-warn underline-offset-2 hover:underline">
        Sem custo
      </Link>
    );
  }
  return (
    <>
      {reais(linha.custoCentavos / 100)}
      {linha.custoDoInicio && (
        <span className="text-muted-foreground" title="Custo do início do histórico">
          *
        </span>
      )}
    </>
  );
}

function Avisos({ avisos }: { avisos: AvisosDoInventario }) {
  const faltando = [
    avisos.semCusto ? { texto: plural(avisos.semCusto, "produto sem custo", "produtos sem custo") } : null,
    avisos.semCodigo ? { texto: `${avisos.semCodigo} sem código`, href: "/catalogo?codigo=sem" } : null,
    avisos.semNcm ? { texto: `${avisos.semNcm} sem NCM`, href: "/catalogo?ncm=sem" } : null,
  ].filter((f) => f !== null);
  return (
    <>
      {faltando.length > 0 && (
        <AvisoDaPagina tom="atencao">
          Dados faltando:{" "}
          {faltando.map((f, i) => (
            <span key={f.texto}>
              {i > 0 && (i === faltando.length - 1 ? " e " : ", ")}
              {f.href ? <Link href={f.href}>{f.texto}</Link> : f.texto}
            </span>
          ))}
          . Esses produtos entram no arquivo com o campo vazio.
        </AvisoDaPagina>
      )}
      {avisos.custoDoInicio > 0 && (
        <AvisoDaPagina tom="info">
          Em {plural(avisos.custoDoInicio, "produto", "produtos")}, o custo é o do início do histórico (*): o HE ainda não guardava o custo nesta data.
        </AvisoDaPagina>
      )}
      {avisos.negativos > 0 && (
        <AvisoDaPagina tom="erro">
          {plural(avisos.negativos, "produto tem", "produtos têm")} quantidade negativa nesta data: uma saída foi registrada com data anterior à entrada. Confira as movimentações.
        </AvisoDaPagina>
      )}
    </>
  );
}
