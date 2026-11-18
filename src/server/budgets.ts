// Queries e mutations de orçamento. Todas recebem o contexto { db, userId }.
import type { Budget, Category } from "@prisma/client";
import { monthRange } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { type BudgetProgress, calcBudgetProgress, checkBudgetCategoryType } from "@/lib/rules";
import type { BudgetData } from "@/lib/validations";
import type { Ctx } from "./context";
import { syncRecurring } from "./recurring";
import { isUniqueError } from "./db";

export type BudgetWithProgress = Budget & {
  category: Category;
  progress: BudgetProgress;
};

const DUPLICADO = "Já existe um orçamento dessa categoria nesse mês.";
const NAO_ENCONTRADO = "Orçamento não encontrado.";

/**
 * Orçamentos do mês com o progresso de cada um.
 * O gasto conta despesas pagas e pendentes (Decisão 2).
 */
export async function listBudgetsWithProgress(ctx: Ctx, month: string): Promise<BudgetWithProgress[]> {
  await syncRecurring(ctx, month); // conta fixa do mês também pesa no orçamento
  const { start, end } = monthRange(month);
  const budgets = await ctx.db.budget.findMany({
    where: { userId: ctx.userId, month },
    include: { category: true },
    orderBy: { category: { name: "asc" } },
  });
  if (budgets.length === 0) return [];

  const gastos = await ctx.db.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId: ctx.userId,
      type: "EXPENSE",
      date: { gte: start, lt: end },
      categoryId: { in: budgets.map((b) => b.categoryId) },
    },
    _sum: { amountCents: true },
  });
  const gastoPor = new Map(gastos.map((g) => [g.categoryId, g._sum.amountCents ?? 0]));

  return budgets.map((b) => ({
    ...b,
    progress: calcBudgetProgress(b.limitCents, gastoPor.get(b.categoryId) ?? 0),
  }));
}

export function getBudget(ctx: Ctx, id: string): Promise<(Budget & { category: Category }) | null> {
  return ctx.db.budget.findFirst({ where: { id, userId: ctx.userId }, include: { category: true } });
}

async function assertOwnBudget(ctx: Ctx, id: string): Promise<void> {
  const n = await ctx.db.budget.count({ where: { id, userId: ctx.userId } });
  if (n === 0) throw new DomainError(NAO_ENCONTRADO);
}

async function assertCategoryOk(ctx: Ctx, categoryId: string): Promise<void> {
  const categoria = await ctx.db.category.findFirst({ where: { id: categoryId, userId: ctx.userId } });
  if (!categoria) throw new DomainError("Categoria não encontrada.");
  const erro = checkBudgetCategoryType(categoria.type);
  if (erro) throw new DomainError(erro);
}

export async function createBudget(ctx: Ctx, data: BudgetData): Promise<Budget> {
  await assertCategoryOk(ctx, data.categoryId);
  try {
    return await ctx.db.budget.create({ data: { ...data, userId: ctx.userId } });
  } catch (e) {
    if (isUniqueError(e)) throw new DomainError(DUPLICADO);
    throw e;
  }
}

export async function updateBudget(ctx: Ctx, id: string, data: BudgetData): Promise<Budget> {
  await assertOwnBudget(ctx, id);
  await assertCategoryOk(ctx, data.categoryId);
  try {
    return await ctx.db.budget.update({ where: { id }, data });
  } catch (e) {
    if (isUniqueError(e)) throw new DomainError(DUPLICADO);
    throw e;
  }
}

export async function deleteBudget(ctx: Ctx, id: string): Promise<void> {
  await assertOwnBudget(ctx, id);
  await ctx.db.budget.delete({ where: { id } });
}
