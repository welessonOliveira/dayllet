// Comprovantes (foto ou PDF) dos lançamentos. Sempre com { db, userId }.
import {
  ATTACHMENT_DEMO_QUOTA_BYTES,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_QUOTA_BYTES,
  cleanFileName,
  detectAttachmentMime,
  formatBytes,
} from "@/lib/attachments";
import { DomainError } from "@/lib/errors";
import type { Ctx } from "./context";

/** O que a lista de transações recebe (sem o arquivo em si, que é pesado). */
export type AttachmentInfo = { id: string; fileName: string; mimeType: string; sizeBytes: number };

export const ATTACHMENT_INFO_SELECT = { id: true, fileName: true, mimeType: true, sizeBytes: true } as const;

const NAO_ENCONTRADA = "Transação não encontrada.";

/** Anexa (ou troca) o comprovante de um lançamento do usuário. */
export async function saveAttachment(
  ctx: Ctx,
  transactionId: string,
  file: { name: string; bytes: Uint8Array<ArrayBuffer> },
): Promise<AttachmentInfo> {
  const tx = await ctx.db.transaction.findFirst({ where: { id: transactionId, userId: ctx.userId }, select: { id: true } });
  if (!tx) throw new DomainError(NAO_ENCONTRADA);
  if (file.bytes.length === 0) throw new DomainError("O arquivo está vazio.");
  if (file.bytes.length > ATTACHMENT_MAX_BYTES) {
    throw new DomainError(`O comprovante pode ter até ${formatBytes(ATTACHMENT_MAX_BYTES)}.`);
  }
  const mimeType = detectAttachmentMime(file.bytes);
  if (!mimeType) throw new DomainError("Envie uma foto (JPG, PNG ou WebP) ou um PDF.");

  // Espaço usado, sem contar o comprovante que vai ser trocado.
  const [user, usado] = await Promise.all([
    ctx.db.user.findUnique({ where: { id: ctx.userId }, select: { isDemo: true } }),
    ctx.db.attachment.aggregate({
      where: { userId: ctx.userId, transactionId: { not: transactionId } },
      _sum: { sizeBytes: true },
    }),
  ]);
  const cota = user?.isDemo ? ATTACHMENT_DEMO_QUOTA_BYTES : ATTACHMENT_QUOTA_BYTES;
  if ((usado._sum.sizeBytes ?? 0) + file.bytes.length > cota) {
    throw new DomainError(`Você chegou no limite de ${formatBytes(cota)} de comprovantes. Apague algum antigo pra liberar espaço.`);
  }

  const dados = {
    fileName: cleanFileName(file.name),
    mimeType,
    sizeBytes: file.bytes.length,
    data: file.bytes,
  };
  return ctx.db.attachment.upsert({
    where: { transactionId },
    create: { ...dados, userId: ctx.userId, transactionId },
    update: { ...dados, createdAt: new Date() },
    select: ATTACHMENT_INFO_SELECT,
  });
}

/** O comprovante com o arquivo (pra rota de download). null se não existe ou não é do usuário. */
export function getAttachmentFile(ctx: Ctx, transactionId: string) {
  return ctx.db.attachment.findFirst({
    where: { transactionId, userId: ctx.userId },
    select: { fileName: true, mimeType: true, sizeBytes: true, data: true },
  });
}

/** Tira o comprovante do lançamento. */
export async function deleteAttachment(ctx: Ctx, transactionId: string): Promise<void> {
  const { count } = await ctx.db.attachment.deleteMany({ where: { transactionId, userId: ctx.userId } });
  if (count === 0) throw new DomainError("Comprovante não encontrado.");
}
