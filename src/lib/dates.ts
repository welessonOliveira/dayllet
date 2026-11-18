// Helpers de data. Regra do projeto:
// - no banco tudo é UTC;
// - toda conta de "mês" é feita no fuso de São Paulo e depois vira intervalo UTC;
// - data sem hora (do formulário) é gravada às 12:00 UTC, pra nunca mudar de dia.

export const APP_TIME_ZONE = "America/Sao_Paulo";

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Mês no formato "YYYY-MM". */
export type Month = string;

export function isValidMonth(value: string): boolean {
  return MONTH_RE.test(value);
}

/** Confere se "YYYY-MM-DD" é uma data que existe (ex.: rejeita 2026-02-30). */
export function isValidDateInput(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

// Partes (ano, mês, dia, hora...) de um instante no fuso do app.
function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// Diferença (ms) entre o horário de São Paulo e o UTC naquele instante.
function offsetMs(date: Date): number {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// Meia-noite de um dia em São Paulo, como instante UTC.
function zonedMidnightToUtc(year: number, month: number, day: number): Date {
  const guess = Date.UTC(year, month - 1, day);
  let result = guess - offsetMs(new Date(guess));
  // Segunda passada cobre mudança de offset (horário de verão antigo).
  result = guess - offsetMs(new Date(result));
  return new Date(result);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Mês ("YYYY-MM") de um instante, no fuso de São Paulo. */
export function monthOf(date: Date): Month {
  const p = zonedParts(date);
  return `${p.year}-${pad(p.month)}`;
}

/** Mês atual em São Paulo. */
export function currentMonth(now: Date = new Date()): Month {
  return monthOf(now);
}

/** Soma (ou subtrai) meses: shiftMonth("2026-01", -1) -> "2025-12". */
export function shiftMonth(month: Month, delta: number): Month {
  const m = MONTH_RE.exec(month);
  if (!m) throw new Error(`Mês inválido: ${month}`);
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/**
 * Intervalo UTC de um mês de São Paulo.
 * `start` é inclusivo e `end` é exclusivo (início do mês seguinte).
 */
export function monthRange(month: Month): { start: Date; end: Date } {
  const m = MONTH_RE.exec(month);
  if (!m) throw new Error(`Mês inválido: ${month}`);
  const next = MONTH_RE.exec(shiftMonth(month, 1))!;
  return {
    start: zonedMidnightToUtc(Number(m[1]), Number(m[2]), 1),
    end: zonedMidnightToUtc(Number(next[1]), Number(next[2]), 1),
  };
}

/** "YYYY-MM-DD" do formulário -> Date às 12:00 UTC daquele dia. */
export function dateInputToUtc(value: string): Date {
  if (!isValidDateInput(value)) throw new Error(`Data inválida: ${value}`);
  const [y, mo, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 12));
}

/** Date -> "YYYY-MM-DD" (dia em São Paulo), pra preencher input type="date". */
export function toDateInput(date: Date): string {
  const p = zonedParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Hoje em São Paulo, como "YYYY-MM-DD". */
export function todayInput(now: Date = new Date()): string {
  return toDateInput(now);
}

/** Date -> "18/11/2026" (São Paulo). */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** "2026-11" -> "novembro de 2026". */
export function formatMonthLabel(month: Month): string {
  const { start } = monthRange(month);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(start);
}
