// Gastos do mês por categoria: rosca animada + blocos de legenda (visual inspirado no
// "Weekly Expense Card" do 21st.dev, adaptado sem framer-motion/shadcn: animação em CSS).
import Link from "next/link";
import type { CSSProperties } from "react";
import { formatBRL } from "@/lib/money";
import type { CategoryTotal } from "@/lib/rules";

const FALLBACK_COLORS = ["#a67c52", "#ea580c", "#2563eb", "#db2777", "#16a34a", "#ca8a04", "#0d9488", "#64748b"];

type ExpensesDonutChartProps = {
  items: CategoryTotal[];
  month: string;
};

const SIZE = 188;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;
/** Espaço entre as fatias (as pontas são arredondadas e encostariam). */
const GAP = STROKE * 0.9;

export function ExpensesDonutChart({ items, month }: ExpensesDonutChartProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3v9l6.36 6.36" />
          </svg>
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Sem despesas neste mês</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Quando houver gastos registrados, o gráfico por categoria aparecerá aqui.
        </p>
      </div>
    );
  }

  const totalCents = items.reduce((acc, item) => acc + item.totalCents, 0);
  const varias = items.length > 1;
  let inicio = 0;
  const slices = items.map((item, idx) => {
    const color = item.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
    const length = totalCents > 0 ? (item.totalCents / totalCents) * CIRC : 0;
    // Fatia muito pequena vira um ponto (a ponta redonda já ocupa o espaço).
    const visivel = varias ? Math.max(length - GAP, 0.01) : length;
    const slice = { ...item, color, length: visivel, start: inicio };
    inicio += length;
    return slice;
  });

  return (
    <div>
      <div className="relative mx-auto flex h-48 w-full items-center justify-center">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label="Gráfico de despesas por categoria"
          className="-rotate-90 overflow-visible"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            className="text-slate-100 dark:text-slate-800"
          />
          {slices.map((slice, i) => (
            <circle
              key={slice.categoryId}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={slice.color}
              strokeWidth={STROKE}
              strokeLinecap={varias ? "round" : "butt"}
              strokeDashoffset={-slice.start - (varias ? GAP / 2 : 0)}
              className="donut-slice"
              style={
                {
                  "--len": `${slice.length}px`,
                  "--circ": `${CIRC}px`,
                  strokeDasharray: `${slice.length} ${CIRC}`,
                  animationDelay: `${i * 70}ms`,
                } as CSSProperties
              }
            >
              <title>{`${slice.name}: ${formatBRL(slice.totalCents)} (${slice.percent}%)`}</title>
            </circle>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-slate-500 dark:text-slate-400">Total gasto</span>
          <span className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-slate-100">
            {formatBRL(totalCents)}
          </span>
        </div>
      </div>

      {/* Legenda em blocos: cada um abre as transações daquela categoria */}
      <ul className="mt-5 grid grid-cols-2 gap-3">
        {slices.map((slice) => (
          <li key={slice.categoryId}>
            <Link
              href={`/transacoes?month=${month}&type=EXPENSE&categoryId=${slice.categoryId}`}
              className="flex min-h-24 flex-col justify-end rounded-2xl bg-slate-100/70 p-4 transition motion-reduce:transition-none hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:bg-slate-800/50 dark:hover:bg-slate-800"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden="true" />
                <p className="truncate text-sm font-medium text-slate-500 dark:text-slate-400">{slice.name}</p>
                <span className="ml-auto shrink-0 text-xs font-semibold text-slate-400 tabular-nums dark:text-slate-500">
                  {slice.percent}%
                </span>
              </div>
              <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums dark:text-slate-100">{formatBRL(slice.totalCents)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
