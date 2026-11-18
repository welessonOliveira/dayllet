// Importação de extrato (Decisão 20): arquivo -> área de revisão -> confirmação.
// Nada entra no extrato do usuário antes de ele confirmar.
import { createHash } from "node:crypto";
import type { Category, ImportBatch, ImportRow, Wallet } from "@prisma/client";
import { normalizeDescription, suggestCategory } from "@/lib/categorize";
import { checkCategoryType } from "@/lib/rules";
import { DomainError } from "@/lib/errors";
import { type StatementRow, parseStatement } from "@/lib/statement";
import { toDateInput } from "@/lib/dates";
import { learnCategory, loadRules } from "./categoryRules";
import type { Ctx } from "./context";
import { getOwnWallet } from "./wallets";

const NAO_ENCONTRADA = "Importação não encontrada.";
const DIA_MS = 24 * 60 * 60 * 1000;
/** Lançamento manual com mesmo valor e tipo até 2 dias de diferença = "possível duplicata". */
const JANELA_DUPLICATA_DIAS = 2;

export type ImportSummary = {
  total: number;
  toImport: number;
  duplicates: number;
  possibleDuplicates: number;
  withoutCategory: number;
};

export type ImportView = ImportBatch & {
  wallet: Wallet;
  rows: (ImportRow & { category: Category | null })[];
  summary: ImportSummary;
};

