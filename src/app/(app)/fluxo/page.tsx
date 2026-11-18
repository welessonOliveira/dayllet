import {
  CashflowBarChart,
  SixMonthProjectionSection,
} from "@/components/CashflowCharts";
import { getBalanceProjection, getCashflow } from "@/server/forecast";
import { getPageCtx } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function FluxoPage() {
  const ctx = await getPageCtx();
  // Executa em sequência para que syncRecurring rode uma única vez antes da leitura
  const projection = await getBalanceProjection(ctx, 6);
  const cashflow = await getCashflow(ctx);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Fluxo de caixa
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Comparativo mensal entre previsto e realizado e projeção do saldo
          acumulado das suas contas
        </p>
      </div>

      {/* Previsto vs. Realizado por mês */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs">
        <div className="mb-5">
          <h2 className="text-base font-bold text-slate-900">
            Previsto vs. realizado por mês
          </h2>
          <p className="text-xs text-slate-500">
            Histórico dos últimos 5 meses, mês atual e próximos 3 meses
            (incluindo contas fixas e parcelas)
          </p>
        </div>
        <CashflowBarChart items={cashflow} />
      </section>

      {/* Saldo projetado nos próximos 6 meses */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs">
        <div className="mb-5">
          <h2 className="text-base font-bold text-slate-900">
            Saldo projetado nos próximos 6 meses
          </h2>
          <p className="text-xs text-slate-500">
            Estimativa do saldo acumulado nas contas no fechamento de cada mês
          </p>
        </div>
        <SixMonthProjectionSection points={projection} />
      </section>
    </div>
  );
}
