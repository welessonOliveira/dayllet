"use server";
// Server Actions do comprovante: anexar/trocar e remover.
import type { ActionResult } from "@/lib/errors";
import { type AttachmentInfo, deleteAttachment, saveAttachment } from "../attachments";
import { INVALID_ID, isId, runMutation } from "./run";

/** Recebe um FormData com o campo "file". */
export async function uploadAttachmentAction(
  transactionId: string,
  formData: FormData,
): Promise<ActionResult<AttachmentInfo>> {
  if (!isId(transactionId)) return INVALID_ID;
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Escolha um arquivo." };
  return runMutation(
    async (ctx) => saveAttachment(ctx, transactionId, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }),
    "Comprovante anexado.",
  );
}

export async function deleteAttachmentAction(transactionId: string): Promise<ActionResult<null>> {
  if (!isId(transactionId)) return INVALID_ID;
  return runMutation(async (ctx) => {
    await deleteAttachment(ctx, transactionId);
    return null;
  }, "Comprovante removido.");
}
