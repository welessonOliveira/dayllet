"use server";
// Server Actions de transferência entre contas.
import type { Transfer } from "@prisma/client";
import type { ActionResult } from "@/lib/errors";
import { type TransferFormValues, toTransferData, transferSchema } from "@/lib/validations";
import { createTransfer, deleteTransfer } from "../transfers";
import { INVALID_ID, isId, parseInput, runMutation } from "./run";

export async function createTransferAction(input: TransferFormValues): Promise<ActionResult<Transfer>> {
  const parsed = parseInput(transferSchema, input);
  if (!parsed.ok) return parsed.result;
  return runMutation((ctx) => createTransfer(ctx, toTransferData(parsed.data)), "Transferência feita.");
}

export async function deleteTransferAction(id: string): Promise<ActionResult<null>> {
  if (!isId(id)) return INVALID_ID;
  return runMutation(async (ctx) => {
    await deleteTransfer(ctx, id);
    return null;
  }, "Transferência apagada.");
}
