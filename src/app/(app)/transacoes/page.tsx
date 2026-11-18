import { TransactionsClient } from "@/components/TransactionsClient";
import { type SearchParams, parseTransactionFilters } from "@/lib/validations";
import { listCategories } from "@/server/categories";
import { getPageCtx } from "@/server/session";
import { listTransactions } from "@/server/transactions";

export default async function TransacoesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await getPageCtx();
  const filters = parseTransactionFilters(await searchParams);
  const [transactions, categories] = await Promise.all([
    listTransactions(ctx, filters),
    listCategories(ctx),
  ]);

  return (
    <TransactionsClient
      transactions={transactions}
      categories={categories}
      filters={filters}
    />
  );
}
