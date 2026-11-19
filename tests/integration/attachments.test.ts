// Comprovantes: anexar, trocar, limites e isolamento entre usuários.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ATTACHMENT_DEMO_QUOTA_BYTES, ATTACHMENT_MAX_BYTES } from "@/lib/attachments";
import { toTransactionData, transactionSchema } from "@/lib/validations";
import { deleteAttachment, getAttachmentFile, saveAttachment } from "@/server/attachments";
import { createCategory } from "@/server/categories";
import type { Ctx } from "@/server/context";
import { deleteTransaction, getTransaction, listTransactions, createTransaction } from "@/server/transactions";
import { createWallet } from "@/server/wallets";
import { TEST_DATABASE_URL } from "../test-db";

const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
let ana: Ctx;
let bruno: Ctx;
let txId: string;

/** Um "PDF" de n bytes (só a assinatura importa). */
const pdf = (n = 100) => {
  const b = new Uint8Array(n);
  b.set(new TextEncoder().encode("%PDF-1.7\n"));
  return b;
};

let seq = 0;
async function novoLancamento(ctx: Ctx) {
  const n = ++seq;
  const wallet = await createWallet(ctx, { name: `Corrente ${n}`, kind: "CHECKING", openingBalanceCents: 0 });
  const cat = await createCategory(ctx, { name: `Mercado ${n}`, type: "EXPENSE", color: null });
  const tx = await createTransaction(
    ctx,
    toTransactionData(
      transactionSchema.parse({ description: "Feira", amount: "30,00", type: "EXPENSE", status: "PAID", date: "2026-11-10", categoryId: cat.id, walletId: wallet.id }),
    ),
  );
  return tx.id;
}

beforeEach(async () => {
  await db.transaction.deleteMany();
  await db.user.deleteMany();
  ana = { db, userId: (await db.user.create({ data: { email: "ana@anexo.local" } })).id };
  bruno = { db, userId: (await db.user.create({ data: { email: "bruno@anexo.local" } })).id };
  txId = await novoLancamento(ana);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("saveAttachment", () => {
  it("anexa, aparece na lista (sem o arquivo) e troca pelo novo", async () => {
    const info = await saveAttachment(ana, txId, { name: "recibo.pdf", bytes: pdf(200) });
    expect(info).toMatchObject({ fileName: "recibo.pdf", mimeType: "application/pdf", sizeBytes: 200 });

    const [tx] = await listTransactions(ana, { month: "2026-11" });
    expect(tx.attachment).toEqual(info);
    expect(tx.attachment).not.toHaveProperty("data");

    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    await saveAttachment(ana, txId, { name: "foto.jpg", bytes: jpg });
    const file = await getAttachmentFile(ana, txId);
    expect(file?.mimeType).toBe("image/jpeg");
    expect(Array.from(file?.data ?? [])).toEqual(Array.from(jpg));
    expect(await db.attachment.count()).toBe(1);
  });

  it("recusa tipo errado, arquivo vazio e grande demais", async () => {
    const html = new TextEncoder().encode("<script>alert(1)</script>");
    await expect(saveAttachment(ana, txId, { name: "x.pdf", bytes: html })).rejects.toThrow(/foto|PDF/);
    await expect(saveAttachment(ana, txId, { name: "x.pdf", bytes: new Uint8Array() })).rejects.toThrow(/vazio/);
    await expect(saveAttachment(ana, txId, { name: "x.pdf", bytes: pdf(ATTACHMENT_MAX_BYTES + 1) })).rejects.toThrow(/até/);
  });

  it("respeita o limite de espaço da demo", async () => {
    await db.user.update({ where: { id: ana.userId }, data: { isDemo: true } });
    const outros = await Promise.all(Array.from({ length: 4 }, () => novoLancamento(ana)));
    const grande = Math.floor(ATTACHMENT_DEMO_QUOTA_BYTES / 4);
    for (const id of outros) await saveAttachment(ana, id, { name: "a.pdf", bytes: pdf(grande) });
    await expect(saveAttachment(ana, txId, { name: "b.pdf", bytes: pdf(1000) })).rejects.toThrow(/limite/);
    // Trocar um que já existe por outro do mesmo tamanho continua valendo.
    await expect(saveAttachment(ana, outros[0], { name: "c.pdf", bytes: pdf(grande) })).resolves.toBeTruthy();
  });

  it("apagar o lançamento apaga o comprovante", async () => {
    await saveAttachment(ana, txId, { name: "r.pdf", bytes: pdf() });
    await deleteTransaction(ana, txId);
    expect(await db.attachment.count()).toBe(0);
  });

  it("remove o comprovante", async () => {
    await saveAttachment(ana, txId, { name: "r.pdf", bytes: pdf() });
    await deleteAttachment(ana, txId);
    expect((await getTransaction(ana, txId))?.attachment).toBeNull();
    await expect(deleteAttachment(ana, txId)).rejects.toThrow(/não encontrado/);
  });
});

describe("isolamento (IDOR)", () => {
  it("outro usuário não anexa, não abre e não apaga", async () => {
    await saveAttachment(ana, txId, { name: "r.pdf", bytes: pdf() });
    await expect(saveAttachment(bruno, txId, { name: "x.pdf", bytes: pdf() })).rejects.toThrow(/não encontrada/);
    expect(await getAttachmentFile(bruno, txId)).toBeNull();
    await expect(deleteAttachment(bruno, txId)).rejects.toThrow(/não encontrado/);
    expect(await db.attachment.count()).toBe(1);
  });
});
