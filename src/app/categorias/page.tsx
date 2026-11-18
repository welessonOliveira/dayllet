import { CategoriesClient } from "@/components/CategoriesClient";
import { listCategoriesGrouped } from "@/server/categories";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const { income, expense } = await listCategoriesGrouped(prisma);
  return <CategoriesClient income={income} expense={expense} />;
}
