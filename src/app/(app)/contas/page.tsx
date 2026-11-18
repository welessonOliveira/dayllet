import { WalletsClient } from "@/components/WalletsClient";
import { currentMonth, isValidMonth } from "@/lib/dates";
import type { SearchParams } from "@/lib/validations";
import { getPageCtx } from "@/server/session";
import { listTransfers } from "@/server/transfers";
import { listWalletsWithBalance } from "@/server/wallets";

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

  const [wallets, transfers] = await Promise.all([
    listWalletsWithBalance(ctx),
    listTransfers(ctx, month),
  ]);

  return (
    <WalletsClient wallets={wallets} transfers={transfers} month={month} />
  );
}
