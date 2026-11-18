// Queries e mutations de transação. Todas recebem o banco (`db`) como parâmetro.
import type { Category, Prisma, Transaction } from "@prisma/client";
import type { TransactionStatus } from "@/lib/constants";
import { monthRange } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { checkCategoryType } from "@/lib/rules";
import type { TransactionData, TransactionFilters } from "@/lib/validations";
import { type Db, isNotFoundError } from "./db";

export type TransactionWithCategory = Transaction & { category: Category };

const NAO_ENCONTRADA = "Transação não encontrada.";

/** Transações do mês com os filtros, da mais recente pra mais antiga. */
export function listTransactions(
  db: Db,
  filters: TransactionFilters,
): Promise<TransactionWithCategory[]> {
  const { start, end } = monthRange(filters.month);
  const where: Prisma.TransactionWhereInput = {
    date: { gte: start, lt: end },
    ...(filters.type && { type: filters.type }),
    ...(filters.categoryId && { categoryId: filters.categoryId }),
    // Postgres diferencia maiúsculas: "insensitive" faz "feira" achar "Feira".
    ...(filters.q && { description: { contains: filters.q, mode: "insensitive" } }),
  };
  return db.transaction.findMany({
    where,
    include: { category: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export function getTransaction(
  db: Db,
  id: string,
): Promise<TransactionWithCategory | null> {
  return db.transaction.findUnique({ where: { id }, include: { category: true } });
}

// Regra principal: o tipo da transação tem que bater com o da categoria.
async function assertCategoryOk(db: Db, data: TransactionData): Promise<void> {
  const categoria = await db.category.findUnique({ where: { id: data.categoryId } });
  if (!categoria) throw new DomainError("Categoria não encontrada.");
  const erro = checkCategoryType(data.type, categoria.type);
  if (erro) throw new DomainError(erro);
}

export async function createTransaction(
  db: Db,
  data: TransactionData,
): Promise<Transaction> {
  await assertCategoryOk(db, data);
  return db.transaction.create({ data });
}

export async function updateTransaction(
  db: Db,
  id: string,
  data: TransactionData,
): Promise<Transaction> {
  await assertCategoryOk(db, data);
  try {
    return await db.transaction.update({ where: { id }, data });
  } catch (e) {
    if (isNotFoundError(e)) throw new DomainError(NAO_ENCONTRADA);
    throw e;
  }
}

/** Troca só o status (pago/pendente). Bom pra um botão rápido na lista. */
export async function setTransactionStatus(
  db: Db,
  id: string,
  status: TransactionStatus,
): Promise<Transaction> {
  try {
    return await db.transaction.update({ where: { id }, data: { status } });
  } catch (e) {
    if (isNotFoundError(e)) throw new DomainError(NAO_ENCONTRADA);
    throw e;
  }
}

export async function deleteTransaction(db: Db, id: string): Promise<void> {
  try {
    await db.transaction.delete({ where: { id } });
  } catch (e) {
    if (isNotFoundError(e)) throw new DomainError(NAO_ENCONTRADA);
    throw e;
  }
}
