"use client";

import { useState } from "react";
import { MensagemDeCampo } from "@/components/acesso/campos";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao } from "@/components/ui/estilos";
import { Gaveta } from "@/components/ui/gaveta";
import { casasDecimais, lerNumero } from "@/lib/dominio/catalogo";
import { MAX_MOTIVO_AJUSTE, paraCentavos, reaisDeCentavos } from "@/lib/dominio/venda";
import { MENSAGENS_VENDA } from "@/lib/vendas/validacao";

// Ajustes da linha na frente de caixa (SPEC-017): materiais usados nesta venda (total da
// linha — OPEN-002) e preço cobrado com motivo (OPEN-003, OPEN-006). Nada aqui muda o
// catálogo; o servidor confere tudo de novo (5.3).

export type MaterialDaLinha = { materialId: string; nome: string; quantidade: number; saldo: number; unidade?: string; custo?: number };

const numeroCampo = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3, useGrouping: false });
const quantos = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const rotulo = "mb-1.5 block text-sm font-medium text-foreground";

/** Gaveta "Editar materiais": quantidade de cada material usada na linha. `null` volta ao padrão. */
export function GavetaDeMateriais({
  aberta,
  aoFechar,
  nome,
  quantidadeDaLinha,
  materiais,
  valores,
  aoAplicar,
}: {
  aberta: boolean;
  aoFechar: () => void;
  nome: string;
  quantidadeDaLinha: number;
  materiais: MaterialDaLinha[];
  valores: Record<string, string> | null;
  aoAplicar: (valores: Record<string, string> | null) => void;
}) {
  const padrao = (m: MaterialDaLinha) => Math.round(quantidadeDaLinha * m.quantidade * 1000) / 1000;
  const [campos, setCampos] = useState<Record<string, string>>(() =>
    Object.fromEntries(materiais.map((m) => [m.materialId, valores?.[m.materialId] ?? numeroCampo(padrao(m))])),
  );
  const [erros, setErros] = useState<Record<string, string>>({});

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const novos: Record<string, string> = {};
    for (const m of materiais) {
      const q = lerNumero(campos[m.materialId]);
      if (q === null || q < 0 || q > 9_999_999.999 || casasDecimais(q) > 3) novos[m.materialId] = MENSAGENS_VENDA.quantidadeMaterialInvalida;
    }
    setErros(novos);
    if (Object.keys(novos).length) return;
    // Igual ao padrão em todos os materiais: não é ajuste.
    const igual = materiais.every((m) => Math.abs((lerNumero(campos[m.materialId]) ?? 0) - padrao(m)) < 1e-9);
    aoAplicar(igual ? null : campos);
    aoFechar();
  }

  return (
    <Gaveta
      aberta={aberta}
      aoMudar={(a) => !a && aoFechar()}
      titulo="Materiais usados"
      descricao={`Quanto de cada material ${nome} usou nesta venda, no total. O catálogo não muda.`}
    >
      <form onSubmit={aplicar} noValidate className="space-y-4">
        {materiais.map((m) => {
          const q = lerNumero(campos[m.materialId]);
          const falta = q !== null && q > m.saldo + 1e-9;
          return (
            <div key={m.materialId}>
              <label htmlFor={`material-${m.materialId}`} className={rotulo}>
                {m.nome}
                {m.unidade ? ` (${m.unidade.toLowerCase()})` : ""}
              </label>
              <input
                id={`material-${m.materialId}`}
                inputMode="decimal"
                value={campos[m.materialId] ?? ""}
                onChange={(e) => setCampos({ ...campos, [m.materialId]: e.target.value })}
                onFocus={(e) => e.currentTarget.select()}
                aria-invalid={erros[m.materialId] ? true : undefined}
                aria-describedby={`material-${m.materialId}-dica${erros[m.materialId] ? ` material-${m.materialId}-erro` : ""}`}
                className={`${classeDoCampo(erros[m.materialId])} tabular-nums`}
              />
              <p id={`material-${m.materialId}-dica`} className={falta ? "mt-1 text-xs text-status-warn" : "mt-1 text-xs text-muted-foreground"}>
                Padrão do catálogo: {quantos(padrao(m))}. {falta ? `Só há ${quantos(m.saldo)} em estoque.` : `${quantos(m.saldo)} em estoque.`}
              </p>
              <MensagemDeCampo id={`material-${m.materialId}-erro`} erro={erros[m.materialId]} />
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" className={classeDoBotao("principal")}>
            Aplicar
          </button>
          {valores && (
            <button
              type="button"
              onClick={() => {
                aoAplicar(null);
                aoFechar();
              }}
              className={classeDoBotao("secundario")}
            >
              Voltar ao padrão
            </button>
          )}
        </div>
      </form>
    </Gaveta>
  );
}

/** Gaveta "Editar preço": preço cobrado nesta venda, com motivo. `null` volta ao preço oficial. */
export function GavetaDePreco({
  aberta,
  aoFechar,
  nome,
  precoOficialCentavos,
  custoUnitarioCentavos,
  valor,
  aoAplicar,
}: {
  aberta: boolean;
  aoFechar: () => void;
  nome: string;
  precoOficialCentavos: number;
  /** Custo unitário da linha (com os materiais da linha), para o aviso de preço abaixo do custo (OPEN-007). */
  custoUnitarioCentavos: number | null;
  valor: { preco: string; motivo: string } | null;
  aoAplicar: (valor: { preco: string; motivo: string } | null) => void;
}) {
  const [preco, setPreco] = useState(valor?.preco ?? (precoOficialCentavos / 100).toFixed(2).replace(".", ","));
  const [motivo, setMotivo] = useState(valor?.motivo ?? "");
  const [erros, setErros] = useState<{ preco?: string; motivo?: string }>({});
  const numero = lerNumero(preco);
  const abaixoDoCusto = numero !== null && custoUnitarioCentavos !== null && paraCentavos(numero) < custoUnitarioCentavos;

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const novos: { preco?: string; motivo?: string } = {};
    if (numero === null || !(numero > 0) || numero > 9_999_999.99 || casasDecimais(numero) > 2) novos.preco = MENSAGENS_VENDA.precoAjusteInvalido;
    const m = motivo.trim().replace(/\s+/g, " ");
    // Preço igual ao oficial: não é ajuste, e o motivo não é pedido.
    const igual = numero !== null && paraCentavos(numero) === precoOficialCentavos;
    if (!igual && !novos.preco) {
      if (!m) novos.motivo = MENSAGENS_VENDA.motivoAjusteObrigatorio;
      else if (m.length > MAX_MOTIVO_AJUSTE) novos.motivo = MENSAGENS_VENDA.motivoAjusteLongo;
    }
    setErros(novos);
    if (Object.keys(novos).length) return;
    aoAplicar(igual ? null : { preco, motivo: m });
    aoFechar();
  }

  return (
    <Gaveta aberta={aberta} aoMudar={(a) => !a && aoFechar()} titulo="Preço nesta venda" descricao={`${nome}: preço do catálogo ${reaisDeCentavos(precoOficialCentavos)}. O catálogo não muda.`}>
      <form onSubmit={aplicar} noValidate className="space-y-4">
        <div>
          <label htmlFor="preco-ajustado" className={rotulo}>
            Preço unitário (R$)
          </label>
          <input
            id="preco-ajustado"
            inputMode="decimal"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            aria-invalid={erros.preco ? true : undefined}
            aria-describedby={erros.preco ? "preco-ajustado-erro" : abaixoDoCusto ? "preco-ajustado-aviso" : undefined}
            className={`${classeDoCampo(erros.preco)} tabular-nums`}
          />
          <MensagemDeCampo id="preco-ajustado-erro" erro={erros.preco} />
          {abaixoDoCusto && !erros.preco && (
            <p id="preco-ajustado-aviso" className="mt-1 text-xs font-semibold text-status-warn">
              <span aria-hidden="true">▲ </span>
              Abaixo do custo ({reaisDeCentavos(custoUnitarioCentavos!)}). Dá para registrar mesmo assim.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="motivo-ajuste" className={rotulo}>
            Motivo
          </label>
          <input
            id="motivo-ajuste"
            value={motivo}
            maxLength={MAX_MOTIVO_AJUSTE}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: preço combinado com o cliente"
            aria-invalid={erros.motivo ? true : undefined}
            aria-describedby={erros.motivo ? "motivo-ajuste-erro" : undefined}
            className={classeDoCampo(erros.motivo)}
          />
          <MensagemDeCampo id="motivo-ajuste-erro" erro={erros.motivo} />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" className={classeDoBotao("principal")}>
            Aplicar
          </button>
          {valor && (
            <button
              type="button"
              onClick={() => {
                aoAplicar(null);
                aoFechar();
              }}
              className={classeDoBotao("secundario")}
            >
              Voltar ao preço do catálogo
            </button>
          )}
        </div>
      </form>
    </Gaveta>
  );
}
