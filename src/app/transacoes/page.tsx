// PLACEHOLDER de Transações: a tela de verdade será feita pelo Gemini.
import { formatMonthLabel } from "@/lib/dates";
import { type SearchParams, parseTransactionFilters } from "@/lib/validations";
import { prisma } from "@/server/db";
import { listTransactions } from "@/server/transactions";

export default async function TransacoesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseTransactionFilters(await searchParams);
  const transacoes = await listTransactions(prisma, filters);
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-bold">Transações</h1>
      <p className="text-sm opacity-70">Placeholder · {formatMonthLabel(filters.month)}</p>
      <p>{transacoes.length} transações neste mês.</p>
    </section>
  );
}
