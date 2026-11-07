import Link from "next/link";
import { Eye, LifeBuoy, LogOut, OctagonPause, Siren } from "lucide-react";
import { classeDoBotao } from "@/components/ui/estilos";
import { dataHoraCurta, listaDeModulos } from "@/lib/dominio/suporte";
import { textoDaFaixaDaSuspensao, type SuspensaoDoNegocio } from "@/lib/dominio/suspensao";
import { acaoSairDoModoSuporte } from "@/lib/suporte/acoes";
import { cn } from "@/lib/utils";
import { EncerrarEmergencia } from "./encerrar-emergencia";

// Avisos do acesso de suporte (SPEC-018, 5.5 e 5.6). Dois lados da mesma liberação:
// o Administrador vê sempre onde está e até quando; a equipe do negócio vê que o suporte
// pode ver os módulos liberados, e o Dono chega ao registro com um toque.

/**
 * Faixa do Administrador em modo suporte (5.5): cor própria, somente leitura, até quando, e a saída.
 * Fixa a partir de 768 px; no celular rola com a página e passa por baixo do cabeçalho fixo
 * (por isso o z-index só a partir de md — decisão de 18/10/2026, seção 9).
 * SPEC-019 (5.3): com correção, "pode corrigir: {módulos}"; se a entrada não teve o código
 * reconfirmado nesta sessão, avisa que é preciso sair e entrar de novo para corrigir.
 */
