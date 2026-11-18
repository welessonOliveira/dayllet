import { notFound } from "next/navigation";
import { ImportReviewClient } from "@/components/ImportReviewClient";
import { listCategories } from "@/server/categories";
import { getImport } from "@/server/imports";
import { getPageCtx } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function ImportReviewPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const ctx = await getPageCtx();
  const { batchId } = await params;

  const [batch, categories] = await Promise.all([
    getImport(ctx, batchId),
    listCategories(ctx),
  ]);

  if (!batch) notFound();

  return <ImportReviewClient batch={batch} categories={categories} />;
}
