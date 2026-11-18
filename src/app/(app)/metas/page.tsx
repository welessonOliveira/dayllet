import { type GoalDetailItem, GoalsClient } from "@/components/GoalsClient";
import { getGoal, listGoals } from "@/server/goals";
import { getPageCtx } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function MetasPage() {
  const ctx = await getPageCtx();
  const list = await listGoals(ctx, { includeArchived: true });
  const detailed = await Promise.all(list.map((g) => getGoal(ctx, g.id)));
  const goals = detailed.filter((g): g is GoalDetailItem => g !== null);

  return <GoalsClient goals={goals} />;
}
