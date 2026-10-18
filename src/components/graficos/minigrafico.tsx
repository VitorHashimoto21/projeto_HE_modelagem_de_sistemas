// Minigráfico (SPEC-016, 5.5): uma linha de tendência sem eixos, desenhada no servidor.
// A descrição em texto (aria-label) diz o começo e o fim — o gráfico nunca é a única fonte.

export function Minigrafico({
  valores,
  largura = 120,
  altura = 36,
  descricao,
  area,
  className,
}: {
  valores: number[];
  largura?: number;
  altura?: number;
  descricao: string;
  /** Preenche a área sob a linha (no bloco grande da faixa). */
  area?: boolean;
  className?: string;
}) {
  if (valores.length < 2) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const faixa = max - min || 1;
  const margem = 3;
  const pontos = valores.map((v, i) => [
    (i / (valores.length - 1)) * (largura - margem * 2) + margem,
    altura - margem - ((v - min) / faixa) * (altura - margem * 2),
  ]);
  const linha = pontos.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [ux, uy] = pontos[pontos.length - 1];
  return (
    <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={descricao} className={className}>
      {area && <path d={`M${margem},${altura} L${linha.replaceAll(" ", " L")} L${largura - margem},${altura} Z`} fill="currentColor" opacity="0.18" />}
      <polyline points={linha} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={ux} cy={uy} r="3.5" fill="currentColor" />
    </svg>
  );
}
