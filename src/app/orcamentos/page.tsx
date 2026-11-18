import { BudgetsClient } from "@/components/BudgetsClient";
import { currentMonth, isValidMonth } from "@/lib/dates";
import type { SearchParams } from "@/lib/validations";
import { listBudgetsWithProgress } from "@/server/budgets";
import { listCategories } from "@/server/categories";
import { prisma } from "@/server/db";

export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const rawMonth = Array.isArray(params.month) ? params.month[0] : params.month;
  const month =
    rawMonth && isValidMonth(rawMonth.trim())
      ? rawMonth.trim()
      : currentMonth();

  const [budgets, expenseCategories] = await Promise.all([
    listBudgetsWithProgress(prisma, month),
    listCategories(prisma, "EXPENSE"),
  ]);

  return (
    <BudgetsClient
      month={month}
      budgets={budgets}
      expenseCategories={expenseCategories}
    />
  );
}
