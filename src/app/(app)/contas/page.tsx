import { WalletsClient } from "@/components/WalletsClient";
import { getPageCtx } from "@/server/session";
import { listWalletsWithBalance } from "@/server/wallets";

export const dynamic = "force-dynamic";

export default async function ContasPage() {
  const ctx = await getPageCtx();
  const wallets = await listWalletsWithBalance(ctx);
  return <WalletsClient wallets={wallets} />;
}
