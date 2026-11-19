// Regras puras das "dicas do mês" e do histórico de saldo (mini gráfico das contas).
import { dateInputToUtc, toDateInput } from "./dates";

/** Soma `dias` a um "YYYY-MM-DD" (em dias de calendário). */
export function addDaysInput(day: string, dias: number): string {
  const d = dateInputToUtc(day);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Saldo da conta no fim de cada um dos últimos `days` dias (do mais antigo até hoje).
 * Parte do saldo atual e vai "desfazendo" os movimentos pagos pra trás.
 * `events`: movimentos que já entraram no saldo atual (+ entrada, − saída).
 */
export function balanceHistory(
  currentCents: number,
  events: { date: Date; deltaCents: number }[],
  days: number,
  now: Date = new Date(),
): number[] {
  const hoje = toDateInput(now);
  // Soma dos movimentos por dia (dia em São Paulo).
  const porDia = new Map<string, number>();
  for (const e of events) {
    const k = toDateInput(e.date);
    porDia.set(k, (porDia.get(k) ?? 0) + e.deltaCents);
  }
  // Movimentos com data depois de hoje (lançados como pagos no futuro) já estão no saldo atual:
  // o saldo "no fim de hoje" não inclui eles.
  let saldo = currentCents;
  for (const [k, v] of porDia) if (k > hoje) saldo -= v;

  const out: number[] = [];
  let dia = hoje;
  for (let i = 0; i < days; i++) {
    out.push(saldo);
    saldo -= porDia.get(dia) ?? 0; // fim do dia anterior = fim de hoje − o que aconteceu hoje
    dia = addDaysInput(dia, -1);
  }
  return out.reverse();
}

export type CategoryChange = {
  categoryId: string;
  name: string;
  currentCents: number;
  previousCents: number;
  /** Variação em % (arredondada). */
  percent: number;
};

/**
 * Maior alta e maior queda de gasto por categoria entre dois períodos.
 * Só conta mudança relevante: pelo menos 20% e R$ 50 de diferença.
 */
export function biggestCategoryChanges(
  current: Map<string, { name: string; cents: number }>,
  previous: Map<string, { name: string; cents: number }>,
  minDiffCents = 5000,
  minPercent = 20,
): { up: CategoryChange | null; down: CategoryChange | null } {
  const ids = new Set([...current.keys(), ...previous.keys()]);
  let up: CategoryChange | null = null;
  let down: CategoryChange | null = null;
  for (const id of ids) {
    const c = current.get(id)?.cents ?? 0;
    const p = previous.get(id)?.cents ?? 0;
    if (p <= 0) continue; // sem base de comparação
    const diff = c - p;
    const percent = Math.round((diff / p) * 100);
    if (Math.abs(diff) < minDiffCents || Math.abs(percent) < minPercent) continue;
    const item = {
      categoryId: id,
      name: current.get(id)?.name ?? previous.get(id)!.name,
      currentCents: c,
      previousCents: p,
      percent,
    };
    if (diff > 0 && (!up || diff > up.currentCents - up.previousCents)) up = item;
    if (diff < 0 && (!down || diff < down.currentCents - down.previousCents)) down = item;
  }
  return { up, down };
}

/** "Bom dia" / "Boa tarde" / "Boa noite" pelo horário de São Paulo. */
export function greeting(now: Date = new Date()): string {
  const h = Number(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(now),
  );
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}
