import { CategoriesClient } from "@/components/CategoriesClient";
import { LearnedRulesSection } from "@/components/LearnedRulesSection";
import { listCategoriesGrouped } from "@/server/categories";
import { listCategoryRules } from "@/server/categoryRules";
import { getPageCtx } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const ctx = await getPageCtx();
  const [{ income, expense }, rules] = await Promise.all([
    listCategoriesGrouped(ctx),
    listCategoryRules(ctx),
  ]);

  return (
    <div>
      <CategoriesClient income={income} expense={expense} />
      <LearnedRulesSection rules={rules} />
    </div>
  );
}
