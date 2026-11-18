// Queries e mutations de categoria. Todas recebem o contexto { db, userId }.
import type { Category } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import type { CategoryType } from "@/lib/constants";
import type { CategoryData } from "@/lib/validations";
import type { Ctx } from "./context";
import { isUniqueError } from "./db";

export type CategoryWithCounts = Category & {
  /** Quantas transações usam a categoria (se > 0, não pode excluir). */
  transactionCount: number;
  /** Quantos orçamentos serão apagados junto se excluir. */
  budgetCount: number;
};

const NOME_DUPLICADO = "Você já tem uma categoria com esse nome.";
const NAO_ENCONTRADA = "Categoria não encontrada.";

/** Busca uma categoria DO USUÁRIO, com contagens. Erro se não for dele. */
async function getOwnWithCounts(ctx: Ctx, id: string) {
  const c = await ctx.db.category.findFirst({
    where: { id, userId: ctx.userId },
    include: { _count: { select: { transactions: true, budgets: true, recurringRules: true } } },
  });
  if (!c) throw new DomainError(NAO_ENCONTRADA);
  return c;
}

/** Categorias em ordem alfabética. Filtra por tipo se passar `type`. */
export function listCategories(ctx: Ctx, type?: CategoryType): Promise<Category[]> {
  return ctx.db.category.findMany({
    where: { userId: ctx.userId, ...(type && { type }) },
    orderBy: { name: "asc" },
  });
}

/** Categorias separadas em receitas e despesas, com contagens. */
export async function listCategoriesGrouped(
  ctx: Ctx,
): Promise<{ income: CategoryWithCounts[]; expense: CategoryWithCounts[] }> {
  const rows = await ctx.db.category.findMany({
    where: { userId: ctx.userId },
    orderBy: { name: "asc" },
    include: { _count: { select: { transactions: true, budgets: true } } },
  });
  const all: CategoryWithCounts[] = rows.map(({ _count, ...c }) => ({
    ...c,
    transactionCount: _count.transactions,
    budgetCount: _count.budgets,
  }));
  return {
    income: all.filter((c) => c.type === "INCOME"),
    expense: all.filter((c) => c.type === "EXPENSE"),
  };
}

export function getCategory(ctx: Ctx, id: string): Promise<Category | null> {
  return ctx.db.category.findFirst({ where: { id, userId: ctx.userId } });
}

export async function createCategory(ctx: Ctx, data: CategoryData): Promise<Category> {
  try {
    return await ctx.db.category.create({ data: { ...data, userId: ctx.userId } });
  } catch (e) {
    if (isUniqueError(e)) throw new DomainError(NOME_DUPLICADO);
    throw e;
  }
}

/**
 * Edita a categoria. Trocar o tipo só é permitido se ela não tiver
 * transações nem orçamentos (senão os dados ficariam inconsistentes).
 */
export async function updateCategory(ctx: Ctx, id: string, data: CategoryData): Promise<Category> {
  const atual = await getOwnWithCounts(ctx, id);

  if (atual.type !== data.type) {
    if (atual._count.transactions > 0) {
      throw new DomainError("Não dá pra trocar o tipo de uma categoria que já tem transações.");
    }
    if (atual._count.budgets > 0) {
      throw new DomainError("Não dá pra trocar o tipo de uma categoria que tem orçamentos.");
    }
    if (atual._count.recurringRules > 0) {
      throw new DomainError("Não dá pra trocar o tipo de uma categoria usada em conta fixa ou parcelamento.");
    }
  }

  try {
    return await ctx.db.category.update({ where: { id }, data });
  } catch (e) {
    if (isUniqueError(e)) throw new DomainError(NOME_DUPLICADO);
    throw e;
  }
}

/**
 * Exclui a categoria. Bloqueia se tiver transações (Decisão 8).
 * Os orçamentos dela são apagados junto (cascade); retorna quantos foram.
 */
export async function deleteCategory(ctx: Ctx, id: string): Promise<{ deletedBudgets: number }> {
  const atual = await getOwnWithCounts(ctx, id);

  const n = atual._count.transactions;
  if (n > 0) {
    throw new DomainError(
      `Essa categoria tem ${n} ${n === 1 ? "transação" : "transações"} e não pode ser excluída. ` +
        "Mude essas transações de categoria ou exclua elas antes.",
    );
  }
  const r = atual._count.recurringRules;
  if (r > 0) {
    throw new DomainError(
      `Essa categoria é usada em ${r} ${r === 1 ? "conta fixa ou parcelamento" : "contas fixas ou parcelamentos"} ` +
        "e não pode ser excluída.",
    );
  }

  await ctx.db.category.delete({ where: { id } });
  return { deletedBudgets: atual._count.budgets };
}
