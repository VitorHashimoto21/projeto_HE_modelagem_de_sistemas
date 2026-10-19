"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { Aviso, MensagemDeCampo } from "@/components/acesso/campos";
import { avisar } from "@/components/ui/avisar";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoCampo } from "@/components/ui/classes";
import { DialogoDeConfirmacao } from "@/components/ui/confirmacao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao } from "@/components/ui/estilos";
import { Gaveta } from "@/components/ui/gaveta";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import type { CategoriaItem } from "@/generated/prisma/enums";
import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { acaoCriarSubcategoria, acaoExcluirSubcategoria, acaoRenomearSubcategoria } from "@/lib/catalogo/acoes";
import { EXCLUSAO_INICIAL, SUBCATEGORIA_INICIAL, type SubcategoriaSalva } from "@/lib/catalogo/servicos";
import { CATEGORIAS, MAX_NOME_SUBCATEGORIA, ROTULO_CATEGORIA, validarNomeDaSubcategoria, validarSubcategoria } from "@/lib/catalogo/validacao";

// Subcategorias do negócio (SPEC-020): formulário curto na gaveta (SPEC-016, OPEN-003), usado no
// cadastro do item e na tela Subcategorias, e a lista dessa tela com renomear e excluir.

export type OpcaoDeSubcategoria = { id: string; categoria: CategoriaItem; nome: string };

export type SubcategoriaNaLista = OpcaoDeSubcategoria & { itensAtivos: number; itensArquivados: number };

const rotulo = "mb-1.5 block text-sm font-medium text-foreground";

const itens = (n: number) => (n === 0 ? "Nenhum item" : n === 1 ? "1 item" : `${n} itens`);

/**
 * Criar (com a categoria fixa, no cadastro do item, ou escolhida, na tela Subcategorias) ou renomear.
 * Não usa a ação do formulário: o envio para aqui (o formulário do item está em volta na árvore do
 * React) e chama a Server Action numa transição.
 */
export function FormularioDaSubcategoria({
  modo,
  aoSalvar,
}: {
  modo:
    | { tipo: "criar"; categoria?: CategoriaItem; categoriaFixa?: boolean }
    | { tipo: "renomear"; id: string; nome: string; categoria: CategoriaItem };
  aoSalvar: (s: SubcategoriaSalva) => void;
}) {
  const [erros, setErros] = useState<ErrosDeCampo>({});
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const renomeando = modo.tipo === "renomear";
  const categoriaFixa = renomeando || !!modo.categoriaFixa;

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    const dados = new FormData(e.currentTarget);
    const campos = Object.fromEntries([...dados].map(([k, v]) => [k, String(v)]));
    const v = renomeando ? validarNomeDaSubcategoria(campos.nome) : validarSubcategoria(campos);
    if (!v.ok) {
      setErros(v.erros);
      return;
    }
    setErros({});
    setMensagem(null);
    iniciar(async () => {
      const r = renomeando ? await acaoRenomearSubcategoria(SUBCATEGORIA_INICIAL, dados) : await acaoCriarSubcategoria(SUBCATEGORIA_INICIAL, dados);
      if (r.status === "salvo") aoSalvar(r.subcategoria);
      else if (r.status === "erro") {
        setErros(r.erros ?? {});
        setMensagem(r.mensagem ?? null);
      }
    });
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {mensagem && <Aviso tipo="erro">{mensagem}</Aviso>}
      {renomeando && <input type="hidden" name="subcategoriaId" value={modo.id} />}
      {categoriaFixa ? (
        <input type="hidden" name="categoria" value={modo.categoria} />
      ) : (
        <div>
          <label htmlFor="subcategoria-categoria" className={rotulo}>
            Categoria
          </label>
          <select
            id="subcategoria-categoria"
            name="categoria"
            defaultValue={modo.categoria ?? ""}
            aria-invalid={erros.categoria ? true : undefined}
            aria-describedby={erros.categoria ? "subcategoria-categoria-erro" : undefined}
            onChange={() => setErros({ ...erros, categoria: undefined })}
            className={classeDoCampo(erros.categoria)}
          >
            <option value="">Selecione…</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {ROTULO_CATEGORIA[c]}
              </option>
            ))}
          </select>
          <MensagemDeCampo id="subcategoria-categoria-erro" erro={erros.categoria} />
        </div>
      )}
      <div>
        <label htmlFor="subcategoria-nome" className={rotulo}>
          Nome
        </label>
        <input
          id="subcategoria-nome"
          name="nome"
          defaultValue={renomeando ? modo.nome : ""}
          maxLength={MAX_NOME_SUBCATEGORIA}
          placeholder="Ex.: Brincos"
          autoComplete="off"
          aria-invalid={erros.nome ? true : undefined}
          aria-describedby={erros.nome ? "subcategoria-nome-erro" : undefined}
          onChange={() => setErros({ ...erros, nome: undefined })}
          className={classeDoCampo(erros.nome)}
        />
        <MensagemDeCampo id="subcategoria-nome-erro" erro={erros.nome} />
      </div>
      <button type="submit" disabled={pendente} className={classeDoBotao("principal")}>
        {pendente ? "Salvando…" : renomeando ? "Salvar nome" : "Criar subcategoria"}
      </button>
    </form>
  );
}

const DESCRICAO = "Só organiza o catálogo: a margem sugerida continua a da categoria.";

/** Gaveta "Nova subcategoria" (no cadastro do item: categoria fixa; na tela: escolhida). */
export function GavetaNovaSubcategoria({
  aberta,
  aoMudar,
  categoria,
  categoriaFixa = false,
  aoSalvar,
  focoAoFechar,
}: {
  aberta: boolean;
  aoMudar: (aberta: boolean) => void;
  categoria?: CategoriaItem;
  categoriaFixa?: boolean;
  aoSalvar: (s: SubcategoriaSalva) => void;
  focoAoFechar?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <Gaveta
      aberta={aberta}
      aoMudar={aoMudar}
      focoAoFechar={focoAoFechar}
      titulo="Nova subcategoria"
      descricao={categoriaFixa && categoria ? `Em ${ROTULO_CATEGORIA[categoria]}. ${DESCRICAO}` : DESCRICAO}
    >
      {aberta && <FormularioDaSubcategoria modo={{ tipo: "criar", categoria, categoriaFixa }} aoSalvar={aoSalvar} />}
    </Gaveta>
  );
}

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
                        href={`/catalogo/novo?categoria=${s.categoria}&subcategoria=${s.id}`}
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
