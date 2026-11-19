"use server";
// Server Actions de importação de extrato e regras de categoria.
import type { ImportRow } from "@prisma/client";
import { CATEGORY_TYPES, type CategoryType } from "@/lib/constants";
import { type ActionResult, DomainError, GENERIC_ERROR } from "@/lib/errors";
import { MAX_STATEMENT_BYTES } from "@/lib/statement";
import { deleteCategoryRule, suggestCategoryFor } from "../categoryRules";
import { type ImportSummary, commitImport, createImport, discardImport, undoImport, updateImportRow } from "../imports";
import { getActionCtx } from "../session";
import { INVALID_ID, NOT_LOGGED, isId, runMutation } from "./run";

/**
 * Upload do extrato. Use num <form> com `encType="multipart/form-data"` ou mande um FormData
 * com os campos `walletId` e `file` (OFX ou CSV, até 1 MB).
 * Devolve o id da importação pra abrir a tela de revisão.
 */
export async function createImportAction(
  formData: FormData,
): Promise<ActionResult<{ batchId: string; summary: ImportSummary; errors: string[] }>> {
  const walletId = formData.get("walletId");
  const file = formData.get("file");
  if (!isId(walletId)) return { ok: false, error: "Escolha a conta.", fieldErrors: { walletId: ["Escolha a conta."] } };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Escolha o arquivo do extrato.", fieldErrors: { file: ["Escolha o arquivo do extrato."] } };
  }
  if (file.size > MAX_STATEMENT_BYTES) {
    return { ok: false, error: "Arquivo grande demais (máximo 1 MB).", fieldErrors: { file: ["Máximo 1 MB."] } };
  }
  if (!/\.(ofx|csv|txt)$/i.test(file.name)) {
    return { ok: false, error: "Use um arquivo .ofx ou .csv.", fieldErrors: { file: ["Use um arquivo .ofx ou .csv."] } };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return runMutation(
    (ctx) => createImport(ctx, { walletId, fileName: file.name, bytes }),
    "Extrato lido. Revise os lançamentos antes de confirmar.",
  );
}

export async function updateImportRowAction(
  rowId: string,
  change: { decision?: "IMPORT" | "SKIP"; categoryId?: string | null },
): Promise<ActionResult<ImportRow & { similarUpdated: number }>> {
  if (!isId(rowId)) return INVALID_ID;
  if (change.decision && change.decision !== "IMPORT" && change.decision !== "SKIP") return INVALID_ID;
  if (change.categoryId !== undefined && change.categoryId !== null && !isId(change.categoryId)) return INVALID_ID;
  return runMutation((ctx) => updateImportRow(ctx, rowId, change), "Atualizado.");
}

export async function commitImportAction(
  batchId: string,
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  if (!isId(batchId)) return INVALID_ID;
  return runMutation((ctx) => commitImport(ctx, batchId), "Importação concluída.");
}

export async function discardImportAction(batchId: string): Promise<ActionResult<null>> {
  if (!isId(batchId)) return INVALID_ID;
  return runMutation(async (ctx) => {
    await discardImport(ctx, batchId);
    return null;
  }, "Importação descartada.");
}

/** Apaga os lançamentos criados por uma importação confirmada. */
export async function undoImportAction(batchId: string): Promise<ActionResult<{ deleted: number }>> {
  if (!isId(batchId)) return INVALID_ID;
  return runMutation((ctx) => undoImport(ctx, batchId), "Importação desfeita.");
}

export async function deleteCategoryRuleAction(id: string): Promise<ActionResult<null>> {
  if (!isId(id)) return INVALID_ID;
  return runMutation(async (ctx) => {
    await deleteCategoryRule(ctx, id);
    return null;
  }, "Regra apagada.");
}

/**
 * Sugestão de categoria enquanto o usuário digita a descrição (só leitura, não revalida nada).
 * Devolve o id da categoria sugerida ou null.
 */
export async function suggestCategoryAction(
  description: string,
  type: CategoryType,
): Promise<ActionResult<{ categoryId: string | null }>> {
  const ctx = await getActionCtx();
  if (!ctx) return NOT_LOGGED;
  if (typeof description !== "string" || !CATEGORY_TYPES.includes(type)) return INVALID_ID;
  try {
    const s = await suggestCategoryFor(ctx, description.slice(0, 120), type);
    return { ok: true, data: { categoryId: s?.categoryId ?? null }, message: "" };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: GENERIC_ERROR };
  }
}
