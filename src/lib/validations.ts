// Schemas Zod usados no cliente (React Hook Form) e no servidor.
// Eles recebem o que o formulário manda (strings) e devolvem
// os dados prontos pro banco (centavos, Date, etc.).
import { z } from "zod";
import { CATEGORY_TYPES, TRANSACTION_STATUSES, WALLET_KINDS, type CategoryType } from "./constants";
import { currentMonth, dateInputToUtc, isValidDateInput, isValidMonth } from "./dates";
import { parseBRLToCents, parseSignedBRLToCents } from "./money";
import { FREQUENCIES } from "./recurrence";

const MAX_CENTS = 10_000_000_000; // R$ 100 milhões, só pra barrar absurdo

/** Valor em reais digitado (pt-BR) -> centavos (inteiro > 0). */
const moneyField = z
  .string({ error: "Informe o valor." })
  .trim()
  .min(1, "Informe o valor.")
  .transform((valor, ctx) => {
    const cents = parseBRLToCents(valor);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Valor inválido. Use o formato 1.234,56." });
      return z.NEVER;
    }
    if (cents <= 0) {
      ctx.addIssue({ code: "custom", message: "O valor precisa ser maior que zero." });
      return z.NEVER;
    }
    if (cents > MAX_CENTS) {
      ctx.addIssue({ code: "custom", message: "Valor alto demais." });
      return z.NEVER;
    }
    return cents;
  });

const idField = (msg: string) => z.string({ error: msg }).trim().min(1, msg);

const monthField = z
  .string({ error: "Informe o mês." })
  .refine(isValidMonth, "Mês inválido. Use o formato AAAA-MM.");

/** Texto opcional: string vazia vira `null`. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

// ---------- Transação ----------

export const transactionSchema = z.object({
  description: z
    .string({ error: "Informe a descrição." })
    .trim()
    .min(1, "Informe a descrição.")
    .max(120, "Use no máximo 120 caracteres."),
  /** Valor digitado em reais, ex.: "1.234,56". */
  amount: moneyField,
  type: z.enum(CATEGORY_TYPES, { error: "Escolha receita ou despesa." }),
  status: z.enum(TRANSACTION_STATUSES, { error: "Status inválido." }).default("PAID"),
  /** "YYYY-MM-DD" (input type="date"). */
  date: z
    .string({ error: "Informe a data." })
    .refine(isValidDateInput, "Data inválida.")
    .transform(dateInputToUtc),
  categoryId: idField("Escolha uma categoria."),
  /** Conta (Wallet). Opcional: sem ela, o servidor usa a conta padrão do usuário. */
  walletId: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null)),
  notes: optionalText(500),
});

/** O que o formulário de transação manda (tudo string). */
export type TransactionFormValues = z.input<typeof transactionSchema>;
/** O que o zodResolver entrega no handleSubmit (3º genérico do useForm). */
export type TransactionFormOutput = z.output<typeof transactionSchema>;

/** Dados validados, prontos pro servidor. */
export type TransactionData = {
  description: string;
  amountCents: number;
  type: CategoryType;
  status: (typeof TRANSACTION_STATUSES)[number];
  date: Date;
  categoryId: string;
  /** null = usar a conta padrão. */
  walletId: string | null;
  notes: string | null;
};

export function toTransactionData(
  parsed: z.output<typeof transactionSchema>,
): TransactionData {
  const { amount, ...resto } = parsed;
  return { ...resto, amountCents: amount };
}

// ---------- Categoria ----------

export const categorySchema = z.object({
  name: z
    .string({ error: "Informe o nome." })
    .trim()
    .min(1, "Informe o nome.")
    .max(40, "Use no máximo 40 caracteres."),
  type: z.enum(CATEGORY_TYPES, { error: "Escolha receita ou despesa." }),
  /** Cor opcional no formato "#rrggbb". Vazio vira null. */
  color: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || /^#[0-9a-f]{6}$/.test(v), "Cor inválida. Use o formato #RRGGBB."),
});

export type CategoryFormValues = z.input<typeof categorySchema>;
export type CategoryData = z.output<typeof categorySchema>;
/** O que o zodResolver entrega no handleSubmit (3º genérico do useForm). */
export type CategoryFormOutput = CategoryData;

// ---------- Conta (Wallet) ----------

/** Saldo inicial digitado (pt-BR), pode ser zero ou negativo. Vazio = 0. */
const signedMoneyField = z
  .string()
  .trim()
  .nullish()
  .transform((valor, ctx) => {
    if (!valor) return 0;
    const cents = parseSignedBRLToCents(valor);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Valor inválido. Use o formato 1.234,56." });
      return z.NEVER;
    }
    if (Math.abs(cents) > MAX_CENTS) {
      ctx.addIssue({ code: "custom", message: "Valor alto demais." });
      return z.NEVER;
    }
    return cents;
  });

