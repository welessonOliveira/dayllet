// Queries e mutations de orçamento. Todas recebem o banco (`db`) como parâmetro.
import type { Budget, Category } from "@prisma/client";
import { monthRange } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { type BudgetProgress, calcBudgetProgress, checkBudgetCategoryType } from "@/lib/rules";
import type { BudgetData } from "@/lib/validations";
import { type Db, isNotFoundError, isUniqueError } from "./db";

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
export async function listBudgetsWithProgress(
  db: Db,
  month: string,
): Promise<BudgetWithProgress[]> {
  const { start, end } = monthRange(month);
  const budgets = await db.budget.findMany({
    where: { month },
    include: { category: true },
    orderBy: { category: { name: "asc" } },
  });
  if (budgets.length === 0) return [];

  const gastos = await db.transaction.groupBy({
    by: ["categoryId"],
    where: {
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

export function getBudget(
  db: Db,
  id: string,
): Promise<(Budget & { category: Category }) | null> {
  return db.budget.findUnique({ where: { id }, include: { category: true } });
}

async function assertCategoryOk(db: Db, categoryId: string): Promise<void> {
  const categoria = await db.category.findUnique({ where: { id: categoryId } });
  if (!categoria) throw new DomainError("Categoria não encontrada.");
  const erro = checkBudgetCategoryType(categoria.type);
  if (erro) throw new DomainError(erro);
}

export async function createBudget(db: Db, data: BudgetData): Promise<Budget> {
  await assertCategoryOk(db, data.categoryId);
  try {
    return await db.budget.create({ data });
  } catch (e) {
    if (isUniqueError(e)) throw new DomainError(DUPLICADO);
    throw e;
  }
}

export async function updateBudget(
  db: Db,
  id: string,
  data: BudgetData,
): Promise<Budget> {
  await assertCategoryOk(db, data.categoryId);
  try {
    return await db.budget.update({ where: { id }, data });
  } catch (e) {
    if (isUniqueError(e)) throw new DomainError(DUPLICADO);
    if (isNotFoundError(e)) throw new DomainError(NAO_ENCONTRADO);
    throw e;
  }
}

export async function deleteBudget(db: Db, id: string): Promise<void> {
  try {
    await db.budget.delete({ where: { id } });
  } catch (e) {
    if (isNotFoundError(e)) throw new DomainError(NAO_ENCONTRADO);
    throw e;
  }
}
