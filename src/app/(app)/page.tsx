import Link from "next/link";
import { CountUp } from "@/components/CountUp";
import { ExpensesDonutChart } from "@/components/ExpensesDonutChart";
import { InsightsCard } from "@/components/InsightsCard";
import { MonthForecastCard } from "@/components/MonthForecastCard";
import { MonthSelector } from "@/components/MonthSelector";
import { Sparkline, trendLabel } from "@/components/Sparkline";
import { WALLET_KIND_LABEL, statusLabel } from "@/lib/constants";
import {
  currentMonth,
  formatDate,
  formatMonthLabel,
  isValidMonth,
} from "@/lib/dates";
import { greeting } from "@/lib/insights";
import { formatBRL } from "@/lib/money";
import type { SearchParams } from "@/lib/validations";
import { getDashboardData } from "@/server/dashboard";
import { getMonthForecast } from "@/server/forecast";
import { listGoals } from "@/server/goals";
import { getInsights } from "@/server/insights";
import { getPageCtx, getSessionUser } from "@/server/session";
import { getWalletHistories } from "@/server/wallets";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const ctx = await getPageCtx();
  const params = searchParams ? await searchParams : {};
  const rawMonth = Array.isArray(params.month) ? params.month[0] : params.month;
  const selectedMonth =
    rawMonth && isValidMonth(rawMonth.trim())
      ? rawMonth.trim()
      : currentMonth();

  // getMonthForecast sincroniza ocorrências recorrentes do mês antes de ler o resumo
  const forecast = await getMonthForecast(ctx, selectedMonth);
  const [
    {
      month,
      summary,
      topExpenses,
      budgets,
      expensesByCategory,
      wallets,
      totalBalanceCents,
    },
    goals,
    insights,
    user,
  ] = await Promise.all([
    getDashboardData(ctx, selectedMonth),
    listGoals(ctx),
    getInsights(ctx, selectedMonth),
    getSessionUser(),
  ]);
  const historicos = await getWalletHistories(ctx, wallets, 30);
  const primeiroNome = (user?.name || "").trim().split(/\s+/)[0];
  const topGoals = goals.slice(0, 2);

  const isNegativeTotal = totalBalanceCents < 0;
  const isNegativeMonthBalance = summary.balanceCents < 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho + seletor de mês */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            {greeting()}
            {primeiroNome ? `, ${primeiroNome}` : ""}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Em{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {formatMonthLabel(month)}
            </span>{" "}
            você recebeu{" "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatBRL(summary.incomeCents)}</span> e
            gastou <span className="font-semibold text-rose-600 dark:text-rose-400">{formatBRL(summary.expenseCents)}</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <MonthSelector month={month} />
        </div>
      </div>

      {/* Seção 1: Dinheiro nas contas hoje (Saldo total + lista compacta de contas) */}
      <section
        aria-label="Saldo total e contas"
        className="grid grid-cols-1 gap-4 lg:grid-cols-12"
      >
        {/* Card Saldo total (dinheiro disponível nas contas hoje) */}
        <div className="flex flex-col justify-between rounded-3xl border border-violet-200/80 bg-white p-6 shadow-xs lg:col-span-5 dark:border-violet-900/60 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white">
                Saldo total nas contas
              </span>
              <p
                className={`mt-3 text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl ${
                  isNegativeTotal ? "text-rose-600" : "text-slate-900 dark:text-slate-100"
                }`}
              >
                <CountUp cents={totalBalanceCents} />
              </p>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5z" />
                <path d="M16 12h5" />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Dinheiro disponível hoje somando todas as suas contas (saldo inicial
            mais tudo que já foi recebido, menos tudo que já foi pago).
          </p>
        </div>

        {/* Lista compacta das contas */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-7">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Suas contas</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Saldo atual em cada conta
              </p>
            </div>
            <Link
              href="/contas"
              className="-my-2 -mr-2 inline-flex min-h-11 items-center rounded-xl px-2 text-xs font-semibold text-violet-600 transition motion-reduce:transition-none hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:my-0 md:min-h-0"
            >
              Gerenciar contas →
            </Link>
          </div>

          {wallets.length === 0 ? (
            <p className="py-4 text-xs text-slate-500 dark:text-slate-400">
              Nenhuma conta cadastrada ainda.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {wallets.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {w.name}
                      </span>
                      {w.isDefault && (
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                          Padrão
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {WALLET_KIND_LABEL[w.kind]}
                    </p>
                  </div>

                  <Sparkline
                    values={historicos[w.id] ?? []}
                    width={72}
                    height={24}
                    className="ml-auto hidden shrink-0 min-[420px]:block"
                    label={trendLabel(historicos[w.id] ?? [], 30, formatBRL)}
                  />
                  <div className="shrink-0 text-right tabular-nums">
                    <p
                      className={`text-sm font-bold ${
                        w.balance.currentCents < 0
                          ? "text-rose-600"
                          : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {formatBRL(w.balance.currentCents)}
                    </p>
                    {w.balance.projectedCents !== w.balance.currentCents && (
                      <p className="text-[11px] text-slate-400">
                        Previsto: {formatBRL(w.balance.projectedCents)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Dicas do mês: contas vencendo, fatura, categoria que subiu/caiu */}
      <InsightsCard insights={insights} />

      {/* Projeção diária do mês (Previsão pro fim do mês / Saldo no fim do mês) */}
      <MonthForecastCard forecast={forecast} />

      {/* Seção 2: Resultado do mês selecionado + Card separado "A pagar" */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Card Saldo do mês (resultado apenas do mês) */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Saldo do mês (resultado)
              </span>
              <p
                className={`mt-3 text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl ${
                  isNegativeMonthBalance
                    ? "text-rose-600"
                    : summary.balanceCents > 0
                      ? "text-emerald-600"
                      : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {summary.balanceCents > 0 ? "+ " : ""}
                {formatBRL(summary.balanceCents)}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Resultado apenas de <strong>{formatMonthLabel(month)}</strong>:
                receitas recebidas no mês menos despesas pagas no mês (não soma
                o saldo anterior das contas).
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 3v18h18" />
                <path d="M7 14l4-4 4 4 5-5" />
              </svg>
            </span>
          </div>
        </div>

        {/* Card separado "A pagar" (despesas pendentes) */}
        <div className="flex flex-col justify-between rounded-3xl border border-amber-200/90 bg-amber-50/70 p-6 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                A pagar
              </span>
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-amber-900 tabular-nums">
                {formatBRL(summary.pendingExpenseCents)}
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 text-xs">
            <span className="text-amber-800">
              Despesas pendentes no mês
            </span>
            <Link
              href={`/transacoes?month=${month}&type=EXPENSE`}
              className="-my-2 -mr-2 inline-flex min-h-11 items-center rounded-xl px-2 font-semibold text-amber-900 underline-offset-2 transition motion-reduce:transition-none hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 md:my-0 md:min-h-0"
            >
              Ver pendentes →
            </Link>
          </div>
        </div>
      </div>

      {/* Cards de Receitas, Despesas e Quantidade de transações */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Receitas */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Receitas do mês
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <svg
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-emerald-600 tabular-nums">
            {formatBRL(summary.incomeCents)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {summary.pendingIncomeCents > 0
              ? `+ ${formatBRL(summary.pendingIncomeCents)} a receber`
              : "Total recebido no mês"}
          </p>
        </div>

        {/* Despesas */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Despesas do mês
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <svg
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-rose-600 tabular-nums">
            {formatBRL(summary.expenseCents)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Total pago no mês</p>
        </div>

        {/* Quantidade de transações */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Transações no mês
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <svg
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
                  clipRule="evenodd"
                />
                <path
                  fillRule="evenodd"
                  d="M6 10a.75.75 0 01.75-.75h9.546l-1.048-.943a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 11-1.004-1.114l1.048-.943H6.75A.75.75 0 016 10z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {summary.count}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {summary.count === 1
              ? "1 lançamento registrado"
              : `${summary.count} lançamentos registrados`}
          </p>
        </div>
      </div>

      {/* Gráfico de despesas por categoria + 5 maiores gastos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico SVG */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Despesas por categoria
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Distribuição dos gastos (pagos e pendentes)
              </p>
            </div>
            <Link
              href="/categorias"
              className="-my-2 -mr-2 inline-flex min-h-11 items-center rounded-xl px-2 text-xs font-semibold text-violet-600 transition motion-reduce:transition-none hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:my-0 md:min-h-0"
            >
              Categorias →
            </Link>
          </div>
          <ExpensesDonutChart items={expensesByCategory} month={month} />
        </section>

        {/* 5 maiores gastos do mês */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                5 maiores gastos do mês
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Maiores despesas registradas no período
              </p>
            </div>
            <Link
              href={`/transacoes?month=${month}&type=EXPENSE`}
              className="-my-2 -mr-2 inline-flex min-h-11 items-center rounded-xl px-2 text-xs font-semibold text-violet-600 transition motion-reduce:transition-none hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:my-0 md:min-h-0"
            >
              Ver todas →
            </Link>
          </div>

          {topExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 dark:border-slate-700 px-6 py-12 text-center dark:bg-slate-800/40">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Nenhum gasto registrado neste mês
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Adicione uma despesa na tela de Transações para acompanhar seus
                maiores gastos.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {topExpenses.map((tx) => {
                const isPending = tx.status === "PENDING";
                return (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white"
                        style={{
                          backgroundColor: tx.category.color || "#a67c52",
                        }}
                        aria-hidden="true"
                      >
                        {tx.category.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {tx.description}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <span>{tx.category.name}</span>
                          <span>·</span>
                          <span>{tx.wallet.name}</span>
                          <span>·</span>
                          <span>{formatDate(tx.date)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-rose-600 tabular-nums">
                        {formatBRL(tx.amountCents)}
                      </p>
                      <span
                        className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          isPending
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600"
                        }`}
                      >
                        {statusLabel(tx.type, tx.status)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Progresso dos orçamentos do mês */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Progresso dos orçamentos
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Limites mensais por categoria (inclui despesas pagas e pendentes)
            </p>
          </div>
          <Link
            href={`/orcamentos?month=${month}`}
            className="-my-2 -mr-2 inline-flex min-h-11 items-center rounded-xl px-2 text-xs font-semibold text-violet-600 transition motion-reduce:transition-none hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:my-0 md:min-h-0"
          >
            Gerenciar orçamentos →
          </Link>
        </div>

        {budgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 dark:border-slate-700 px-6 py-10 text-center dark:bg-slate-800/40">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Nenhum orçamento definido para {formatMonthLabel(month)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Defina limites mensais por categoria para acompanhar seus gastos
              de perto.
            </p>
            <Link
              href={`/orcamentos?month=${month}`}
              className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              Criar orçamento
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {budgets.map((b) => {
              const { progress, category } = b;
              const overAmountCents = Math.abs(progress.remainingCents);

              return (
                <div
                  key={b.id}
                  className={`rounded-2xl border p-4 transition motion-reduce:transition-none ${
                    progress.isOver
                      ? "border-rose-200 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/30"
                      : "border-slate-200/80 bg-slate-50/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: category.color || "#a67c52" }}
                      />
                      <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                        {category.name}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                        progress.isOver
                          ? "bg-rose-100 text-rose-700"
                          : "bg-violet-100 text-violet-700"
                      }`}
                    >
                      {progress.percentUsed}%
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between gap-2 text-xs tabular-nums">
                    <span
                      className={`font-semibold ${
                        progress.isOver ? "text-rose-700" : "text-slate-700"
                      }`}
                    >
                      {formatBRL(progress.spentCents)} gastos
                    </span>
                    <span className="text-slate-500">
                      de {formatBRL(progress.limitCents)}
                    </span>
                  </div>

                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/80">
                    <div
                      className={`h-full rounded-full transition-all motion-reduce:transition-none ${
                        progress.isOver ? "bg-rose-600" : "bg-violet-600"
                      }`}
                      style={{ width: `${progress.percentBar}%` }}
                    />
                  </div>

                  <p
                    className={`mt-2 text-xs font-medium tabular-nums ${
                      progress.isOver ? "text-rose-600" : "text-slate-600"
                    }`}
                  >
                    {progress.isOver
                      ? `Limite excedido em ${formatBRL(overAmountCents)}`
                      : `Restante: ${formatBRL(progress.remainingCents)}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Card compacto de Metas (2 primeiras metas) */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Metas</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Acompanhamento rápido das suas principais reservas
            </p>
          </div>
          <Link
            href="/metas"
            className="-my-2 -mr-2 inline-flex min-h-11 items-center rounded-xl px-2 text-xs font-semibold text-violet-600 transition motion-reduce:transition-none hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:my-0 md:min-h-0"
          >
            Ver todas as metas →
          </Link>
        </div>

        {topGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 dark:border-slate-700 px-6 py-8 text-center dark:bg-slate-800/40">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Você ainda não criou nenhuma meta
            </p>
            <Link
              href="/metas"
              className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              Criar meta
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {topGoals.map((g) => {
              const color = g.color || "#a67c52";
              return (
                <Link
                  key={g.id}
                  href="/metas"
                  className="block rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition motion-reduce:transition-none hover:border-violet-200 hover:bg-violet-50/30 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-violet-900/50 dark:hover:bg-violet-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                        {g.name}
                      </span>
                    </div>
                    <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 tabular-nums">
                      {g.progress.percent}%
                    </span>
                  </div>
                  <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/80">
                    <div
                      className="h-full rounded-full transition-all motion-reduce:transition-none"
                      style={{
                        width: `${g.progress.percentBar}%`,
                        backgroundColor: g.progress.done ? "#059669" : color,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-600 tabular-nums">
                    <strong className="font-semibold text-slate-800">
                      {formatBRL(g.progress.savedCents)}
                    </strong>{" "}
                    de {formatBRL(g.progress.targetCents)}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
