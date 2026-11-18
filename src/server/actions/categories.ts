"use server";
// Server Actions de categoria. São finas: validam, chamam src/server e revalidam.
import type { Category } from "@prisma/client";
import type { ActionResult } from "@/lib/errors";
import { type CategoryFormValues, categorySchema } from "@/lib/validations";
import { createCategory, deleteCategory, updateCategory } from "../categories";
import { prisma } from "../db";
import { INVALID_ID, isId, parseInput, runMutation } from "./run";

export async function createCategoryAction(
  input: CategoryFormValues,
): Promise<ActionResult<Category>> {
  const parsed = parseInput(categorySchema, input);
  if (!parsed.ok) return parsed.result;
  return runMutation(() => createCategory(prisma, parsed.data), "Categoria criada.");
}

export async function updateCategoryAction(
  id: string,
  input: CategoryFormValues,
): Promise<ActionResult<Category>> {
  if (!isId(id)) return INVALID_ID;
  const parsed = parseInput(categorySchema, input);
  if (!parsed.ok) return parsed.result;
  return runMutation(() => updateCategory(prisma, id, parsed.data), "Categoria atualizada.");
}

/** Bloqueia se tiver transações. Os orçamentos dela são apagados junto. */
export async function deleteCategoryAction(
  id: string,
): Promise<ActionResult<{ deletedBudgets: number }>> {
  if (!isId(id)) return INVALID_ID;
  return runMutation(() => deleteCategory(prisma, id), "Categoria excluída.");
}
