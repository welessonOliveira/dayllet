// Importação de extrato (Decisão 20): arquivo -> área de revisão -> confirmação.
// Nada entra no extrato do usuário antes de ele confirmar.
import { createHash } from "node:crypto";
import type { Category, ImportBatch, ImportRow, Wallet } from "@prisma/client";
import { normalizeDescription, ruleKey, suggestWithBuiltins } from "@/lib/categorize";
import { checkCategoryType } from "@/lib/rules";
import { DomainError } from "@/lib/errors";
import { type StatementRow, parseStatement } from "@/lib/statement";
import { toDateInput } from "@/lib/dates";
import { learnCategory, loadBuiltinRules, loadRules } from "./categoryRules";
import type { Ctx } from "./context";
import { getOwnWallet } from "./wallets";
import { TRANSFER_KIND_NOTE, detectTransfer, suggestTransferWallet } from "@/lib/transferDetect";

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
  rows: (ImportRow & { category: Category | null; transferWallet: Wallet | null })[];
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

function summarize(
  rows: Pick<ImportRow, "decision" | "duplicateOfId" | "possibleDuplicate" | "categoryId" | "transferWalletId">[],
): ImportSummary {
  return {
    total: rows.length,
    toImport: rows.filter((r) => r.decision === "IMPORT").length,
    duplicates: rows.filter((r) => r.duplicateOfId).length,
    possibleDuplicates: rows.filter((r) => r.possibleDuplicate).length,
    // Linha resolvida = tem categoria OU virou transferência pra outra conta.
    withoutCategory: rows.filter((r) => r.decision === "IMPORT" && !r.categoryId && !r.transferWalletId).length,
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

  const parsed = parseStatement(input.bytes, { cardMode: wallet.kind === "CREDIT_CARD" });
  if (parsed.rows.length === 0) {
    throw new DomainError(parsed.errors[0] ?? "Não encontrei nenhum lançamento nesse arquivo.");
  }

  const ids = externalIds(parsed.rows);
  const datas = parsed.rows.map((r) => r.date.getTime());
  const [jaImportados, manuais, rules, builtins, dono, outrasContas] = await Promise.all([
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
    loadBuiltinRules(ctx),
    ctx.db.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
    ctx.db.wallet.findMany({ where: { userId: ctx.userId, id: { not: wallet.id } }, select: { id: true, kind: true, isDefault: true } }),
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
    const tipoTransf = detectTransfer(r.description, type, dono?.name, wallet.kind);
    const outraConta = tipoTransf ? suggestTransferWallet(tipoTransf, outrasContas) : null;
    const sugestao = tipoTransf ? null : suggestWithBuiltins(r.description, type, rules, builtins);
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
      decision: (duplicateOfId || possibleDuplicate ? "SKIP" : "IMPORT") as "IMPORT" | "SKIP",
      note: (tipoTransf ? TRANSFER_KIND_NOTE[tipoTransf] : null) as string | null,
      looksLikeTransfer: Boolean(tipoTransf),
      transferWalletId: outraConta,
    };
  });

  marcarEstornos(rows);
  await marcarTransferenciasRepetidas(ctx, wallet.id, rows);

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

const ESTORNO = /\b(ESTORN\w*|DEVOLU\w*|REEMBOLS\w*|CHARGEBACK)\b/;

/** "2026-11-13" -> "13/11". */
function diaMes(d: Date): string {
  const [, m, dia] = toDateInput(d).split("-");
  return `${dia}/${m}`;
}

/**
 * Estorno (entrada "Compra estornada - Uber") que tem a compra original no mesmo arquivo
 * (saída do mesmo valor e do mesmo estabelecimento, antes dele): as duas se anulam e ficam
 * de fora, com um aviso. Estorno sem a compra no arquivo entra normal (sugestão: "Reembolsos").
 * Muda as linhas no lugar.
 */
export function marcarEstornos(
  rows: { date: Date; amountCents: number; type: "INCOME" | "EXPENSE"; description: string; decision: "IMPORT" | "SKIP"; note: string | null }[],
): void {
  const usadas = new Set<number>();
  for (const r of rows) {
    if (r.type !== "INCOME" || !ESTORNO.test(normalizeDescription(r.description))) continue;
    const chave = ruleKey(r.description);
    let melhor = -1;
    rows.forEach((o, j) => {
      if (usadas.has(j) || o.type !== "EXPENSE" || o.amountCents !== r.amountCents || o.date > r.date) return;
      if (chave && ruleKey(o.description) !== chave) return;
      if (melhor < 0 || o.date > rows[melhor].date) melhor = j; // a compra mais recente antes do estorno
    });
    if (melhor < 0) continue;
    usadas.add(melhor);
    const compra = rows[melhor];
    compra.decision = "SKIP";
    compra.note = `Estornada em ${diaMes(r.date)}: as duas ficam de fora`;
    r.decision = "SKIP";
    r.note = `Estorno da compra de ${diaMes(compra.date)}: as duas ficam de fora`;
  }
}

const JANELA_TRANSFERENCIA_MS = 3 * DIA_MS;

/** Contas (de, para) da transferência que a linha vira: saída sai desta conta, entrada chega nela. */
function ladosDaTransferencia(type: "INCOME" | "EXPENSE", contaDoExtrato: string, outra: string) {
  return type === "EXPENSE" ? { fromWalletId: contaDoExtrato, toWalletId: outra } : { fromWalletId: outra, toWalletId: contaDoExtrato };
}

/**
 * O mesmo Pix aparece nos DOIS extratos (sai do Nubank, entra no PicPay). Se a transferência
 * já está no app (veio do outro extrato), a linha fica de fora pra não contar duas vezes.
 */
async function marcarTransferenciasRepetidas(
  ctx: Ctx,
  contaDoExtrato: string,
  rows: { date: Date; amountCents: number; type: "INCOME" | "EXPENSE"; decision: "IMPORT" | "SKIP"; note: string | null; transferWalletId: string | null; possibleDuplicate: boolean }[],
): Promise<void> {
  const comConta = rows.filter((r) => r.transferWalletId);
  if (comConta.length === 0) return;
  const datas = comConta.map((r) => r.date.getTime());
  const existentes = await ctx.db.transfer.findMany({
    where: {
      userId: ctx.userId,
      OR: [{ fromWalletId: contaDoExtrato }, { toWalletId: contaDoExtrato }],
      date: { gte: new Date(Math.min(...datas) - JANELA_TRANSFERENCIA_MS), lte: new Date(Math.max(...datas) + JANELA_TRANSFERENCIA_MS) },
    },
    select: { id: true, fromWalletId: true, toWalletId: true, amountCents: true, date: true },
  });
  const usadas = new Set<string>();
  for (const r of comConta) {
    const lados = ladosDaTransferencia(r.type, contaDoExtrato, r.transferWalletId!);
    const igual = existentes.find(
      (t) =>
        !usadas.has(t.id) &&
        t.fromWalletId === lados.fromWalletId &&
        t.toWalletId === lados.toWalletId &&
        t.amountCents === r.amountCents &&
        Math.abs(t.date.getTime() - r.date.getTime()) <= JANELA_TRANSFERENCIA_MS,
    );
    if (!igual) continue;
    usadas.add(igual.id);
    r.decision = "SKIP";
    r.possibleDuplicate = true;
    r.note = "Essa transferência já está no app (veio do extrato da outra conta)";
  }
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
  const contas = await ctx.db.wallet.findMany({ where: { userId: ctx.userId } });
  const contaPorId = new Map(contas.map((w) => [w.id, w]));
  const rows = b.rows.map((r) => ({
    ...r,
    category: r.categoryId ? (porId.get(r.categoryId) ?? null) : null,
    transferWallet: r.transferWalletId ? (contaPorId.get(r.transferWalletId) ?? null) : null,
  }));
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

/**
 * Muda a decisão (importar/pular) e/ou a categoria de uma linha em revisão.
 * Ao escolher a categoria, ela vale também pras linhas PARECIDAS do mesmo arquivo
 * (mesmo estabelecimento/pessoa e mesmo tipo): marcou um Uber, todos os Uber vão junto.
 * Só mexe nas parecidas que o usuário ainda não escolheu na mão (`categoryChosen`).
 * Já aprende a regra, pra próxima importação vir certa.
 */
export async function updateImportRow(
  ctx: Ctx,
  rowId: string,
  change: { decision?: "IMPORT" | "SKIP"; categoryId?: string | null; transferWalletId?: string | null },
): Promise<ImportRow & { similarUpdated: number }> {
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
  if (change.transferWalletId) {
    if (change.transferWalletId === row.batch.walletId) throw new DomainError("Escolha uma conta diferente da do extrato.");
    await getOwnWallet(ctx, change.transferWalletId);
  }
  // Categoria e transferência são caminhos excludentes: escolher um limpa o outro.
  const escolha =
    change.transferWalletId !== undefined
      ? { transferWalletId: change.transferWalletId, categoryId: null, categoryChosen: change.transferWalletId !== null }
      : change.categoryId !== undefined
        ? { categoryId: change.categoryId, transferWalletId: null, categoryChosen: change.categoryId !== null }
        : {};
  const atualizada = await ctx.db.importRow.update({
    where: { id: rowId },
    data: { ...(change.decision && { decision: change.decision }), ...escolha },
  });

  let similarUpdated = 0;
  const destino = change.categoryId ? { categoryId: change.categoryId, transferWalletId: null } : change.transferWalletId ? { transferWalletId: change.transferWalletId, categoryId: null } : null;
  const chave = destino ? ruleKey(row.description) : null;
  if (destino && chave) {
    const irmas = await ctx.db.importRow.findMany({
      // Só as que o usuário não escolheu na mão.
      where: { batchId: row.batchId, type: row.type, id: { not: row.id }, categoryChosen: false },
      select: { id: true, description: true, categoryId: true, transferWalletId: true },
    });
    const ids = irmas
      .filter((o) => ruleKey(o.description) === chave)
      .filter((o) => o.categoryId !== destino.categoryId || o.transferWalletId !== destino.transferWalletId)
      .map((o) => o.id);
    if (ids.length > 0) {
      const res = await ctx.db.importRow.updateMany({ where: { id: { in: ids } }, data: destino });
      similarUpdated = res.count;
    }
    if (change.categoryId) await learnCategory(ctx, row.description, change.categoryId);
  }
  return { ...atualizada, similarUpdated };
}

/**
 * Confirma: as linhas marcadas pra importar viram transações PAGAS na conta.
 * Toda linha a importar precisa de categoria. Aprende as categorias escolhidas.
 */
export async function commitImport(ctx: Ctx, batchId: string): Promise<{ imported: number; skipped: number }> {
  const batch = await getOwnBatch(ctx, batchId);
  if (batch.status !== "REVIEW") throw new DomainError("Essa importação já foi concluída.");
  const rows = await ctx.db.importRow.findMany({ where: { batchId }, orderBy: { position: "asc" } });
  const marcadas = rows.filter((r) => r.decision === "IMPORT");
  const semCategoria = marcadas.filter((r) => !r.categoryId && !r.transferWalletId).length;
  const aImportar = marcadas.filter((r) => !r.transferWalletId);
  const transferencias = marcadas.filter((r) => r.transferWalletId);
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

  // A outra conta de cada transferência ainda é dela?
  const outras = [...new Set(transferencias.map((r) => r.transferWalletId!))];
  const donas = await ctx.db.wallet.count({ where: { userId: ctx.userId, id: { in: outras } } });
  if (donas !== outras.length) throw new DomainError("Uma das contas das transferências não existe mais.");
  // Transferência que já entrou pelo extrato da outra conta não entra de novo.
  const repetidas = transferencias.map((r) => ({ ...r, note: r.note as string | null, type: r.type as "INCOME" | "EXPENSE", decision: "IMPORT" as "IMPORT" | "SKIP" }));
  await marcarTransferenciasRepetidas(ctx, batch.walletId, repetidas);
  const novasTransf = repetidas.filter((r) => r.decision === "IMPORT");

  const imported = await ctx.db.$transaction(async (tx) => {
    if (novasTransf.length > 0) {
      await tx.transfer.createMany({
        data: novasTransf.map((r) => ({
          userId: ctx.userId,
          ...ladosDaTransferencia(r.type, batch.walletId, r.transferWalletId!),
          amountCents: r.amountCents,
          date: r.date,
          note: r.description.slice(0, 120),
          importBatchId: batch.id,
        })),
      });
    }
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
    return res.count + novasTransf.length;
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
    const t = await tx.transfer.deleteMany({ where: { userId: ctx.userId, importBatchId: batchId } });
    await tx.importRow.deleteMany({ where: { batchId } });
    await tx.importBatch.update({ where: { id: batchId }, data: { status: "DISCARDED" } });
    return { deleted: r.count + t.count };
  });
}
