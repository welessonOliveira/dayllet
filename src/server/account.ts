// "Meus dados" (LGPD): baixar tudo que é do usuário e excluir a conta.
import { DomainError } from "@/lib/errors";
import type { Ctx } from "./context";
import type { Db } from "./db";

/** Todos os dados do usuário num objeto (vira o JSON de "Baixar meus dados"). */
export async function exportUserData(ctx: Ctx) {
  const where = { userId: ctx.userId };
  const [user, wallets, categories, transactions, transfers, budgets, recurringRules, goals, categoryRules, imports] =
    await Promise.all([
      ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { id: true, name: true, email: true, createdAt: true },
      }),
      ctx.db.wallet.findMany({ where }),
      ctx.db.category.findMany({ where }),
      ctx.db.transaction.findMany({ where, orderBy: { date: "asc" } }),
      ctx.db.transfer.findMany({ where, orderBy: { date: "asc" } }),
      ctx.db.budget.findMany({ where }),
      ctx.db.recurringRule.findMany({ where, include: { skips: true } }),
      ctx.db.goal.findMany({ where, include: { contributions: true } }),
      ctx.db.categoryRule.findMany({ where }),
      ctx.db.importBatch.findMany({ where, select: { id: true, fileName: true, format: true, status: true, createdAt: true } }),
    ]);
  if (!user) throw new DomainError("Usuário não encontrado.");
  return {
    exportedAt: new Date().toISOString(),
    note: "Valores em centavos (amountCents 12345 = R$ 123,45). Datas em UTC.",
    user,
    wallets,
    categories,
    transactions,
    transfers,
    budgets,
    recurringRules,
    goals,
    categoryRules,
    imports,
  };
}

/** Texto que o usuário precisa digitar pra confirmar a exclusão. */
export const DELETE_CONFIRMATION = "EXCLUIR";

/**
 * Exclui o usuário e TUDO dele, numa transação só. Não dá pra desfazer.
 * A conta demo não pode ser excluída (é compartilhada).
 */
export async function deleteAccount(ctx: Ctx, confirmation: string): Promise<void> {
  if (confirmation.trim().toUpperCase() !== DELETE_CONFIRMATION) {
    throw new DomainError(`Digite ${DELETE_CONFIRMATION} pra confirmar.`);
  }
  const user = await ctx.db.user.findUnique({ where: { id: ctx.userId } });
  if (!user) throw new DomainError("Usuário não encontrado.");
  if (user.isDemo) throw new DomainError("A conta de demonstração não pode ser excluída.");
  await purgeUser(ctx.db, ctx.userId);
}

/** Apaga o usuário e tudo dele (sem checagens). Usado na exclusão e na limpeza das demos. */
export async function purgeUser(db: Db, userId: string): Promise<void> {
  const ctx = { db, userId };
  const where = { userId };
  await ctx.db.$transaction([
    // Primeiro o que aponta pra contas/categorias com Restrict...
    ctx.db.transaction.deleteMany({ where }),
    ctx.db.transfer.deleteMany({ where }),
    ctx.db.recurringRule.deleteMany({ where }),
    ctx.db.importBatch.deleteMany({ where }),
    // ...depois o resto (metas, regras e orçamentos caem junto em cascata)...
    ctx.db.goal.deleteMany({ where }),
    ctx.db.categoryRule.deleteMany({ where }),
    ctx.db.budget.deleteMany({ where }),
    ctx.db.category.deleteMany({ where }),
    ctx.db.wallet.deleteMany({ where }),
    // ...e por fim o usuário (logins e sessões vão em cascata).
    ctx.db.user.delete({ where: { id: ctx.userId } }),
  ]);
}
