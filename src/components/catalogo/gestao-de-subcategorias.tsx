"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { avisar } from "@/components/ui/avisar";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { DialogoDeConfirmacao } from "@/components/ui/confirmacao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao } from "@/components/ui/estilos";
import { Gaveta } from "@/components/ui/gaveta";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { acaoExcluirSubcategoria } from "@/lib/catalogo/acoes";
import { EXCLUSAO_INICIAL } from "@/lib/catalogo/servicos";
import { CATEGORIAS, ROTULO_CATEGORIA } from "@/lib/catalogo/validacao";
import { comRetorno } from "@/lib/estrutura/retorno";
import { FormularioDaSubcategoria, GavetaNovaSubcategoria, type OpcaoDeSubcategoria } from "./subcategorias";

// Tela Subcategorias (SPEC-020, 5.3): lista por categoria com ver itens, novo item, renomear e excluir.

export type SubcategoriaNaLista = OpcaoDeSubcategoria & { itensAtivos: number; itensArquivados: number };

const itens = (n: number) => (n === 0 ? "Nenhum item" : n === 1 ? "1 item" : `${n} itens`);

/** Tela Subcategorias (5.3): por categoria, com ver itens, novo item, renomear e excluir conforme as permissões. */
export function GestaoDeSubcategorias({
  descricao,
  subcategorias,
  podeCriar,
  podeRenomear,
  podeExcluir,
  podeCriarItem,
}: {
  descricao: string;
  subcategorias: SubcategoriaNaLista[];
  podeCriar: boolean;
  podeRenomear: boolean;
  podeExcluir: boolean;
  podeCriarItem: boolean;
}) {
  const [criando, setCriando] = useState(false);
  const [renomeando, setRenomeando] = useState<SubcategoriaNaLista | null>(null);
  const [excluindo, setExcluindo] = useState<SubcategoriaNaLista | null>(null);
  const [, iniciar] = useTransition();

  const grupos = CATEGORIAS.map((c) => ({ categoria: c, lista: subcategorias.filter((s) => s.categoria === c) })).filter((g) => g.lista.length > 0);

  function excluir(s: SubcategoriaNaLista) {
    const dados = new FormData();
    dados.set("subcategoriaId", s.id);
    iniciar(async () => {
      const r = await acaoExcluirSubcategoria(EXCLUSAO_INICIAL, dados);
      if (r.status === "excluida") avisar(`Subcategoria “${s.nome}” excluída.`);
      else if (r.status === "erro") avisar(r.mensagem);
    });
  }

  const textoDaExclusao = (s: SubcategoriaNaLista) => {
    const total = s.itensAtivos + s.itensArquivados;
    const afetados =
      total === 0
        ? "Nenhum item usa esta subcategoria."
        : `${total === 1 ? "1 item ficará" : `${total} itens ficarão`} sem subcategoria${s.itensArquivados > 0 ? ` (${s.itensArquivados} ${s.itensArquivados === 1 ? "arquivado" : "arquivados"})` : ""}.`;
    return `${afetados} Preços, estoque e vendas não mudam.`;
  };

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        voltar={{ href: "/catalogo", rotulo: "Catálogo" }}
        titulo="Subcategorias"
        descricao={descricao}
        acoes={
          podeCriar && (
            <button type="button" onClick={() => setCriando(true)} className={classeDoBotao("principal")}>
              <Plus aria-hidden="true" />
              Nova subcategoria
            </button>
          )
        }
      />

      {grupos.length === 0 ? (
        <Superficie>
          <EstadoVazio
            Icone={Tags}
            titulo="Nenhuma subcategoria ainda"
            acao={
              podeCriar && (
                <button type="button" onClick={() => setCriando(true)} className={classeDoBotao("principal")}>
                  <Plus aria-hidden="true" />
                  Nova subcategoria
                </button>
              )
            }
          >
            Organize o catálogo dentro de cada categoria, por exemplo Brincos, Colares e Anéis em Acessórios. A margem sugerida continua a da categoria.
          </EstadoVazio>
        </Superficie>
      ) : (
        grupos.map((g) => (
          <Superficie key={g.categoria} espaco="nenhum" className="overflow-hidden" aria-labelledby={`categoria-${g.categoria}`}>
            <div className="px-4 pt-4 sm:px-5">
              <TituloDaSuperficie id={`categoria-${g.categoria}`} titulo={ROTULO_CATEGORIA[g.categoria]} />
            </div>
            <ul className="divide-y border-t" aria-label={`Subcategorias de ${ROTULO_CATEGORIA[g.categoria]}`}>
              {g.lista.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate text-[15px] font-bold text-foreground">{s.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {itens(s.itensAtivos)}
                      {s.itensArquivados > 0 && `, mais ${s.itensArquivados} ${s.itensArquivados === 1 ? "arquivado" : "arquivados"}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/catalogo?categoria=${s.categoria}&subcategoria=${s.id}`}
                      className={classeDoBotao("fantasma", "sm")}
                      aria-label={`Ver itens de ${s.nome}`}
                    >
                      Ver itens
                    </Link>
                    {podeCriarItem && (
                      <Link
                        href={comRetorno(`/catalogo/novo?categoria=${s.categoria}&subcategoria=${s.id}`, "/catalogo/subcategorias")}
                        className={classeDoBotao("secundario", "sm")}
                        aria-label={`Novo item em ${s.nome}`}
                      >
                        <Plus aria-hidden="true" />
                        Novo item
                      </Link>
                    )}
                    {podeRenomear && (
                      <button type="button" onClick={() => setRenomeando(s)} className={classeDoBotao("fantasma", "sm")} aria-label={`Renomear ${s.nome}`}>
                        <Pencil aria-hidden="true" />
                        Renomear
                      </button>
                    )}
                    {podeExcluir && (
                      <button type="button" onClick={() => setExcluindo(s)} className={classeDoBotao("fantasma", "sm")} aria-label={`Excluir ${s.nome}`}>
                        <Trash2 aria-hidden="true" />
                        Excluir
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Superficie>
        ))
      )}

      <GavetaNovaSubcategoria
        aberta={criando}
        aoMudar={setCriando}
        aoSalvar={(s) => {
          setCriando(false);
          avisar(`Subcategoria “${s.nome}” criada em ${ROTULO_CATEGORIA[s.categoria]}.`);
        }}
      />
      <Gaveta aberta={renomeando !== null} aoMudar={(a) => !a && setRenomeando(null)} titulo="Renomear subcategoria" descricao={renomeando ? `Em ${ROTULO_CATEGORIA[renomeando.categoria]}. Os itens passam a mostrar o nome novo.` : undefined}>
        {renomeando && (
          <FormularioDaSubcategoria
            modo={{ tipo: "renomear", id: renomeando.id, nome: renomeando.nome, categoria: renomeando.categoria }}
            aoSalvar={(s) => {
              setRenomeando(null);
              avisar(`Subcategoria renomeada para “${s.nome}”.`);
            }}
          />
        )}
      </Gaveta>
      <DialogoDeConfirmacao
        aberto={excluindo !== null}
        aoMudar={(a) => !a && setExcluindo(null)}
        titulo={excluindo ? `Excluir “${excluindo.nome}”?` : "Excluir subcategoria?"}
        descricao={excluindo ? textoDaExclusao(excluindo) : ""}
        confirmar="Excluir"
        aoConfirmar={() => {
          if (excluindo) excluir(excluindo);
          setExcluindo(null);
        }}
      />
    </div>
  );
}
