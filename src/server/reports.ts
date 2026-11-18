// Relatórios: exportação CSV e gastos corrigidos pela inflação. Só leitura.
import { csvMoney, csvText, buildCsv } from "@/lib/csv";
import { CATEGORY_TYPE_LABEL, statusLabel } from "@/lib/constants";
import { currentMonth, formatDate, monthRange, shiftMonth } from "@/lib/dates";
import { accumulatedBps, adjustForInflation } from "@/lib/ipca";
import type { TransactionFilters } from "@/lib/validations";
import type { Ctx } from "./context";
import { type Fetcher, getIpcaRates } from "./indexRates";
import { listTransactions } from "./transactions";

/** CSV das transações com os mesmos filtros da tela. Nome do arquivo incluso. */
export async function exportTransactionsCsv(
  ctx: Ctx,
  filters: TransactionFilters,
): Promise<{ fileName: string; content: string }> {
  const txs = await listTransactions(ctx, filters);
  const header = ["Data", "Descrição", "Categoria", "Conta", "Tipo", "Situação", "Valor (R$)", "Observações"];
  const rows = [...txs].reverse().map((t) => [
    formatDate(t.date),
    csvText(t.description),
    csvText(t.category.name),
    csvText(t.wallet.name),
    CATEGORY_TYPE_LABEL[t.type],
    statusLabel(t.type, t.status),
    csvMoney(t.type === "EXPENSE" ? -t.amountCents : t.amountCents),
    csvText(t.notes),
  ]);
  return { fileName: `transacoes-${filters.month}.csv`, content: buildCsv(header, rows) };
}

export type InflationRow = {
  month: string;
  /** Despesas do mês (pagas e pendentes), em valores da época. */
  expenseCents: number;
  /** As mesmas despesas em "dinheiro de hoje" (corrigidas pelo IPCA até o último mês publicado). */
  adjustedCents: number;
  /** Inflação acumulada do mês até o último IPCA, em bps (1,23% = 123). */
  inflationBps: number;
};

export type InflationReport = {
  rows: InflationRow[];
  /** Último mês com IPCA publicado (null = sem dados, API fora do ar e cache vazio). */
  lastIpcaMonth: string | null;
};

/**
 * Gastos dos últimos `months` meses, nominais e corrigidos pela inflação.
 * Responde: "gastei mais mesmo, ou foi a inflação?".
 */
export async function getInflationReport(
  ctx: Ctx,
  months = 12,
  now = new Date(),
  fetcher?: Fetcher,
): Promise<InflationReport> {
  const n = Math.min(Math.max(months, 1), 36);
  const atual = currentMonth(now);
  const meses = Array.from({ length: n }, (_, i) => shiftMonth(atual, i - n + 1));
  const [rates, txs] = await Promise.all([
    getIpcaRates(ctx.db, now, fetcher),
    ctx.db.transaction.findMany({
      where: {
        userId: ctx.userId,
        type: "EXPENSE",
        date: { gte: monthRange(meses[0]).start, lt: monthRange(atual).end },
      },
      select: { date: true, amountCents: true },
    }),
  ]);
  const lastIpcaMonth = rates.at(-1)?.month ?? null;
  const ate = lastIpcaMonth ?? atual;

  return {
    lastIpcaMonth,
    rows: meses.map((m) => {
      const { start, end } = monthRange(m);
      const expenseCents = txs.filter((t) => t.date >= start && t.date < end).reduce((s, t) => s + t.amountCents, 0);
      return {
        month: m,
        expenseCents,
        adjustedCents: adjustForInflation(expenseCents, m, ate, rates),
        inflationBps: accumulatedBps(m, ate, rates),
      };
    }),
  };
}
