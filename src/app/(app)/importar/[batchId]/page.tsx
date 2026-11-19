import { notFound } from "next/navigation";
import { ImportReviewClient } from "@/components/ImportReviewClient";
import { listCategories } from "@/server/categories";
import { getImport } from "@/server/imports";
import { getPageCtx } from "@/server/session";
import { listWallets } from "@/server/wallets";

export const dynamic = "force-dynamic";

export default async function ImportReviewPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const ctx = await getPageCtx();
  const { batchId } = await params;

  const [batch, categories, wallets] = await Promise.all([
    getImport(ctx, batchId),
    listCategories(ctx),
    listWallets(ctx),
  ]);

  if (!batch) notFound();

  return <ImportReviewClient batch={batch} categories={categories} wallets={wallets} />;
}
