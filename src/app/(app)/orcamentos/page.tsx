import { BudgetsClient } from "@/components/BudgetsClient";
import { currentMonth, isValidMonth } from "@/lib/dates";
import type { SearchParams } from "@/lib/validations";
import { listBudgetsWithProgress } from "@/server/budgets";
import { listCategories } from "@/server/categories";
import { getPageCtx } from "@/server/session";

export default async function OrcamentosPage({
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

  const [budgets, expenseCategories] = await Promise.all([
    listBudgetsWithProgress(ctx, month),
    listCategories(ctx, "EXPENSE"),
  ]);

  return (
    <BudgetsClient
      month={month}
      budgets={budgets}
      expenseCategories={expenseCategories}
    />
  );
}
