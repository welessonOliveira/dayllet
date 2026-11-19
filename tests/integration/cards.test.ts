// Cartão de crédito: compras viram despesa no cartão; pagar a fatura é transferência.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { toDateInput } from "@/lib/dates";
import { toTransactionData, toTransferData, transactionSchema, transferSchema, toWalletData, walletSchema } from "@/lib/validations";
import { listCardInvoices } from "@/server/cards";
import { createCategory } from "@/server/categories";
import type { Ctx } from "@/server/context";
import { createTransaction } from "@/server/transactions";
import { createTransfer } from "@/server/transfers";
import { createWallet, listWalletsWithBalance } from "@/server/wallets";
import { TEST_DATABASE_URL } from "../test-db";

const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
const HOJE = new Date("2026-11-18T15:00:00Z");
let ana: Ctx;
let bruno: Ctx;
let corrente: string;
let cartao: string;
let lazer: string;

const compra = (date: string, amount: string) =>
  createTransaction(
    ana,
    toTransactionData(transactionSchema.parse({ description: "Loja", amount, type: "EXPENSE", date, categoryId: lazer, walletId: cartao })),
  );

beforeEach(async () => {
  await db.transaction.deleteMany();
  await db.transfer.deleteMany();
  await db.user.deleteMany();
  ana = { db, userId: (await db.user.create({ data: { email: "ana@card.local" } })).id };
  bruno = { db, userId: (await db.user.create({ data: { email: "bruno@card.local" } })).id };
  corrente = (await createWallet(ana, { name: "Corrente", kind: "CHECKING", openingBalanceCents: 300000 })).id;
  cartao = (
    await createWallet(ana, toWalletData(walletSchema.parse({ name: "Nubank", kind: "CREDIT_CARD", openingBalance: "0", closingDay: "3", dueDay: "10" })))
  ).id;
  lazer = (await createCategory(ana, { name: "Lazer", type: "EXPENSE", color: null })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("cartão de crédito", () => {
  it("cartão exige dia de fechamento e de vencimento; as outras contas não", () => {
    expect(walletSchema.safeParse({ name: "X", kind: "CREDIT_CARD", openingBalance: "0" }).success).toBe(false);
    expect(walletSchema.safeParse({ name: "X", kind: "CREDIT_CARD", openingBalance: "0", closingDay: "32", dueDay: "10" }).success).toBe(false);
    expect(toWalletData(walletSchema.parse({ name: "X", kind: "CHECKING", openingBalance: "0", closingDay: "3" }))).toMatchObject({ closingDay: null, dueDay: null });
  });

  it("compras caem na fatura certa, pagamento quita a fatura fechada e o saldo do cartão é o que se deve", async () => {
    await compra("2026-10-20", "100,00"); // fatura de novembro (fecha 03/11)
    await compra("2026-11-02", "50,00"); // ainda novembro
    await compra("2026-11-03", "30,00"); // dia do fechamento: dezembro
    await compra("2026-11-15", "20,00"); // dezembro
    await createTransfer(ana, toTransferData(transferSchema.parse({ fromWalletId: corrente, toWalletId: cartao, amount: "150,00", date: "2026-11-09" })));

    const [card] = await listCardInvoices(ana, HOJE);
    const porMes = Object.fromEntries(card.invoices.map((f) => [f.month, [f.totalCents, f.paidCents, f.status]]));
    expect(porMes["2026-11"]).toEqual([15000, 15000, "PAID"]);
    expect(porMes["2026-12"]).toEqual([5000, 0, "OPEN"]);
    const dez = card.invoices.find((f) => f.month === "2026-12")!;
    expect([dez.opensAt, dez.closingDate, dez.dueDate].map(toDateInput)).toEqual(["2026-11-03", "2026-12-03", "2026-12-10"]);

    const saldo = Object.fromEntries((await listWalletsWithBalance(ana, HOJE)).map((w) => [w.name, w.balance.currentCents]));
    expect(saldo).toEqual({ Corrente: 285000, Nubank: -5000 }); // deve só a fatura aberta
  });

  it("fatura fechada e não paga depois do vencimento fica atrasada; parcela futura aparece", async () => {
    await compra("2026-10-20", "100,00");
    await compra("2027-01-05", "40,00"); // fatura de fevereiro/2027
    const [card] = await listCardInvoices(ana, HOJE);
    expect(card.invoices.find((f) => f.month === "2026-11")!.status).toBe("OVERDUE");
    expect(card.invoices.find((f) => f.month === "2027-02")).toMatchObject({ totalCents: 4000, status: "FUTURE" });
  });

  it("isolamento: outro usuário não vê os cartões dela", async () => {
    await compra("2026-11-10", "10,00");
    expect(await listCardInvoices(bruno, HOJE)).toEqual([]);
  });
});
