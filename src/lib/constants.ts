// Constantes compartilhadas entre servidor e telas.
// Os valores batem com os enums do Prisma (CategoryType e TransactionStatus).

export const CATEGORY_TYPES = ["INCOME", "EXPENSE"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const TRANSACTION_STATUSES = ["PAID", "PENDING"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const WALLET_KINDS = ["CHECKING", "SAVINGS", "WALLET", "CREDIT_CARD"] as const;
export type WalletKind = (typeof WALLET_KINDS)[number];

export const WALLET_KIND_LABEL: Record<WalletKind, string> = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  WALLET: "Carteira",
  CREDIT_CARD: "Cartão de crédito",
};

export const CATEGORY_TYPE_LABEL: Record<CategoryType, string> = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
};

/** Rótulo do status, que muda conforme o tipo (Decisão 2). */
export function statusLabel(
  type: CategoryType,
  status: TransactionStatus,
): string {
  if (type === "INCOME") return status === "PAID" ? "Recebido" : "A receber";
  return status === "PAID" ? "Pago" : "Pendente";
}
