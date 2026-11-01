import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Search, Truck } from "lucide-react";
import { SeloParaNota } from "@/components/clientes/selo-para-nota";
import { CabecalhoDoFinanceiro } from "@/components/financeiro/exibicao";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { classeDoCampo } from "@/components/ui/classes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao } from "@/components/ui/estilos";
import { Segmentos } from "@/components/ui/segmentos";
import { Superficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { FILTRO_INCOMPLETOS, fornecedores, LIMITE_DE_FORNECEDORES } from "@/lib/db";
import { ROTULO_TIPO_CLIENTE } from "@/lib/dominio/cliente";
import { pode } from "@/lib/dominio/permissoes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Fornecedores" };

const texto = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 100) : "");

const EXCLUSAO: Record<string, string> = {
  apagado: "Fornecedor excluído.",
  anonimizado: "Dados do fornecedor apagados. As contas continuam registradas, sem identificação.",
};

// Fornecedores do negócio (SPEC-026, 5.1; OPEN-001): seção do Financeiro, com Financeiro — ver. O
// documento sai mascarado do servidor para todos; no modo suporte, o nome também (OPEN-011).
export default async function Fornecedores({ searchParams }: PageProps<"/financeiro/fornecedores">) {
  const membro = await exigirPermissao("financeiro", "ver");
  const p = await searchParams;
  const busca = texto(p.busca);
  const incompletos = p.filtro === FILTRO_INCOMPLETOS;
  const { fornecedores: lista, maisFornecedores } = await fornecedores(membro).listar({ busca, incompletos });
  const podeCriar = !membro.modoSuporte && pode(membro.permissoes, "financeiro", "criar");
  const exclusao = typeof p.excluido === "string" ? EXCLUSAO[p.excluido] : undefined;

  const link = (filtro: boolean) => {
    const q = new URLSearchParams();
    if (busca) q.set("busca", busca);
    if (filtro) q.set("filtro", FILTRO_INCOMPLETOS);
    const s = q.toString();
    return s ? `/financeiro/fornecedores?${s}` : "/financeiro/fornecedores";
  };
  const novo = (
    <Link href="/financeiro/fornecedores/novo" className={classeDoBotao("principal")}>
      <Plus aria-hidden="true" />
      Novo fornecedor
    </Link>
  );

  return (
    <div className="space-y-6">
      <CabecalhoDoFinanceiro atual="fornecedores" titulo="Fornecedores" descricao="De quem você compra, para ligar às contas a pagar e às despesas fixas." acoes={podeCriar && novo} />

      {exclusao && <AvisoDaPagina tom="sucesso">{exclusao}</AvisoDaPagina>}

      <div className="flex flex-col gap-3">
        <Segmentos
          rotulo="Filtro"
          itens={[
            { href: link(false), rotulo: "Todos", ativo: !incompletos },
            { href: link(true), rotulo: "Faltam dados para nota", ativo: incompletos },
          ]}
        />
        <form method="get" className="flex flex-wrap gap-2" role="search">
          {incompletos && <input type="hidden" name="filtro" value={FILTRO_INCOMPLETOS} />}
          <label className="sr-only" htmlFor="busca">
            Buscar por nome, documento, e-mail ou telefone
          </label>
          <div className="relative min-w-0 flex-1 basis-52">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="busca"
              name="busca"
              type="search"
              defaultValue={busca}
              maxLength={100}
              placeholder="Nome, CNPJ, CPF, e-mail ou telefone"
              className={cn(classeDoCampo(), "h-11 rounded-full py-0 pl-10")}
            />
          </div>
          <button type="submit" className={classeDoBotao("secundario")}>
            Buscar
          </button>
        </form>
      </div>

      {lista.length === 0 ? (
        <Superficie>
          {busca || incompletos ? (
            <EstadoVazio Icone={Truck} titulo="Nenhum fornecedor encontrado">
              {incompletos && !busca ? "Todos os fornecedores estão completos para a nota fiscal." : "Confira o que foi digitado ou busque por outra parte do nome."}
            </EstadoVazio>
          ) : (
            <EstadoVazio Icone={Truck} titulo="Nenhum fornecedor cadastrado" acao={podeCriar && novo}>
              Os fornecedores cadastrados numa conta ou numa despesa fixa também aparecem aqui.
            </EstadoVazio>
          )}
        </Superficie>
      ) : (
        <Superficie espaco="nenhum" aria-label="Fornecedores">
          {/* Computador: tabela; celular: lista. As mesmas informações nos dois (SPEC-016, 5.4). */}
          <table className="hidden w-full text-left text-sm md:table">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="px-6 py-3 font-medium">Fornecedor</th>
                <th scope="col" className="px-3 py-3 font-medium">Documento</th>
                <th scope="col" className="px-3 py-3 font-medium">Município</th>
                <th scope="col" className="px-6 py-3 font-medium">Nota fiscal</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((f) => (
                <tr key={f.id} className="border-b last:border-b-0 hover:bg-muted/50">
                  <td className="px-6 py-3">
                    <Link href={`/financeiro/fornecedores/${f.id}`} className="font-semibold break-words text-foreground hover:text-primary hover:underline">
                      {f.nome}
                    </Link>
                    <span className="block text-xs break-words text-muted-foreground">
                      {ROTULO_TIPO_CLIENTE[f.tipo]}
                      {f.razaoSocial && `, ${f.razaoSocial}`}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-muted-foreground tabular-nums">{f.documento ?? "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{f.municipioUf ?? "—"}</td>
                  <td className="px-6 py-3">
                    <SeloParaNota completo={f.completoParaNota} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y md:hidden">
            {lista.map((f) => (
              <li key={f.id}>
                <Link href={`/financeiro/fornecedores/${f.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold break-words text-foreground">{f.nome}</p>
                    <p className="text-xs break-words text-muted-foreground">
                      {ROTULO_TIPO_CLIENTE[f.tipo]}
                      {f.razaoSocial && `, ${f.razaoSocial}`}
                      {f.documento && <span className="tabular-nums">, {f.documento}</span>}
                      {f.municipioUf && `, ${f.municipioUf}`}
                    </p>
                    <SeloParaNota completo={f.completoParaNota} />
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Superficie>
      )}
      {maisFornecedores && (
        <p className="text-sm text-muted-foreground">Mostrando os {LIMITE_DE_FORNECEDORES} primeiros pelo nome. Use a busca para encontrar os outros.</p>
      )}
    </div>
  );
}
