// Integração: projeção de saldo e previsto vs. realizado.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { toDateInput } from "@/lib/dates";
import { recurringRuleSchema, toTransactionData, transactionSchema } from "@/lib/validations";
import { createCategory } from "@/server/categories";
import type { Ctx } from "@/server/context";
import { getBalanceProjection, getCashflow, getMonthForecast } from "@/server/forecast";
import { createRecurringRule } from "@/server/recurring";
import { createTransaction } from "@/server/transactions";
import { createWallet } from "@/server/wallets";
import { TEST_DATABASE_URL } from "../test-db";

const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
const AGORA = new Date("2026-11-18T15:00:00Z"); // 18/11/2026

let ana: Ctx;
let bruno: Ctx;
let mercado: string;
let salario: string;

async function lanca(ctx: Ctx, over: Record<string, string>) {
  return createTransaction(
    ctx,
    toTransactionData(
      transactionSchema.parse({ description: "x", amount: "100,00", type: "EXPENSE", date: "2026-11-10", categoryId: mercado, ...over }),
    ),
  );
}

beforeEach(async () => {
  await db.transaction.deleteMany();
  await db.user.deleteMany();
  const u = await db.user.create({ data: { name: "ana", email: "ana@fc.local" } });
  const b = await db.user.create({ data: { name: "bruno", email: "bruno@fc.local" } });
  ana = { db, userId: u.id };
  bruno = { db, userId: b.id };
  mercado = (await createCategory(ana, { name: "Mercado", type: "EXPENSE", color: null })).id;
  salario = (await createCategory(ana, { name: "Salário", type: "INCOME", color: null })).id;
  await createWallet(ana, { name: "Banco", kind: "CHECKING", openingBalanceCents: 100000 }); // R$ 1.000
});

afterAll(async () => {
  await db.$disconnect();
});

describe("projeção do mês", () => {
  it("mês atual: saldo de hoje + pendentes (inclusive atrasados) até o fim do mês", async () => {
    await lanca(ana, { amount: "200,00", date: "2026-11-05" }); // pago
    await lanca(ana, { amount: "50,00", date: "2026-11-02", status: "PENDING" }); // atrasada
    await lanca(ana, { amount: "1.500,00", date: "2026-11-25", status: "PENDING" }); // conta grande
    await lanca(ana, { type: "INCOME", categoryId: salario, amount: "3.000,00", date: "2026-11-28", status: "PENDING" });
    await lanca(ana, { amount: "999,00", date: "2026-12-05", status: "PENDING" }); // mês que vem

    const f = await getMonthForecast(ana, "2026-11", AGORA);
    expect(f.mode).toBe("current");
    expect(f.currentBalanceCents).toBe(80000); // 1000 - 200
    expect(f.pendingExpenseCents).toBe(155000); // 50 + 1500
    expect(f.pendingIncomeCents).toBe(300000);
    expect(f.overdueExpenseCents).toBe(5000);
    expect(f.endOfMonthBalanceCents).toBe(80000 - 5000 - 150000 + 300000); // 2.250,00
    expect(toDateInput(f.daily[0].date)).toBe("2026-11-18"); // começa hoje
    expect(f.lowest).toMatchObject({ balanceCents: -75000 }); // dia 25: fica negativo
    expect(toDateInput(f.lowest!.date)).toBe("2026-11-25");
  });

  it("mês futuro inclui as contas fixas geradas; mês passado mostra o realizado", async () => {
    await createRecurringRule(
      ana,
      recurringRuleSchema.parse({
        kind: "FIXED", description: "Aluguel", type: "EXPENSE", amount: "300,00", categoryId: mercado, startDate: "2026-11-10",
      }),
      AGORA,
    );
    await lanca(ana, { amount: "100,00", date: "2026-10-15" }); // pago em outubro

    const jan = await getMonthForecast(ana, "2027-01", AGORA);
    expect(jan.mode).toBe("future");
    expect(jan.daily).toHaveLength(31);
    // hoje: 1000 - 100 = 900; pendentes até 31/01: aluguel nov (atrasado? 10/11 < hoje, pendente), dez, jan
    expect(jan.endOfMonthBalanceCents).toBe(90000 - 3 * 30000);

    const out = await getMonthForecast(ana, "2026-10", AGORA);
    expect(out.mode).toBe("past");
    expect(out.endOfMonthBalanceCents).toBe(90000);
    expect(out.daily[0].balanceCents).toBe(100000); // 01/10, antes da compra
  });
});

describe("fluxo de caixa e saldo dos próximos meses", () => {
  it("previsto vs. realizado por mês", async () => {
    await lanca(ana, { amount: "200,00", date: "2026-10-05" });
    await lanca(ana, { amount: "300,00", date: "2026-11-05", status: "PENDING" });
    await lanca(ana, { type: "INCOME", categoryId: salario, amount: "1.000,00", date: "2026-11-01" });

    const cf = await getCashflow(ana, { back: 1, ahead: 1 }, AGORA);
    expect(cf.map((c) => c.month)).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(cf[0]).toMatchObject({ plannedExpenseCents: 20000, realizedExpenseCents: 20000 });
    expect(cf[1]).toMatchObject({
      plannedIncomeCents: 100000,
      realizedIncomeCents: 100000,
      plannedExpenseCents: 30000,
      realizedExpenseCents: 0,
      plannedNetCents: 70000,
      realizedNetCents: 100000,
    });
    expect(cf[2].plannedNetCents).toBe(0);
  });

  it("saldo projetado no fim dos próximos meses, com conta fixa", async () => {
    await createRecurringRule(
      ana,
      recurringRuleSchema.parse({
        kind: "FIXED", description: "Salário", type: "INCOME", amount: "500,00", categoryId: salario, startDate: "2026-11-30",
      }),
      AGORA,
    );
    const p = await getBalanceProjection(ana, 3, AGORA);
    expect(p).toEqual([
      { month: "2026-11", balanceCents: 150000 },
      { month: "2026-12", balanceCents: 200000 },
      { month: "2027-01", balanceCents: 250000 },
    ]);
  });

  it("isolamento: o Bruno não vê nada da Ana", async () => {
    await lanca(ana, { amount: "200,00", date: "2026-11-05", status: "PENDING" });
    const f = await getMonthForecast(bruno, "2026-11", AGORA);
    expect(f).toMatchObject({ currentBalanceCents: 0, pendingExpenseCents: 0, endOfMonthBalanceCents: 0 });
    const cf = await getCashflow(bruno, { back: 0, ahead: 0 }, AGORA);
    expect(cf[0].plannedExpenseCents).toBe(0);
  });
});
