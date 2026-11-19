// Mini gráfico de linha do saldo (últimos dias). SVG puro, sem biblioteca.
type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Texto pra leitor de tela, ex.: "Saldo nos últimos 30 dias: subiu". */
  label?: string;
};

export function Sparkline({ values, width = 96, height = 28, className = "", label }: SparklineProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const faixa = max - min || 1;
  const pad = 2;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = max === min ? height / 2 : pad + (1 - (v - min) / faixa) * (height - pad * 2);
    return [x, y] as const;
  });
  const linha = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${linha} L${width} ${height} L0 ${height} Z`;
  const subiu = values[values.length - 1] >= values[0];
  const cor = subiu ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
  const [ux, uy] = pts[pts.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible ${cor} ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={area} fill="currentColor" opacity={0.12} />
      <path d={linha} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={ux} cy={uy} r={2.2} fill="currentColor" />
    </svg>
  );
}

/** "subiu R$ X" / "caiu R$ X" / "estável" pro leitor de tela. */
export function trendLabel(values: number[], dias: number, fmt: (c: number) => string): string {
  if (values.length < 2) return "";
  const diff = values[values.length - 1] - values[0];
  if (diff === 0) return `Saldo estável nos últimos ${dias} dias`;
  return `Saldo ${diff > 0 ? "subiu" : "caiu"} ${fmt(Math.abs(diff))} nos últimos ${dias} dias`;
}