export function FaixaDoModoSuporte({
  negocio,
  expiraEm,
  corrigir = [],
  correcaoPendente = false,
  emergencia = null,
  suspenso = false,
}: {
  negocio: string;
  expiraEm: Date;
  corrigir?: string[];
  correcaoPendente?: boolean;
  /** SPEC-019 (5.6): acesso de emergência, com o motivo curto. */
  emergencia?: { motivo: string } | null;
  /** SPEC-019 (5.7): negócio suspenso — a liberação vale para ver, e as correções esperam a reativação. */
  suspenso?: boolean;
}) {
  if (emergencia) return <FaixaDaEmergenciaDoAdministrador negocio={negocio} expiraEm={expiraEm} motivo={emergencia.motivo} suspenso={suspenso} />;
  const nivel = suspenso
    ? "somente leitura (negócio suspenso: sem correções até a reativação)"
    : corrigir.length > 0
      ? `pode corrigir: ${listaDeModulos(corrigir)}`
      : correcaoPendente
        ? "somente leitura (para corrigir, saia e entre de novo)"
        : "somente leitura";
  return (
    <div role="region" aria-label="Modo suporte" className="bg-ambar md:sticky md:top-0 md:z-40 text-ambar-foreground shadow-[0_6px_16px_color-mix(in_srgb,var(--estrutura)_18%,transparent)]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-10">
        <p className="flex min-w-0 items-center gap-2 text-sm font-bold">
          <Eye className="size-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
          <span className="min-w-0">
            <span className="font-extrabold">Modo suporte</span>
            <span aria-hidden="true"> · </span>
            <span className="break-words">{negocio}</span>
            <span aria-hidden="true"> · </span>
            <span className="font-semibold">
              {nivel} · até {dataHoraCurta(expiraEm)}
            </span>
          </span>
        </p>
        <form action={acaoSairDoModoSuporte}>
          <button type="submit" className={classeDoBotao("secundario", "sm", "border-ambar-foreground/30 bg-ambar-foreground/10 text-ambar-foreground hover:bg-ambar-foreground/15")}>
            <LogOut aria-hidden="true" />
            Sair do modo suporte
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * SPEC-019 (5.6): a faixa vermelha do Administrador no acesso de emergência — "Emergência · {negócio} ·
 * somente leitura · até {hora} · {motivo}". Sair encerra o acesso (sem renovação).
 */
function FaixaDaEmergenciaDoAdministrador({ negocio, expiraEm, motivo, suspenso }: { negocio: string; expiraEm: Date; motivo: string; suspenso: boolean }) {
  return (
    <div role="region" aria-label="Acesso de emergência" className="bg-status-danger text-background md:sticky md:top-0 md:z-40 shadow-[0_6px_16px_color-mix(in_srgb,var(--estrutura)_18%,transparent)]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-10">
        <p className="flex min-w-0 items-center gap-2 text-sm font-bold">
          <Siren className="size-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
          <span className="min-w-0">
            <span className="font-extrabold">Emergência</span>
            <span aria-hidden="true"> · </span>
            <span className="break-words">{negocio}</span>
            <span aria-hidden="true"> · </span>
            <span className="font-semibold">
              somente leitura · até {dataHoraCurta(expiraEm)} · {motivo}
              {suspenso && " · negócio suspenso"}
            </span>
          </span>
        </p>
        <form action={acaoSairDoModoSuporte}>
          <button type="submit" className={classeDoBotao("secundario", "sm", "border-background/40 bg-background/10 text-background hover:bg-background/20")}>
            <LogOut aria-hidden="true" />
            Sair e encerrar
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * SPEC-019 (5.6): a faixa vermelha para todos os membros enquanto houver acesso de emergência — "Acesso de
 * emergência do suporte do HE até {hora}: {motivo}". O Dono ganha "Ver detalhes" e "Encerrar acesso".
 */
export function FaixaDaEmergencia({ acessoId, motivo, expiraEm, ehDono }: { acessoId: string; motivo: string; expiraEm: Date; ehDono: boolean }) {
  return (
    <div role="status" className="border-b border-status-danger/30 bg-status-danger-bg text-status-danger">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 text-sm sm:px-6 lg:px-10">
        <p className="flex min-w-0 items-start gap-2 font-semibold">
          <Siren className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
          <span>
            Acesso de emergência do suporte do HE até {dataHoraCurta(expiraEm)}: {motivo}.
          </span>
        </p>
        {ehDono && (
          <div className="flex flex-wrap items-center gap-3 pl-6 sm:pl-0">
            <Link href="/negocio/suporte" className="font-bold underline underline-offset-2">
              Ver detalhes
            </Link>
            <EncerrarEmergencia acessoId={acessoId} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * SPEC-019 (5.7, RN39): a faixa para todos os membros enquanto o negócio estiver suspenso — "Negócio suspenso
 * pelo HE desde {data}: {motivo}. Fale com o suporte." Tudo continua visível; nada é gravado. O Dono ganha o
 * atalho para "Acessos do suporte", onde vê a descrição.
 */
export function FaixaDaSuspensao({ suspensao, ehDono }: { suspensao: SuspensaoDoNegocio; ehDono: boolean }) {
  return (
    <div role="status" className="border-b border-status-danger/30 bg-status-danger-bg text-status-danger">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-2.5 text-sm sm:px-6 lg:px-10">
        <p className="flex min-w-0 items-start gap-2 font-semibold">
          <OctagonPause className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
          <span>
            {textoDaFaixaDaSuspensao(suspensao)} <span className="font-normal">Você pode ver e exportar os dados; nada é gravado até a reativação.</span>
          </span>
        </p>
        {ehDono && (
          <Link href="/negocio/suporte" className="shrink-0 pl-6 font-bold underline underline-offset-2 sm:pl-0">
            Ver detalhes
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Faixa para a equipe do negócio enquanto houver liberação ativa (5.6); o Dono ganha o atalho para o registro.
 * SPEC-019 (5.2, item 5): com correção, "pode ver {módulos} e corrigir {módulos}".
 */
export function FaixaDoSuporteLiberado({
  modulos,
  modulosComCorrecao = [],
  expiraEm,
  ehDono,
  suspenso = false,
}: {
  modulos: string[];
  modulosComCorrecao?: string[];
  expiraEm: Date;
  ehDono: boolean;
  /** SPEC-019 (5.7): no negócio suspenso, as correções liberadas esperam a reativação. */
  suspenso?: boolean;
}) {
  return (
    <div role="status" className="border-b border-status-warn/20 bg-status-warn-bg text-status-warn">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-2.5 text-sm sm:px-6 lg:px-10">
        <p className="flex min-w-0 items-start gap-2 font-semibold">
          <LifeBuoy className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
          <span>
            {modulosComCorrecao.length > 0 && suspenso
              ? `O suporte do HE pode ver ${listaDeModulos(modulos)} até ${dataHoraCurta(expiraEm)}. As correções liberadas esperam a reativação do negócio.`
              : modulosComCorrecao.length > 0
                ? `O suporte do HE pode ver ${listaDeModulos(modulos)} e corrigir ${listaDeModulos(modulosComCorrecao)} até ${dataHoraCurta(expiraEm)}.`
                : `O suporte do HE pode ver ${listaDeModulos(modulos)} deste negócio (somente leitura) até ${dataHoraCurta(expiraEm)}.`}
          </span>
        </p>
        {ehDono && (
          <Link href="/negocio/suporte" className={cn("shrink-0 pl-6 font-bold underline underline-offset-2 sm:pl-0")}>
            Ver acessos do suporte
          </Link>
        )}
      </div>
    </div>
  );
}
