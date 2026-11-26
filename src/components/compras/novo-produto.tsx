"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { Aviso, MensagemDeCampo } from "@/components/acesso/campos";
import { ROTULO_CATEGORIA, rotuloUnidade } from "@/components/catalogo/rotulos";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao } from "@/components/ui/estilos";
import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { ITEM_INICIAL, type EstadoDoItem } from "@/lib/catalogo/servicos";
import { CATEGORIAS, validarItem } from "@/lib/catalogo/validacao";
import { acaoNovoProdutoDaCompra } from "@/lib/compras/acoes";
import { lerNumero, normalizarCodigo, UNIDADES } from "@/lib/dominio/catalogo";
import { paraCentavos } from "@/lib/dominio/venda";
import type { ProdutoNaCompra } from "./registrar-compra";

const rotulo = "mb-1.5 block text-sm font-medium text-foreground";

/**
 * "Novo produto" sem sair da compra (SPEC-027, OPEN-003), para quem tem Catálogo — criar: os campos
 * essenciais do produto físico, com o custo desta compra, que vira o custo do produto e o da linha.
 * Subcategoria, preço e o resto do cadastro continuam no Catálogo.
 */
export function NovoProdutoNaCompra({
  nomeInicial,
  exigeNcm,
  aoCriar,
  aoCancelar,
}: {
  nomeInicial: string;
  exigeNcm: boolean;
  aoCriar: (p: ProdutoNaCompra, custo: string) => void;
  aoCancelar: () => void;
}) {
  const [estado, executar, enviando] = useActionState<EstadoDoItem, FormData>(acaoNovoProdutoDaCompra, ITEM_INICIAL);
  const [locais, setLocais] = useState<ErrosDeCampo | null>(null);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    setLocais(null);
  }
  const erros = locais ?? (estado.status === "erro" ? (estado.erros ?? {}) : {});
  const enviado = useRef<{ nome: string; codigo: string; unidade: string; custo: string } | null>(null);

  // O produto gravado volta para a compra, já com a linha e o custo informado.
  useEffect(() => {
    if (estado.status !== "salvo" || !enviado.current) return;
    const e = enviado.current;
    enviado.current = null;
    aoCriar(
      { id: estado.itemId, nome: e.nome.trim().replace(/\s+/g, " "), codigo: e.codigo ? normalizarCodigo(e.codigo) : null, unidade: rotuloUnidade(e.unidade), custoCentavos: paraCentavos(lerNumero(e.custo) ?? 0), saldo: 0 },
      e.custo,
    );
  }, [estado, aoCriar]);

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    const dados = new FormData(e.currentTarget);
    const campos = Object.fromEntries([...dados.entries()].map(([k, v]) => [k, String(v)]));
    const v = validarItem({ ...campos, tipo: "PRODUTO_FISICO" }, { tipo: "criar" }, { exigeNcm });
    if (!v.ok) return setLocais(v.erros);
    setLocais({});
    enviado.current = { nome: campos.nome, codigo: campos.codigo ?? "", unidade: campos.unidadeMedida, custo: campos.custoBase };
    startTransition(() => executar(dados));
  }

  // Como no Catálogo, o erro do campo some assim que a pessoa o corrige.
  const campo = (nome: string) => ({
    id: `novo-${nome}`,
    name: nome,
    "aria-invalid": erros[nome] ? true : undefined,
    "aria-describedby": erros[nome] ? `novo-${nome}-erro` : undefined,
    onChange: () => {
      if (erros[nome]) setLocais({ ...erros, [nome]: undefined });
    },
  });

  return (
    <section aria-label="Novo produto" className="mt-4 space-y-4 rounded-2xl border border-input p-4">
      <p className="text-sm font-bold text-foreground">Novo produto</p>
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <form onSubmit={aoEnviar} noValidate className="space-y-4">
        <div>
          <label htmlFor="novo-nome" className={rotulo}>
            Nome
          </label>
          <input {...campo("nome")} defaultValue={nomeInicial} maxLength={120} autoComplete="off" className={classeDoCampo(erros.nome)} />
          <MensagemDeCampo id="novo-nome-erro" erro={erros.nome} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="novo-categoria" className={rotulo}>
              Categoria
            </label>
            <select {...campo("categoria")} defaultValue="" className={classeDoCampo(erros.categoria)}>
              <option value="">Escolha a categoria</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {ROTULO_CATEGORIA[c]}
                </option>
              ))}
            </select>
            <MensagemDeCampo id="novo-categoria-erro" erro={erros.categoria} />
          </div>
          <div>
            <label htmlFor="novo-unidadeMedida" className={rotulo}>
              Unidade
            </label>
            <select {...campo("unidadeMedida")} defaultValue="un" className={classeDoCampo(erros.unidadeMedida)}>
              {Object.entries(UNIDADES).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
            <MensagemDeCampo id="novo-unidadeMedida-erro" erro={erros.unidadeMedida} />
          </div>
          <div>
            <label htmlFor="novo-custoBase" className={rotulo}>
              Custo unitário desta compra
            </label>
            <input {...campo("custoBase")} inputMode="decimal" placeholder="0,00" className={`${classeDoCampo(erros.custoBase)} tabular-nums`} />
            <MensagemDeCampo id="novo-custoBase-erro" erro={erros.custoBase} />
          </div>
          <div>
            <label htmlFor="novo-codigo" className={rotulo}>
              Código <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input {...campo("codigo")} maxLength={20} autoComplete="off" className={`${classeDoCampo(erros.codigo)} uppercase`} />
            <MensagemDeCampo id="novo-codigo-erro" erro={erros.codigo} />
          </div>
          <div>
            <label htmlFor="novo-ncm" className={rotulo}>
              NCM {!exigeNcm && <span className="font-normal text-muted-foreground">(opcional)</span>}
            </label>
            <input {...campo("ncm")} inputMode="numeric" maxLength={10} autoComplete="off" className={classeDoCampo(erros.ncm)} />
            <MensagemDeCampo id="novo-ncm-erro" erro={erros.ncm} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Subcategoria, preço e o resto do cadastro ficam no Catálogo.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={aoCancelar} className={classeDoBotao("secundario")}>
            Cancelar
          </button>
          <button type="submit" disabled={enviando} className={classeDoBotao("principal")}>
            {enviando ? "Cadastrando…" : "Cadastrar e adicionar"}
          </button>
        </div>
      </form>
    </section>
  );
}