export const walletSchema = z.object({
  name: z
    .string({ error: "Informe o nome." })
    .trim()
    .min(1, "Informe o nome.")
    .max(40, "Use no máximo 40 caracteres."),
  kind: z.enum(WALLET_KINDS, { error: "Escolha o tipo da conta." }).default("CHECKING"),
  /** Saldo antes do primeiro lançamento no app, ex.: "1.500,00" ou "-200". */
  openingBalance: signedMoneyField,
});

export type WalletFormValues = z.input<typeof walletSchema>;
/** O que o zodResolver entrega no handleSubmit (3º genérico do useForm). */
export type WalletFormOutput = z.output<typeof walletSchema>;
export type WalletData = { name: string; kind: (typeof WALLET_KINDS)[number]; openingBalanceCents: number };

export function toWalletData(parsed: WalletFormOutput): WalletData {
  return { name: parsed.name, kind: parsed.kind, openingBalanceCents: parsed.openingBalance };
}

// ---------- Recorrente / parcelado ----------

export const RECURRING_KINDS = ["FIXED", "INSTALLMENT"] as const;
export type RecurringKind = (typeof RECURRING_KINDS)[number];

const optionalDateField = z
  .string()
  .trim()
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    if (!isValidDateInput(v)) {
      ctx.addIssue({ code: "custom", message: "Data inválida." });
      return z.NEVER;
    }
    return dateInputToUtc(v);
  });

export const recurringRuleSchema = z
  .object({
    /** "FIXED" = conta fixa (repete); "INSTALLMENT" = compra parcelada. */
    kind: z.enum(RECURRING_KINDS, { error: "Escolha conta fixa ou parcelado." }),
    description: z
      .string({ error: "Informe a descrição." })
      .trim()
      .min(1, "Informe a descrição.")
      .max(120, "Use no máximo 120 caracteres."),
    type: z.enum(CATEGORY_TYPES, { error: "Escolha receita ou despesa." }),
    /** Conta fixa: valor de cada vez. Parcelado: valor TOTAL da compra. */
    amount: moneyField,
    categoryId: idField("Escolha uma categoria."),
    walletId: z
      .string()
      .trim()
      .nullish()
      .transform((v) => (v ? v : null)),
    /** Só na conta fixa. No parcelado é sempre mensal. */
    frequency: z.enum(FREQUENCIES, { error: "Frequência inválida." }).default("MONTHLY"),
    /** Primeira ocorrência / primeira parcela ("YYYY-MM-DD"). */
    startDate: z
      .string({ error: "Informe a data da primeira vez." })
      .refine(isValidDateInput, "Data inválida.")
      .transform(dateInputToUtc),
    /** Só na conta fixa: até quando repete (vazio = sem fim). */
    endDate: optionalDateField,
    /** Só no parcelado: número de parcelas ("2" a "120"). */
    installments: z.string().trim().nullish(),
    notes: optionalText(500),
  })
  .transform((v, ctx) => {
    let installments: number | null = null;
    if (v.kind === "INSTALLMENT") {
      const n = Number(v.installments);
      if (!v.installments || !Number.isInteger(n) || n < 2 || n > 120) {
        ctx.addIssue({ code: "custom", path: ["installments"], message: "Informe de 2 a 120 parcelas." });
        return z.NEVER;
      }
      installments = n;
    }
    if (v.kind === "FIXED" && v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "O fim precisa ser depois do começo." });
      return z.NEVER;
    }
    return {
      description: v.description,
      type: v.type,
      amountCents: v.amount,
      categoryId: v.categoryId,
      walletId: v.walletId,
      frequency: v.kind === "INSTALLMENT" ? ("MONTHLY" as const) : v.frequency,
      startDate: v.startDate,
      endDate: v.kind === "INSTALLMENT" ? null : v.endDate,
      installments,
      notes: v.notes,
    };
  });

export type RecurringRuleFormValues = z.input<typeof recurringRuleSchema>;
/** O que o zodResolver entrega no handleSubmit (3º genérico do useForm). */
export type RecurringRuleFormOutput = z.output<typeof recurringRuleSchema>;
/** Dados validados, prontos pro servidor. */
export type RecurringRuleData = RecurringRuleFormOutput;

// ---------- Transferência entre contas ----------

