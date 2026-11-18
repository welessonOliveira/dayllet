import Link from "next/link";
import { formatBRL } from "@/lib/money";
import type { CategoryTotal } from "@/lib/rules";

const FALLBACK_COLORS = [
  "#7c3aed",
  "#ea580c",
  "#2563eb",
  "#db2777",
  "#16a34a",
  "#ca8a04",
  "#0d9488",
  "#64748b",
];

type ExpensesDonutChartProps = {
  items: CategoryTotal[];
  month: string;
};

export function ExpensesDonutChart({ items, month }: ExpensesDonutChartProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3v9l6.36 6.36" />
          </svg>
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-700">
          Sem despesas neste mês
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Quando houver gastos registrados, o gráfico por categoria aparecerá
          aqui.
        </p>
      </div>
    );
  }

  // Soma inteira em centavos apenas para exibir o total de despesas no centro do gráfico
  const totalCents = items.reduce((acc, item) => acc + item.totalCents, 0);

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const slices = items.map((item, idx) => {
    const color = item.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
    const fraction = totalCents > 0 ? item.totalCents / totalCents : 0;
    const length = fraction * circumference;
    const slice = {
      ...item,
      color,
      length,
      dashOffset: -offset,
    };
    offset += length;
    return slice;
  });

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      {/* Gráfico Donut em SVG puro */}
      <div className="relative shrink-0">
        <svg
          width="188"
          height="188"
          viewBox="0 0 188 188"
          role="img"
          aria-label="Gráfico de despesas por categoria"
          className="overflow-visible"
        >
          <circle
            cx="94"
            cy="94"
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="24"
          />
          <g transform="rotate(-90 94 94)">
            {slices.map((slice) => (
              <circle
                key={slice.categoryId}
                cx="94"
                cy="94"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth="24"
                strokeDasharray={`${slice.length} ${circumference}`}
                strokeDashoffset={slice.dashOffset}
                className="transition-all duration-300"
              >
                <title>{`${slice.name}: ${formatBRL(slice.totalCents)} (${slice.percent}%)`}</title>
              </circle>
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Despesas
          </span>
          <span className="mt-0.5 text-sm font-bold text-slate-900 tabular-nums">
            {formatBRL(totalCents)}
          </span>
        </div>
      </div>

      {/* Legenda detalhada por categoria */}
      <ul className="w-full flex-1 space-y-3">
        {slices.map((slice) => (
          <li key={slice.categoryId}>
            <Link
              href={`/transacoes?month=${month}&type=EXPENSE&categoryId=${slice.categoryId}`}
              className="group block rounded-xl p-1.5 -mx-1.5 transition hover:bg-slate-50"
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="truncate font-medium text-slate-700 group-hover:text-violet-700">
                    {slice.name}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2 tabular-nums">
                  <span className="text-xs font-semibold text-slate-400">
                    {slice.percent}%
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatBRL(slice.totalCents)}
                  </span>
                </div>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(Math.max(slice.percent, 2), 100)}%`,
                    backgroundColor: slice.color,
                  }}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
