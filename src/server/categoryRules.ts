// Regras de categorização aprendidas (Decisão 21). Todas recebem o contexto { db, userId }.
// Aprende quando o usuário escolhe uma categoria (lançamento manual, edição ou importação)
// e sugere pra descrições parecidas depois.
import type { Category, CategoryRule } from "@prisma/client";
import { type CategoryRuleLike, builtinRules, ruleKey, suggestWithBuiltins } from "@/lib/categorize";
import type { CategoryType } from "@/lib/constants";
import { DomainError } from "@/lib/errors";
import type { Ctx } from "./context";

/** Regras do usuário no formato que a função pura entende. */
export async function loadRules(ctx: Ctx): Promise<CategoryRuleLike[]> {
  const rules = await ctx.db.categoryRule.findMany({
    where: { userId: ctx.userId },
    include: { category: { select: { type: true } } },
  });
  return rules.map((r) => ({ pattern: r.pattern, categoryId: r.categoryId, categoryType: r.category.type, hits: r.hits }));
}

/** Regras do dicionário de estabelecimentos (Uber, iFood, farmácia...) pras categorias do usuário. */
export async function loadBuiltinRules(ctx: Ctx): Promise<CategoryRuleLike[]> {
  const cats = await ctx.db.category.findMany({
    where: { userId: ctx.userId },
    select: { id: true, name: true, type: true },
  });
  return builtinRules(cats);
}

/** Sugestão de categoria pra uma descrição (ou null): primeiro o que o usuário ensinou, depois o dicionário. */
export async function suggestCategoryFor(
  ctx: Ctx,
  description: string,
  type: CategoryType,
): Promise<{ categoryId: string; pattern: string } | null> {
  const [learned, builtins] = await Promise.all([loadRules(ctx), loadBuiltinRules(ctx)]);
  return suggestWithBuiltins(description, type, learned, builtins);
}

/**
 * Aprende "descrição -> categoria". Se a regra já existe com a mesma categoria,
 * fica mais forte (hits + 1); se era outra categoria, passa a valer a nova.
 * Descrição sem palavra útil (ex.: "PIX 123") não gera regra.
 */
export async function learnCategory(ctx: Ctx, description: string, categoryId: string): Promise<void> {
  const pattern = ruleKey(description);
  if (!pattern) return;
  const existente = await ctx.db.categoryRule.findUnique({
    where: { userId_pattern: { userId: ctx.userId, pattern } },
  });
  if (!existente) {
    await ctx.db.categoryRule.createMany({
      data: [{ userId: ctx.userId, pattern, categoryId }],
      skipDuplicates: true, // corrida entre duas requisições: tudo bem
    });
  } else if (existente.categoryId === categoryId) {
    await ctx.db.categoryRule.update({ where: { id: existente.id }, data: { hits: { increment: 1 } } });
  } else {
    await ctx.db.categoryRule.update({ where: { id: existente.id }, data: { categoryId, hits: 1 } });
  }
}

/** Regras do usuário (mais usadas primeiro), pra uma tela de "regras aprendidas". */
export function listCategoryRules(ctx: Ctx): Promise<(CategoryRule & { category: Category })[]> {
  return ctx.db.categoryRule.findMany({
    where: { userId: ctx.userId },
    include: { category: true },
    orderBy: [{ hits: "desc" }, { pattern: "asc" }],
  });
}

export async function deleteCategoryRule(ctx: Ctx, id: string): Promise<void> {
  const r = await ctx.db.categoryRule.deleteMany({ where: { id, userId: ctx.userId } });
  if (r.count === 0) throw new DomainError("Regra não encontrada.");
}
