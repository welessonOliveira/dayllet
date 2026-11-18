// Projeção de saldo e fluxo de caixa (previsto vs. realizado). Só leitura.
// Usa as transações que existem: como as contas fixas/parcelas são geradas antes
// (syncRecurring), os pendentes futuros já estão lá.
import { currentMonth, dateInputToUtc, monthRange, shiftMonth, todayInput } from "@/lib/dates";
import {
  type BalancePoint,
  type FlowItem,
  type MonthCashflow,
  cashflowByMonth,
  daysOfMonth,
  lowestPoint,
  projectDaily,
  realizedDaily,
  signedAmount,
} from "@/lib/projection";
import type { Ctx } from "./context";
import { syncRecurring } from "./recurring";

export type MonthForecast = {
  month: string;
  /** "past" = mês que já acabou (só realizado); "current" = mês atual; "future" = mês que vem pela frente. */
  mode: "past" | "current" | "future";
  /** Saldo total das contas hoje (só o que já foi pago/recebido). */
  currentBalanceCents: number;
  /** Saldo no fim do mês: projetado (atual/futuro) ou realizado (passado). */
  endOfMonthBalanceCents: number;
  /** Pendentes do mês (inclui atrasados no mês atual). */
  pendingIncomeCents: number;
  pendingExpenseCents: number;
  /** Despesas pendentes com data antes de hoje (atrasadas), de qualquer mês. */
  overdueExpenseCents: number;
  /** Saldo no fim de cada dia (a partir de hoje no mês atual; o mês todo nos outros). */
  daily: BalancePoint[];
  /** Ponto mais baixo da série (null se a série for vazia). */
  lowest: BalancePoint | null;
};

async function loadAll(ctx: Ctx) {
  const [wallets, txs] = await Promise.all([
    ctx.db.wallet.findMany({ where: { userId: ctx.userId }, select: { openingBalanceCents: true } }),
    ctx.db.transaction.findMany({
      where: { userId: ctx.userId },
      select: { date: true, type: true, status: true, amountCents: true },
    }),
  ]);
  const opening = wallets.reduce((s, w) => s + w.openingBalanceCents, 0);
  return { opening, txs: txs as FlowItem[] };
}

/** Projeção (ou realizado, se já passou) do mês pedido. */
export async function getMonthForecast(ctx: Ctx, month: string, now = new Date()): Promise<MonthForecast> {
  await syncRecurring(ctx, month, now);
  const { opening, txs } = await loadAll(ctx);
  const atual = currentMonth(now);
  const hoje = dateInputToUtc(todayInput(now));
  const fimDoMes = new Date(monthRange(month).end.getTime() - 1);
  const mode = month < atual ? "past" : month === atual ? "current" : "future";

  const pagos = txs.filter((t) => t.status === "PAID");
  const pendentes = txs.filter((t) => t.status === "PENDING");
  const currentBalanceCents = opening + pagos.reduce((s, t) => s + signedAmount(t), 0);

  const doMes = (t: FlowItem) => {
    const { start, end } = monthRange(month);
    return t.date >= start && t.date < end;
  };
  // No mês atual, os atrasados (de meses anteriores) também entram como "a pagar agora".
  const pendentesDoMes = pendentes.filter((t) => doMes(t) || (mode === "current" && t.date < hoje));
  const pendingIncomeCents = pendentesDoMes.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amountCents, 0);
  const pendingExpenseCents = pendentesDoMes.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amountCents, 0);
  const overdueExpenseCents = pendentes
    .filter((t) => t.type === "EXPENSE" && t.date < hoje)
    .reduce((s, t) => s + t.amountCents, 0);

  let daily: BalancePoint[];
  if (mode === "past") {
    daily = realizedDaily(opening, txs, daysOfMonth(month));
  } else {
    const dias = daysOfMonth(month).filter((d) => mode === "future" || d >= hoje);
    daily = projectDaily(currentBalanceCents, pendentes, dias);
  }
  const ultimo = daily.at(-1);
  const endOfMonthBalanceCents =
    ultimo?.balanceCents ??
    currentBalanceCents + pendentes.filter((t) => t.date <= fimDoMes).reduce((s, t) => s + signedAmount(t), 0);

  return {
    month,
    mode,
    currentBalanceCents,
    endOfMonthBalanceCents,
    pendingIncomeCents,
    pendingExpenseCents,
    overdueExpenseCents,
    daily,
    lowest: lowestPoint(daily),
  };
}

/**
 * Previsto vs. realizado mês a mês: `back` meses pra trás e `ahead` pra frente
 * a partir do mês atual (padrão: 5 pra trás + atual + 3 pra frente = 9 meses).
 */
export async function getCashflow(
  ctx: Ctx,
  opts: { back?: number; ahead?: number } = {},
  now = new Date(),
): Promise<MonthCashflow[]> {
  const back = Math.min(Math.max(opts.back ?? 5, 0), 24);
  const ahead = Math.min(Math.max(opts.ahead ?? 3, 0), 12);
  const atual = currentMonth(now);
  const meses = Array.from({ length: back + 1 + ahead }, (_, i) => shiftMonth(atual, i - back));
  await syncRecurring(ctx, meses.at(-1), now);

  const inicio = monthRange(meses[0]).start;
  const fim = monthRange(meses.at(-1)!).end;
  const txs = await ctx.db.transaction.findMany({
    where: { userId: ctx.userId, date: { gte: inicio, lt: fim } },
    select: { date: true, type: true, status: true, amountCents: true },
  });
  return cashflowByMonth(txs, meses);
}

/** Saldo projetado no fim de cada um dos próximos `months` meses (inclui o atual). */
export async function getBalanceProjection(
  ctx: Ctx,
  months = 6,
  now = new Date(),
): Promise<{ month: string; balanceCents: number }[]> {
  const n = Math.min(Math.max(months, 1), 24);
  const atual = currentMonth(now);
  const meses = Array.from({ length: n }, (_, i) => shiftMonth(atual, i));
  await syncRecurring(ctx, meses.at(-1), now);
  const { opening, txs } = await loadAll(ctx);
  const saldoHoje = opening + txs.filter((t) => t.status === "PAID").reduce((s, t) => s + signedAmount(t), 0);
  const fins = meses.map((m) => new Date(monthRange(m).end.getTime() - 1));
  const serie = projectDaily(saldoHoje, txs, fins);
  return meses.map((m, i) => ({ month: m, balanceCents: serie[i].balanceCents }));
}
