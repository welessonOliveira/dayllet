import { InflationReportSection } from "@/components/InflationReportSection";
import { MonthSelector } from "@/components/MonthSelector";
import { currentMonth, formatMonthLabel, isValidMonth } from "@/lib/dates";
import type { SearchParams } from "@/lib/validations";
import { getInflationReport } from "@/server/reports";
import { getPageCtx } from "@/server/session";

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await getPageCtx();
  const params = await searchParams;
  const rawMonth = Array.isArray(params.month) ? params.month[0] : params.month;
  const month =
    rawMonth && isValidMonth(rawMonth.trim())
      ? rawMonth.trim()
      : currentMonth();

  const report = await getInflationReport(ctx, 12);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Relatórios
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Exportação de lançamentos em CSV e análise real de gastos descontando
          a inflação
        </p>
      </div>

      {/* (a) Bloco Exportar */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Exportar lançamentos (CSV)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Baixe todas as receitas e despesas de{" "}
              <strong className="text-slate-700">
                {formatMonthLabel(month)}
              </strong>{" "}
              em planilha compatível com Excel (padrão brasileiro).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <MonthSelector month={month} />
            <a
              href={`/api/export/transacoes?month=${month}`}
              download
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
              </svg>
              <span>Baixar CSV</span>
            </a>
          </div>
        </div>
      </section>

      {/* (b) Gastos x inflação */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="mb-5">
          <h2 className="text-base font-bold text-slate-900">
            Gastos x inflação (últimos 12 meses)
          </h2>
          <p className="text-xs text-slate-500">
            Compare quanto você gastou na época com o poder de compra
            equivalente em dinheiro de hoje
          </p>
        </div>
        <InflationReportSection report={report} />
      </section>
    </div>
  );
}
