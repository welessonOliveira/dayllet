// PLACEHOLDER do Dashboard: a tela de verdade será feita pelo Gemini.
import { currentMonth, formatMonthLabel } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { getDashboardData } from "@/server/dashboard";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { month, summary, budgets } = await getDashboardData(prisma, currentMonth());
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-sm opacity-70">Placeholder · {formatMonthLabel(month)}</p>
      <p>Saldo do mês: {formatBRL(summary.balanceCents)}</p>
      <p>A pagar: {formatBRL(summary.pendingExpenseCents)}</p>
      <p>Transações no mês: {summary.count}</p>
      <p>Orçamentos no mês: {budgets.length}</p>
    </section>
  );
}
