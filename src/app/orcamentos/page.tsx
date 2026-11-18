// PLACEHOLDER de Orçamentos: a tela de verdade será feita pelo Gemini.
import { currentMonth, formatMonthLabel } from "@/lib/dates";
import { listBudgetsWithProgress } from "@/server/budgets";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function OrcamentosPage() {
  const month = currentMonth();
  const budgets = await listBudgetsWithProgress(prisma, month);
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-bold">Orçamentos</h1>
      <p className="text-sm opacity-70">Placeholder · {formatMonthLabel(month)}</p>
      <p>{budgets.length} orçamentos neste mês.</p>
    </section>
  );
}
