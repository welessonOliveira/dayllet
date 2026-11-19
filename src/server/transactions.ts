// Queries e mutations de transação. Todas recebem o contexto { db, userId }.
import type { Category, Prisma, Transaction, Wallet } from "@prisma/client";
import type { TransactionStatus } from "@/lib/constants";
import { monthRange } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { checkCategoryType } from "@/lib/rules";
import type { TransactionData, TransactionFilters } from "@/lib/validations";
import { ATTACHMENT_INFO_SELECT, type AttachmentInfo } from "./attachments";
import type { Ctx } from "./context";
import { learnCategory } from "./categoryRules";
import { syncRecurring } from "./recurring";
import { getDefaultWalletId, getOwnWallet } from "./wallets";

export type TransactionWithCategory = Transaction & {
  category: Category;
  wallet: Wallet;
  /** Só vem na lista de transações (e em getTransaction). */
  attachment?: AttachmentInfo | null;
};

const NAO_ENCONTRADA = "Transação não encontrada.";

/**
 * Transações do mês com os filtros, da mais recente pra mais antiga.
 * Antes, gera as contas fixas/parcelas que faltam até esse mês.
 */
export async function listTransactions(
  ctx: Ctx,
  filters: TransactionFilters,
): Promise<TransactionWithCategory[]> {
  await syncRecurring(ctx, filters.month);
  const { start, end } = monthRange(filters.month);
  const where: Prisma.TransactionWhereInput = {
    userId: ctx.userId,
    date: { gte: start, lt: end },
    ...(filters.type && { type: filters.type }),
    ...(filters.categoryId && { categoryId: filters.categoryId }),
    ...(filters.walletId && { walletId: filters.walletId }),
    // Postgres diferencia maiúsculas: "insensitive" faz "feira" achar "Feira".
    ...(filters.q && { description: { contains: filters.q, mode: "insensitive" } }),
  };
  return ctx.db.transaction.findMany({
    where,
    include: { category: true, wallet: true, attachment: { select: ATTACHMENT_INFO_SELECT } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export function getTransaction(ctx: Ctx, id: string): Promise<TransactionWithCategory | null> {
  return ctx.db.transaction.findFirst({
    where: { id, userId: ctx.userId },
    include: { category: true, wallet: true, attachment: { select: ATTACHMENT_INFO_SELECT } },
  });
}

async function assertOwnTransaction(ctx: Ctx, id: string): Promise<void> {
  const n = await ctx.db.transaction.count({ where: { id, userId: ctx.userId } });
  if (n === 0) throw new DomainError(NAO_ENCONTRADA);
}

/**
 * Confere categoria e conta (as duas precisam ser do usuário) e devolve
 * os dados prontos pro banco. Regra principal: o tipo da transação tem
 * que bater com o da categoria.
 */
async function prepare(ctx: Ctx, data: TransactionData) {
  const categoria = await ctx.db.category.findFirst({
    where: { id: data.categoryId, userId: ctx.userId },
  });
  if (!categoria) throw new DomainError("Categoria não encontrada.");
  const erro = checkCategoryType(data.type, categoria.type);
  if (erro) throw new DomainError(erro);

  const walletId = data.walletId
    ? (await getOwnWallet(ctx, data.walletId)).id
    : await getDefaultWalletId(ctx);

  return { ...data, walletId, userId: ctx.userId };
}

export async function createTransaction(ctx: Ctx, data: TransactionData): Promise<Transaction> {
  const tx = await ctx.db.transaction.create({ data: await prepare(ctx, data) });
  await learnCategory(ctx, tx.description, tx.categoryId); // ensina a categorização automática
  return tx;
}

export async function updateTransaction(
  ctx: Ctx,
  id: string,
  data: TransactionData,
): Promise<Transaction> {
  const antes = await ctx.db.transaction.findFirst({ where: { id, userId: ctx.userId } });
  if (!antes) throw new DomainError(NAO_ENCONTRADA);
  const tx = await ctx.db.transaction.update({ where: { id }, data: await prepare(ctx, data) });
  // Corrigiu a categoria (ou a descrição)? A regra aprende a escolha nova.
  if (antes.categoryId !== tx.categoryId || antes.description !== tx.description) {
    await learnCategory(ctx, tx.description, tx.categoryId);
  }
  return tx;
}

/** Troca só o status (pago/pendente). Bom pra um botão rápido na lista. */
export async function setTransactionStatus(
  ctx: Ctx,
  id: string,
  status: TransactionStatus,
): Promise<Transaction> {
  await assertOwnTransaction(ctx, id);
  return ctx.db.transaction.update({ where: { id }, data: { status } });
}

/**
 * Exclui o lançamento. Se ele veio de uma conta fixa/parcelado, guarda um
 * "pulo" (RecurringSkip) pra regra não gerar essa ocorrência de novo.
 */
export async function deleteTransaction(ctx: Ctx, id: string): Promise<void> {
  const tx = await ctx.db.transaction.findFirst({ where: { id, userId: ctx.userId } });
  if (!tx) throw new DomainError(NAO_ENCONTRADA);
  await ctx.db.$transaction(async (db) => {
    if (tx.recurringRuleId && tx.occurrenceDate) {
      await db.recurringSkip.createMany({
        data: [{ ruleId: tx.recurringRuleId, occurrenceDate: tx.occurrenceDate }],
        skipDuplicates: true,
      });
    }
    await db.transaction.delete({ where: { id } });
  });
}
