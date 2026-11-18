"use server";
// Server Actions de conta fixa / parcelado. São finas: validam, chamam src/server e revalidam.
import type { RecurringRule } from "@prisma/client";
import type { ActionResult } from "@/lib/errors";
import { type RecurringRuleFormValues, recurringRuleSchema } from "@/lib/validations";
import {
  createRecurringRule,
  deleteRecurringRule,
  setRecurringRuleActive,
  updateRecurringRule,
} from "../recurring";
import { INVALID_ID, isId, parseInput, runMutation } from "./run";

export async function createRecurringRuleAction(
  input: RecurringRuleFormValues,
): Promise<ActionResult<RecurringRule>> {
  const parsed = parseInput(recurringRuleSchema, input);
  if (!parsed.ok) return parsed.result;
  const msg = parsed.data.installments ? "Parcelamento criado." : "Conta fixa criada.";
  return runMutation((ctx) => createRecurringRule(ctx, parsed.data), msg);
}

/** Vale só pra frente: o que já passou ou foi pago não muda. */
export async function updateRecurringRuleAction(
  id: string,
  input: RecurringRuleFormValues,
): Promise<ActionResult<RecurringRule>> {
  if (!isId(id)) return INVALID_ID;
  const parsed = parseInput(recurringRuleSchema, input);
  if (!parsed.ok) return parsed.result;
  return runMutation(
    (ctx) => updateRecurringRule(ctx, id, parsed.data),
    "Atualizado. As mudanças valem daqui pra frente.",
  );
}

/** Pausar (active = false) apaga as futuras pendentes; retomar volta a gerar. */
export async function setRecurringRuleActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult<RecurringRule>> {
  if (!isId(id) || typeof active !== "boolean") return INVALID_ID;
  return runMutation((ctx) => setRecurringRuleActive(ctx, id, active), active ? "Retomado." : "Pausado.");
}

/** Mantém o histórico; apaga só as futuras pendentes. */
export async function deleteRecurringRuleAction(
  id: string,
): Promise<ActionResult<{ deletedFuture: number }>> {
  if (!isId(id)) return INVALID_ID;
  return runMutation((ctx) => deleteRecurringRule(ctx, id), "Excluído. O histórico foi mantido.");
}
