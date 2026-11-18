import { TransactionsClient } from "@/components/TransactionsClient";
import { type SearchParams, parseTransactionFilters } from "@/lib/validations";
import { listCategories } from "@/server/categories";
import { prisma } from "@/server/db";
import { listTransactions } from "@/server/transactions";

export default async function TransacoesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseTransactionFilters(await searchParams);
  const [transactions, categories] = await Promise.all([
    listTransactions(prisma, filters),
    listCategories(prisma),
  ]);

  return (
    <TransactionsClient
      transactions={transactions}
      categories={categories}
      filters={filters}
    />
  );
}
