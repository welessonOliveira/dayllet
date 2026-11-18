// Teste de integração: usa um SQLite de verdade (prisma/test.db),
// recriado pelo tests/global-setup.ts antes da suíte.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import { toBudgetData, toTransactionData, budgetSchema, transactionSchema } from "@/lib/validations";
import { createBudget, listBudgetsWithProgress } from "@/server/budgets";
import { createCategory, deleteCategory } from "@/server/categories";
import { getDashboardData } from "@/server/dashboard";
import { createTransaction, listTransactions } from "@/server/transactions";
import { TEST_DATABASE_URL } from "../test-db";

const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });

const MES = "2026-11";

// Monta os dados como se viessem do formulário, passando pela validação real.
function txForm(over: Record<string, string>) {
  return toTransactionData(
    transactionSchema.parse({
      description: "Mercado",
      amount: "100,00",
      type: "EXPENSE",
      date: "2026-11-10",
      categoryId: "",
      ...over,
    }),
  );
}

beforeEach(async () => {
  await db.transaction.deleteMany();
  await db.budget.deleteMany();
  await db.category.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("criar transação reflete no orçamento", () => {
  it("o gasto do orçamento sobe com despesas pagas e pendentes do mês", async () => {
    const alimentacao = await createCategory(db, { name: "Alimentação", type: "EXPENSE", color: null });
    await createBudget(
      db,
      toBudgetData(budgetSchema.parse({ categoryId: alimentacao.id, month: MES, limit: "500,00" })),
    );

    let [orc] = await listBudgetsWithProgress(db, MES);
    expect(orc.progress.spentCents).toBe(0);

    await createTransaction(db, txForm({ categoryId: alimentacao.id, amount: "150,00" }));
    await createTransaction(
      db,
      txForm({ categoryId: alimentacao.id, amount: "400,00", status: "PENDING", date: "2026-11-30" }),
    );
    // Fora do mês: não conta.
    await createTransaction(db, txForm({ categoryId: alimentacao.id, amount: "999,00", date: "2026-10-31" }));

    [orc] = await listBudgetsWithProgress(db, MES);
    expect(orc.progress).toMatchObject({
      spentCents: 55000,
      remainingCents: -5000,
      percentUsed: 110,
      isOver: true,
    });

    // O dashboard usa o mesmo progresso e o saldo só conta o que foi pago.
    const dash = await getDashboardData(db, MES);
    expect(dash.budgets[0].progress.spentCents).toBe(55000);
    expect(dash.summary.expenseCents).toBe(15000);
    expect(dash.summary.pendingExpenseCents).toBe(40000);
    expect(dash.summary.count).toBe(2);
  });
});

describe("regras no servidor", () => {
  it("bloqueia transação com tipo diferente da categoria", async () => {
    const salario = await createCategory(db, { name: "Salário", type: "INCOME", color: null });
    await expect(createTransaction(db, txForm({ categoryId: salario.id, type: "EXPENSE" }))).rejects.toThrow(
      DomainError,
    );
    expect(await db.transaction.count()).toBe(0);
  });

  it("bloqueia orçamento duplicado e orçamento de receita", async () => {
    const moradia = await createCategory(db, { name: "Moradia", type: "EXPENSE", color: null });
    const salario = await createCategory(db, { name: "Salário", type: "INCOME", color: null });
    const data = { categoryId: moradia.id, month: MES, limitCents: 100000 };
    await createBudget(db, data);
    await expect(createBudget(db, data)).rejects.toThrow("Já existe um orçamento");
    await expect(createBudget(db, { ...data, categoryId: salario.id })).rejects.toThrow(DomainError);
  });

  it("não exclui categoria com transações; sem transações apaga os orçamentos junto", async () => {
    const lazer = await createCategory(db, { name: "Lazer", type: "EXPENSE", color: null });
    const saude = await createCategory(db, { name: "Saúde", type: "EXPENSE", color: null });
    await createTransaction(db, txForm({ categoryId: lazer.id }));
    await createBudget(db, { categoryId: saude.id, month: MES, limitCents: 1000 });

    await expect(deleteCategory(db, lazer.id)).rejects.toThrow("não pode ser excluída");
    expect(await deleteCategory(db, saude.id)).toEqual({ deletedBudgets: 1 });
    expect(await db.budget.count()).toBe(0);
  });

  it("nome de categoria duplicado vira mensagem amigável", async () => {
    await createCategory(db, { name: "Outros", type: "EXPENSE", color: null });
    await expect(createCategory(db, { name: "Outros", type: "EXPENSE", color: null })).rejects.toThrow(
      "Já existe uma categoria com esse nome.",
    );
  });

  it("listTransactions filtra por mês, tipo, categoria e texto", async () => {
    const mercado = await createCategory(db, { name: "Mercado", type: "EXPENSE", color: null });
    const salario = await createCategory(db, { name: "Salário", type: "INCOME", color: null });
    await createTransaction(db, txForm({ categoryId: mercado.id, description: "Feira do mês" }));
    await createTransaction(db, txForm({ categoryId: mercado.id, description: "Padaria", date: "2026-10-05" }));
    await createTransaction(db, txForm({ categoryId: salario.id, type: "INCOME", description: "Salário" }));

    expect(await listTransactions(db, { month: MES })).toHaveLength(2);
    expect(await listTransactions(db, { month: MES, type: "INCOME" })).toHaveLength(1);
    expect(await listTransactions(db, { month: MES, categoryId: mercado.id })).toHaveLength(1);
    const busca = await listTransactions(db, { month: MES, q: "feira" });
    expect(busca.map((t) => t.description)).toEqual(["Feira do mês"]);
    expect(busca[0].category.name).toBe("Mercado");
  });
});