export const transferSchema = z
  .object({
    fromWalletId: idField("Escolha a conta de origem."),
    toWalletId: idField("Escolha a conta de destino."),
    amount: moneyField,
    date: z
      .string({ error: "Informe a data." })
      .refine(isValidDateInput, "Data inválida.")
      .transform(dateInputToUtc),
    note: optionalText(200),
  })
  .refine((v) => v.fromWalletId !== v.toWalletId, {
    path: ["toWalletId"],
    message: "Escolha uma conta diferente da origem.",
  });

export type TransferFormValues = z.input<typeof transferSchema>;
export type TransferFormOutput = z.output<typeof transferSchema>;
export type TransferData = { fromWalletId: string; toWalletId: string; amountCents: number; date: Date; note: string | null };

export function toTransferData(p: TransferFormOutput): TransferData {
  return { fromWalletId: p.fromWalletId, toWalletId: p.toWalletId, amountCents: p.amount, date: p.date, note: p.note };
}

// ---------- Metas ----------

export const goalSchema = z.object({
  name: z
    .string({ error: "Informe o nome da meta." })
    .trim()
    .min(1, "Informe o nome da meta.")
    .max(60, "Use no máximo 60 caracteres."),
  /** Quanto quer juntar, ex.: "4.000,00". */
  target: moneyField,
  /** Até quando ("YYYY-MM-DD"), vazio = sem prazo. */
  targetDate: optionalDateField,
  color: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || /^#[0-9a-f]{6}$/.test(v), "Cor inválida. Use o formato #RRGGBB."),
});

export type GoalFormValues = z.input<typeof goalSchema>;
export type GoalFormOutput = z.output<typeof goalSchema>;
export type GoalData = { name: string; targetCents: number; targetDate: Date | null; color: string | null };

export function toGoalData(p: GoalFormOutput): GoalData {
  return { name: p.name, targetCents: p.target, targetDate: p.targetDate, color: p.color };
}

export const goalContributionSchema = z.object({
  /** "DEPOSIT" = guardei; "WITHDRAW" = tirei. */
  kind: z.enum(["DEPOSIT", "WITHDRAW"], { error: "Escolha guardar ou retirar." }).default("DEPOSIT"),
  amount: moneyField,
  date: z
    .string({ error: "Informe a data." })
    .refine(isValidDateInput, "Data inválida.")
    .transform(dateInputToUtc),
  note: optionalText(200),
});

export type GoalContributionFormValues = z.input<typeof goalContributionSchema>;
export type GoalContributionFormOutput = z.output<typeof goalContributionSchema>;
/** Valor com sinal: positivo guardou, negativo tirou. */
export type GoalContributionData = { amountCents: number; date: Date; note: string | null };

export function toGoalContributionData(p: GoalContributionFormOutput): GoalContributionData {
  return { amountCents: p.kind === "WITHDRAW" ? -p.amount : p.amount, date: p.date, note: p.note };
}

// ---------- Orçamento ----------

export const budgetSchema = z.object({
  categoryId: idField("Escolha uma categoria."),
  /** "YYYY-MM" (input type="month"). */
  month: monthField,
  /** Limite digitado em reais, ex.: "800,00". */
  limit: moneyField,
});

export type BudgetFormValues = z.input<typeof budgetSchema>;
/** O que o zodResolver entrega no handleSubmit (3º genérico do useForm). */
export type BudgetFormOutput = z.output<typeof budgetSchema>;
export type BudgetData = { categoryId: string; month: string; limitCents: number };

export function toBudgetData(parsed: z.output<typeof budgetSchema>): BudgetData {
  return { categoryId: parsed.categoryId, month: parsed.month, limitCents: parsed.limit };
}

// ---------- Filtros da lista de transações ----------

export type TransactionFilters = {
  /** Sempre preenchido ("YYYY-MM"). */
  month: string;
  type?: CategoryType;
  categoryId?: string;
  /** Só lançamentos desta conta (Wallet). */
  walletId?: string;
  /** Texto buscado na descrição. */
  q?: string;
};

export type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Lê os filtros da URL (searchParams). Valor inválido é ignorado.
 * Sem mês na URL, usa o mês atual.
 */
export function parseTransactionFilters(
  params: SearchParams,
  now: Date = new Date(),
): TransactionFilters {
  const one = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const month = one("month");
  const type = one("type");
  return {
    month: month && isValidMonth(month) ? month : currentMonth(now),
    type: type === "INCOME" || type === "EXPENSE" ? type : undefined,
    categoryId: one("categoryId"),
    walletId: one("walletId"),
    q: one("q")?.slice(0, 120),
  };
}

/** Transforma os erros do Zod em { campo: [mensagens] }. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
