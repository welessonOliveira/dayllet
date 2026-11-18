// Regras puras de lançamentos recorrentes (contas fixas) e parcelados.
// Tudo em datas "de calendário" (dia em São Paulo), representadas como Date às 12:00 UTC,
// igual às transações (Decisão 5). Nada aqui acessa o banco.
import { dateInputToUtc, monthRange, shiftMonth, toDateInput } from "./dates";

export const FREQUENCIES = ["WEEKLY", "MONTHLY", "YEARLY"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  WEEKLY: "Toda semana",
  MONTHLY: "Todo mês",
  YEARLY: "Todo ano",
};

/** O mínimo de uma regra que o cálculo de datas precisa. */
export type RuleSchedule = {
  frequency: Frequency;
  /** Primeira ocorrência (12:00 UTC). O dia dela define o "dia do mês" das próximas. */
  startDate: Date;
  /** Última data possível (inclusiva), ou null = sem fim. */
  endDate: Date | null;
  /** Parcelado: quantas parcelas no total. null = recorrente sem número fixo. */
  installments: number | null;
};

const DIA_MS = 24 * 60 * 60 * 1000;

function partes(d: Date): { y: number; m: number; day: number } {
  const [y, m, day] = toDateInput(d).split("-").map(Number);
  return { y, m, day };
}

function diasNoMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // dia 0 do mês seguinte = último dia deste
}

/** Data de calendário às 12:00 UTC, com o dia limitado ao último dia do mês (31 -> 30, 29 de fev -> 28). */
function diaLimitado(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, Math.min(day, diasNoMes(y, m)), 12));
}

/**
 * N-ésima ocorrência (0 = a primeira) de uma regra.
 * - Mensal: mesmo dia do mês da primeira; dia 31 vira o último dia em meses curtos.
 * - Anual: mesmo dia e mês; 29/02 vira 28/02 em ano não bissexto.
 * - Semanal: de 7 em 7 dias.
 * Calcula sempre a partir da primeira (não da anterior), pra não "escorregar":
 * 31/01 -> 28/02 -> 31/03 (e não 28/03).
 */
export function nthOccurrence(rule: Pick<RuleSchedule, "frequency" | "startDate">, n: number): Date {
  const { y, m, day } = partes(rule.startDate);
  if (rule.frequency === "WEEKLY") {
    return new Date(dateInputToUtc(toDateInput(rule.startDate)).getTime() + n * 7 * DIA_MS);
  }
  if (rule.frequency === "YEARLY") return diaLimitado(y + n, m, day);
  const [ny, nm] = shiftMonth(`${y}-${String(m).padStart(2, "0")}`, n).split("-").map(Number);
  return diaLimitado(ny, nm, day);
}

export type Occurrence = {
  /** Índice da ocorrência (0 = primeira). No parcelado, parcela = index + 1. */
  index: number;
  /** Data da ocorrência (12:00 UTC). É a "identidade" dela: não muda se o lançamento for editado. */
  date: Date;
};

/**
 * Ocorrências da regra entre `from` e `to` (inclusive), em ordem.
 * Respeita o fim (endDate) e o número de parcelas.
 * `limit` é uma trava de segurança contra loop infinito.
 */
export function occurrencesBetween(rule: RuleSchedule, from: Date, to: Date, limit = 1000): Occurrence[] {
  const out: Occurrence[] = [];
  for (let i = 0; i < limit; i++) {
    if (rule.installments !== null && i >= rule.installments) break;
    const date = nthOccurrence(rule, i);
    if (date > to) break;
    if (rule.endDate && date > rule.endDate) break;
    if (date >= from) out.push({ index: i, date });
  }
  return out;
}

/** Ocorrências da regra até o fim do mês `month` ("YYYY-MM"), desde o começo. */
export function occurrencesUntilMonthEnd(rule: RuleSchedule, month: string): Occurrence[] {
  const fimDoMes = new Date(monthRange(month).end.getTime() - 1);
  return occurrencesBetween(rule, rule.startDate, fimDoMes);
}

/**
 * Divide um valor total em N parcelas inteiras (centavos).
 * As primeiras ficam com o valor "redondo" e a ÚLTIMA leva o resto,
 * então a soma sempre bate: 10000 em 3 -> [3333, 3333, 3334].
 */
export function splitInstallments(totalCents: number, n: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents <= 0) throw new Error("Total inválido.");
  if (!Number.isInteger(n) || n < 1) throw new Error("Número de parcelas inválido.");
  const base = Math.floor(totalCents / n);
  const parcelas = Array<number>(n).fill(base);
  parcelas[n - 1] = totalCents - base * (n - 1);
  return parcelas;
}

/** Valor da ocorrência `index`: no parcelado, a parcela; no recorrente, o valor cheio. */
export function occurrenceAmount(
  rule: { amountCents: number; installments: number | null },
  index: number,
): number {
  if (rule.installments === null) return rule.amountCents;
  return splitInstallments(rule.amountCents, rule.installments)[index];
}

/** Texto curto da regra: "Todo mês, dia 31", "Parcelado em 10x", "Toda semana". */
export function describeSchedule(rule: RuleSchedule): string {
  if (rule.installments !== null) return `Parcelado em ${rule.installments}x`;
  if (rule.frequency === "MONTHLY") return `Todo mês, dia ${partes(rule.startDate).day}`;
  return FREQUENCY_LABEL[rule.frequency];
}
