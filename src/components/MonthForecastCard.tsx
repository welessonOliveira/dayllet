import Link from "next/link";
import { formatDate, formatMonthLabel } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { MonthForecast } from "@/server/forecast";

type MonthForecastCardProps = {
  forecast: MonthForecast;
};

function shortDayMonth(d: Date): string {
  return formatDate(new Date(d)).slice(0, 5);
}

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function MonthForecastCard({ forecast }: MonthForecastCardProps) {
  const isPast = forecast.mode === "past";
  const isNegativeEnd = forecast.endOfMonthBalanceCents < 0;
  const goesNegative = Boolean(
    forecast.lowest && forecast.lowest.balanceCents < 0,
  );
  const lowestDateLabel = forecast.lowest
    ? shortDayMonth(forecast.lowest.date)
    : "";

  // Monta geometria do mini gráfico de linha em SVG puro
  const points = forecast.daily;
  const width = 360;
  const height = 104;
  const padX = 10;
  const padY = 12;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  let polylinePoints = "";
  let areaPoints = "";
  let zeroLineY: number | null = null;
  let minCoord: { x: number; y: number } | null = null;

  if (points.length > 0) {
    const values = points.map((p) => p.balanceCents);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    if (minVal < 0 && maxVal < 0) maxVal = 0;
    if (minVal === maxVal) {
      minVal -= 1000;
      maxVal += 1000;
    }
    const span = maxVal - minVal;

    const coords = points.map((p, i) => {
      const x =
        points.length === 1
          ? padX + innerW / 2
          : padX + (i / (points.length - 1)) * innerW;
      const y = padY + innerH - ((p.balanceCents - minVal) / span) * innerH;
      return { x, y, point: p };
    });

    polylinePoints = coords
      .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(" ");

    const firstX = coords[0].x.toFixed(1);
    const lastX = coords[coords.length - 1].x.toFixed(1);
    const baseY = (padY + innerH).toFixed(1);
    areaPoints = `${firstX},${baseY} ${polylinePoints} ${lastX},${baseY}`;

    if (minVal < 0 && maxVal > 0) {
      zeroLineY = padY + innerH - ((0 - minVal) / span) * innerH;
    }

    if (goesNegative) {
      const lowestCoord = coords.reduce((best, cur) =>
        cur.point.balanceCents < best.point.balanceCents ? cur : best,
      );
      minCoord = { x: lowestCoord.x, y: lowestCoord.y };
    }
  }

  const lineStroke = goesNegative ? "#e11d48" : "#7c3aed";
  const areaFill = goesNegative
    ? "rgba(225, 29, 72, 0.10)"
    : "rgba(124, 58, 237, 0.10)";

  return (
    <section
      aria-label={isPast ? "Saldo no fim do mês" : "Previsão pro fim do mês"}
      className={`rounded-3xl border bg-white p-6 shadow-xs ${
        goesNegative ? "border-rose-200" : "border-slate-200/80"
      }`}
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
        {/* Coluna esquerda: valor principal, pendentes e alertas */}
        <div className="space-y-4 lg:col-span-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  isPast
                    ? "bg-slate-100 text-slate-700"
                    : goesNegative
                      ? "bg-rose-100 text-rose-800"
                      : "bg-violet-50 text-violet-700"
                }`}
              >
                {isPast ? "Saldo no fim do mês" : "Previsão pro fim do mês"}
              </span>
              <span className="text-xs text-slate-500">
                {capitalizeFirst(formatMonthLabel(forecast.month))}
              </span>
            </div>

            <p
              className={`mt-3 text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl ${
                isNegativeEnd ? "text-rose-600" : "text-slate-900"
              }`}
            >
              {formatBRL(forecast.endOfMonthBalanceCents)}
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              {isPast
                ? `Saldo realizado das suas contas ao encerrar ${formatMonthLabel(forecast.month)}.`
                : "Quanto deve restar somando o saldo atual das contas com tudo que falta receber e pagar até o fim do mês."}
            </p>
          </div>

          {!isPast && (
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50/80 p-3.5 ring-1 ring-slate-200/60">
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  A receber no mês
                </span>
                <span className="mt-0.5 block text-base font-bold text-emerald-600 tabular-nums">
                  {formatBRL(forecast.pendingIncomeCents)}
                </span>
              </div>
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  A pagar no mês
                </span>
                <span className="mt-0.5 block text-base font-bold text-amber-700 tabular-nums">
                  {formatBRL(forecast.pendingExpenseCents)}
                </span>
              </div>
            </div>
          )}

          {/* Alertas de saldo negativo e contas atrasadas */}
          {(goesNegative || forecast.overdueExpenseCents > 0) && (
            <div className="space-y-2.5">
              {goesNegative && forecast.lowest && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-relaxed text-rose-900"
                >
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0 text-rose-600"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <p className="font-bold text-rose-950">
                      Seu saldo fica negativo em {lowestDateLabel}
                    </p>
                    <p className="mt-0.5 tabular-nums">
                      Menor saldo previsto no período:{" "}
                      <strong>{formatBRL(forecast.lowest.balanceCents)}</strong>
                      .
                    </p>
                  </div>
                </div>
              )}

              {forecast.overdueExpenseCents > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-950">
                  <div>
                    <strong className="font-bold">Contas atrasadas: </strong>
                    <span className="font-semibold tabular-nums">
                      {formatBRL(forecast.overdueExpenseCents)}
                    </span>{" "}
                    <span className="text-amber-900/85">
                      pendentes com vencimento antes de hoje.
                    </span>
                  </div>
                  <Link
                    href="/transacoes?type=EXPENSE"
                    className="-my-1 inline-flex min-h-9 items-center rounded-lg px-2 font-bold text-amber-950 underline hover:text-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
                  >
                    Regularizar →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Coluna direita: mini gráfico de linha dia a dia em SVG puro */}
        <div className="rounded-2xl bg-slate-50/70 p-4 ring-1 ring-slate-200/60 lg:col-span-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">
              Evolução diária do saldo
            </span>
            <Link
              href="/fluxo"
              className="-my-1 inline-flex min-h-9 items-center rounded-lg px-1.5 font-semibold text-violet-600 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              Ver fluxo →
            </Link>
          </div>

          {points.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              Sem dados diários para este período.
            </p>
          ) : (
            <>
              <svg
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label="Gráfico de linha da evolução diária do saldo no mês"
                className="h-28 w-full overflow-visible"
              >
                <title>{`Saldo de ${shortDayMonth(points[0].date)} (${formatBRL(points[0].balanceCents)}) até ${shortDayMonth(points[points.length - 1].date)} (${formatBRL(points[points.length - 1].balanceCents)})`}</title>

                {zeroLineY !== null && (
                  <line
                    x1={padX}
                    y1={zeroLineY}
                    x2={width - padX}
                    y2={zeroLineY}
                    stroke="#fda4af"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                  />
                )}

                <polygon points={areaPoints} fill={areaFill} />

                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke={lineStroke}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {minCoord && (
                  <circle
                    cx={minCoord.x}
                    cy={minCoord.y}
                    r="4"
                    fill="#e11d48"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                )}
              </svg>

              <div className="mt-1 flex items-center justify-between text-[11px] font-medium text-slate-500 tabular-nums">
                <span>
                  {shortDayMonth(points[0].date)}:{" "}
                  {formatBRL(points[0].balanceCents)}
                </span>
                <span>
                  {shortDayMonth(points[points.length - 1].date)}:{" "}
                  {formatBRL(points[points.length - 1].balanceCents)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
