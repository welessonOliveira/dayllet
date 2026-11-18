// Contas financeiras (Wallet). Na tela: "Conta".
import type { Wallet } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { type WalletBalance, calcWalletBalance } from "@/lib/rules";
import type { WalletData } from "@/lib/validations";
import type { Ctx } from "./context";
import { isUniqueError } from "./db";
import { ensureDefaultWallet } from "./defaults";

export type WalletWithBalance = Wallet & {
  balance: WalletBalance;
  /** Quantos lançamentos a conta tem (se > 0, não pode excluir). */
  transactionCount: number;
};

const NOME_DUPLICADO = "Você já tem uma conta com esse nome.";
const NAO_ENCONTRADA = "Conta não encontrada.";

/** Busca uma conta do usuário ou erro (nunca devolve conta de outro usuário). */
export async function getOwnWallet(ctx: Ctx, id: string): Promise<Wallet> {
  const w = await ctx.db.wallet.findFirst({ where: { id, userId: ctx.userId } });
  if (!w) throw new DomainError(NAO_ENCONTRADA);
  return w;
}

/** Contas do usuário (padrão primeiro, depois A-Z). Simples, pra selects. */
export function listWallets(ctx: Ctx): Promise<Wallet[]> {
  return ctx.db.wallet.findMany({
    where: { userId: ctx.userId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

/** Contas com saldo atual, saldo previsto e quantidade de lançamentos. */
export async function listWalletsWithBalance(ctx: Ctx): Promise<WalletWithBalance[]> {
  const [wallets, txs] = await Promise.all([
    listWallets(ctx),
    ctx.db.transaction.findMany({
      where: { userId: ctx.userId },
      select: { walletId: true, type: true, status: true, amountCents: true },
    }),
  ]);
  return wallets.map((w) => {
    const daConta = txs.filter((t) => t.walletId === w.id);
    return {
      ...w,
      balance: calcWalletBalance(w.openingBalanceCents, daConta),
      transactionCount: daConta.length,
    };
  });
}

export function getDefaultWalletId(ctx: Ctx): Promise<string> {
  return ensureDefaultWallet(ctx.db, ctx.userId);
}

export async function createWallet(ctx: Ctx, data: WalletData): Promise<Wallet> {
  try {
    const temAlguma = await ctx.db.wallet.count({ where: { userId: ctx.userId } });
    return await ctx.db.wallet.create({
      data: { ...data, userId: ctx.userId, isDefault: temAlguma === 0 },
    });
  } catch (e) {
    if (isUniqueError(e)) throw new DomainError(NOME_DUPLICADO);
    throw e;
  }
}

export async function updateWallet(ctx: Ctx, id: string, data: WalletData): Promise<Wallet> {
  await getOwnWallet(ctx, id);
  try {
    return await ctx.db.wallet.update({ where: { id }, data });
  } catch (e) {
    if (isUniqueError(e)) throw new DomainError(NOME_DUPLICADO);
    throw e;
  }
}

/** Torna esta a conta padrão (a anterior deixa de ser). */
export async function setDefaultWallet(ctx: Ctx, id: string): Promise<void> {
  await getOwnWallet(ctx, id);
  await ctx.db.$transaction([
    ctx.db.wallet.updateMany({ where: { userId: ctx.userId }, data: { isDefault: false } }),
    ctx.db.wallet.update({ where: { id }, data: { isDefault: true } }),
  ]);
}

/** Exclui a conta. Bloqueia se tiver lançamentos ou se for a única. */
export async function deleteWallet(ctx: Ctx, id: string): Promise<void> {
  const w = await getOwnWallet(ctx, id);
  const n = await ctx.db.transaction.count({ where: { walletId: id } });
  if (n > 0) {
    throw new DomainError(
      `Essa conta tem ${n} ${n === 1 ? "lançamento" : "lançamentos"} e não pode ser excluída. ` +
        "Mova ou exclua os lançamentos antes.",
    );
  }
  const regras = await ctx.db.recurringRule.count({ where: { walletId: id } });
  if (regras > 0) {
    throw new DomainError("Essa conta é usada em conta fixa ou parcelamento e não pode ser excluída.");
  }
  const total = await ctx.db.wallet.count({ where: { userId: ctx.userId } });
  if (total <= 1) throw new DomainError("Você precisa ter pelo menos uma conta.");

  await ctx.db.wallet.delete({ where: { id } });
  // Se apagou a padrão, outra vira padrão.
  if (w.isDefault) await ensureDefaultWallet(ctx.db, ctx.userId);
}
