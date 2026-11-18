"use server";
// Server Actions de metas. São finas: validam, chamam src/server e revalidam.
import type { Goal, GoalContribution } from "@prisma/client";
import type { ActionResult } from "@/lib/errors";
import {
  type GoalContributionFormValues,
  type GoalFormValues,
  goalContributionSchema,
  goalSchema,
  toGoalContributionData,
  toGoalData,
} from "@/lib/validations";
import {
  addGoalContribution,
  createGoal,
  deleteGoal,
  deleteGoalContribution,
  setGoalArchived,
  updateGoal,
} from "../goals";
import { INVALID_ID, isId, parseInput, runMutation } from "./run";

export async function createGoalAction(input: GoalFormValues): Promise<ActionResult<Goal>> {
  const parsed = parseInput(goalSchema, input);
  if (!parsed.ok) return parsed.result;
  return runMutation((ctx) => createGoal(ctx, toGoalData(parsed.data)), "Meta criada.");
}

export async function updateGoalAction(id: string, input: GoalFormValues): Promise<ActionResult<Goal>> {
  if (!isId(id)) return INVALID_ID;
  const parsed = parseInput(goalSchema, input);
  if (!parsed.ok) return parsed.result;
  return runMutation((ctx) => updateGoal(ctx, id, toGoalData(parsed.data)), "Meta atualizada.");
}

export async function setGoalArchivedAction(id: string, archived: boolean): Promise<ActionResult<Goal>> {
  if (!isId(id) || typeof archived !== "boolean") return INVALID_ID;
  return runMutation((ctx) => setGoalArchived(ctx, id, archived), archived ? "Meta arquivada." : "Meta reativada.");
}

export async function deleteGoalAction(id: string): Promise<ActionResult<null>> {
  if (!isId(id)) return INVALID_ID;
  return runMutation(async (ctx) => {
    await deleteGoal(ctx, id);
    return null;
  }, "Meta excluída.");
}

export async function addGoalContributionAction(
  goalId: string,
  input: GoalContributionFormValues,
): Promise<ActionResult<GoalContribution>> {
  if (!isId(goalId)) return INVALID_ID;
  const parsed = parseInput(goalContributionSchema, input);
  if (!parsed.ok) return parsed.result;
  const data = toGoalContributionData(parsed.data);
  return runMutation(
    (ctx) => addGoalContribution(ctx, goalId, data),
    data.amountCents > 0 ? "Valor guardado na meta." : "Valor retirado da meta.",
  );
}

export async function deleteGoalContributionAction(id: string): Promise<ActionResult<null>> {
  if (!isId(id)) return INVALID_ID;
  return runMutation(async (ctx) => {
    await deleteGoalContribution(ctx, id);
    return null;
  }, "Movimentação apagada.");
}