function sha256(s: string | Uint8Array): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Identidade de cada linha. OFX: o FITID do banco. CSV (ou OFX sem FITID): hash de
 * data + valor + descrição + "qual repetição é essa" (duas compras iguais no mesmo dia
 * são lançamentos diferentes, então a 2ª ganha #2).
 */
export function externalIds(rows: StatementRow[]): string[] {
  const vistos = new Map<string, number>();
  return rows.map((r) => {
    if (r.fitId) return `ofx:${r.fitId}`;
    const base = `${toDateInput(r.date)}|${r.signedCents}|${normalizeDescription(r.description)}`;
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    return `csv:${sha256(`${base}#${n}`).slice(0, 32)}`;
  });
}

function summarize(rows: Pick<ImportRow, "decision" | "duplicateOfId" | "possibleDuplicate" | "categoryId">[]): ImportSummary {
  return {
    total: rows.length,
    toImport: rows.filter((r) => r.decision === "IMPORT").length,
    duplicates: rows.filter((r) => r.duplicateOfId).length,
    possibleDuplicates: rows.filter((r) => r.possibleDuplicate).length,
    withoutCategory: rows.filter((r) => r.decision === "IMPORT" && !r.categoryId).length,
  };
}

async function getOwnBatch(ctx: Ctx, id: string): Promise<ImportBatch> {
  const b = await ctx.db.importBatch.findFirst({ where: { id, userId: ctx.userId } });
  if (!b) throw new DomainError(NAO_ENCONTRADA);
  return b;
}

/**
 * Lê o arquivo e cria a importação em revisão. Marca duplicatas (já importadas antes)
 * e possíveis duplicatas (parecidas com lançamentos manuais) como "pular", e sugere
 * categoria pelas regras aprendidas.
 */
export async function createImport(
  ctx: Ctx,
  input: { walletId: string; fileName: string; bytes: Uint8Array },
): Promise<{ batchId: string; summary: ImportSummary; errors: string[] }> {
  const wallet = await getOwnWallet(ctx, input.walletId);
  const fileHash = sha256(input.bytes);
  const repetido = await ctx.db.importBatch.findFirst({
    where: { userId: ctx.userId, walletId: wallet.id, fileHash, status: { not: "DISCARDED" } },
  });
  if (repetido) throw new DomainError("Esse arquivo já foi importado nessa conta.");

  const parsed = parseStatement(input.bytes);
  if (parsed.rows.length === 0) {
    throw new DomainError(parsed.errors[0] ?? "Não encontrei nenhum lançamento nesse arquivo.");
  }

  const ids = externalIds(parsed.rows);
  const datas = parsed.rows.map((r) => r.date.getTime());
  const [jaImportados, manuais, rules] = await Promise.all([
    ctx.db.transaction.findMany({
      where: { userId: ctx.userId, walletId: wallet.id, externalId: { in: ids } },
      select: { id: true, externalId: true },
    }),
    ctx.db.transaction.findMany({
      where: {
        userId: ctx.userId,
        walletId: wallet.id,
        externalId: null,
        date: {
          gte: new Date(Math.min(...datas) - JANELA_DUPLICATA_DIAS * DIA_MS),
          lte: new Date(Math.max(...datas) + JANELA_DUPLICATA_DIAS * DIA_MS),
        },
      },
      select: { id: true, date: true, amountCents: true, type: true },
    }),
    loadRules(ctx),
  ]);
  const porExternalId = new Map(jaImportados.map((t) => [t.externalId!, t.id]));
  const manuaisUsados = new Set<string>();

  const rows = parsed.rows.map((r, i) => {
    const type = r.signedCents < 0 ? ("EXPENSE" as const) : ("INCOME" as const);
    const amountCents = Math.abs(r.signedCents);
    const duplicateOfId = porExternalId.get(ids[i]) ?? null;
    let possibleDuplicate = false;
    if (!duplicateOfId) {
      const parecido = manuais.find(
        (m) =>
          !manuaisUsados.has(m.id) &&
          m.type === type &&
          m.amountCents === amountCents &&
          Math.abs(m.date.getTime() - r.date.getTime()) <= JANELA_DUPLICATA_DIAS * DIA_MS,
      );
      if (parecido) {
        possibleDuplicate = true;
        manuaisUsados.add(parecido.id); // um manual só "explica" uma linha
      }
    }
    const sugestao = suggestCategory(r.description, type, rules);
    return {
      position: i,
      date: r.date,
      amountCents,
      type,
      description: r.description,
      externalId: ids[i],
      suggestedCategoryId: sugestao?.categoryId ?? null,
      categoryId: sugestao?.categoryId ?? null,
      duplicateOfId,
      possibleDuplicate,
      decision: duplicateOfId || possibleDuplicate ? ("SKIP" as const) : ("IMPORT" as const),
    };
  });

  const batch = await ctx.db.$transaction(async (tx) => {
    const b = await tx.importBatch.create({
      data: {
        userId: ctx.userId,
        walletId: wallet.id,
        fileName: input.fileName.slice(0, 120),
        fileHash,
        format: parsed.format,
      },
    });
    await tx.importRow.createMany({ data: rows.map((r) => ({ ...r, batchId: b.id })) });
    return b;
  });
  return { batchId: batch.id, summary: summarize(rows), errors: parsed.errors };
}

/** Importação com as linhas (em ordem) e o resumo. */
export async function getImport(ctx: Ctx, id: string): Promise<ImportView | null> {
  const b = await ctx.db.importBatch.findFirst({
    where: { id, userId: ctx.userId },
    include: { wallet: true, rows: { orderBy: { position: "asc" } } },
  });
  if (!b) return null;
  const cats = await ctx.db.category.findMany({ where: { userId: ctx.userId } });
  const porId = new Map(cats.map((c) => [c.id, c]));
  const rows = b.rows.map((r) => ({ ...r, category: r.categoryId ? (porId.get(r.categoryId) ?? null) : null }));
  return { ...b, rows, summary: summarize(rows) };
}

/** Últimas importações (as em revisão primeiro). */
export async function listImports(ctx: Ctx) {
  const batches = await ctx.db.importBatch.findMany({
    where: { userId: ctx.userId, status: { not: "DISCARDED" } },
    include: { wallet: true, _count: { select: { rows: true, transactions: true } } },
    orderBy: [{ status: "desc" }, { createdAt: "desc" }],
    take: 30,
  });
  return batches.map(({ _count, ...b }) => ({ ...b, rowCount: _count.rows, importedCount: _count.transactions }));
}

/** Muda a decisão (importar/pular) e/ou a categoria de uma linha em revisão. */
export async function updateImportRow(
  ctx: Ctx,
  rowId: string,
  change: { decision?: "IMPORT" | "SKIP"; categoryId?: string | null },
): Promise<ImportRow> {
  const row = await ctx.db.importRow.findFirst({
    where: { id: rowId, batch: { userId: ctx.userId } },
    include: { batch: true },
  });
  if (!row) throw new DomainError("Linha não encontrada.");
  if (row.batch.status !== "REVIEW") throw new DomainError("Essa importação já foi concluída.");

  if (change.categoryId) {
    const cat = await ctx.db.category.findFirst({ where: { id: change.categoryId, userId: ctx.userId } });
    if (!cat) throw new DomainError("Categoria não encontrada.");
    const erro = checkCategoryType(row.type, cat.type);
    if (erro) throw new DomainError(erro);
  }
  return ctx.db.importRow.update({
    where: { id: rowId },
    data: {
      ...(change.decision && { decision: change.decision }),
      ...(change.categoryId !== undefined && { categoryId: change.categoryId }),
    },
  });
}

/**
 * Confirma: as linhas marcadas pra importar viram transações PAGAS na conta.
 * Toda linha a importar precisa de categoria. Aprende as categorias escolhidas.
 */
export async function commitImport(ctx: Ctx, batchId: string): Promise<{ imported: number; skipped: number }> {
  const batch = await getOwnBatch(ctx, batchId);
  if (batch.status !== "REVIEW") throw new DomainError("Essa importação já foi concluída.");
  const rows = await ctx.db.importRow.findMany({ where: { batchId }, orderBy: { position: "asc" } });
  const aImportar = rows.filter((r) => r.decision === "IMPORT");
  const semCategoria = aImportar.filter((r) => !r.categoryId).length;
  if (semCategoria > 0) {
    throw new DomainError(
      `Escolha a categoria de ${semCategoria} ${semCategoria === 1 ? "lançamento" : "lançamentos"} antes de confirmar (ou marque pra pular).`,
    );
  }
  // Categoria apagada no meio do caminho? Confere de novo.
  const cats = await ctx.db.category.findMany({
    where: { userId: ctx.userId, id: { in: [...new Set(aImportar.map((r) => r.categoryId!))] } },
  });
  const tipoDa = new Map(cats.map((c) => [c.id, c.type]));
  for (const r of aImportar) {
    if (tipoDa.get(r.categoryId!) !== r.type) throw new DomainError(`Categoria inválida em "${r.description}".`);
  }

  const imported = await ctx.db.$transaction(async (tx) => {
    const res = await tx.transaction.createMany({
      data: aImportar.map((r) => ({
        userId: ctx.userId,
        walletId: batch.walletId,
        categoryId: r.categoryId!,
        type: r.type,
        status: "PAID" as const,
        description: r.description,
        amountCents: r.amountCents,
        date: r.date,
        importBatchId: batch.id,
        externalId: r.externalId,
      })),
      skipDuplicates: true, // (walletId, externalId) único: nunca duplica
    });
    await tx.importBatch.update({ where: { id: batch.id }, data: { status: "COMMITTED", committedAt: new Date() } });
    return res.count;
  });

  for (const r of aImportar) await learnCategory(ctx, r.description, r.categoryId!);
  return { imported, skipped: rows.length - imported };
}

/** Descarta uma importação em revisão (nada foi lançado). */
export async function discardImport(ctx: Ctx, batchId: string): Promise<void> {
  const batch = await getOwnBatch(ctx, batchId);
  if (batch.status !== "REVIEW") throw new DomainError("Só dá pra descartar uma importação em revisão.");
  await ctx.db.$transaction([
    ctx.db.importRow.deleteMany({ where: { batchId } }),
    ctx.db.importBatch.update({ where: { id: batchId }, data: { status: "DISCARDED" } }),
  ]);
}

/** Desfaz uma importação confirmada: apaga os lançamentos que ela criou. */
export async function undoImport(ctx: Ctx, batchId: string): Promise<{ deleted: number }> {
  const batch = await getOwnBatch(ctx, batchId);
  if (batch.status !== "COMMITTED") throw new DomainError("Só dá pra desfazer uma importação confirmada.");
  return ctx.db.$transaction(async (tx) => {
    const r = await tx.transaction.deleteMany({ where: { userId: ctx.userId, importBatchId: batchId } });
    await tx.importRow.deleteMany({ where: { batchId } });
    await tx.importBatch.update({ where: { id: batchId }, data: { status: "DISCARDED" } });
    return { deleted: r.count };
  });
}
