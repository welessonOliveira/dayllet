// Integração: contas fixas e parcelados com Postgres de verdade.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { toDateInput } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { type RecurringRuleFormValues, recurringRuleSchema } from "@/lib/validations";
import { listBudgetsWithProgress } from "@/server/budgets";
import { createCategory, deleteCategory } from "@/server/categories";
import type { Ctx } from "@/server/context";
import { getDashboardData } from "@/server/dashboard";
import {
  createRecurringRule,
  deleteRecurringRule,
  getRecurringRule,
  listRecurringRules,
  setRecurringRuleActive,
  syncRecurring,
  updateRecurringRule,
} from "@/server/recurring";
import { deleteTransaction, listTransactions, setTransactionStatus } from "@/server/transactions";
import { createWallet, deleteWallet } from "@/server/wallets";
import { TEST_DATABASE_URL } from "../test-db";

const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });

// "Hoje" fixo nos testes: 18/11/2026 (meio-dia em São Paulo).
const AGORA = new Date("2026-11-18T15:00:00Z");

let ana: Ctx;
let bruno: Ctx;
let moradia: string;
let salario: string;

async function novoUsuario(nome: string): Promise<Ctx> {
  const u = await db.user.create({ data: { name: nome, email: `${nome}@rec.local` } });
  return { db, userId: u.id };
}

function regra(over: Partial<RecurringRuleFormValues>) {
  return recurringRuleSchema.parse({
    kind: "FIXED",
    description: "Aluguel",
    type: "EXPENSE",
    amount: "1.400,00",
    categoryId: moradia,
    startDate: "2026-11-10",
    ...over,
  });
}

/** Lançamentos gerados pela regra, em ordem de data. */
async function gerados(ruleId: string) {
  return db.transaction.findMany({ where: { recurringRuleId: ruleId }, orderBy: { occurrenceDate: "asc" } });
}

