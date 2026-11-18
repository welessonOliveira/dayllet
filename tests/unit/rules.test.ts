import { describe, expect, it } from "vitest";
import {
  type TxLike,
  calcBudgetProgress,
  calcBudgetSpent,
  calcMonthSummary,
  calcWalletBalance,
  checkBudgetCategoryType,
  checkCategoryType,
  expensesByCategory,
  topExpenses,
} from "@/lib/rules";

const tx = (
  type: TxLike["type"],
  amountCents: number,
  status: TxLike["status"] = "PAID",
): TxLike => ({ type, amountCents, status });

describe("saldo mensal (calcMonthSummary)", () => {
  it("saldo = receitas pagas - despesas pagas", () => {
    const s = calcMonthSummary([
      tx("INCOME", 500000),
      tx("EXPENSE", 120000),
      tx("EXPENSE", 30050),
    ]);
    expect(s.incomeCents).toBe(500000);
    expect(s.expenseCents).toBe(150050);
    expect(s.balanceCents).toBe(349950);
    expect(s.count).toBe(3);
  });

  it("pendentes não entram no saldo, mas aparecem separados", () => {
    const s = calcMonthSummary([
      tx("INCOME", 100000),
      tx("INCOME", 80000, "PENDING"),
      tx("EXPENSE", 40000, "PENDING"),
      tx("EXPENSE", 10000),
    ]);
    expect(s.balanceCents).toBe(90000);
    expect(s.pendingExpenseCents).toBe(40000);
    expect(s.pendingIncomeCents).toBe(80000);
    expect(s.count).toBe(4);
  });

  it("saldo pode ficar negativo", () => {
    expect(calcMonthSummary([tx("EXPENSE", 5000)]).balanceCents).toBe(-5000);
  });

  it("mês vazio dá tudo zero", () => {
    expect(calcMonthSummary([])).toEqual({
      incomeCents: 0,
      expenseCents: 0,
      balanceCents: 0,
      pendingExpenseCents: 0,
      pendingIncomeCents: 0,
      count: 0,
    });
  });
});

describe("saldo da conta (calcWalletBalance)", () => {
  it("saldo inicial + recebido - pago; previsto inclui os pendentes", () => {
    expect(
      calcWalletBalance(100000, [
        tx("INCOME", 50000),
        tx("EXPENSE", 20000),
        tx("EXPENSE", 5000, "PENDING"),
        tx("INCOME", 1000, "PENDING"),
      ]),
    ).toEqual({ currentCents: 130000, projectedCents: 126000 });
  });

  it("conta sem lançamentos fica com o saldo inicial (pode ser negativo)", () => {
    expect(calcWalletBalance(-5000, [])).toEqual({ currentCents: -5000, projectedCents: -5000 });
  });
});

describe("progresso de orçamento", () => {
  it("calcula gasto, restante e percentual", () => {
    expect(calcBudgetProgress(80000, 20000)).toEqual({
      limitCents: 80000,
      spentCents: 20000,
      remainingCents: 60000,
      percentUsed: 25,
      percentBar: 25,
      isOver: false,
    });
  });

  it("exatamente no limite não é estouro", () => {
    const p = calcBudgetProgress(10000, 10000);
    expect(p.percentUsed).toBe(100);
    expect(p.isOver).toBe(false);
  });

  it("estourado: restante negativo, percentual > 100 e barra travada em 100", () => {
    const p = calcBudgetProgress(10000, 15000);
    expect(p.remainingCents).toBe(-5000);
    expect(p.percentUsed).toBe(150);
    expect(p.percentBar).toBe(100);
    expect(p.isOver).toBe(true);
  });

  it("gasto do orçamento conta despesas pagas e pendentes, e ignora receitas", () => {
    expect(
      calcBudgetSpent([
        tx("EXPENSE", 1000),
        tx("EXPENSE", 2000, "PENDING"),
        tx("INCOME", 99999),
      ]),
    ).toBe(3000);
  });
});

describe("bloqueio de categoria com tipo errado", () => {
  it("aceita tipos iguais", () => {
    expect(checkCategoryType("INCOME", "INCOME")).toBeNull();
    expect(checkCategoryType("EXPENSE", "EXPENSE")).toBeNull();
  });

  it("bloqueia receita em categoria de despesa e vice-versa", () => {
    expect(checkCategoryType("INCOME", "EXPENSE")).toMatch(/receita/i);
    expect(checkCategoryType("EXPENSE", "INCOME")).toMatch(/despesa/i);
  });

  it("orçamento só em categoria de despesa", () => {
    expect(checkBudgetCategoryType("EXPENSE")).toBeNull();
    expect(checkBudgetCategoryType("INCOME")).toMatch(/despesa/i);
  });
});

describe("dashboard", () => {
  it("topExpenses pega as maiores despesas em ordem", () => {
    const lista = [
      tx("EXPENSE", 100),
      tx("INCOME", 9999),
      tx("EXPENSE", 500),
      tx("EXPENSE", 300, "PENDING"),
    ];
    expect(topExpenses(lista, 2).map((t) => t.amountCents)).toEqual([500, 300]);
  });

  it("expensesByCategory soma por categoria com percentual", () => {
    const cat = (id: string) => ({ id, name: id, color: null });
    const r = expensesByCategory([
      { ...tx("EXPENSE", 300), category: cat("a") },
      { ...tx("EXPENSE", 100), category: cat("b") },
      { ...tx("EXPENSE", 600), category: cat("a") },
      { ...tx("INCOME", 5000), category: cat("c") },
    ]);
    expect(r.map((c) => [c.categoryId, c.totalCents, c.percent])).toEqual([
      ["a", 900, 90],
      ["b", 100, 10],
    ]);
  });
});
