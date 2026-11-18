// Transferências entre contas do mesmo usuário. Não são receita nem despesa.
import type { Transfer, Wallet } from "@prisma/client";
import { monthRange } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import type { TransferData } from "@/lib/validations";
import type { Ctx } from "./context";
import { getOwnWallet } from "./wallets";

export type TransferWithWallets = Transfer & { fromWallet: Wallet; toWallet: Wallet };

/** Transferências (do mês, se passar `month`), da mais recente pra mais antiga. */
export function listTransfers(ctx: Ctx, month?: string): Promise<TransferWithWallets[]> {
  const range = month ? monthRange(month) : null;
  return ctx.db.transfer.findMany({
    where: { userId: ctx.userId, ...(range && { date: { gte: range.start, lt: range.end } }) },
    include: { fromWallet: true, toWallet: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export async function createTransfer(ctx: Ctx, data: TransferData): Promise<Transfer> {
  if (data.fromWalletId === data.toWalletId) throw new DomainError("Escolha uma conta diferente da origem.");
  // As duas contas precisam ser do usuário.
  await getOwnWallet(ctx, data.fromWalletId);
  await getOwnWallet(ctx, data.toWalletId);
  return ctx.db.transfer.create({ data: { ...data, userId: ctx.userId } });
}

export async function deleteTransfer(ctx: Ctx, id: string): Promise<void> {
  const r = await ctx.db.transfer.deleteMany({ where: { id, userId: ctx.userId } });
  if (r.count === 0) throw new DomainError("Transferência não encontrada.");
}

/** Saldo líquido de transferências por conta: + entrou, − saiu. */
export async function netTransfersByWallet(ctx: Ctx): Promise<Map<string, number>> {
  const [saidas, entradas] = await Promise.all([
    ctx.db.transfer.groupBy({ by: ["fromWalletId"], where: { userId: ctx.userId }, _sum: { amountCents: true } }),
    ctx.db.transfer.groupBy({ by: ["toWalletId"], where: { userId: ctx.userId }, _sum: { amountCents: true } }),
  ]);
  const net = new Map<string, number>();
  for (const s of saidas) net.set(s.fromWalletId, (net.get(s.fromWalletId) ?? 0) - (s._sum.amountCents ?? 0));
  for (const e of entradas) net.set(e.toWalletId, (net.get(e.toWalletId) ?? 0) + (e._sum.amountCents ?? 0));
  return net;
}
