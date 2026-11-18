import { RecurringClient } from "@/components/RecurringClient";
import { listCategories } from "@/server/categories";
import { listRecurringRules } from "@/server/recurring";
import { getPageCtx } from "@/server/session";
import { listWallets } from "@/server/wallets";

export const dynamic = "force-dynamic";

export default async function RecorrentesPage() {
  const ctx = await getPageCtx();
  const [rules, categories, wallets] = await Promise.all([
    listRecurringRules(ctx),
    listCategories(ctx),
    listWallets(ctx),
  ]);

  return (
    <RecurringClient
      rules={rules}
      categories={categories}
      wallets={wallets}
    />
  );
}
