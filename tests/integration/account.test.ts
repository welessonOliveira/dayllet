// LGPD: exportar os próprios dados e excluir a conta, sem tocar nos outros usuários.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { goalContributionSchema, goalSchema, recurringRuleSchema, toGoalContributionData, toGoalData, toTransactionData, transactionSchema } from "@/lib/validations";
import { deleteAccount, exportUserData } from "@/server/account";
import { createBudget } from "@/server/budgets";
import { createCategory } from "@/server/categories";
import type { Ctx } from "@/server/context";
import { setupNewUser } from "@/server/defaults";
import { ensureDemoUser, resetDemoData } from "@/server/demo";
import { addGoalContribution, createGoal } from "@/server/goals";
import { createImport } from "@/server/imports";
import { createRecurringRule } from "@/server/recurring";
import { createTransaction } from "@/server/transactions";
import { createTransfer } from "@/server/transfers";
import { createWallet } from "@/server/wallets";
import { TEST_DATABASE_URL } from "../test-db";

const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
const AGORA = new Date("2026-11-18T15:00:00Z");
let ana: Ctx;
let bruno: Ctx;

/** Usuário com um pouco de tudo. */
async function povoar(ctx: Ctx) {
  await setupNewUser(db, ctx.userId);
  const cat = await createCategory(ctx, { name: "Teste", type: "EXPENSE", color: null });
  const outra = await createWallet(ctx, { name: "Outra", kind: "WALLET", openingBalanceCents: 0 });
  const [principal] = await db.wallet.findMany({ where: { userId: ctx.userId, isDefault: true } });
  await createTransaction(ctx, toTransactionData(transactionSchema.parse({ description: "Uber", amount: "10,00", type: "EXPENSE", date: "2026-11-05", categoryId: cat.id })));
  await createTransfer(ctx, { fromWalletId: principal.id, toWalletId: outra.id, amountCents: 100, date: AGORA, note: null });
  await createBudget(ctx, { categoryId: cat.id, month: "2026-11", limitCents: 1000 });
  await createRecurringRule(ctx, recurringRuleSchema.parse({ kind: "FIXED", description: "Aluguel", type: "EXPENSE", amount: "100,00", categoryId: cat.id, startDate: "2026-11-01" }), AGORA);
  const g = await createGoal(ctx, toGoalData(goalSchema.parse({ name: "PC", target: "100,00" })));
  await addGoalContribution(ctx, g.id, toGoalContributionData(goalContributionSchema.parse({ amount: "10,00", date: "2026-11-01" })));
  await createImport(ctx, { walletId: principal.id, fileName: "x.csv", bytes: new TextEncoder().encode("Data;Descrição;Valor\n01/11/2026;CAFE;-5,00") });
}

beforeEach(async () => {
  await db.transaction.deleteMany();
  await db.transfer.deleteMany();
  await db.user.deleteMany();
  ana = { db, userId: (await db.user.create({ data: { name: "Ana", email: "ana@acc.local" } })).id };
  bruno = { db, userId: (await db.user.create({ data: { name: "Bruno", email: "bruno@acc.local" } })).id };
  await povoar(ana);
  await povoar(bruno);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("meus dados (LGPD)", () => {
  it("o export tem tudo do usuário e nada do outro", async () => {
    const d = await exportUserData(ana);
    expect(d.user).toMatchObject({ name: "Ana", email: "ana@acc.local" });
    expect(d.transactions.length).toBeGreaterThan(0);
    expect(d.transfers).toHaveLength(1);
    expect(d.goals[0].contributions).toHaveLength(1);
    const ids = new Set([...d.wallets, ...d.categories, ...d.transactions, ...d.budgets].map((x) => x.userId));
    expect([...ids]).toEqual([ana.userId]);
  });

  it("excluir a conta apaga TUDO da Ana e mantém o Bruno inteiro", async () => {
    const antesBruno = JSON.stringify(await exportUserData(bruno), (k, v) => (k === "exportedAt" ? undefined : v));
    await expect(deleteAccount(ana, "excluir sim")).rejects.toThrow("Digite EXCLUIR");
    await deleteAccount(ana, "excluir");

    expect(await db.user.findUnique({ where: { id: ana.userId } })).toBeNull();
    for (const model of ["wallet", "category", "transaction", "transfer", "budget", "recurringRule", "goal", "categoryRule", "importBatch"] as const) {
      // @ts-expect-error acesso dinâmico só no teste
      expect(await db[model].count({ where: { userId: ana.userId } })).toBe(0);
    }
    const depoisBruno = JSON.stringify(await exportUserData(bruno), (k, v) => (k === "exportedAt" ? undefined : v));
    expect(depoisBruno).toBe(antesBruno);
  });

  it("a conta demo não pode ser excluída", async () => {
    const demo = await ensureDemoUser(db);
    await resetDemoData(db, demo.id, AGORA);
    await expect(deleteAccount({ db, userId: demo.id }, "EXCLUIR")).rejects.toThrow("demonstração");
  });
});
