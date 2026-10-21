"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, TriangleAlert } from "lucide-react";
import { MensagemDeCampo } from "@/components/acesso/campos";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao } from "@/components/ui/estilos";
import { acaoConferirNcm } from "@/lib/catalogo/acoes";
import { MENSAGENS_CATALOGO } from "@/lib/catalogo/validacao";
import { formatarNcm, lerNcm } from "@/lib/dominio/ncm";

// A gaveta "Buscar NCM" só é baixada no primeiro toque no botão (SPEC-016, seção 10).
const GavetaBuscaNcm = dynamic(() => import("./busca-ncm").then((m) => m.GavetaBuscaNcm), { ssr: false });

export type NcmConhecido = { codigo: string; descricao: string | null; vigente: boolean };
export type SugestaoDoCampo = { ncm: string; descricao: string; itens: number; subcategoria: string };

/** Aviso obrigatório junto da sugestão (OPEN-004, complemento da equipe). */
export const AVISO_DA_SUGESTAO = "Isto é só uma sugestão e pode estar errada. Confira o código certo: a responsabilidade pelo NCM cadastrado é do próprio negócio.";
export const AVISO_FORA_DA_TABELA = "NCM fora da tabela vigente — revise o código.";

type Situacao =
  | { tipo: "vazio" }
  | { tipo: "incompleto" }
  | { tipo: "conferindo" }
  | { tipo: "ok"; descricao: string }
  | { tipo: "fora"; descricao: string | null }
  | { tipo: "erro"; mensagem: string };

function situacaoInicial(gravado: NcmConhecido | null): Situacao {
  if (!gravado) return { tipo: "vazio" };
  return gravado.vigente && gravado.descricao ? { tipo: "ok", descricao: gravado.descricao } : { tipo: "fora", descricao: gravado.descricao };
}

/**
 * Campo NCM do produto físico (SPEC-021, 5.2–5.4): digitar os 8 dígitos (confere na tabela vigente),
 * buscar na gaveta ou usar a sugestão da subcategoria. O código gravado que saiu da tabela continua
 * aceito sem mudança (OPEN-002); um código novo precisa estar vigente — o servidor confere de novo.
 */
export function CampoNcm({
  gravado,
  obrigatorio,
  sugestao,
  erro,
  limpar,
}: {
  gravado: NcmConhecido | null;
  obrigatorio: boolean;
  sugestao: SugestaoDoCampo | null;
  erro?: string;
  limpar: () => void;
}) {
  const [texto, setTexto] = useState(gravado ? formatarNcm(gravado.codigo) : "");
  const [situacao, setSituacao] = useState<Situacao>(() => situacaoInicial(gravado));
  const [buscaPedida, setBuscaPedida] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [, iniciar] = useTransition();
  const campo = useRef<HTMLInputElement>(null);
  const ultima = useRef(0);
  const codigo = lerNcm(texto);

  // Confere o código digitado (8 dígitos) na tabela vigente, depois de a pessoa parar de digitar.
  useEffect(() => {
    if (!codigo || (gravado && codigo === gravado.codigo)) return;
    const pedido = ++ultima.current;
    const espera = setTimeout(() => {
      iniciar(async () => {
        const r = await acaoConferirNcm(codigo);
        if (pedido !== ultima.current) return;
        if (r.status === "ok" && r.ncm.vigente && r.ncm.descricao) setSituacao({ tipo: "ok", descricao: r.ncm.descricao });
        else if (r.status === "ok" || r.status === "nao-encontrado") setSituacao({ tipo: "erro", mensagem: MENSAGENS_CATALOGO.ncmForaDaTabela });
        else setSituacao({ tipo: "erro", mensagem: r.mensagem });
      });
    }, 250);
    return () => clearTimeout(espera);
  }, [codigo, gravado]);

  function mudar(valor: string) {
    setTexto(valor);
    limpar();
    ultima.current++;
    const c = lerNcm(valor);
    if (!valor.trim()) setSituacao({ tipo: "vazio" });
    else if (!c) setSituacao({ tipo: "incompleto" });
    else if (gravado && c === gravado.codigo) setSituacao(situacaoInicial(gravado));
    else setSituacao({ tipo: "conferindo" });
  }

  function escolher(c: string, descricao: string) {
    ultima.current++;
    setTexto(formatarNcm(c));
    setSituacao({ tipo: "ok", descricao });
    limpar();
  }

  const mostrarSugestao = sugestao && sugestao.ncm !== codigo;
  const erroDoCampo = erro ?? (situacao.tipo === "erro" ? situacao.mensagem : undefined);
  const descricaoId = "ncm-situacao";

  return (
    <div>
      <div className="mb-1.5">
        <label htmlFor="ncm" className="text-sm font-medium text-foreground">
          {obrigatorio ? "NCM" : "NCM (opcional)"}
        </label>
        <p id="ncm-ajuda" className="mt-0.5 text-xs text-muted-foreground">
          Código da mercadoria na nota fiscal, com 8 dígitos. Busque pelo código ou por palavras. A classificação correta é responsabilidade do negócio; na
          dúvida, confirme com o seu contador.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={campo}
          id="ncm"
          name="ncm"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0000.00.00"
          maxLength={12}
          value={texto}
          onChange={(e) => mudar(e.target.value)}
          onBlur={() => codigo && setTexto(formatarNcm(codigo))}
          aria-required={obrigatorio || undefined}
          aria-invalid={erroDoCampo ? true : undefined}
          aria-describedby={`ncm-ajuda ${descricaoId}${erroDoCampo ? " ncm-erro" : ""}`}
          className={`${classeDoCampo(erroDoCampo)} min-w-0 flex-1 basis-40 tabular-nums`}
        />
        <button
          type="button"
          onClick={() => {
            setBuscaPedida(true);
            setBuscando(true);
          }}
          className={classeDoBotao("secundario")}
        >
          <Search aria-hidden="true" />
          Buscar NCM
        </button>
      </div>
      <div id={descricaoId} aria-live="polite" className="mt-1.5 text-sm">
        {situacao.tipo === "conferindo" && <p className="text-muted-foreground">Conferindo na tabela…</p>}
        {situacao.tipo === "ok" && <p className="text-muted-foreground">{situacao.descricao}</p>}
        {situacao.tipo === "fora" && (
          <p className="flex items-start gap-1.5 font-medium text-status-warn">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              {AVISO_FORA_DA_TABELA}
              {situacao.descricao ? <span className="block font-normal text-muted-foreground">{situacao.descricao}</span> : null}
            </span>
          </p>
        )}
      </div>
      <MensagemDeCampo id="ncm-erro" erro={erroDoCampo} />

      {mostrarSugestao && (
        <div className="mt-3 rounded-xl bg-status-warn-bg px-4 py-3">
          <button type="button" onClick={() => escolher(sugestao.ncm, sugestao.descricao)} className={classeDoBotao("secundario", "sm")}>
            Usar {formatarNcm(sugestao.ncm)}, o NCM de {sugestao.itens} {sugestao.itens === 1 ? "item" : "itens"} de {sugestao.subcategoria}
          </button>
          <p className="mt-2 flex items-start gap-1.5 text-sm text-status-warn">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {AVISO_DA_SUGESTAO}
          </p>
        </div>
      )}

      {buscaPedida && (
        <GavetaBuscaNcm
          aberta={buscando}
          aoMudar={setBuscando}
          focoAoFechar={campo}
          aoEscolher={(r) => {
            escolher(r.codigo, r.descricao);
            setBuscando(false);
          }}
        />
      )}
    </div>
  );
}
