import { describe, expect, it } from "vitest";
import {
  currentMonth,
  dateInputToUtc,
  formatDate,
  formatMonthLabel,
  isValidDateInput,
  monthOf,
  monthRange,
  shiftMonth,
  toDateInput,
} from "@/lib/dates";

describe("monthRange", () => {
  it("usa meia-noite de São Paulo (03:00 UTC)", () => {
    const { start, end } = monthRange("2026-11");
    expect(start.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-01T03:00:00.000Z");
  });

  it("vira o ano corretamente", () => {
    const { start, end } = monthRange("2026-12");
    expect(start.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("respeita o horário de verão antigo (2018)", () => {
    // Em 01/12/2018 São Paulo estava em -02:00.
    expect(monthRange("2018-11").end.toISOString()).toBe("2018-12-01T02:00:00.000Z");
  });

  it("rejeita mês inválido", () => {
    expect(() => monthRange("2026-13")).toThrow();
  });
});

describe("mês atual e mês de uma data", () => {
  it("23h de 31/10 em São Paulo ainda é outubro, mesmo já sendo novembro em UTC", () => {
    const instante = new Date("2026-11-01T02:00:00.000Z"); // 23:00 de 31/10 em SP
    expect(currentMonth(instante)).toBe("2026-10");
    expect(monthOf(instante)).toBe("2026-10");
  });

  it("shiftMonth soma e subtrai meses", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-05", -14)).toBe("2025-03");
  });
});

describe("data do formulário", () => {
  it("grava às 12:00 UTC e volta pro mesmo dia", () => {
    const d = dateInputToUtc("2026-11-30");
    expect(d.toISOString()).toBe("2026-11-30T12:00:00.000Z");
    expect(toDateInput(d)).toBe("2026-11-30");
    expect(formatDate(d)).toBe("30/11/2026");
  });

  it("dia 1º fica dentro do mês e o último dia não vaza pro próximo", () => {
    const { start, end } = monthRange("2026-11");
    expect(dateInputToUtc("2026-11-01") >= start).toBe(true);
    expect(dateInputToUtc("2026-11-30") < end).toBe(true);
  });

  it("valida datas que não existem", () => {
    expect(isValidDateInput("2026-02-28")).toBe(true);
    expect(isValidDateInput("2026-02-30")).toBe(false);
    expect(isValidDateInput("30/11/2026")).toBe(false);
  });

  it("formatMonthLabel em português", () => {
    expect(formatMonthLabel("2026-03")).toBe("março de 2026");
  });
});
