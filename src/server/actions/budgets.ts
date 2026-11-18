"use server";
// Server Actions de orçamento. São finas: validam, chamam src/server e revalidam.
import type { Budget } from "@prisma/client";
import type { ActionResult } from "@/lib/errors";
import { type BudgetFormValues, budgetSchema, toBudgetData } from "@/lib/validations";
import { createBudget, deleteBudget, updateBudget } from "../budgets";
import { INVALID_ID, isId, parseInput, runMutation } from "./run";

export async function createBudgetAction(
  input: BudgetFormValues,
): Promise<ActionResult<Budget>> {
  const parsed = parseInput(budgetSchema, input);
  if (!parsed.ok) return parsed.result;
  return runMutation((ctx) => createBudget(ctx, toBudgetData(parsed.data)), "Orçamento criado.");
}

export async function updateBudgetAction(
  id: string,
  input: BudgetFormValues,
): Promise<ActionResult<Budget>> {
  if (!isId(id)) return INVALID_ID;
  const parsed = parseInput(budgetSchema, input);
  if (!parsed.ok) return parsed.result;
  return runMutation(
    (ctx) => updateBudget(ctx, id, toBudgetData(parsed.data)),
    "Orçamento atualizado.",
  );
}

export async function deleteBudgetAction(id: string): Promise<ActionResult<null>> {
  if (!isId(id)) return INVALID_ID;
  return runMutation(async (ctx) => {
    await deleteBudget(ctx, id);
    return null;
  }, "Orçamento excluído.");
}
