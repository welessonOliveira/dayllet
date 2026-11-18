// Transferências entre contas: mexem no saldo de cada conta, mas não são receita nem despesa.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { toTransferData, transferSchema } from "@/lib/validations";
import type { Ctx } from "@/server/context";
import { getDashboardData } from "@/server/dashboard";
import { getMonthForecast } from "@/server/forecast";
import { createTransfer, deleteTransfer, listTransfers } from "@/server/transfers";
import { createWallet, deleteWallet, listWalletsWithBalance } from "@/server/wallets";
import { TEST_DATABASE_URL } from "../test-db";

const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
const AGORA = new Date("2026-11-18T15:00:00Z");
let ana: Ctx;
let bruno: Ctx;
let corrente: string;
let poupanca: string;

const t = (over: Record<string, string> = {}) =>
  toTransferData(
    transferSchema.parse({ fromWalletId: corrente, toWalletId: poupanca, amount: "500,00", date: "2026-11-10", ...over }),
  );

beforeEach(async () => {
  await db.transaction.deleteMany();
  await db.transfer.deleteMany();
  await db.user.deleteMany();
  ana = { db, userId: (await db.user.create({ data: { email: "ana@tr.local" } })).id };
  bruno = { db, userId: (await db.user.create({ data: { email: "bruno@tr.local" } })).id };
  corrente = (await createWallet(ana, { name: "Corrente", kind: "CHECKING", openingBalanceCents: 200000 })).id;
  poupanca = (await createWallet(ana, { name: "Poupança", kind: "SAVINGS", openingBalanceCents: 0 })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("transferências", () => {
  it("tira de uma conta e põe na outra; o total e o resultado do mês não mudam", async () => {
    await createTransfer(ana, t());
    const ws = await listWalletsWithBalance(ana);
    const saldo = Object.fromEntries(ws.map((w) => [w.name, w.balance.currentCents]));
    expect(saldo).toEqual({ Corrente: 150000, "Poupança": 50000 });

    const dash = await getDashboardData(ana, "2026-11");
    expect(dash.totalBalanceCents).toBe(200000); // soma das contas igual
    expect(dash.summary).toMatchObject({ incomeCents: 0, expenseCents: 0, count: 0 }); // não é receita/despesa
    expect((await getMonthForecast(ana, "2026-11", AGORA)).currentBalanceCents).toBe(200000);

    expect((await listTransfers(ana, "2026-11")).map((x) => [x.fromWallet.name, x.toWallet.name, x.amountCents])).toEqual([
      ["Corrente", "Poupança", 50000],
    ]);
    expect(await listTransfers(ana, "2026-10")).toHaveLength(0);
  });

  it("mesma conta é barrado; conta com transferência não pode ser excluída", async () => {
    expect(() => t({ toWalletId: corrente })).toThrow();
    const x = await createTransfer(ana, t());
    await expect(deleteWallet(ana, poupanca)).rejects.toThrow("tem transferências");
    await deleteTransfer(ana, x.id);
    await expect(deleteWallet(ana, poupanca)).resolves.toBeUndefined();
  });

  it("isolamento: não dá pra transferir pra/da conta de outro usuário nem ver/apagar a dele", async () => {
    const contaBruno = (await createWallet(bruno, { name: "B", kind: "CHECKING", openingBalanceCents: 0 })).id;
    await expect(createTransfer(ana, t({ toWalletId: contaBruno }))).rejects.toThrow("Conta não encontrada.");
    await expect(createTransfer(bruno, t({ toWalletId: contaBruno }))).rejects.toThrow("Conta não encontrada.");
    const x = await createTransfer(ana, t());
    expect(await listTransfers(bruno)).toHaveLength(0);
    await expect(deleteTransfer(bruno, x.id)).rejects.toThrow("Transferência não encontrada.");
  });
});
