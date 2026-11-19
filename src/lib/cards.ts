// Fatura do cartão de crédito. Puro, sem banco.
//
// Regras (como os bancos brasileiros fazem):
// - A fatura é identificada pelo MÊS EM QUE ELA FECHA ("2026-11" fecha em novembro).
// - Compra feita NO dia do fechamento ou depois já cai na fatura seguinte.
// - Fechamento no dia 31 em mês curto = último dia do mês.
// - Vencimento: se o dia de vencimento é depois do fechamento, vence no mesmo mês;
//   senão, no mês seguinte (fecha 25, vence 5 do outro mês).
import { type Month, dateInputToUtc, monthOf, shiftMonth, toDateInput } from "./dates";

function diasNoMes(month: Month): number {
  const [a, m] = month.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** Data (12:00 UTC) do dia `day` no mês, limitado ao último dia do mês. */
export function dayInMonth(month: Month, day: number): Date {
  const d = Math.min(day, diasNoMes(month));
  return dateInputToUtc(`${month}-${String(d).padStart(2, "0")}`);
}

/** Em qual fatura (mês de fechamento) cai uma compra feita em `date`. */
export function invoiceMonthOf(date: Date, closingDay: number): Month {
  const mes = monthOf(date);
  const dia = Number(toDateInput(date).slice(8, 10));
  return dia >= Math.min(closingDay, diasNoMes(mes)) ? shiftMonth(mes, 1) : mes;
}

export type InvoiceDates = {
  month: Month;
  /** Dia em que a fatura fecha (as compras desse dia já vão pra próxima). */
  closingDate: Date;
  /** Fechamento da fatura anterior: compras de [opensAt, closingDate) entram nesta. */
  opensAt: Date;
  dueDate: Date;
};

export function invoiceDates(month: Month, closingDay: number, dueDay: number): InvoiceDates {
  return {
    month,
    closingDate: dayInMonth(month, closingDay),
    opensAt: dayInMonth(shiftMonth(month, -1), closingDay),
    dueDate: dayInMonth(dueDay > closingDay ? month : shiftMonth(month, 1), dueDay),
  };
}

export type InvoiceStatus = "OPEN" | "CLOSED" | "PAID" | "OVERDUE" | "FUTURE";

/**
 * Situação da fatura em `today`. `totalCents` é o que foi gasto nela (compras − estornos)
 * e `paidCents` o que entrou no cartão depois que ela fechou.
 */
export function invoiceStatus(d: InvoiceDates, totalCents: number, paidCents: number, today: Date): InvoiceStatus {
  const hoje = toDateInput(today);
  if (hoje < toDateInput(d.opensAt)) return "FUTURE";
  if (hoje < toDateInput(d.closingDate)) return "OPEN";
  if (totalCents <= 0 || paidCents >= totalCents) return "PAID";
  return hoje > toDateInput(d.dueDate) ? "OVERDUE" : "CLOSED";
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  OPEN: "Aberta",
  CLOSED: "Fechada",
  PAID: "Paga",
  OVERDUE: "Atrasada",
  FUTURE: "Futura",
};
