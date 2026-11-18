import { TransactionsClient } from "@/components/TransactionsClient";
import { type SearchParams, parseTransactionFilters } from "@/lib/validations";
import { listCategories } from "@/server/categories";
import { getPageCtx } from "@/server/session";
import { listTransactions } from "@/server/transactions";
import { listWallets } from "@/server/wallets";

export default async function TransacoesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await getPageCtx();
  const filters = parseTransactionFilters(await searchParams);
  const [transactions, categories, wallets] = await Promise.all([
    listTransactions(ctx, filters),
    listCategories(ctx),
    listWallets(ctx),
  ]);

  return (
    <TransactionsClient
      transactions={transactions}
      categories={categories}
      wallets={wallets}
      filters={filters}
    />
  );
}
