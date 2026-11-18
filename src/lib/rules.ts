// Regras de negócio puras (sem banco). Fáceis de testar.
import type { CategoryType, TransactionStatus } from "./constants";

/** O mínimo de uma transação que as regras precisam. */
export type TxLike = {
  type: CategoryType;
  status: TransactionStatus;
  amountCents: number;
};

export type MonthSummary = {
  /** Receitas recebidas (PAID). */
  incomeCents: number;
  /** Despesas pagas (PAID). */
  expenseCents: number;
  /** Saldo do mês = receitas pagas - despesas pagas. */
  balanceCents: number;
  /** "A pagar": despesas pendentes. */
  pendingExpenseCents: number;
  /** "A receber": receitas pendentes. */
  pendingIncomeCents: number;
  /** Quantidade de transações do mês (todas, pagas e pendentes). */
  count: number;
};

/** Resumo do mês. O saldo conta só o que está PAID (Decisão 2). */
export function calcMonthSummary(transactions: TxLike[]): MonthSummary {
  const s: MonthSummary = {
    incomeCents: 0,
    expenseCents: 0,
    balanceCents: 0,
    pendingExpenseCents: 0,
    pendingIncomeCents: 0,
    count: transactions.length,
  };
  for (const t of transactions) {
    if (t.type === "INCOME") {
      if (t.status === "PAID") s.incomeCents += t.amountCents;
      else s.pendingIncomeCents += t.amountCents;
    } else {
      if (t.status === "PAID") s.expenseCents += t.amountCents;
      else s.pendingExpenseCents += t.amountCents;
    }
  }
  s.balanceCents = s.incomeCents - s.expenseCents;
  return s;
}

/** Gasto que conta pro orçamento: despesas PAID e PENDING (Decisão 2). */
export function calcBudgetSpent(transactions: TxLike[]): number {
  return transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((soma, t) => soma + t.amountCents, 0);
}

export type WalletBalance = {
  /** Saldo de hoje: saldo inicial + o que já foi recebido - o que já foi pago. */
  currentCents: number;
  /** Saldo se tudo que está pendente for pago/recebido. */
  projectedCents: number;
};

/** Saldo de uma conta a partir do saldo inicial e de TODAS as transações dela. */
export function calcWalletBalance(
  openingBalanceCents: number,
  transactions: TxLike[],
): WalletBalance {
  let current = openingBalanceCents;
  let pendente = 0;
  for (const t of transactions) {
    const valor = t.type === "INCOME" ? t.amountCents : -t.amountCents;
    if (t.status === "PAID") current += valor;
    else pendente += valor;
  }
  return { currentCents: current, projectedCents: current + pendente };
}

export type BudgetProgress = {
  limitCents: number;
  spentCents: number;
  /** Quanto resta. Fica negativo quando estoura. */
  remainingCents: number;
  /** Percentual usado, inteiro (pode passar de 100). */
  percentUsed: number;
  /** Percentual limitado a 100, bom pra largura de barra. */
  percentBar: number;
  /** true quando o gasto passou do limite (fica vermelho). */
  isOver: boolean;
};

export function calcBudgetProgress(
  limitCents: number,
  spentCents: number,
): BudgetProgress {
  const percentUsed =
    limitCents > 0 ? Math.round((spentCents * 100) / limitCents) : 0;
  return {
    limitCents,
    spentCents,
    remainingCents: limitCents - spentCents,
    percentUsed,
    percentBar: Math.min(percentUsed, 100),
    isOver: spentCents > limitCents,
  };
}

/**
 * Confere se o tipo da transação bate com o tipo da categoria.
 * Retorna a mensagem de erro, ou `null` se estiver tudo certo.
 */
export function checkCategoryType(
  transactionType: CategoryType,
  categoryType: CategoryType,
): string | null {
  if (transactionType === categoryType) return null;
  return transactionType === "INCOME"
    ? "Receita só pode usar uma categoria de receita."
    : "Despesa só pode usar uma categoria de despesa.";
}

/** Orçamento só pode ser de categoria de despesa. */
export function checkBudgetCategoryType(
  categoryType: CategoryType,
): string | null {
  return categoryType === "EXPENSE"
    ? null
    : "Orçamento só pode ser criado para uma categoria de despesa.";
}

/** As N maiores despesas (pagas e pendentes), da maior pra menor. */
export function topExpenses<T extends TxLike>(transactions: T[], n = 5): T[] {
  return transactions
    .filter((t) => t.type === "EXPENSE")
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, n);
}

export type CategoryTotal = {
  categoryId: string;
  name: string;
  color: string | null;
  totalCents: number;
  /** Fatia do total de despesas, em % inteiro (bom pro gráfico). */
  percent: number;
};

/** Soma das despesas (pagas e pendentes) por categoria, da maior pra menor. */
export function expensesByCategory(
  transactions: (TxLike & {
    category: { id: string; name: string; color: string | null };
  })[],
): CategoryTotal[] {
  const mapa = new Map<string, CategoryTotal>();
  let total = 0;
  for (const t of transactions) {
    if (t.type !== "EXPENSE") continue;
    total += t.amountCents;
    const atual = mapa.get(t.category.id) ?? {
      categoryId: t.category.id,
      name: t.category.name,
      color: t.category.color,
      totalCents: 0,
      percent: 0,
    };
    atual.totalCents += t.amountCents;
    mapa.set(t.category.id, atual);
  }
  return [...mapa.values()]
    .map((c) => ({
      ...c,
      percent: total > 0 ? Math.round((c.totalCents * 100) / total) : 0,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
}
