import { describe, expect, it } from "vitest";
import { dateInputToUtc as d, toDateInput } from "@/lib/dates";
import {
  type FlowItem,
  cashflowByMonth,
  daysOfMonth,
  lowestPoint,
  projectDaily,
  realizedDaily,
  signedAmount,
} from "@/lib/projection";

const item = (
  date: string,
  type: FlowItem["type"],
  amountCents: number,
  status: FlowItem["status"] = "PAID",
): FlowItem => ({ date: d(date), type, amountCents, status });

describe("previsto vs. realizado", () => {
  it("previsto conta pago + pendente; realizado só o pago; mês vazio vem zerado", () => {
    const r = cashflowByMonth(
      [
        item("2026-11-05", "INCOME", 450000),
        item("2026-11-10", "EXPENSE", 140000, "PENDING"),
        item("2026-11-12", "EXPENSE", 50000),
        item("2026-12-05", "INCOME", 450000, "PENDING"),
        item("2027-03-01", "EXPENSE", 999), // fora dos meses pedidos
      ],
      ["2026-10", "2026-11", "2026-12"],
    );
    expect(r[0]).toMatchObject({ month: "2026-10", plannedNetCents: 0, realizedNetCents: 0 });
    expect(r[1]).toEqual({
      month: "2026-11",
      plannedIncomeCents: 450000,
      plannedExpenseCents: 190000,
      realizedIncomeCents: 450000,
      realizedExpenseCents: 50000,
      plannedNetCents: 260000,
      realizedNetCents: 400000,
    });
    expect(r[2]).toMatchObject({ plannedIncomeCents: 450000, realizedIncomeCents: 0 });
  });

  it("usa o mês de São Paulo (dia 01 às 12:00 UTC fica no mês certo)", () => {
    const r = cashflowByMonth([item("2026-12-01", "EXPENSE", 100)], ["2026-11", "2026-12"]);
    expect(r.map((c) => c.plannedExpenseCents)).toEqual([0, 100]);
  });
});

describe("saldo projetado e realizado", () => {
  it("daysOfMonth devolve todos os dias às 12:00 UTC", () => {
    const fev = daysOfMonth("2028-02");
    expect(fev).toHaveLength(29);
    expect(toDateInput(fev[0])).toBe("2028-02-01");
    expect(toDateInput(fev[28])).toBe("2028-02-29");
    expect(fev.every((x) => x.getUTCHours() === 12)).toBe(true);
  });

  it("projeção: saldo de hoje + pendentes até cada dia; atrasado entra logo no 1º dia", () => {
    const dias = [d("2026-11-18"), d("2026-11-20"), d("2026-11-30")];
    const serie = projectDaily(
      100000,
      [
        item("2026-11-10", "EXPENSE", 20000, "PENDING"), // atrasada
        item("2026-11-20", "EXPENSE", 140000, "PENDING"),
        item("2026-11-25", "INCOME", 80000, "PENDING"),
        item("2026-11-19", "EXPENSE", 99999, "PAID"), // pago já está no saldo de hoje: ignora
        item("2026-12-01", "EXPENSE", 5000, "PENDING"), // depois do último dia
      ],
      dias,
    );
    expect(serie.map((p) => p.balanceCents)).toEqual([80000, -60000, 20000]);
    expect(lowestPoint(serie)).toEqual({ date: d("2026-11-20"), balanceCents: -60000 });
  });

  it("realizado: saldo inicial + pagos até cada dia (pendente não entra)", () => {
    const serie = realizedDaily(
      10000,
      [item("2026-10-05", "INCOME", 5000), item("2026-10-20", "EXPENSE", 3000), item("2026-10-21", "EXPENSE", 1, "PENDING")],
      [d("2026-10-01"), d("2026-10-05"), d("2026-10-31")],
    );
    expect(serie.map((p) => p.balanceCents)).toEqual([10000, 15000, 12000]);
  });

  it("signedAmount e lowestPoint em série vazia", () => {
    expect(signedAmount({ type: "EXPENSE", amountCents: 10 })).toBe(-10);
    expect(lowestPoint([])).toBeNull();
  });
});
