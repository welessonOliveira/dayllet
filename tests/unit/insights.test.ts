import { describe, expect, it } from "vitest";
import { dateInputToUtc } from "@/lib/dates";
import { addDaysInput, balanceHistory, biggestCategoryChanges, greeting } from "@/lib/insights";

const d = dateInputToUtc;
const HOJE = new Date("2026-11-19T15:00:00Z"); // 12h em São Paulo

describe("addDaysInput", () => {
  it("vira o mês e o ano", () => {
    expect(addDaysInput("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDaysInput("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("balanceHistory", () => {
  it("desfaz os movimentos pra trás a partir do saldo atual", () => {
    const h = balanceHistory(
      1000,
      [
        { date: d("2026-11-19"), deltaCents: 200 }, // hoje
        { date: d("2026-11-17"), deltaCents: -500 },
      ],
      4,
      HOJE,
    );
    // 16: 1300 · 17: 800 · 18: 800 · 19: 1000
    expect(h).toEqual([1300, 800, 800, 1000]);
  });

  it("movimento pago com data futura não entra no saldo de hoje", () => {
    expect(balanceHistory(1000, [{ date: d("2026-11-25"), deltaCents: 300 }], 2, HOJE)).toEqual([700, 700]);
  });
});

describe("biggestCategoryChanges", () => {
  const m = (xs: [string, number][]) => new Map(xs.map(([id, cents]) => [id, { name: id.toUpperCase(), cents }]));

  it("acha a maior alta e a maior queda relevantes", () => {
    const r = biggestCategoryChanges(
      m([["comida", 30000], ["uber", 5000], ["lazer", 10500]]),
      m([["comida", 20000], ["uber", 15000], ["lazer", 10000]]),
    );
    expect(r.up).toMatchObject({ categoryId: "comida", percent: 50 });
    expect(r.down).toMatchObject({ categoryId: "uber", percent: -67 });
  });

  it("ignora diferença pequena e categoria sem base no mês anterior", () => {
    const r = biggestCategoryChanges(m([["a", 3000], ["b", 99999]]), m([["a", 1000]]));
    expect(r).toEqual({ up: null, down: null }); // a: só R$ 20 a mais; b: não existia antes
  });
});

describe("greeting", () => {
  it("usa o horário de São Paulo", () => {
    expect(greeting(new Date("2026-11-19T11:00:00Z"))).toBe("Bom dia"); // 8h
    expect(greeting(new Date("2026-11-19T18:00:00Z"))).toBe("Boa tarde"); // 15h
    expect(greeting(new Date("2026-11-19T23:30:00Z"))).toBe("Boa noite"); // 20h30
  });
});
