import { WalletsClient } from "@/components/WalletsClient";
import { currentMonth, isValidMonth } from "@/lib/dates";
import type { SearchParams } from "@/lib/validations";
import { listCardInvoices } from "@/server/cards";
import { getPageCtx } from "@/server/session";
import { listTransfers } from "@/server/transfers";
import { getWalletHistories, listWalletsWithBalance } from "@/server/wallets";

export default async function ContasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await getPageCtx();
  const params = await searchParams;
  const rawMonth = Array.isArray(params.month) ? params.month[0] : params.month;
  const month =
    rawMonth && isValidMonth(rawMonth.trim())
      ? rawMonth.trim()
      : currentMonth();

  const [wallets, transfers, cards] = await Promise.all([
    listWalletsWithBalance(ctx),
    listTransfers(ctx, month),
    listCardInvoices(ctx),
  ]);
  const histories = await getWalletHistories(ctx, wallets, 30);

  return (
    <WalletsClient wallets={wallets} transfers={transfers} month={month} cards={cards} histories={histories} />
  );
}
