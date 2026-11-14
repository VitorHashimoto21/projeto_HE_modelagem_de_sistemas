"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Gaveta } from "@/components/ui/gaveta";
import { classeDoCampo } from "@/components/ui/classes";
import { acaoBuscarNcm } from "@/lib/catalogo/acoes";
import type { EstadoDaBuscaNcm } from "@/lib/catalogo/servicos";
import { formatarNcm, LIMITE_DA_BUSCA, termosDaBusca } from "@/lib/dominio/ncm";

/** "2026-10-21" → "21/10/2026". */
const diaBrasileiro = (dia: string) => dia.split("-").reverse().join("/");

/**
 * Gaveta "Buscar NCM" (SPEC-021, 5.2): palavras (3 letras ou mais) ou começo do código (2 dígitos ou
 * mais), só códigos vigentes, até 20, em ordem de código. Baixada no primeiro toque em "Buscar NCM".
 */
export function GavetaBuscaNcm({
  aberta,
  aoMudar,
  focoAoFechar,
  aoEscolher,
}: {
  aberta: boolean;
  aoMudar: (aberta: boolean) => void;
  focoAoFechar: React.RefObject<HTMLElement | null>;
  aoEscolher: (r: { codigo: string; descricao: string }) => void;
}) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<EstadoDaBuscaNcm | null>(null);
  const [buscando, iniciar] = useTransition();
  const ultima = useRef(0);

  useEffect(() => {
    if (termosDaBusca(texto).tipo === "curta") return;
    // Espera a pessoa parar de digitar; só a resposta da última busca vale.
    const pedido = ++ultima.current;
    const espera = setTimeout(() => {
      iniciar(async () => {
        const r = await acaoBuscarNcm(texto);
        if (pedido === ultima.current) setEstado(r);
      });
    }, 300);
    return () => clearTimeout(espera);
  }, [texto]);

  const curta = termosDaBusca(texto).tipo === "curta";
  const resultado = !curta && estado?.status === "ok" ? estado : null;

  return (
    <Gaveta
      aberta={aberta}
      aoMudar={aoMudar}
      titulo="Buscar NCM"
      descricao="Procure pelo código ou por palavras da descrição oficial. A classificação correta é responsabilidade do negócio."
      focoAoFechar={focoAoFechar}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="busca-ncm" className="text-sm font-medium text-foreground">
            Código ou palavras
          </label>
          <p id="busca-ncm-ajuda" className="mt-0.5 mb-1.5 text-xs text-muted-foreground">
            Ex.: “bijuteria” ou “7117”. Palavras com 3 letras ou mais; código com 2 dígitos ou mais.
          </p>
          <input
            id="busca-ncm"
            type="search"
            autoFocus
            autoComplete="off"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-describedby="busca-ncm-ajuda busca-ncm-situacao"
            className={classeDoCampo()}
          />
        </div>

        <p id="busca-ncm-situacao" role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {curta
            ? ""
            : buscando && !resultado
              ? "Buscando…"
              : estado?.status === "erro"
                ? estado.mensagem
                : resultado && resultado.resultados.length === 0
                  ? "Nenhum código vigente encontrado."
                  : resultado?.maisResultados
                    ? `Mostrando os ${LIMITE_DA_BUSCA} primeiros. Refine a busca.`
                    : resultado
                      ? `${resultado.resultados.length} ${resultado.resultados.length === 1 ? "código encontrado" : "códigos encontrados"}.`
                      : ""}
        </p>

        {resultado && resultado.resultados.length > 0 && (
          <ul aria-label="Códigos NCM encontrados" className="divide-y overflow-hidden rounded-xl bg-muted/60">
            {resultado.resultados.map((r) => (
              <li key={r.codigo}>
                <button
                  type="button"
                  onClick={() => aoEscolher(r)}
                  className="flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors duration-(--duracao-estado) hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  <span className="text-sm font-bold text-foreground tabular-nums">{formatarNcm(r.codigo)}</span>
                  <span className="text-sm text-muted-foreground">{r.descricao}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="border-t pt-4 text-xs text-muted-foreground">
          Tabela NCM oficial (Siscomex){resultado?.atualizadaEm ? `, atualizada em ${diaBrasileiro(resultado.atualizadaEm)}` : ""}. Confira a classificação com o seu
          contador.
        </p>
      </div>
    </Gaveta>
  );
}
