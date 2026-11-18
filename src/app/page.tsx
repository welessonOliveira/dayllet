import Link from "next/link";
import { ExpensesDonutChart } from "@/components/ExpensesDonutChart";
import { MonthSelector } from "@/components/MonthSelector";
import { statusLabel } from "@/lib/constants";
import {
  currentMonth,
  formatDate,
  formatMonthLabel,
  isValidMonth,
} from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { SearchParams } from "@/lib/validations";
import { getDashboardData } from "@/server/dashboard";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const rawMonth = Array.isArray(params.month) ? params.month[0] : params.month;
  const selectedMonth =
    rawMonth && isValidMonth(rawMonth.trim())
      ? rawMonth.trim()
      : currentMonth();

  const { month, summary, topExpenses, budgets, expensesByCategory } =
    await getDashboardData(prisma, selectedMonth);

  const isNegativeBalance = summary.balanceCents < 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho + seletor de mês */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Visão geral
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Resumo financeiro de{" "}
            <span className="font-medium text-slate-700">
              {formatMonthLabel(month)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <MonthSelector month={month} />
          <Link
            href={`/transacoes?month=${month}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            <span>Transações</span>
          </Link>
        </div>
      </div>

      {/* Destaque principal: Saldo do mês + Card separado "A pagar" */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Card Saldo do mês */}
        <div className="relative overflow-hidden rounded-3xl border border-violet-100 bg-white p-6 shadow-xs lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                Saldo do mês
              </span>
              <p
                className={`mt-3 text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl ${
                  isNegativeBalance ? "text-rose-600" : "text-slate-900"
                }`}
              >
                {formatBRL(summary.balanceCents)}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Calculado apenas sobre receitas recebidas e despesas já pagas em{" "}
                {formatMonthLabel(month)}.
              </p>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-xs">
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
            <span className="text-amber-800/80">
              Despesas pendentes no mês
            </span>
            <Link
              href={`/transacoes?month=${month}&type=EXPENSE`}
              className="-my-2 -mr-2 inline-flex min-h-11 items-center rounded-xl px-2 font-semibold text-amber-900 underline-offset-2 transition motion-reduce:transition-none hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 md:my-0 md:min-h-0"
            >
              Ver contas →
            </Link>
          </div>
        </div>
      </div>

      {/* Cards de Receitas, Despesas e Quantidade de transações */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Receitas */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Receitas</span>
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
          <p className="mt-1 text-xs text-slate-500">
            {summary.pendingIncomeCents > 0
              ? `+ ${formatBRL(summary.pendingIncomeCents)} a receber`
              : "Total recebido no mês"}
          </p>
        </div>

        {/* Despesas */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Despesas</span>
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
          <p className="mt-1 text-xs text-slate-500">Total pago no mês</p>
        </div>

        {/* Quantidade de transações */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
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
          <p className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">
            {summary.count}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary.count === 1
              ? "1 lançamento registrado"
              : `${summary.count} lançamentos registrados`}
          </p>
        </div>
      </div>

      {/* Gráfico de despesas por categoria + 5 maiores gastos */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gráfico SVG */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="mb-5 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Despesas por categoria
              </h2>
              <p className="text-xs text-slate-500">
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
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="mb-5 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                5 maiores gastos do mês
              </h2>
              <p className="text-xs text-slate-500">
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
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Nenhum gasto registrado neste mês
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Adicione uma despesa na tela de Transações para acompanhar seus
                maiores gastos.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
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
                          backgroundColor: tx.category.color || "#7c3aed",
                        }}
                        aria-hidden="true"
                      >
                        {tx.category.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {tx.description}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span>{tx.category.name}</span>
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
                            : "bg-slate-100 text-slate-600"
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
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Progresso dos orçamentos
            </h2>
            <p className="text-xs text-slate-500">
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
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
            <p className="text-sm font-semibold text-slate-700">
              Nenhum orçamento definido para {formatMonthLabel(month)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {budgets.map((b) => {
              const { progress, category } = b;
              const overAmountCents = Math.abs(progress.remainingCents);

              return (
                <div
                  key={b.id}
                  className={`rounded-2xl border p-4 transition motion-reduce:transition-none ${
                    progress.isOver
                      ? "border-rose-200 bg-rose-50/40"
                      : "border-slate-200/80 bg-slate-50/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: category.color || "#7c3aed" }}
                      />
                      <span className="truncate text-sm font-bold text-slate-900">
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

                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80">
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
    </div>
  );
}
