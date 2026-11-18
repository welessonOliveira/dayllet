// Metas de economia. Todas recebem o contexto { db, userId }.
import type { Goal, GoalContribution } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { type GoalProgress, calcGoalProgress } from "@/lib/goals";
import type { GoalContributionData, GoalData } from "@/lib/validations";
import type { Ctx } from "./context";
import { isUniqueError } from "./db";

export type GoalWithProgress = Goal & { progress: GoalProgress; contributionCount: number };

const NAO_ENCONTRADA = "Meta não encontrada.";
const NOME_DUPLICADO = "Você já tem uma meta com esse nome.";

async function getOwnGoal(ctx: Ctx, id: string): Promise<Goal> {
  const g = await ctx.db.goal.findFirst({ where: { id, userId: ctx.userId } });
  if (!g) throw new DomainError(NAO_ENCONTRADA);
  return g;
}

async function savedOf(ctx: Ctx, goalId: string): Promise<number> {
  const s = await ctx.db.goalContribution.aggregate({ where: { goalId }, _sum: { amountCents: true } });
  return s._sum.amountCents ?? 0;
}

/** Metas com progresso. Arquivadas só se pedir. Não concluídas primeiro, depois por prazo. */
export async function listGoals(
  ctx: Ctx,
  opts: { includeArchived?: boolean } = {},
  now = new Date(),
): Promise<GoalWithProgress[]> {
  const goals = await ctx.db.goal.findMany({
    where: { userId: ctx.userId, ...(opts.includeArchived ? {} : { archived: false }) },
    orderBy: [{ targetDate: { sort: "asc", nulls: "last" } }, { name: "asc" }],
  });
  const somas = await ctx.db.goalContribution.groupBy({
    by: ["goalId"],
    where: { goalId: { in: goals.map((g) => g.id) } },
    _sum: { amountCents: true },
    _count: { _all: true },
  });
  const por = new Map(somas.map((s) => [s.goalId, s]));
  const lista = goals.map((g) => ({
    ...g,
    progress: calcGoalProgress(g.targetCents, por.get(g.id)?._sum.amountCents ?? 0, g.targetDate, now),
    contributionCount: por.get(g.id)?._count._all ?? 0,
  }));
  return lista.sort((a, b) => Number(a.progress.done) - Number(b.progress.done));
}

export async function getGoal(ctx: Ctx, id: string, now = new Date()) {
  const g = await ctx.db.goal.findFirst({
    where: { id, userId: ctx.userId },
    include: { contributions: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] } },
  });
  if (!g) return null;
  const saved = g.contributions.reduce((s, c) => s + c.amountCents, 0);
  return { ...g, progress: calcGoalProgress(g.targetCents, saved, g.targetDate, now) };
}

export async function createGoal(ctx: Ctx, data: GoalData): Promise<Goal> {
  try {
    return await ctx.db.goal.create({ data: { ...data, userId: ctx.userId } });
  } catch (e) {
    if (isUniqueError(e)) throw new DomainError(NOME_DUPLICADO);
    throw e;
  }
}

export async function updateGoal(ctx: Ctx, id: string, data: GoalData): Promise<Goal> {
  await getOwnGoal(ctx, id);
  try {
    return await ctx.db.goal.update({ where: { id }, data });
  } catch (e) {
    if (isUniqueError(e)) throw new DomainError(NOME_DUPLICADO);
    throw e;
  }
}

export async function setGoalArchived(ctx: Ctx, id: string, archived: boolean): Promise<Goal> {
  await getOwnGoal(ctx, id);
  return ctx.db.goal.update({ where: { id }, data: { archived } });
}

/** Apaga a meta e o histórico de depósitos dela. */
export async function deleteGoal(ctx: Ctx, id: string): Promise<void> {
  await getOwnGoal(ctx, id);
  await ctx.db.goal.delete({ where: { id } });
}

/** Guarda (positivo) ou retira (negativo) dinheiro da meta. Não dá pra tirar mais do que tem. */
export async function addGoalContribution(
  ctx: Ctx,
  goalId: string,
  data: GoalContributionData,
): Promise<GoalContribution> {
  await getOwnGoal(ctx, goalId);
  if (data.amountCents === 0) throw new DomainError("O valor precisa ser maior que zero.");
  if (data.amountCents < 0) {
    const guardado = await savedOf(ctx, goalId);
    if (guardado + data.amountCents < 0) {
      throw new DomainError("Não dá pra retirar mais do que está guardado nessa meta.");
    }
  }
  return ctx.db.goalContribution.create({ data: { ...data, goalId } });
}

export async function deleteGoalContribution(ctx: Ctx, id: string): Promise<void> {
  const c = await ctx.db.goalContribution.findFirst({ where: { id, goal: { userId: ctx.userId } } });
  if (!c) throw new DomainError("Movimentação não encontrada.");
  // Apagar um depósito não pode deixar a meta negativa.
  if (c.amountCents > 0 && (await savedOf(ctx, c.goalId)) - c.amountCents < 0) {
    throw new DomainError("Apagar esse depósito deixaria a meta negativa. Apague a retirada antes.");
  }
  await ctx.db.goalContribution.delete({ where: { id } });
}
