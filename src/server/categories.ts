// Queries e mutations de categoria. Todas recebem o banco (`db`) como parâmetro.
import type { Category } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import type { CategoryType } from "@/lib/constants";
import type { CategoryData } from "@/lib/validations";
import { type Db, isNotFoundError, isUniqueError } from "./db";

export type CategoryWithCounts = Category & {
  /** Quantas transações usam a categoria (se > 0, não pode excluir). */
  transactionCount: number;
  /** Quantos orçamentos serão apagados junto se excluir. */
  budgetCount: number;
};

const NOME_DUPLICADO = "Já existe uma categoria com esse nome.";
const NAO_ENCONTRADA = "Categoria não encontrada.";

/** Categorias em ordem alfabética. Filtra por tipo se passar `type`. */
export function listCategories(db: Db, type?: CategoryType): Promise<Category[]> {
  return db.category.findMany({
    where: type ? { type } : undefined,
    orderBy: { name: "asc" },
  });
}

/** Categorias separadas em receitas e despesas, com contagens. */
export async function listCategoriesGrouped(
  db: Db,
): Promise<{ income: CategoryWithCounts[]; expense: CategoryWithCounts[] }> {
  const rows = await db.category.findMany({
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

export function getCategory(db: Db, id: string): Promise<Category | null> {
  return db.category.findUnique({ where: { id } });
}

export async function createCategory(db: Db, data: CategoryData): Promise<Category> {
  try {
    return await db.category.create({ data });
  } catch (e) {
    if (isUniqueError(e)) throw new DomainError(NOME_DUPLICADO);
    throw e;
  }
}

/**
 * Edita a categoria. Trocar o tipo só é permitido se ela não tiver
 * transações nem orçamentos (senão os dados ficariam inconsistentes).
 */
export async function updateCategory(
  db: Db,
  id: string,
  data: CategoryData,
): Promise<Category> {
  const atual = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { transactions: true, budgets: true } } },
  });
  if (!atual) throw new DomainError(NAO_ENCONTRADA);

  if (atual.type !== data.type) {
    if (atual._count.transactions > 0) {
      throw new DomainError(
        "Não dá pra trocar o tipo de uma categoria que já tem transações.",
      );
    }
    if (atual._count.budgets > 0) {
      throw new DomainError(
        "Não dá pra trocar o tipo de uma categoria que tem orçamentos.",
      );
    }
  }

  try {
    return await db.category.update({ where: { id }, data });
  } catch (e) {
    if (isUniqueError(e)) throw new DomainError(NOME_DUPLICADO);
    if (isNotFoundError(e)) throw new DomainError(NAO_ENCONTRADA);
    throw e;
  }
}

/**
 * Exclui a categoria. Bloqueia se tiver transações (Decisão 8).
 * Os orçamentos dela são apagados junto (cascade); retorna quantos foram.
 */
export async function deleteCategory(
  db: Db,
  id: string,
): Promise<{ deletedBudgets: number }> {
  const atual = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { transactions: true, budgets: true } } },
  });
  if (!atual) throw new DomainError(NAO_ENCONTRADA);

  const n = atual._count.transactions;
  if (n > 0) {
    throw new DomainError(
      `Essa categoria tem ${n} ${n === 1 ? "transação" : "transações"} e não pode ser excluída. ` +
        "Mude essas transações de categoria ou exclua elas antes.",
    );
  }

  await db.category.delete({ where: { id } });
  return { deletedBudgets: atual._count.budgets };
}
