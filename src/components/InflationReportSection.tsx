import Link from "next/link";
import { formatMonthLabel } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { InflationReport } from "@/server/reports";

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

function monthToMmYyyy(month: string): string {
  const [y, m] = month.split("-");
  return `${m}/${y}`;
}

/** Pontos-base inteiros (123) -> "1,23%" sem float. */
function formatBps(bps: number): string {
  const sign = bps < 0 ? "-" : "";
  const abs = Math.abs(bps);
  const intPart = Math.trunc(abs / 100);
  const decPart = String(abs % 100).padStart(2, "0");
  return `${sign}${intPart},${decPart}%`;
}

type InflationReportSectionProps = {
  report: InflationReport;
};

export function InflationReportSection({
  report,
}: InflationReportSectionProps) {
  const maxCents = Math.max(
    10000,
    ...report.rows.flatMap((r) => [r.expenseCents, r.adjustedCents]),
  );

  const width = 820;
  const height = 240;
  const padTop = 18;
  const padBottom = 38;
  const padX = 20;
  const chartH = height - padTop - padBottom;
  const slotW =
    report.rows.length > 0 ? (width - padX * 2) / report.rows.length : 60;

  return (
    <div className="space-y-5">
      {/* Status do IPCA */}
      {report.lastIpcaMonth ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50/90 p-3.5 text-xs ring-1 ring-slate-200/70">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <span className="h-3.5 w-3.5 rounded-sm border border-dashed border-slate-400 bg-slate-200" />
              Gasto nominal (valor da época)
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <span className="h-3.5 w-3.5 rounded-sm bg-violet-600" />
              Gasto corrigido (em dinheiro de hoje)
            </span>
          </div>
          <span className="font-semibold text-violet-700 tabular-nums">
            Corrigido pelo IPCA até {monthToMmYyyy(report.lastIpcaMonth)} (fonte:
            Banco Central)
          </span>
        </div>
      ) : (
        <div
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs leading-relaxed text-amber-950"
        >
          <p className="font-bold">IPCA indisponível no momento</p>
          <p className="mt-0.5">
            Não foi possível consultar a série histórica do Banco Central agora;
            os valores abaixo mostram seus gastos nominais sem correção pela
            inflação.
          </p>
        </div>
      )}

      {/* Gráfico de barras em SVG puro */}
      <div className="overflow-x-auto pb-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Gráfico de barras comparando gastos nominais e corrigidos pela inflação nos últimos 12 meses"
          className="h-60 min-w-[640px] w-full"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((step) => {
            const y = padTop + chartH * (1 - step);
            return (
              <line
                key={step}
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke={step === 0 ? "#cbd5e1" : "#f1f5f9"}
                strokeWidth={step === 0 ? "1.5" : "1"}
              />
            );
          })}

          {report.rows.map((r, idx) => {
            const centerX = padX + slotW * idx + slotW / 2;
            const barW = Math.min(18, (slotW - 16) / 2);
            const gap = 3;
            const groupW = barW * 2 + gap;
            const startX = centerX - groupW / 2;
            const baseY = padTop + chartH;

            const h = (v: number) =>
              v > 0 ? Math.max((v / maxCents) * chartH, 3) : 0;

            const nomH = h(r.expenseCents);
            const adjH = h(r.adjustedCents);

            return (
              <g key={r.month}>
                <title>{`${capitalizeFirst(formatMonthLabel(r.month))} — Nominal: ${formatBRL(r.expenseCents)} | Corrigido: ${formatBRL(r.adjustedCents)} (${formatBps(r.inflationBps)})`}</title>

                {nomH > 0 && (
                  <rect
                    x={startX}
                    y={baseY - nomH}
                    width={barW}
                    height={nomH}
                    rx="3"
                    fill="#e2e8f0"
                    stroke="#64748b"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                )}

                {adjH > 0 && (
                  <rect
                    x={startX + barW + gap}
                    y={baseY - adjH}
                    width={barW}
                    height={adjH}
                    rx="3"
                    fill="#7c3aed"
                  />
                )}

                <text
                  x={centerX}
                  y={baseY + 20}
                  textAnchor="middle"
                  className="fill-slate-500 text-[11px] font-medium"
                >
                  {shortMonth(r.month)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tabela acessível */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
        <table className="w-full border-collapse text-left text-xs sm:text-sm">
          <caption className="sr-only">
            Gastos nominais e corrigidos pelo IPCA nos últimos 12 meses
          </caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-4 py-3">
                Mês
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Gasto nominal
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                IPCA acumulado
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Em dinheiro de hoje
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white tabular-nums">
            {report.rows.map((r) => (
              <tr key={r.month} className="hover:bg-slate-50/60">
                <th
                  scope="row"
                  className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900"
                >
                  <Link
                    href={`/transacoes?month=${r.month}&type=EXPENSE`}
                    className="inline-flex min-h-9 items-center hover:text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                  >
                    {capitalizeFirst(formatMonthLabel(r.month))}
                  </Link>
                </th>
                <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                  {formatBRL(r.expenseCents)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-slate-500">
                  {report.lastIpcaMonth ? formatBps(r.inflationBps) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-violet-700">
                  {formatBRL(r.adjustedCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
