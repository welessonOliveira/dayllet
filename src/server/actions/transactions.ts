"use server";
// Server Actions de transação. São finas: validam, chamam src/server e revalidam.
import type { Transaction } from "@prisma/client";
import { TRANSACTION_STATUSES, type TransactionStatus } from "@/lib/constants";
import type { ActionResult } from "@/lib/errors";
import {
  type TransactionFormValues,
  toTransactionData,
  transactionSchema,
} from "@/lib/validations";
import {
  createTransaction,
  deleteTransaction,
  setTransactionStatus,
  updateTransaction,
} from "../transactions";
import { INVALID_ID, isId, parseInput, runMutation } from "./run";

export async function createTransactionAction(
  input: TransactionFormValues,
): Promise<ActionResult<Transaction>> {
  const parsed = parseInput(transactionSchema, input);
  if (!parsed.ok) return parsed.result;
  return runMutation(
    (ctx) => createTransaction(ctx, toTransactionData(parsed.data)),
    "Transação criada.",
  );
}

export async function updateTransactionAction(
  id: string,
  input: TransactionFormValues,
): Promise<ActionResult<Transaction>> {
  if (!isId(id)) return INVALID_ID;
  const parsed = parseInput(transactionSchema, input);
  if (!parsed.ok) return parsed.result;
  return runMutation(
    (ctx) => updateTransaction(ctx, id, toTransactionData(parsed.data)),
    "Transação atualizada.",
  );
}

export async function setTransactionStatusAction(
  id: string,
  status: TransactionStatus,
): Promise<ActionResult<Transaction>> {
  if (!isId(id)) return INVALID_ID;
  if (!TRANSACTION_STATUSES.includes(status)) {
    return { ok: false, error: "Status inválido." };
  }
  return runMutation((ctx) => setTransactionStatus(ctx, id, status), "Status atualizado.");
}

export async function deleteTransactionAction(id: string): Promise<ActionResult<null>> {
  if (!isId(id)) return INVALID_ID;
  return runMutation(async (ctx) => {
    await deleteTransaction(ctx, id);
    return null;
  }, "Transação excluída.");
}
