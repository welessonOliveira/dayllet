import { describe, expect, it } from "vitest";
import { invoiceDates, invoiceMonthOf, invoiceStatus } from "@/lib/cards";
import { dateInputToUtc, toDateInput } from "@/lib/dates";

const d = (s: string) => dateInputToUtc(s);

describe("fatura do cartão", () => {
  it("compra antes do fechamento fica na fatura do mês; no dia do fechamento ou depois, vai pra próxima", () => {
    expect(invoiceMonthOf(d("2026-11-02"), 3)).toBe("2026-11");
    expect(invoiceMonthOf(d("2026-11-03"), 3)).toBe("2026-12");
    expect(invoiceMonthOf(d("2026-12-28"), 3)).toBe("2027-01");
  });

  it("fechamento no dia 31 em mês curto usa o último dia", () => {
    expect(invoiceMonthOf(d("2026-02-27"), 31)).toBe("2026-02");
    expect(invoiceMonthOf(d("2026-02-28"), 31)).toBe("2026-03");
  });

  it("datas da fatura: abre no fechamento anterior; vence no mesmo mês ou no seguinte", () => {
    const a = invoiceDates("2026-11", 3, 10);
    expect([a.opensAt, a.closingDate, a.dueDate].map(toDateInput)).toEqual(["2026-10-03", "2026-11-03", "2026-11-10"]);
    const b = invoiceDates("2026-11", 25, 5);
    expect(toDateInput(b.dueDate)).toBe("2026-12-05");
  });

  it("situação: aberta, fechada, paga, atrasada e futura", () => {
    const f = invoiceDates("2026-11", 3, 10);
    expect(invoiceStatus(f, 50000, 0, d("2026-10-20"))).toBe("OPEN");
    expect(invoiceStatus(f, 50000, 0, d("2026-11-05"))).toBe("CLOSED");
    expect(invoiceStatus(f, 50000, 50000, d("2026-11-05"))).toBe("PAID");
    expect(invoiceStatus(f, 50000, 10000, d("2026-11-11"))).toBe("OVERDUE");
    expect(invoiceStatus(f, 50000, 0, d("2026-09-01"))).toBe("FUTURE");
    expect(invoiceStatus(f, 0, 0, d("2026-11-20"))).toBe("PAID"); // nada gasto
  });
});
