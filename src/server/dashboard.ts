// Dados do Dashboard num lugar só.
import { monthRange } from "@/lib/dates";
import {
  type CategoryTotal,
  type MonthSummary,
  calcMonthSummary,
  expensesByCategory,
  topExpenses,
} from "@/lib/rules";
import { type BudgetWithProgress, listBudgetsWithProgress } from "./budgets";
import type { Db } from "./db";
import type { TransactionWithCategory } from "./transactions";

export type DashboardData = {
  month: string;
  /** Saldo, receitas, despesas, "a pagar" e quantidade. */
  summary: MonthSummary;
  /** 5 maiores despesas do mês (pagas e pendentes). */
  topExpenses: TransactionWithCategory[];
  /** Progresso de cada orçamento do mês. */
  budgets: BudgetWithProgress[];
  /** Despesas por categoria (pro gráfico), da maior pra menor. */
  expensesByCategory: CategoryTotal[];
};

export async function getDashboardData(db: Db, month: string): Promise<DashboardData> {
  const { start, end } = monthRange(month);
  const [transacoes, budgets] = await Promise.all([
    db.transaction.findMany({
      where: { date: { gte: start, lt: end } },
      include: { category: true },
      orderBy: { date: "desc" },
    }),
    listBudgetsWithProgress(db, month),
  ]);

  return {
    month,
    summary: calcMonthSummary(transacoes),
    topExpenses: topExpenses(transacoes, 5),
    budgets,
    expensesByCategory: expensesByCategory(transacoes),
  };
}