beforeEach(async () => {
  await db.transaction.deleteMany();
  await db.user.deleteMany();
  ana = await novoUsuario("ana");
  bruno = await novoUsuario("bruno");
  moradia = (await createCategory(ana, { name: "Moradia", type: "EXPENSE", color: null })).id;
  salario = (await createCategory(ana, { name: "Salário", type: "INCOME", color: null })).id;
  await createWallet(ana, { name: "Banco", kind: "CHECKING", openingBalanceCents: 0 });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("geração na leitura", () => {
  it("cria até o fim do mês atual na hora de criar a regra, e mais quando abre um mês futuro", async () => {
    const r = await createRecurringRule(ana, regra({}), AGORA);
    expect((await gerados(r.id)).map((t) => toDateInput(t.date))).toEqual(["2026-11-10"]);

    await syncRecurring(ana, "2027-02", AGORA);
    expect((await gerados(r.id)).map((t) => toDateInput(t.date))).toEqual([
      "2026-11-10",
      "2026-12-10",
      "2027-01-10",
      "2027-02-10",
    ]);
  });

  it("é idempotente: rodar várias vezes (até ao mesmo tempo) não duplica", async () => {
    const r = await createRecurringRule(ana, regra({}), AGORA);
    await Promise.all([1, 2, 3, 4].map(() => syncRecurring(ana, "2027-03", AGORA)));
    await syncRecurring(ana, "2027-03", AGORA);
    expect(await gerados(r.id)).toHaveLength(5); // nov, dez, jan, fev, mar
  });

  it("histórico (antes da criação) entra pago; daqui pra frente entra pendente", async () => {
    // A regra é criada hoje (createdAt = agora real), com início lá atrás.
    const r = await createRecurringRule(ana, regra({ startDate: "2020-01-10" }), AGORA);
    const lista = await gerados(r.id);
    const hojeReal = toDateInput(new Date());
    for (const t of lista) {
      const esperado = toDateInput(t.date) < hojeReal ? "PAID" : "PENDING";
      expect(t.status).toBe(esperado);
    }
  });

  it("listTransactions, dashboard e orçamento já enxergam a conta fixa do mês", async () => {
    await createRecurringRule(ana, regra({ startDate: "2026-09-05" }), AGORA);
    await db.budget.create({ data: { userId: ana.userId, categoryId: moradia, month: "2027-01", limitCents: 100000 } });

    const jan = await listTransactions(ana, { month: "2027-01" });
    expect(jan.map((t) => t.description)).toEqual(["Aluguel"]);
    const [orc] = await listBudgetsWithProgress(ana, "2027-01");
    expect(orc.progress).toMatchObject({ spentCents: 140000, isOver: true });
    expect((await getDashboardData(ana, "2027-01")).summary.pendingExpenseCents).toBe(140000);
  });

  it("não passa de 24 meses à frente do mês atual", async () => {
    const r = await createRecurringRule(ana, regra({}), AGORA);
    await syncRecurring(ana, "2099-12", AGORA);
    const ultima = (await gerados(r.id)).at(-1)!;
    expect(toDateInput(ultima.date)).toBe("2028-11-10");
  });
});

describe("parcelado", () => {
  it("divide o total em parcelas mensais, numeradas, com a soma batendo", async () => {
    const r = await createRecurringRule(
      ana,
      regra({ kind: "INSTALLMENT", description: "Notebook", amount: "1.000,00", installments: "3" }),
      AGORA,
    );
    await syncRecurring(ana, "2027-12", AGORA);
    const lista = await gerados(r.id);
    expect(lista.map((t) => [toDateInput(t.date), t.amountCents, t.installmentNo, t.installmentOf])).toEqual([
      ["2026-11-10", 33333, 1, 3],
      ["2026-12-10", 33333, 2, 3],
      ["2027-01-10", 33334, 3, 3],
    ]);
    expect(lista.reduce((s, t) => s + t.amountCents, 0)).toBe(100000);

    await setTransactionStatus(ana, lista[0].id, "PAID");
    const [view] = await listRecurringRules(ana, AGORA);
    expect(view).toMatchObject({ scheduleLabel: "Parcelado em 3x", paidInstallments: 1, finished: false });
    expect(toDateInput(view.nextDate!)).toBe("2026-12-10");
    expect(view.nextAmountCents).toBe(33333);
  });

  it("validação: parcelado precisa de 2 a 120 parcelas; fim antes do começo é erro", () => {
    expect(() => regra({ kind: "INSTALLMENT", installments: "1" })).toThrow();
    expect(() => regra({ kind: "INSTALLMENT", installments: "abc" })).toThrow();
    expect(() => regra({ endDate: "2026-01-01" })).toThrow();
    expect(regra({ kind: "INSTALLMENT", installments: "12", endDate: "2030-01-01" })).toMatchObject({
      installments: 12,
      endDate: null,
      frequency: "MONTHLY",
    });
  });
});

describe("editar, pausar, pular e excluir", () => {
  it("apagar uma ocorrência gerada não faz ela voltar", async () => {
    const r = await createRecurringRule(ana, regra({}), AGORA);
    await syncRecurring(ana, "2027-01", AGORA);
    const dez = (await gerados(r.id))[1];
    await deleteTransaction(ana, dez.id);
    await syncRecurring(ana, "2027-01", AGORA);
    expect((await gerados(r.id)).map((t) => toDateInput(t.date))).toEqual(["2026-11-10", "2027-01-10"]);
  });

  it("editar vale só pra frente: o que é passado ou pago fica como estava", async () => {
    const r = await createRecurringRule(ana, regra({ startDate: "2026-10-01" }), AGORA);
    await syncRecurring(ana, "2027-01", AGORA);
    // outubro e novembro (01/11) já passaram; dezembro e janeiro são futuros
    await updateRecurringRule(ana, r.id, regra({ startDate: "2026-10-01", amount: "1.500,00" }), AGORA);
    await syncRecurring(ana, "2027-01", AGORA);
    const lista = await gerados(r.id);
    expect(lista.map((t) => [toDateInput(t.date), t.amountCents])).toEqual([
      ["2026-10-01", 140000],
      ["2026-11-01", 140000],
      ["2026-12-01", 150000],
      ["2027-01-01", 150000],
    ]);
  });

  it("pausar apaga as futuras pendentes e para de gerar; retomar volta a gerar", async () => {
    const r = await createRecurringRule(ana, regra({ startDate: "2026-11-25" }), AGORA);
    await syncRecurring(ana, "2027-02", AGORA);
    await setRecurringRuleActive(ana, r.id, false, AGORA);
    await syncRecurring(ana, "2027-02", AGORA);
    expect(await gerados(r.id)).toHaveLength(0);

    await setRecurringRuleActive(ana, r.id, true, AGORA);
    await syncRecurring(ana, "2027-02", AGORA);
    expect(await gerados(r.id)).toHaveLength(4);
  });

  it("excluir a regra mantém o histórico e apaga as futuras pendentes", async () => {
    const r = await createRecurringRule(ana, regra({ startDate: "2026-10-01" }), AGORA);
    await syncRecurring(ana, "2027-01", AGORA);
    expect(await deleteRecurringRule(ana, r.id, AGORA)).toEqual({ deletedFuture: 2 });
    const sobraram = await db.transaction.findMany({ where: { userId: ana.userId }, orderBy: { date: "asc" } });
    expect(sobraram.map((t) => [toDateInput(t.date), t.recurringRuleId])).toEqual([
      ["2026-10-01", null],
      ["2026-11-01", null],
    ]);
  });

  it("categoria e conta usadas por uma regra não podem ser excluídas", async () => {
    const carteira = await createWallet(ana, { name: "Carteira", kind: "WALLET", openingBalanceCents: 0 });
    const lazer = await createCategory(ana, { name: "Lazer", type: "EXPENSE", color: null });
    const r = await createRecurringRule(
      ana,
      regra({ categoryId: lazer.id, walletId: carteira.id, startDate: "2027-05-01" }),
      AGORA,
    );
    expect(await gerados(r.id)).toHaveLength(0); // começa no futuro: nada gerado ainda
    await expect(deleteCategory(ana, lazer.id)).rejects.toThrow("conta fixa ou parcelamento");
    await expect(deleteWallet(ana, carteira.id)).rejects.toThrow("conta fixa ou parcelamento");
  });
});

describe("regras de negócio e isolamento", () => {
  it("tipo da regra precisa bater com a categoria", async () => {
    await expect(createRecurringRule(ana, regra({ categoryId: salario }), AGORA)).rejects.toThrow(
      "Despesa só pode usar uma categoria de despesa.",
    );
  });

  it("outro usuário não vê, não edita, não pausa e não exclui a regra", async () => {
    const r = await createRecurringRule(ana, regra({}), AGORA);
    expect(await getRecurringRule(bruno, r.id)).toBeNull();
    expect(await listRecurringRules(bruno, AGORA)).toHaveLength(0);
    await expect(updateRecurringRule(bruno, r.id, regra({}), AGORA)).rejects.toThrow(DomainError);
    await expect(setRecurringRuleActive(bruno, r.id, false, AGORA)).rejects.toThrow(DomainError);
    await expect(deleteRecurringRule(bruno, r.id, AGORA)).rejects.toThrow(DomainError);
    // o sync do Bruno não gera nada da Ana
    await syncRecurring(bruno, "2027-06", AGORA);
    expect(await db.transaction.count({ where: { userId: bruno.userId } })).toBe(0);
    // e o Bruno não consegue usar a categoria da Ana numa regra dele
    await expect(createRecurringRule(bruno, regra({}), AGORA)).rejects.toThrow("Categoria não encontrada.");
  });
});
