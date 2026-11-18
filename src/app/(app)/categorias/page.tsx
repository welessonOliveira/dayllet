import { CategoriesClient } from "@/components/CategoriesClient";
import { listCategoriesGrouped } from "@/server/categories";
import { getPageCtx } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const ctx = await getPageCtx();
  const { income, expense } = await listCategoriesGrouped(ctx);
  return <CategoriesClient income={income} expense={expense} />;
}
