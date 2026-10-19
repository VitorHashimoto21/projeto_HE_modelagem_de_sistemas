"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Aviso, MensagemDeCampo } from "@/components/acesso/campos";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao } from "@/components/ui/estilos";
import { Gaveta } from "@/components/ui/gaveta";
import type { CategoriaItem } from "@/generated/prisma/enums";
import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { acaoCriarSubcategoria, acaoRenomearSubcategoria } from "@/lib/catalogo/acoes";
import { SUBCATEGORIA_INICIAL, type SubcategoriaSalva } from "@/lib/catalogo/servicos";
import { CATEGORIAS, MAX_NOME_SUBCATEGORIA, ROTULO_CATEGORIA, validarNomeDaSubcategoria, validarSubcategoria } from "@/lib/catalogo/validacao";

// Subcategorias do negócio (SPEC-020): formulário curto na gaveta (SPEC-016, OPEN-003), usado no
// cadastro do item e na tela Subcategorias. A lista da tela fica em gestao-de-subcategorias.tsx,
// para o cadastro do item não levar o que só a tela usa (SPEC-016, seção 10).

export type OpcaoDeSubcategoria = { id: string; categoria: CategoriaItem; nome: string };

const rotulo = "mb-1.5 block text-sm font-medium text-foreground";

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
