import { Selo } from "@/components/ui/selo";
import type { CorrecaoDoNegocio } from "@/lib/db";
import { CORRECOES_PERMITIDAS, DIAS_PARA_DESFAZER } from "@/lib/dominio/correcoes";
import { dataHoraCurta } from "@/lib/dominio/suporte";
import { linhasDaCorrecao } from "./campos-da-correcao";
import { DesfazerCorrecao } from "./desfazer-correcao";

/**
 * Correções do suporte numa liberação (SPEC-019, 5.10): o que mudou, o antes e o depois, quem e
 * quando, e o "Desfazer" por até 30 dias (5.5). Nada é apagado: a correção desfeita continua aqui.
 */
export function CorrecoesDoSuporte({ correcoes, id }: { correcoes: CorrecaoDoNegocio[]; id: string }) {
  return (
    <section aria-labelledby={id} className="mt-4">
      <h3 id={id} className="text-sm font-bold">
        Correções do suporte ({correcoes.length})
      </h3>
      <ul className="mt-3 space-y-3">
        {correcoes.map((c) => {
          const linhas = linhasDaCorrecao(c.antes, c.depois);
          return (
            <li key={c.id} className="rounded-xl bg-card p-4 text-card-foreground ring-1 ring-border">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold break-words">
                    {c.rotulo} — {c.registro}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.modulo} ·{" "}
                    <time dateTime={c.criadoEm.toISOString()} className="tabular-nums">
                      {dataHoraCurta(c.criadoEm)}
                    </time>{" "}
                    · {c.autor} (suporte do HE)
                  </p>
                </div>
                {c.desfeitaEm && <Selo tom="neutro">Desfeita</Selo>}
              </div>
              {linhas.length > 0 && (
                <table className="mt-3 w-full table-fixed text-sm">
                  <caption className="sr-only">Antes e depois da correção</caption>
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th scope="col" className="w-[30%] pr-2 pb-1 font-medium">
                        Campo
                      </th>
                      <th scope="col" className="pr-2 pb-1 font-medium">
                        Antes
                      </th>
                      <th scope="col" className="pb-1 font-medium">
                        Depois
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => (
                      <tr key={l.campo} className="border-t border-border align-top">
                        <th scope="row" className="py-1.5 pr-2 text-left font-medium break-words">
                          {l.campo}
                        </th>
                        <td className="py-1.5 pr-2 break-words text-muted-foreground">{l.antes}</td>
                        <td className="py-1.5 font-semibold break-words">{l.depois}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="mt-3">
                {c.desfeitaEm ? (
                  <p className="text-sm text-muted-foreground">
                    Desfeita por {c.desfeitaPor} em {dataHoraCurta(c.desfeitaEm)}.
                  </p>
                ) : c.podeDesfazer ? (
                  <DesfazerCorrecao correcaoId={c.id} registro={c.registro} comoDesfaz={CORRECOES_PERMITIDAS[c.acao].desfazer} />
                ) : (
                  <p className="text-sm text-muted-foreground">O prazo de {DIAS_PARA_DESFAZER} dias para desfazer terminou.</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
