import { describe, expect, it } from "vitest";
import { dateInputToUtc as d, toDateInput } from "@/lib/dates";
import {
  type RuleSchedule,
  describeSchedule,
  nthOccurrence,
  occurrenceAmount,
  occurrencesBetween,
  occurrencesUntilMonthEnd,
  splitInstallments,
} from "@/lib/recurrence";

const datas = (lista: { date: Date }[]) => lista.map((o) => toDateInput(o.date));

const mensal = (start: string, extra: Partial<RuleSchedule> = {}): RuleSchedule => ({
  frequency: "MONTHLY",
  startDate: d(start),
  endDate: null,
  installments: null,
  ...extra,
});

describe("datas das ocorrências", () => {
  it("mensal no dia 31 vira o último dia em meses curtos, sem escorregar", () => {
    const r = mensal("2026-01-31");
    expect([0, 1, 2, 3].map((n) => toDateInput(nthOccurrence(r, n)))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31", // volta pro 31 (calcula a partir da primeira)
      "2026-04-30",
    ]);
  });

  it("fevereiro de ano bissexto tem 29", () => {
    expect(toDateInput(nthOccurrence(mensal("2027-12-30"), 2))).toBe("2028-02-29");
  });

  it("anual em 29/02 vira 28/02 em ano comum", () => {
    const r: RuleSchedule = { ...mensal("2028-02-29"), frequency: "YEARLY" };
    expect([0, 1, 4].map((n) => toDateInput(nthOccurrence(r, n)))).toEqual([
      "2028-02-29",
      "2029-02-28",
      "2032-02-29",
    ]);
  });

  it("semanal de 7 em 7 dias, atravessando o mês", () => {
    const r: RuleSchedule = { ...mensal("2026-11-25"), frequency: "WEEKLY" };
    expect(datas(occurrencesBetween(r, d("2026-11-01"), d("2026-12-10")))).toEqual([
      "2026-11-25",
      "2026-12-02",
      "2026-12-09",
    ]);
  });

  it("todas as datas ficam às 12:00 UTC (nunca mudam de dia)", () => {
    for (const o of occurrencesUntilMonthEnd(mensal("2026-01-31"), "2026-12")) {
      expect(o.date.getUTCHours()).toBe(12);
    }
  });
});

describe("limites da regra", () => {
  it("respeita o fim (endDate)", () => {
    const r = mensal("2026-01-10", { endDate: d("2026-04-10") });
    expect(datas(occurrencesUntilMonthEnd(r, "2026-12"))).toEqual([
      "2026-01-10",
      "2026-02-10",
      "2026-03-10",
      "2026-04-10",
    ]);
  });

  it("parcelado para no número de parcelas e o índice vira o número da parcela", () => {
    const r = mensal("2026-11-05", { installments: 3 });
    const occ = occurrencesUntilMonthEnd(r, "2027-12");
    expect(datas(occ)).toEqual(["2026-11-05", "2026-12-05", "2027-01-05"]);
    expect(occ.map((o) => o.index + 1)).toEqual([1, 2, 3]);
  });

  it("occurrencesBetween só devolve o intervalo pedido, mas com o índice certo", () => {
    const r = mensal("2026-01-15");
    const nov = occurrencesBetween(r, d("2026-11-01"), d("2026-11-30"));
    expect(nov).toHaveLength(1);
    expect(nov[0].index).toBe(10);
  });

  it("regra que começa depois do mês pedido não gera nada", () => {
    expect(occurrencesUntilMonthEnd(mensal("2027-01-01"), "2026-12")).toEqual([]);
  });
});

describe("parcelas em centavos (sem float)", () => {
  it("a última parcela leva o resto e a soma sempre bate", () => {
    expect(splitInstallments(10000, 3)).toEqual([3333, 3333, 3334]);
    expect(splitInstallments(100, 1)).toEqual([100]);
    for (const [total, n] of [
      [99999, 7],
      [1, 1],
      [123456, 12],
      [500000, 10],
    ]) {
      const p = splitInstallments(total, n);
      expect(p).toHaveLength(n);
      expect(p.reduce((a, b) => a + b, 0)).toBe(total);
      expect(p.every(Number.isInteger)).toBe(true);
    }
  });

  it("rejeita entradas inválidas", () => {
    expect(() => splitInstallments(0, 3)).toThrow();
    expect(() => splitInstallments(100, 0)).toThrow();
    expect(() => splitInstallments(10.5, 2)).toThrow();
  });

  it("occurrenceAmount: parcelado divide o total, recorrente repete o valor", () => {
    expect([0, 1, 2].map((i) => occurrenceAmount({ amountCents: 10000, installments: 3 }, i))).toEqual([
      3333, 3333, 3334,
    ]);
    expect(occurrenceAmount({ amountCents: 4590, installments: null }, 7)).toBe(4590);
  });
});

describe("descrição da regra", () => {
  it("texto curto pra tela", () => {
    expect(describeSchedule(mensal("2026-01-31"))).toBe("Todo mês, dia 31");
    expect(describeSchedule(mensal("2026-01-31", { installments: 10 }))).toBe("Parcelado em 10x");
    expect(describeSchedule({ ...mensal("2026-01-01"), frequency: "WEEKLY" })).toBe("Toda semana");
  });
});
