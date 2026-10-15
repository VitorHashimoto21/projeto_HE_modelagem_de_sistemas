import { posicoesDoMedidor } from "@/lib/dominio/graficos";
import { reaisDeCentavos as reais } from "@/lib/dominio/venda";
import { cn } from "@/lib/utils";

// Medidor da meta do mês (SPEC-016, 5.5; RF57): faturado sólido, ritmo até o fim do mês
// hachurado (estimativa), marcas do equilíbrio e da meta. A cor da faixa segue só o valor
// real (SPEC-012, OPEN-003); a descrição em texto acompanha (role="img" + aria-label).

export function Medidor({
  faturadoCentavos,
  equilibrioCentavos,
  metaCentavos,
  ritmoCentavos,
  tom,
}: {
  faturadoCentavos: number;
  equilibrioCentavos: number;
  metaCentavos: number | null;
  ritmoCentavos: number | null;
  tom: "ok" | "atencao" | "perigo";
}) {
  const p = posicoesDoMedidor({ faturadoCentavos, equilibrioCentavos, metaCentavos, ritmoCentavos });
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const cor = { ok: "bg-status-ok", atencao: "bg-primary", perigo: "bg-status-danger" }[tom];
  const descricao =
    `Faturado ${reais(faturadoCentavos)}; equilíbrio ${reais(equilibrioCentavos)}` +
    (metaCentavos !== null ? `; meta ${reais(metaCentavos)}` : "") +
    (ritmoCentavos !== null ? `; no ritmo atual, o mês fecha em ${reais(ritmoCentavos)}` : "");

  return (
    <div role="img" aria-label={descricao} className="relative h-[74px]">
      <div className="absolute inset-x-0 top-3.5 h-4 overflow-hidden rounded-full bg-muted">
        {p.ritmo !== null && <div className="hachurado absolute inset-y-0 left-0 rounded-full" style={{ width: pct(p.ritmo) }} />}
        <div className={cn("absolute inset-y-0 left-0 origin-left animate-[medidor-encher_700ms_var(--ease-saida)] rounded-full", cor)} style={{ width: pct(p.faturado) }} />
      </div>
      <span
        className="absolute top-2 size-7 -translate-x-1/2 rounded-full border-[3px] border-estrutura bg-card dark:border-estrutura-suave"
        style={{ left: pct(p.equilibrio) }}
        aria-hidden="true"
      />
      {p.meta !== null && <span className="absolute top-2 right-0 size-7 rounded-full border-[3px] border-estrutura bg-card dark:border-estrutura-suave" aria-hidden="true" />}
      <span className="absolute top-11 -translate-x-1/2 text-[13px] font-semibold whitespace-nowrap" style={{ left: `clamp(4.5rem, ${pct(p.equilibrio)}, calc(100% - 9rem))` }} aria-hidden="true">
        Equilíbrio {reais(equilibrioCentavos)}
      </span>
      {metaCentavos !== null && (
        <span className="absolute top-11 right-0 hidden text-[13px] font-semibold whitespace-nowrap sm:inline" aria-hidden="true">
          Meta {reais(metaCentavos)}
        </span>
      )}
    </div>
  );
}
