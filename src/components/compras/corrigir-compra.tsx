"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Aviso, MensagemDeCampo } from "@/components/acesso/campos";
import { classeDoCampo } from "@/components/ui/classes";
import { enviarSemReiniciar } from "@/components/ui/envio";
import { classeDoBotao } from "@/components/ui/estilos";
import { camposDoFormulario, type ErrosDeCampo } from "@/lib/auth/validacao";
import { acaoCorrigirCompra } from "@/lib/compras/acoes";
import { CORRECAO_INICIAL } from "@/lib/compras/servicos";
import type { OpcaoDePessoa } from "@/lib/db/fornecedores";
import { MAX_DOCUMENTO, validarCorrecaoDaCompra } from "@/lib/dominio/compras";

const rotulo = "mb-1.5 block text-sm font-medium text-foreground";

/**
 * Corrigir o fornecedor e o nº do documento da compra (SPEC-027, 5.7; CA-11): sem mudar valores, e a
 * correção vale também para as contas da compra. O envio não reinicia os campos: depois de salvar, eles
 * já mostram o que foi gravado.
 */
export function CorrigirCompra({
  compra,
  fornecedores,
}: {
  compra: { id: string; fornecedor: OpcaoDePessoa; numeroDocumento: string | null; semNotaFiscal: boolean };
  fornecedores: OpcaoDePessoa[];
}) {
  const [estado, executar, enviando] = useActionState(acaoCorrigirCompra, CORRECAO_INICIAL);
  const [locais, setLocais] = useState<ErrosDeCampo | null>(null);
  const [visto, setVisto] = useState(estado);
  const [semNota, setSemNota] = useState(compra.semNotaFiscal);
  if (estado !== visto) {
    setVisto(estado);
    setLocais(null);
  }
  const erros = locais ?? (estado.status === "erro" ? (estado.erros ?? {}) : {});
  const limpar = (campo: string) => erros[campo] && setLocais({ ...erros, [campo]: undefined });
  // O fornecedor atual fica na lista mesmo se foi excluído (anonimizado) depois da compra.
  const opcoes = fornecedores.some((f) => f.id === compra.fornecedor.id) ? fornecedores : [...fornecedores, compra.fornecedor];

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    enviarSemReiniciar(e, executar, (dados) => {
      const v = validarCorrecaoDaCompra(camposDoFormulario(dados));
      setLocais(v.ok ? {} : v.erros);
      return v.ok;
    });
  }

  return (
    <div className="space-y-4">
      {estado.status === "salvo" && <Aviso tipo="sucesso">{estado.mensagem}</Aviso>}
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <form onSubmit={aoEnviar} noValidate className="space-y-4">
        <input type="hidden" name="compraId" value={compra.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="correcao-fornecedor" className={rotulo}>
              Fornecedor
            </label>
            <select
              id="correcao-fornecedor"
              name="fornecedor"
              defaultValue={compra.fornecedor.id}
              onChange={() => limpar("fornecedor")}
              aria-invalid={erros.fornecedor ? true : undefined}
              aria-describedby={erros.fornecedor ? "correcao-fornecedor-erro" : undefined}
              className={classeDoCampo(erros.fornecedor)}
            >
              {opcoes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
            <MensagemDeCampo id="correcao-fornecedor-erro" erro={erros.fornecedor} />
          </div>
          <div>
            <label htmlFor="correcao-documento" className={rotulo}>
              Nº do documento
            </label>
            {semNota ? (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Sem nota</p>
            ) : (
              <input
                id="correcao-documento"
                name="numeroDocumento"
                defaultValue={compra.numeroDocumento ?? ""}
                maxLength={MAX_DOCUMENTO}
                autoComplete="off"
                onChange={() => limpar("documento")}
                aria-invalid={erros.documento ? true : undefined}
                aria-describedby={erros.documento ? "correcao-documento-erro" : undefined}
                className={classeDoCampo(erros.documento)}
              />
            )}
            <MensagemDeCampo id="correcao-documento-erro" erro={erros.documento} />
            <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="semNotaFiscal"
                checked={semNota}
                onChange={(e) => {
                  setSemNota(e.target.checked);
                  limpar("documento");
                }}
                className="size-4 accent-primary"
              />
              Compra sem nota fiscal
            </label>
          </div>
        </div>
        <button type="submit" disabled={enviando} className={classeDoBotao("secundario")}>
          {enviando ? "Salvando…" : "Salvar correção"}
        </button>
      </form>
    </div>
  );
}
