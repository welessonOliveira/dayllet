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
import type { Ctx } from "./context";
import { syncRecurring } from "./recurring";
import type { TransactionWithCategory } from "./transactions";
import { type WalletWithBalance, listWalletsWithBalance } from "./wallets";

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
  /** Contas com saldo atual e previsto (saldo total = soma delas). */
  wallets: WalletWithBalance[];
  /** Soma dos saldos de todas as contas. */
  totalBalanceCents: number;
};

export async function getDashboardData(ctx: Ctx, month: string): Promise<DashboardData> {
  await syncRecurring(ctx, month); // gera contas fixas/parcelas que faltam até esse mês
  const { start, end } = monthRange(month);
  const [transacoes, budgets, wallets] = await Promise.all([
    ctx.db.transaction.findMany({
      where: { userId: ctx.userId, date: { gte: start, lt: end } },
      include: { category: true, wallet: true },
      orderBy: { date: "desc" },
    }),
    listBudgetsWithProgress(ctx, month),
    listWalletsWithBalance(ctx),
  ]);

  return {
    month,
    summary: calcMonthSummary(transacoes),
    topExpenses: topExpenses(transacoes, 5),
    budgets,
    expensesByCategory: expensesByCategory(transacoes),
    wallets,
    totalBalanceCents: wallets.reduce((s, w) => s + w.balance.currentCents, 0),
  };
}
