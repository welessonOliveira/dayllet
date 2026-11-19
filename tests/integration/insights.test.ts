// Dicas do Início e histórico de saldo das contas (sempre só os dados do próprio usuário).
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { toTransactionData, toTransferData, transactionSchema, transferSchema } from "@/lib/validations";
import { createCategory } from "@/server/categories";
import type { Ctx } from "@/server/context";
import { getInsights } from "@/server/insights";
import { createTransaction } from "@/server/transactions";
import { createTransfer } from "@/server/transfers";
import { createWallet, getWalletHistories, listWalletsWithBalance } from "@/server/wallets";
import { TEST_DATABASE_URL } from "../test-db";

const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
const HOJE = new Date("2026-11-19T15:00:00Z");
let ana: Ctx;
let bruno: Ctx;
let corrente: string;
let comida: string;

const gasto = (ctx: Ctx, date: string, amount: string, status: "PAID" | "PENDING" = "PAID", categoryId = comida, walletId = corrente) =>
  createTransaction(
    ctx,
    toTransactionData(transactionSchema.parse({ description: "X", amount, type: "EXPENSE", status, date, categoryId, walletId })),
  );

beforeEach(async () => {
  await db.transaction.deleteMany();
  await db.transfer.deleteMany();
  await db.user.deleteMany();
  ana = { db, userId: (await db.user.create({ data: { email: "ana@ins.local" } })).id };
  bruno = { db, userId: (await db.user.create({ data: { email: "bruno@ins.local" } })).id };
  corrente = (await createWallet(ana, { name: "Corrente", kind: "CHECKING", openingBalanceCents: 100000 })).id;
  comida = (await createCategory(ana, { name: "Comida", type: "EXPENSE", color: null })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("getInsights", () => {
  it("avisa contas atrasadas, vencendo e a categoria que subiu", async () => {
    await gasto(ana, "2026-11-10", "50,00", "PENDING"); // atrasada
    await gasto(ana, "2026-11-22", "80,00", "PENDING"); // vence em 3 dias
    await gasto(ana, "2026-12-15", "999,00", "PENDING"); // longe: não entra
    await gasto(ana, "2026-10-05", "100,00"); // outubro até o dia 19
    await gasto(ana, "2026-11-05", "200,00"); // novembro

    const ins = await getInsights(ana, "2026-11", HOJE);
    const ids = ins.map((i) => i.id);
    expect(ids).toContain("atrasadas");
    expect(ins.find((i) => i.id === "vencendo")?.detail).toContain("80,00");
    // Novembro até hoje: 200 + 50 (a pendente atrasada conta; a do dia 22 ainda não) = 250 vs outubro: 100
    expect(ins.find((i) => i.id.startsWith("sobe-"))?.title).toBe("Comida subiu 150%");
  });

  it("não mistura dados de outro usuário (IDOR)", async () => {
    await gasto(ana, "2026-11-10", "50,00", "PENDING");
    expect(await getInsights(bruno, "2026-11", HOJE)).toEqual([]);
  });
});

describe("getWalletHistories", () => {
  it("monta o saldo dia a dia com lançamentos pagos e transferências", async () => {
    const poup = (await createWallet(ana, { name: "Poupança", kind: "SAVINGS", openingBalanceCents: 0 })).id;
    await gasto(ana, "2026-11-18", "100,00");
    await gasto(ana, "2026-11-18", "30,00", "PENDING"); // pendente não mexe no saldo
    await createTransfer(ana, toTransferData(transferSchema.parse({ fromWalletId: corrente, toWalletId: poup, amount: "200,00", date: "2026-11-19" })));

    const wallets = await listWalletsWithBalance(ana, HOJE);
    const h = await getWalletHistories(ana, wallets, 3, HOJE);
    expect(h[corrente]).toEqual([100000, 90000, 70000]);
    expect(h[poup]).toEqual([0, 0, 20000]);
  });

  it("só olha contas e transferências do próprio usuário (IDOR)", async () => {
    const outra = (await createWallet(bruno, { name: "Do Bruno", kind: "CHECKING", openingBalanceCents: 5000 })).id;
    const wallets = await listWalletsWithBalance(bruno, HOJE);
    const h = await getWalletHistories(bruno, wallets, 2, HOJE);
    expect(Object.keys(h)).toEqual(wallets.map((w) => w.id));
    expect(Object.keys(h)).not.toContain(corrente);
    expect(h[outra]).toEqual([5000, 5000]);
  });
});
