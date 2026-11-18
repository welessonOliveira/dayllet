import { ImportUploadClient } from "@/components/ImportUploadClient";
import { listImports } from "@/server/imports";
import { getPageCtx } from "@/server/session";
import { listWallets } from "@/server/wallets";

export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  const ctx = await getPageCtx();
  const [wallets, batches] = await Promise.all([
    listWallets(ctx),
    listImports(ctx),
  ]);

  return <ImportUploadClient wallets={wallets} batches={batches} />;
}
