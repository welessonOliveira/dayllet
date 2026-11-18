// PLACEHOLDER de Categorias: a tela de verdade será feita pelo Gemini.
import { listCategoriesGrouped } from "@/server/categories";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const { income, expense } = await listCategoriesGrouped(prisma);
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-bold">Categorias</h1>
      <p className="text-sm opacity-70">Placeholder</p>
      <p>
        {income.length} de receita e {expense.length} de despesa.
      </p>
    </section>
  );
}
