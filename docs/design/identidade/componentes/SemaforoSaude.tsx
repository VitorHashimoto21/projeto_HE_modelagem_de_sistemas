/* Selo do semáforo de saúde financeira (RF57) — Health Enterprise.
   Regra da identidade: o status NUNCA é comunicado só pela cor;
   sempre ícone + rótulo escrito (acessível a daltônicos e leitores de tela). */

export type StatusSaude = 'saudavel' | 'atencao' | 'deficit'

const CONFIG: Record<StatusSaude, { rotulo: string; classes: string; icone: JSX.Element }> = {
  saudavel: {
    rotulo: 'Saudável',
    classes: 'bg-status-ok-bg text-status-ok border-status-ok/30',
    icone: <path d="M5 12.5l4 4 10-10" />,               // check
  },
  atencao: {
    rotulo: 'Atenção',
    classes: 'bg-status-warn-bg text-status-warn border-status-warn/30',
    icone: <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>, // triângulo
  },
  deficit: {
    rotulo: 'Déficit',
    classes: 'bg-status-danger-bg text-status-danger border-status-danger/30',
    icone: <path d="M12 5v14M6 13l6 6 6-6" />,             // seta para baixo
  },
}

export function SemaforoSaude({ status, detalhe }: { status: StatusSaude; detalhe?: string }) {
  const c = CONFIG[status]
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${c.classes}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{c.icone}</svg>
      {c.rotulo}
      {detalhe && <span className="font-normal opacity-90">· {detalhe}</span>}
    </span>
  )
}
