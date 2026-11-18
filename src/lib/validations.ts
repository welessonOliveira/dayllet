// Schemas Zod usados no cliente (React Hook Form) e no servidor.
// Eles recebem o que o formulário manda (strings) e devolvem
// os dados prontos pro banco (centavos, Date, etc.).
import { z } from "zod";
import { CATEGORY_TYPES, TRANSACTION_STATUSES, type CategoryType } from "./constants";
import { currentMonth, dateInputToUtc, isValidDateInput, isValidMonth } from "./dates";
import { parseBRLToCents } from "./money";

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
  notes: optionalText(500),
});

/** O que o formulário de transação manda (tudo string). */
export type TransactionFormValues = z.input<typeof transactionSchema>;

/** Dados validados, prontos pro servidor. */
export type TransactionData = {
  description: string;
  amountCents: number;
  type: CategoryType;
  status: (typeof TRANSACTION_STATUSES)[number];
  date: Date;
  categoryId: string;
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

// ---------- Orçamento ----------

export const budgetSchema = z.object({
  categoryId: idField("Escolha uma categoria."),
  /** "YYYY-MM" (input type="month"). */
  month: monthField,
  /** Limite digitado em reais, ex.: "800,00". */
  limit: moneyField,
});

export type BudgetFormValues = z.input<typeof budgetSchema>;
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
