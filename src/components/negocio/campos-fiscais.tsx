"use client";

import { useState, type ComponentProps } from "react";
import type { AnexoSimples, AtividadeMei, RegimeTributario } from "@/generated/prisma/enums";
import { MensagemDeCampo } from "@/components/acesso/campos";
import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { formatarCnpj } from "@/lib/dominio/cnpj";
import { classeDoCampo } from "@/components/ui/classes";
import { ROTULO_ANEXO, ROTULO_ATIVIDADE_MEI, ROTULO_REGIME } from "./rotulos";

/**
 * Campos do enquadramento por regime (SPEC-004, 5.3). Só os campos do regime escolhido
 * vão no formulário; ao trocar o regime, os do regime anterior deixam de ser enviados.
 */

export type ValoresFiscais = {
  nome?: string;
  regime?: RegimeTributario;
  cnpj?: string | null;
  razaoSocial?: string | null;
  cnaePrincipal?: string | null;
  anexoSimples?: AnexoSimples | null;
  sujeitoFatorR?: boolean;
  atividadeMei?: AtividadeMei | null;
  impostoPercentualManual?: number | null;
};


function Rotulo({ htmlFor, children, ajuda }: { htmlFor: string; children: React.ReactNode; ajuda?: string }) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {children}
      </label>
      {ajuda && <p className="mt-0.5 text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

function Selecao({
  nome,
  rotulo,
  ajuda,
  erro,
  opcoes,
  ...props
}: Omit<ComponentProps<"select">, "id" | "name"> & {
  nome: string;
  rotulo: string;
  ajuda?: string;
  erro?: string;
  opcoes: [string, string][];
}) {
  return (
    <div>
      <Rotulo htmlFor={nome} ajuda={ajuda}>
        {rotulo}
      </Rotulo>
      <select
        id={nome}
        name={nome}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${nome}-erro` : undefined}
        className={classeDoCampo(erro)}
        {...props}
      >
        <option value="">Selecione…</option>
        {opcoes.map(([valor, texto]) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>
      <MensagemDeCampo id={`${nome}-erro`} erro={erro} />
    </div>
  );
}

export function CamposFiscais({
  valores,
  erros,
  regimes,
  limparErro,
  cnpjEditavel = false,
}: {
  valores: ValoresFiscais;
  erros: ErrosDeCampo;
  /** Regimes oferecidos (com CNPJ: MEI e Simples; sem CNPJ: só Autônomo). */
  regimes: RegimeTributario[];
  limparErro: (campo: string) => void;
  /** CNPJ digitável (negócio autônomo passando para MEI/Simples na edição). */
  cnpjEditavel?: boolean;
}) {
  const [regime, setRegime] = useState<RegimeTributario | "">(valores.regime ?? (regimes.length === 1 ? regimes[0] : ""));
  const temCnpj = regime === "MEI" || regime === "SIMPLES_NACIONAL";

  return (
    <div className="space-y-5">
      <div>
        <Rotulo htmlFor="nome" ajuda="Como o negócio vai aparecer no sistema (pode ser o nome fantasia).">
          Nome do negócio
        </Rotulo>
        <input
          id="nome"
          name="nome"
          defaultValue={valores.nome ?? ""}
          maxLength={120}
          aria-invalid={erros.nome ? true : undefined}
          aria-describedby={erros.nome ? "nome-erro" : undefined}
          onChange={() => limparErro("nome")}
          className={classeDoCampo(erros.nome)}
        />
        <MensagemDeCampo id="nome-erro" erro={erros.nome} />
      </div>

      {regimes.length > 1 ? (
        <Selecao
          nome="regime"
          rotulo="Regime tributário"
          value={regime}
          erro={erros.regime}
          opcoes={regimes.map((r) => [r, ROTULO_REGIME[r]])}
          onChange={(e) => {
            setRegime(e.target.value as RegimeTributario);
            limparErro("regime");
          }}
        />
      ) : (
        <input type="hidden" name="regime" value={regime} />
      )}

      {temCnpj &&
        (cnpjEditavel ? (
          <div>
            <Rotulo htmlFor="cnpj">CNPJ</Rotulo>
            <input
              id="cnpj"
              name="cnpj"
              inputMode="numeric"
              defaultValue={valores.cnpj ? formatarCnpj(valores.cnpj) : ""}
              placeholder="00.000.000/0000-00"
              aria-invalid={erros.cnpj ? true : undefined}
              aria-describedby={erros.cnpj ? "cnpj-erro" : undefined}
              onChange={() => limparErro("cnpj")}
              className={classeDoCampo(erros.cnpj)}
            />
            <MensagemDeCampo id="cnpj-erro" erro={erros.cnpj} />
          </div>
        ) : (
          <>
            <input type="hidden" name="cnpj" value={valores.cnpj ?? ""} />
            {valores.cnpj && (
              <p className="text-sm text-muted-foreground">
                CNPJ <span className="font-medium text-foreground">{formatarCnpj(valores.cnpj)}</span>
              </p>
            )}
            <MensagemDeCampo id="cnpj-erro" erro={erros.cnpj} />
          </>
        ))}

      {temCnpj && (
        <>
          <input type="hidden" name="razaoSocial" value={valores.razaoSocial ?? ""} />
          <div>
            <Rotulo htmlFor="cnaePrincipal" ajuda="Atividade principal do CNPJ (aparece no cartão CNPJ). Opcional.">
              CNAE principal
            </Rotulo>
            <input
              id="cnaePrincipal"
              name="cnaePrincipal"
              defaultValue={valores.cnaePrincipal ?? ""}
              placeholder="0000-0/00"
              aria-invalid={erros.cnaePrincipal ? true : undefined}
              aria-describedby={erros.cnaePrincipal ? "cnaePrincipal-erro" : undefined}
              onChange={() => limparErro("cnaePrincipal")}
              className={classeDoCampo(erros.cnaePrincipal)}
            />
            <MensagemDeCampo id="cnaePrincipal-erro" erro={erros.cnaePrincipal} />
          </div>
        </>
      )}

      {regime === "MEI" && (
        <Selecao
          nome="atividadeMei"
          rotulo="Atividade do MEI"
          ajuda="Define o valor do DAS mensal."
          defaultValue={valores.atividadeMei ?? ""}
          erro={erros.atividadeMei}
          opcoes={Object.entries(ROTULO_ATIVIDADE_MEI)}
          onChange={() => limparErro("atividadeMei")}
        />
      )}

      {regime === "SIMPLES_NACIONAL" && (
        <>
          <Selecao
            nome="anexoSimples"
            rotulo="Anexo do Simples Nacional"
            ajuda="Aparece no extrato do Simples (PGDAS) ou com o seu contador."
            defaultValue={valores.anexoSimples ?? ""}
            erro={erros.anexoSimples}
            opcoes={Object.entries(ROTULO_ANEXO)}
            onChange={() => limparErro("anexoSimples")}
          />
          <div className="flex items-start gap-3">
            <input
              id="sujeitoFatorR"
              name="sujeitoFatorR"
              type="checkbox"
              defaultChecked={valores.sujeitoFatorR ?? false}
              className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
            />
            <label htmlFor="sujeitoFatorR" className="text-sm text-foreground">
              Minha atividade está sujeita ao <strong>Fator R</strong>
              <span className="block text-xs text-muted-foreground">
                Comum em serviços intelectuais (ex.: tecnologia, consultoria, psicologia): o Anexo muda entre III e V conforme a
                folha de salários.
              </span>
            </label>
          </div>
        </>
      )}

      {regime === "AUTONOMO" && (
        <div>
          <Rotulo
            htmlFor="impostoPercentual"
            ajuda="Some o ISS e o IR que você recolhe sobre o que recebe. Se não souber, pergunte ao seu contador."
          >
            Imposto que você paga (%)
          </Rotulo>
          <input
            id="impostoPercentual"
            name="impostoPercentual"
            inputMode="decimal"
            defaultValue={valores.impostoPercentualManual?.toString().replace(".", ",") ?? ""}
            placeholder="Ex.: 6,5"
            aria-invalid={erros.impostoPercentual ? true : undefined}
            aria-describedby={erros.impostoPercentual ? "impostoPercentual-erro" : undefined}
            onChange={() => limparErro("impostoPercentual")}
            className={classeDoCampo(erros.impostoPercentual)}
          />
          <MensagemDeCampo id="impostoPercentual-erro" erro={erros.impostoPercentual} />
        </div>
      )}
    </div>
  );
}
