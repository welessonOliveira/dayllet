// Regras puras de fluxo de caixa e projeção de saldo (Decisão 22: calculado na hora).
// "Realizado" = só o que está PAGO. "Previsto" = pago + pendente (o que vai acontecer).
import type { CategoryType, TransactionStatus } from "./constants";
import { monthOf, monthRange, toDateInput, dateInputToUtc } from "./dates";

export type FlowItem = {
  date: Date;
  type: CategoryType;
  status: TransactionStatus;
  amountCents: number;
};

/** Receita soma, despesa subtrai. */
export function signedAmount(t: Pick<FlowItem, "type" | "amountCents">): number {
  return t.type === "INCOME" ? t.amountCents : -t.amountCents;
}

export type MonthCashflow = {
  month: string;
  /** Previsto: tudo do mês (pago + pendente). */
  plannedIncomeCents: number;
  plannedExpenseCents: number;
  /** Realizado: só o que já foi pago/recebido. */
  realizedIncomeCents: number;
  realizedExpenseCents: number;
  /** Resultado (receitas - despesas). */
  plannedNetCents: number;
  realizedNetCents: number;
};

/** Previsto vs. realizado de cada mês pedido (meses sem lançamento vêm zerados). */
export function cashflowByMonth(items: FlowItem[], months: string[]): MonthCashflow[] {
  const mapa = new Map<string, MonthCashflow>(
    months.map((m) => [
      m,
      {
        month: m,
        plannedIncomeCents: 0,
        plannedExpenseCents: 0,
        realizedIncomeCents: 0,
        realizedExpenseCents: 0,
        plannedNetCents: 0,
        realizedNetCents: 0,
      },
    ]),
  );
  for (const t of items) {
    const c = mapa.get(monthOf(t.date));
    if (!c) continue;
    const pago = t.status === "PAID";
    if (t.type === "INCOME") {
      c.plannedIncomeCents += t.amountCents;
      if (pago) c.realizedIncomeCents += t.amountCents;
    } else {
      c.plannedExpenseCents += t.amountCents;
      if (pago) c.realizedExpenseCents += t.amountCents;
    }
  }
  for (const c of mapa.values()) {
    c.plannedNetCents = c.plannedIncomeCents - c.plannedExpenseCents;
    c.realizedNetCents = c.realizedIncomeCents - c.realizedExpenseCents;
  }
  return months.map((m) => mapa.get(m)!);
}

/** Todos os dias do mês, como Date às 12:00 UTC. */
export function daysOfMonth(month: string): Date[] {
  const { start, end } = monthRange(month);
  const dias: Date[] = [];
  let atual = dateInputToUtc(toDateInput(start));
  while (atual < end) {
    dias.push(atual);
    atual = new Date(atual.getTime() + 24 * 60 * 60 * 1000);
  }
  return dias;
}

export type BalancePoint = { date: Date; balanceCents: number };

/**
 * Saldo PROJETADO no fim de cada dia pedido: saldo de hoje + todos os pendentes
 * com data até aquele dia (inclusive os atrasados, que ainda vão sair/entrar).
 */
export function projectDaily(currentBalanceCents: number, pending: FlowItem[], days: Date[]): BalancePoint[] {
  const ordenados = pending
    .filter((t) => t.status === "PENDING")
    .map((t) => ({ dia: toDateInput(t.date), valor: signedAmount(t) }))
    .sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0));
  let i = 0;
  let saldo = currentBalanceCents;
  return days.map((d) => {
    const dia = toDateInput(d);
    while (i < ordenados.length && ordenados[i].dia <= dia) saldo += ordenados[i++].valor;
    return { date: d, balanceCents: saldo };
  });
}

/**
 * Saldo REALIZADO no fim de cada dia: saldo inicial das contas + tudo que foi
 * pago/recebido até aquele dia. Serve pros meses que já passaram.
 */
export function realizedDaily(openingBalanceCents: number, items: FlowItem[], days: Date[]): BalancePoint[] {
  const pagos = items.filter((t) => t.status === "PAID");
  return days.map((d) => {
    const dia = toDateInput(d);
    const soma = pagos.filter((t) => toDateInput(t.date) <= dia).reduce((s, t) => s + signedAmount(t), 0);
    return { date: d, balanceCents: openingBalanceCents + soma };
  });
}

/** Ponto mais baixo da série (pra avisar "seu saldo fica negativo dia X"). */
export function lowestPoint(series: BalancePoint[]): BalancePoint | null {
  return series.reduce<BalancePoint | null>((min, p) => (!min || p.balanceCents < min.balanceCents ? p : min), null);
}
