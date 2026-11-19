// Faturas dos cartões de crédito (contas do tipo CREDIT_CARD). Sempre com { db, userId }.
//
// No app, o cartão é uma conta: compra = despesa nela (o saldo fica negativo = o que você deve)
// e pagar a fatura = transferência da conta corrente pro cartão. Aqui só AGRUPAMOS isso por fatura.
import type { Wallet } from "@prisma/client";
import { type InvoiceStatus, invoiceDates, invoiceMonthOf, invoiceStatus } from "@/lib/cards";
import { type Month, shiftMonth } from "@/lib/dates";
import type { Ctx } from "./context";

export type CardInvoice = {
  month: Month;
  opensAt: Date;
  closingDate: Date;
  dueDate: Date;
  /** Compras − estornos que caíram nesta fatura. */
  totalCents: number;
  /** Pagamentos (transferências pro cartão) feitos depois que ela fechou. */
  paidCents: number;
  status: InvoiceStatus;
};

export type CardWithInvoices = { wallet: Wallet; invoices: CardInvoice[] };

/**
 * Cartões do usuário com as faturas: 3 anteriores, a aberta e as futuras que já têm
 * compra (parcelas). Cartão sem dia de fechamento/vencimento não entra.
 */
export async function listCardInvoices(ctx: Ctx, now: Date = new Date()): Promise<CardWithInvoices[]> {
  const cards = await ctx.db.wallet.findMany({
    where: { userId: ctx.userId, kind: "CREDIT_CARD", closingDay: { not: null }, dueDay: { not: null } },
    orderBy: { name: "asc" },
  });
  if (cards.length === 0) return [];
  const ids = cards.map((c) => c.id);
  const [txs, transfers] = await Promise.all([
    ctx.db.transaction.findMany({
      where: { userId: ctx.userId, walletId: { in: ids } },
      select: { walletId: true, type: true, amountCents: true, date: true },
    }),
    ctx.db.transfer.findMany({
      where: { userId: ctx.userId, OR: [{ toWalletId: { in: ids } }, { fromWalletId: { in: ids } }] },
      select: { fromWalletId: true, toWalletId: true, amountCents: true, date: true },
    }),
  ]);

  return cards.map((wallet) => {
    const closing = wallet.closingDay!;
    const due = wallet.dueDay!;
    const total = new Map<Month, number>();
    for (const t of txs) {
      if (t.walletId !== wallet.id) continue;
      const m = invoiceMonthOf(t.date, closing);
      total.set(m, (total.get(m) ?? 0) + (t.type === "EXPENSE" ? t.amountCents : -t.amountCents));
    }
    // Pagamento vai pra fatura que fechou por último antes dele.
    const pago = new Map<Month, number>();
    for (const tr of transfers) {
      const sinal = tr.toWalletId === wallet.id ? 1 : tr.fromWalletId === wallet.id ? -1 : 0;
      if (!sinal) continue;
      const m = shiftMonth(invoiceMonthOf(tr.date, closing), -1);
      pago.set(m, (pago.get(m) ?? 0) + sinal * tr.amountCents);
    }

    const aberta = invoiceMonthOf(now, closing);
    const meses: Month[] = [];
    for (let i = -3; i <= 0; i++) meses.push(shiftMonth(aberta, i));
    const futuras = [...total.keys()].filter((m) => m > aberta).sort();
    meses.push(...futuras);

    const invoices = meses.map((month) => {
      const d = invoiceDates(month, closing, due);
      const totalCents = total.get(month) ?? 0;
      const paidCents = pago.get(month) ?? 0;
      return { ...d, totalCents, paidCents, status: invoiceStatus(d, totalCents, paidCents, now) };
    });
    return { wallet, invoices };
  });
}
