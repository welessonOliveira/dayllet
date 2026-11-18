// Regras puras de metas de economia ("PC novo: R$ 4.000 até março").
import { currentMonth, monthOf } from "./dates";

export type GoalProgress = {
  targetCents: number;
  savedCents: number;
  /** Quanto falta (0 quando já bateu a meta). */
  remainingCents: number;
  /** Percentual guardado (inteiro, pode passar de 100). */
  percent: number;
  /** Percentual limitado a 100 (largura da barra). */
  percentBar: number;
  done: boolean;
  /** Meses até a data alvo, contando o mês atual (null = sem data). 0 = a data já passou. */
  monthsLeft: number | null;
  /** Quanto guardar por mês pra chegar na data (arredondado PRA CIMA, em centavos). */
  monthlyNeededCents: number | null;
  /** true quando tem data, não bateu a meta e a data já passou. */
  overdue: boolean;
};

/** Meses do mês atual até o mês da data alvo, contando os dois (nov -> mar = 5). */
export function monthsUntil(targetDate: Date, now: Date = new Date()): number {
  const [ay, am] = currentMonth(now).split("-").map(Number);
  const [ty, tm] = monthOf(targetDate).split("-").map(Number);
  return Math.max((ty - ay) * 12 + (tm - am) + 1, 0);
}

export function calcGoalProgress(
  targetCents: number,
  savedCents: number,
  targetDate: Date | null,
  now: Date = new Date(),
): GoalProgress {
  const remainingCents = Math.max(targetCents - savedCents, 0);
  const percent = targetCents > 0 ? Math.floor((savedCents * 100) / targetCents) : 0;
  const done = savedCents >= targetCents;
  const monthsLeft = targetDate ? monthsUntil(targetDate, now) : null;
  let monthlyNeededCents: number | null = null;
  if (monthsLeft !== null && !done) {
    // Divisão inteira arredondando pra cima: guardar 1 centavo a mais é melhor que faltar.
    monthlyNeededCents = monthsLeft > 0 ? Math.ceil(remainingCents / monthsLeft) : remainingCents;
  }
  return {
    targetCents,
    savedCents,
    remainingCents,
    percent: Math.max(percent, 0),
    percentBar: Math.min(Math.max(percent, 0), 100),
    done,
    monthsLeft,
    monthlyNeededCents,
    overdue: monthsLeft === 0 && !done,
  };
}
