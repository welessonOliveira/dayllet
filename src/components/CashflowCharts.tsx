import Link from "next/link";
import { currentMonth, formatMonthLabel } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { MonthCashflow } from "@/lib/projection";

function shortMonth(month: string): string {
  const [y, m] = month.split("-");
  const nomes = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  return `${nomes[Number(m) - 1]}/${y.slice(2)}`;
}

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function getClosestMonths(items: MonthCashflow[], count = 6): MonthCashflow[] {
  if (items.length <= count) return items;
  const thisM = currentMonth();
  const currentIdx = items.findIndex((m) => m.month === thisM);
  if (currentIdx === -1) {
    return items.slice(-count);
  }
  let start = currentIdx - 2;
  if (start + count > items.length) {
    start = items.length - count;
  }
  if (start < 0) {
    start = 0;
  }
  return items.slice(start, start + count);
}

type SvgBarChartProps = {
  items: MonthCashflow[];
  thisMonth: string;
  maxCents: number;
  width: number;
  height: number;
  padX: number;
  padTop: number;
  padBottom: number;
  maxBarW: number;
  className: string;
};

function SvgBarChart({
  items,
  thisMonth,
  maxCents,
  width,
  height,
  padX,
  padTop,
  padBottom,
  maxBarW,
  className,
}: SvgBarChartProps) {
  const chartH = height - padTop - padBottom;
  const slotW = items.length > 0 ? (width - padX * 2) / items.length : 80;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Gráfico de barras comparando receitas e despesas previstas e realizadas por mês"
      className={className}
    >
      {/* Linhas guia horizontais */}
      {[0, 0.25, 0.5, 0.75, 1].map((step) => {
        const y = padTop + chartH * (1 - step);
        return (
          <line
            key={step}
            x1={padX}
            y1={y}
            x2={width - padX}
            y2={y}
            stroke={step === 0 ? "var(--chart-axis, #cbd5e1)" : "var(--chart-grid, #f1f5f9)"}
            strokeWidth={step === 0 ? "1.5" : "1"}
          />
        );
      })}

      {items.map((m, idx) => {
        const centerX = padX + slotW * idx + slotW / 2;
        const barW = Math.min(maxBarW, (slotW - 14) / 4);
        const gap = 2;
        const groupW = barW * 4 + gap * 3;
        const startX = centerX - groupW / 2;
        const baseY = padTop + chartH;
        const isCurrent = m.month === thisMonth;

        const h = (val: number) =>
          val > 0 ? Math.max((val / maxCents) * chartH, 3) : 0;

        const pIncH = h(m.plannedIncomeCents);
        const rIncH = h(m.realizedIncomeCents);
        const pExpH = h(m.plannedExpenseCents);
        const rExpH = h(m.realizedExpenseCents);

        return (
          <g key={m.month}>
            <title>{`${capitalizeFirst(formatMonthLabel(m.month))} — Receita prevista: ${formatBRL(m.plannedIncomeCents)}, realizada: ${formatBRL(m.realizedIncomeCents)} | Despesa prevista: ${formatBRL(m.plannedExpenseCents)}, realizada: ${formatBRL(m.realizedExpenseCents)}`}</title>

            {isCurrent && (
              <rect
                x={centerX - slotW / 2 + 2}
                y={padTop - 6}
                width={slotW - 4}
                height={chartH + 34}
                rx="10"
                className="fill-violet-500/10 dark:fill-violet-400/15"
              />
            )}

            {/* 1. Receita prevista */}
            {pIncH > 0 && (
              <rect
                x={startX}
                y={baseY - pIncH}
                width={barW}
                height={pIncH}
                rx="3"
                className="fill-emerald-100 stroke-emerald-500 dark:fill-emerald-950/80 dark:stroke-emerald-400"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            )}

            {/* 2. Receita realizada */}
            {rIncH > 0 && (
              <rect
                x={startX + barW + gap}
                y={baseY - rIncH}
                width={barW}
                height={rIncH}
                rx="3"
                className="fill-emerald-600 dark:fill-emerald-500"
              />
            )}

            {/* 3. Despesa prevista */}
            {pExpH > 0 && (
              <rect
                x={startX + (barW + gap) * 2}
                y={baseY - pExpH}
                width={barW}
                height={pExpH}
                rx="3"
                className="fill-rose-100 stroke-rose-500 dark:fill-rose-950/80 dark:stroke-rose-400"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            )}

            {/* 4. Despesa realizada */}
            {rExpH > 0 && (
              <rect
                x={startX + (barW + gap) * 3}
                y={baseY - rExpH}
                width={barW}
                height={rExpH}
                rx="3"
                className="fill-rose-600 dark:fill-rose-500"
              />
            )}

            <text
              x={centerX}
              y={baseY + 18}
              textAnchor="middle"
              className={`text-[11px] ${
                isCurrent
                  ? "fill-violet-700 font-bold dark:fill-violet-400"
                  : "fill-slate-500 font-medium dark:fill-slate-400"
              }`}
            >
              {shortMonth(m.month)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

type CashflowBarChartProps = {
  items: MonthCashflow[];
};

export function CashflowBarChart({ items }: CashflowBarChartProps) {
  const thisMonth = currentMonth();
  const closestItems = getClosestMonths(items, 6);

  const maxCents = Math.max(
    10000,
    ...items.flatMap((m) => [
      m.plannedIncomeCents,
      m.realizedIncomeCents,
      m.plannedExpenseCents,
      m.realizedExpenseCents,
    ]),
  );

  return (
    <div className="space-y-5">
      {/* Legenda clara do que é Previsto vs. Realizado */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50/90 p-3.5 text-xs ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/60">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <span className="h-3.5 w-3.5 rounded-sm border border-dashed border-emerald-600 bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-950" />
            Receita prevista (pagos + a receber)
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <span className="h-3.5 w-3.5 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
            Receita realizada (já recebida)
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <span className="h-3.5 w-3.5 rounded-sm border border-dashed border-rose-500 bg-rose-100 dark:border-rose-500 dark:bg-rose-950" />
            Despesa prevista (pagas + a pagar)
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <span className="h-3.5 w-3.5 rounded-sm bg-rose-600 dark:bg-rose-500" />
            Despesa realizada (já paga)
          </span>
        </div>
        <span className="text-slate-500 dark:text-slate-400">
          <span className="sm:hidden">Exibindo os 6 meses mais próximos. </span>
          Meses futuros mostram apenas valores previstos.
        </span>
      </div>

      {/* Gráfico de barras agrupadas em SVG puro */}
      {/* Versão celular (< 640px): 6 meses mais próximos, sem rolagem horizontal */}
      <div className="sm:hidden">
        <SvgBarChart
          items={closestItems}
          thisMonth={thisMonth}
          maxCents={maxCents}
          width={380}
          height={220}
          padX={12}
          padTop={16}
          padBottom={30}
          maxBarW={9}
          className="h-56 w-full"
        />
      </div>

      {/* Versão desktop (>= 640px): histórico completo, responsivo e sem rolagem */}
      <div className="hidden sm:block">
        <SvgBarChart
          items={items}
          thisMonth={thisMonth}
          maxCents={maxCents}
          width={820}
          height={250}
          padX={24}
          padTop={18}
          padBottom={38}
          maxBarW={13}
          className="h-64 w-full"
        />
      </div>

      {/* Tabela acessível com todos os valores */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <table className="w-full border-collapse text-left text-xs sm:text-sm">
          <caption className="sr-only">
            Tabela mensal de receitas, despesas e resultado previstos e
            realizados
          </caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-400">
              <th scope="col" className="px-4 py-3">
                Mês
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Rec. prevista
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Rec. realizada
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Desp. prevista
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Desp. realizada
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Saldo previsto
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Saldo realizado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white tabular-nums dark:divide-slate-800 dark:bg-slate-900">
            {items.map((m) => {
              const isCurrent = m.month === thisMonth;
              const isFuture = m.month > thisMonth;

              return (
                <tr
                  key={m.month}
                  className={
                    isCurrent
                      ? "bg-violet-50/40 font-medium dark:bg-violet-950/30"
                      : "hover:bg-slate-50/60 dark:hover:bg-slate-800/60"
                  }
                >
                  <th
                    scope="row"
                    className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900 dark:text-slate-100"
                  >
                    <Link
                      href={`/transacoes?month=${m.month}`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg hover:text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:hover:text-violet-400"
                    >
                      <span>
                        {capitalizeFirst(formatMonthLabel(m.month))}
                      </span>
                      {isCurrent && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                          Atual
                        </span>
                      )}
                    </Link>
                  </th>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-emerald-700 dark:text-emerald-400">
                    {formatBRL(m.plannedIncomeCents)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    {isFuture ? "—" : formatBRL(m.realizedIncomeCents)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-rose-700 dark:text-rose-400">
                    {formatBRL(m.plannedExpenseCents)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-rose-600 dark:text-rose-400">
                    {isFuture ? "—" : formatBRL(m.realizedExpenseCents)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${
                      m.plannedNetCents < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {formatBRL(m.plannedNetCents)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-bold ${
                      isFuture
                        ? "text-slate-400 dark:text-slate-500"
                        : m.realizedNetCents < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-900 dark:text-slate-100"
                    }`}
                  >
                    {isFuture ? "—" : formatBRL(m.realizedNetCents)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type SixMonthProjectionProps = {
  points: { month: string; balanceCents: number }[];
};

type SvgLineProjectionProps = {
  points: { month: string; balanceCents: number }[];
  width: number;
  height: number;
  padX: number;
  padY: number;
  className: string;
};

function SvgLineProjection({
  points,
  width,
  height,
  padX,
  padY,
  className,
}: SvgLineProjectionProps) {
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const vals = points.map((p) => p.balanceCents);
  let minV = Math.min(...vals);
  let maxV = Math.max(...vals);
  if (minV === maxV) {
    minV -= 1000;
    maxV += 1000;
  }
  const span = maxV - minV;

  const coords = points.map((p, i) => ({
    x:
      points.length === 1
        ? padX + innerW / 2
        : padX + (i / (points.length - 1)) * innerW,
    y: padY + innerH - ((p.balanceCents - minV) / span) * innerH,
    month: p.month,
    balanceCents: p.balanceCents,
  }));

  const polyline = coords
    .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");

  const anyNegative = points.some((p) => p.balanceCents < 0);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Linha de tendência do saldo projetado nos próximos 6 meses"
      className={className}
    >
      <polyline
        points={polyline}
        fill="none"
        stroke={anyNegative ? "#e11d48" : "var(--color-violet-600)"}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={anyNegative ? "dark:stroke-rose-400" : "dark:stroke-violet-400"}
      />
      {coords.map((c) => {
        const neg = c.balanceCents < 0;
        return (
          <g key={c.month}>
            <title>{`${capitalizeFirst(formatMonthLabel(c.month))}: ${formatBRL(c.balanceCents)}`}</title>
            <circle
              cx={c.x}
              cy={c.y}
              r="5"
              fill={neg ? "#e11d48" : "var(--color-violet-600)"}
              stroke="#ffffff"
              strokeWidth="2"
              className={neg ? "dark:fill-rose-400 dark:stroke-slate-900" : "dark:fill-violet-400 dark:stroke-slate-900"}
            />
            <text
              x={c.x}
              y={height - 4}
              textAnchor="middle"
              className="fill-slate-500 text-[11px] font-semibold dark:fill-slate-400"
            >
              {shortMonth(c.month)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function SixMonthProjectionSection({ points }: SixMonthProjectionProps) {
  const thisMonth = currentMonth();

  return (
    <div className="space-y-5">
      {points.length > 1 && (
        <div className="rounded-2xl bg-slate-50/75 p-3 sm:p-4 ring-1 ring-slate-200/60 dark:bg-slate-800/40 dark:ring-slate-700/60">
          {/* Versão celular (< 640px): cabe perfeitamente em 390px sem rolagem */}
          <div className="sm:hidden">
            <SvgLineProjection
              points={points}
              width={340}
              height={120}
              padX={22}
              padY={20}
              className="h-32 w-full overflow-visible"
            />
          </div>

          {/* Versão desktop (>= 640px): proporção ampla */}
          <div className="hidden sm:block">
            <SvgLineProjection
              points={points}
              width={680}
              height={140}
              padX={36}
              padY={22}
              className="h-36 w-full overflow-visible"
            />
          </div>
        </div>
      )}

      {/* Lista de cards dos próximos 6 meses */}
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {points.map((p) => {
          const isCurrent = p.month === thisMonth;
          const isNeg = p.balanceCents < 0;
          return (
            <li
              key={p.month}
              className={`rounded-2xl border p-4 ${
                isNeg
                  ? "border-rose-200 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/40"
                  : isCurrent
                    ? "border-violet-200 bg-violet-50/40 dark:border-violet-900/60 dark:bg-violet-950/40"
                    : "border-slate-200/80 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-900/60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {capitalizeFirst(formatMonthLabel(p.month))}
                </span>
                {isCurrent && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    Mês atual
                  </span>
                )}
              </div>
              <p
                className={`mt-2 text-xl font-extrabold tabular-nums ${
                  isNeg ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {formatBRL(p.balanceCents)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Saldo projetado ao fim do mês
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
